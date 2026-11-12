using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Npgsql;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Enum;
using Parking.ServiceDefaults;

namespace Parking.Identity.Api.Controllers;

[ApiController,Route("api/v1/auth/guest"),EnableRateLimiting("auth-rate-limit")]
public sealed class GuestOtpController(NpgsqlDataSource db,IOtpService otp,IEmailService mail,IAccountRepository accounts,IAccessTokenService tokens,IMfaVerifier mfa):ControllerBase
{
 public sealed record SendRequest(string Email);
 public sealed record VerifyRequest(string Email,string Code,string? MfaCode);
 private static string Email(string value){if(string.IsNullOrWhiteSpace(value)||value.Length>254||!System.Net.Mail.MailAddress.TryCreate(value.Trim(),out var address)||address.Address!=value.Trim())throw new AppException(ErrorCode.InvalidEmail,"Invalid email");return value.Trim().ToUpperInvariant();}
 [HttpPost("request-otp")]
 public async Task<IResult> Send(SendRequest request,CancellationToken ct)
 {
  var email=Email(request.Email);var code=otp.GenerateOtp();var hash=otp.HashOtp("guest:"+email+":"+code);
  await using var cmd=db.CreateCommand("""
   INSERT INTO guest_login_challenges(email,otp_hash,expires_at,sent_at) VALUES(@email,@hash,now()+interval '5 minutes',now())
   ON CONFLICT(email) DO UPDATE SET otp_hash=EXCLUDED.otp_hash,expires_at=EXCLUDED.expires_at,sent_at=now(),consumed_at=NULL,
    failures=CASE WHEN guest_login_challenges.locked_until<=now() THEN 0 ELSE guest_login_challenges.failures END,locked_until=NULL
   WHERE guest_login_challenges.sent_at<now()-interval '60 seconds' AND (guest_login_challenges.locked_until IS NULL OR guest_login_challenges.locked_until<=now())
   """);cmd.Parameters.AddWithValue("email",email);cmd.Parameters.AddWithValue("hash",hash);
  if(await cmd.ExecuteNonQueryAsync(ct)>0){try{await mail.SendSignInOtpAsync(email,code,ct);}catch{await using var invalidate=db.CreateCommand("DELETE FROM guest_login_challenges WHERE email=@email AND otp_hash=@hash");invalidate.Parameters.AddWithValue("email",email);invalidate.Parameters.AddWithValue("hash",hash);await invalidate.ExecuteNonQueryAsync(CancellationToken.None);throw;}}
  return Responses.Ok(new{message="Nếu yêu cầu hợp lệ, mã đã được gửi. Đợi ít nhất 60 giây trước khi gửi lại."});
 }
 [HttpPost("verify")]
 public async Task<IResult> Verify(VerifyRequest request,CancellationToken ct)
 {
  var email=Email(request.Email);await using var conn=await db.OpenConnectionAsync(ct);await using var tx=await conn.BeginTransactionAsync(ct);
  string hash;
  await using(var read=new NpgsqlCommand("SELECT otp_hash FROM guest_login_challenges WHERE email=@email AND expires_at>now() AND consumed_at IS NULL AND (locked_until IS NULL OR locked_until<=now()) FOR UPDATE",conn,tx))
  {read.Parameters.AddWithValue("email",email);hash=await read.ExecuteScalarAsync(ct) as string??throw new AppException(ErrorCode.OtpInvalid,"Code expired, consumed or temporarily locked");}
  if(string.IsNullOrEmpty(request.Code)||request.Code.Length!=6||request.Code.Any(c=>c<'0'||c>'9')||!otp.VerifyOtp("guest:"+email+":"+request.Code,hash))
  {
   await using var fail=new NpgsqlCommand("UPDATE guest_login_challenges SET failures=failures+1,locked_until=CASE WHEN failures+1>=3 THEN now()+interval '15 minutes' ELSE NULL END WHERE email=@email",conn,tx);fail.Parameters.AddWithValue("email",email);await fail.ExecuteNonQueryAsync(ct);await tx.CommitAsync(ct);throw new AppException(ErrorCode.OtpInvalid,"Incorrect OTP");
  }
  var user=Guid.NewGuid();
  await using(var create=new NpgsqlCommand("""
   INSERT INTO app_users(id,email_normalized,full_name,email_verified_at,status) VALUES(@id,@email,'Khách hàng',now(),'ACTIVE') ON CONFLICT(email_normalized) DO NOTHING;
   SELECT id FROM app_users WHERE email_normalized=@email AND status='ACTIVE' AND (locked_until IS NULL OR locked_until<=now())
   """,conn,tx))
  {create.Parameters.AddWithValue("id",user);create.Parameters.AddWithValue("email",email);user=await create.ExecuteScalarAsync(ct) is Guid id?id:throw new AppException(ErrorCode.AccountLocked,"Account is unavailable");}
  await using(var roles=new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM platform_user_roles WHERE user_id=@user AND role_code<>'CUSTOMER') OR EXISTS(SELECT 1 FROM lot_staff_assignments WHERE user_id=@user AND revoked_at IS NULL)",conn,tx))
  {roles.Parameters.AddWithValue("user",user);if((bool)(await roles.ExecuteScalarAsync(ct))!)throw new AppException(ErrorCode.InvalidCredentials,"Staff accounts must use staff sign-in");}
  await mfa.RequireAsync(user,request.MfaCode,ct);
  await using(var finish=new NpgsqlCommand("""
   INSERT INTO platform_user_roles(user_id,role_code) VALUES(@user,'CUSTOMER') ON CONFLICT DO NOTHING;
   INSERT INTO user_memberships(user_id,tier_code) VALUES(@user,'STANDARD') ON CONFLICT DO NOTHING;
   UPDATE app_users SET email_verified_at=coalesce(email_verified_at,now()) WHERE id=@user;
   UPDATE guest_login_challenges SET consumed_at=now(),failures=0 WHERE email=@email;
   """,conn,tx))
  {finish.Parameters.AddWithValue("user",user);finish.Parameters.AddWithValue("email",email);await finish.ExecuteNonQueryAsync(ct);}
  await tx.CommitAsync(ct);
  var account=await accounts.GetUserByEmail(email)??throw new InvalidOperationException("Account missing");
  var refresh=tokens.GenerateRefreshToken();await using var token=db.CreateCommand("INSERT INTO auth_tokens(id,user_id,token_hash,family_id,purpose,expires_at) VALUES(gen_random_uuid(),@user,@hash,gen_random_uuid(),'RefreshToken',now()+interval '7 days')");
  token.Parameters.AddWithValue("user",user);token.Parameters.AddWithValue("hash",tokens.HashToken(refresh));await token.ExecuteNonQueryAsync(ct);
  return Responses.Ok(new{accessToken=tokens.GenerateAccessToken(account),refreshToken=refresh});
 }
}
