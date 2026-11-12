using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Enum;

namespace Parking.Identity.Persistence;

public sealed class MfaService(NpgsqlDataSource db,IConfiguration config) : IMfaVerifier
{
 private static AppException Invalid(string message)=>new(ErrorCode.InvalidCredentials,message);
 private byte[] Key() {var value=config["Mfa:EncryptionKey"]??"";if(value.Length!=64)throw new InvalidOperationException("Mfa:EncryptionKey must be 64 hex characters");return Convert.FromHexString(value);}
 private byte[] Encrypt(byte[] secret) {var nonce=RandomNumberGenerator.GetBytes(12);var tag=new byte[16];var data=new byte[secret.Length];using var aes=new AesGcm(Key(),16);aes.Encrypt(nonce,secret,data,tag);return nonce.Concat(tag).Concat(data).ToArray();}
 private byte[] Decrypt(byte[] blob) {var result=new byte[blob.Length-28];using var aes=new AesGcm(Key(),16);aes.Decrypt(blob.AsSpan(0,12),blob.AsSpan(28),blob.AsSpan(12,16),result);return result;}
 private static string Base32(byte[] bytes) {const string chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";var output=new StringBuilder();int buffer=0,bits=0;foreach(var b in bytes){buffer=(buffer<<8)|b;bits+=8;while(bits>=5){bits-=5;output.Append(chars[(buffer>>bits)&31]);}}if(bits>0)output.Append(chars[(buffer<<(5-bits))&31]);return output.ToString();}
 private static string Code(byte[] key,long step){Span<byte> bytes=stackalloc byte[8];BinaryPrimitives.WriteInt64BigEndian(bytes,step);var hash=HMACSHA1.HashData(key,bytes);int offset=hash[^1]&15;int value=BinaryPrimitives.ReadInt32BigEndian(hash.AsSpan(offset,4))&0x7fffffff;return (value%1000000).ToString("D6",System.Globalization.CultureInfo.InvariantCulture);}
 public async Task<bool> EnabledAsync(Guid user,CancellationToken ct){await using var cmd=db.CreateCommand("SELECT coalesce((SELECT enabled FROM user_mfa WHERE user_id=@user),false)");cmd.Parameters.AddWithValue("user",user);return (bool)(await cmd.ExecuteScalarAsync(ct))!;}
 public async Task<object> SetupAsync(Guid user,string email,CancellationToken ct)
 {
  var secret=RandomNumberGenerator.GetBytes(20);var cipher=Encrypt(secret);
  await using var cmd=db.CreateCommand("""
   INSERT INTO user_mfa(user_id,secret_cipher,setup_expires_at) VALUES(@user,@cipher,now()+interval '10 minutes')
   ON CONFLICT(user_id) DO UPDATE SET secret_cipher=EXCLUDED.secret_cipher,setup_expires_at=EXCLUDED.setup_expires_at,last_step=-1
     WHERE NOT user_mfa.enabled AND (user_mfa.locked_until IS NULL OR user_mfa.locked_until<=now())
   """);cmd.Parameters.AddWithValue("user",user);cmd.Parameters.AddWithValue("cipher",cipher);
  if(await cmd.ExecuteNonQueryAsync(ct)==0)throw Invalid("MFA already enabled or temporarily locked");
  var encoded=Base32(secret);return new{secret=encoded,uri=$"otpauth://totp/{Uri.EscapeDataString("Parking:"+email)}?secret={encoded}&issuer=Parking&algorithm=SHA1&digits=6&period=30"};
 }
 public Task RequireAsync(Guid userId,string? code,CancellationToken ct)=>VerifyAsync(userId,code,"LOGIN",ct);
 public async Task VerifyAsync(Guid user,string? code,string action,CancellationToken ct)
 {
  await using var conn=await db.OpenConnectionAsync(ct);await using var tx=await conn.BeginTransactionAsync(ct);
  byte[] cipher;bool enabled;long last;DateTime expires;DateTime? locked;
  await using(var read=new NpgsqlCommand("SELECT secret_cipher,enabled,last_step,setup_expires_at,locked_until FROM user_mfa WHERE user_id=@user FOR UPDATE",conn,tx))
  {read.Parameters.AddWithValue("user",user);await using var r=await read.ExecuteReaderAsync(ct);if(!await r.ReadAsync(ct)){if(action=="LOGIN")return;throw Invalid("Set up MFA first");}cipher=(byte[])r[0];enabled=r.GetBoolean(1);last=r.GetInt64(2);expires=r.GetDateTime(3);locked=r.IsDBNull(4)?null:r.GetDateTime(4);}
  if(action=="LOGIN"&&!enabled)return;
  if(locked>DateTime.UtcNow)throw Invalid("MFA locked for 15 minutes");
  if(action=="ENABLE"&&(enabled||expires<=DateTime.UtcNow))throw Invalid("MFA setup expired or already enabled");
  if(string.IsNullOrWhiteSpace(code))throw Invalid("MFA_REQUIRED: Nhập mã 6 số từ ứng dụng xác thực.");
  var step=DateTimeOffset.UtcNow.ToUnixTimeSeconds()/30;long accepted=-1;var secret=Decrypt(cipher);
  if(code.Length==6&&code.All(char.IsAsciiDigit))for(long at=step-1;at<=step+1;at++)if(at>last&&CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(Code(secret,at)),Encoding.ASCII.GetBytes(code)))accepted=at;
  if(accepted<0)
  {
   await using var fail=new NpgsqlCommand("UPDATE user_mfa SET failures=failures+1,locked_until=CASE WHEN failures+1>=3 THEN now()+interval '15 minutes' ELSE NULL END WHERE user_id=@user",conn,tx);fail.Parameters.AddWithValue("user",user);await fail.ExecuteNonQueryAsync(ct);await tx.CommitAsync(ct);throw Invalid("MFA code invalid or already used");
  }
  await using(var write=new NpgsqlCommand(action=="DISABLE"?"DELETE FROM user_mfa WHERE user_id=@user":"UPDATE user_mfa SET enabled=true,last_step=@step,failures=0,locked_until=NULL WHERE user_id=@user",conn,tx))
  {write.Parameters.AddWithValue("user",user);if(action!="DISABLE")write.Parameters.AddWithValue("step",accepted);await write.ExecuteNonQueryAsync(ct);}
  if(action!="LOGIN") {await using var revoke=new NpgsqlCommand("UPDATE auth_tokens SET revoked_at=now() WHERE user_id=@user AND revoked_at IS NULL",conn,tx);revoke.Parameters.AddWithValue("user",user);await revoke.ExecuteNonQueryAsync(ct);}
  await tx.CommitAsync(ct);
 }
}
