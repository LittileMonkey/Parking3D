using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Parking.Identity.Persistence;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Enum;
using Parking.ServiceDefaults;
namespace Parking.Identity.Api.Controllers;

[ApiController,Route("api/v1/auth/mfa"),Authorize,EnableRateLimiting("auth-rate-limit")]
public sealed class MfaController(MfaService mfa,IAccountRepository accounts,IPasswordHasherService passwords):ControllerBase
{
 public sealed record PasswordRequest(string Password);
 public sealed record VerifyRequest(string Password,string Code);
 private async Task<string> CheckPassword(string password)
 {
  var account=await accounts.GetUserByIdAsync(User.Subject(),HttpContext.RequestAborted);
  if(account is null||account.Status!="ACTIVE"||account.LockedUntil>DateTime.UtcNow||string.IsNullOrEmpty(account.PasswordHash)||string.IsNullOrWhiteSpace(password)||!passwords.VerifiedPassword(account,password,account.PasswordHash))throw new AppException(ErrorCode.InvalidCredentials,"Current password is required");
  return account.EmailNormalized??account.Id.ToString();
 }
 [HttpGet]public async Task<IResult> Status(CancellationToken ct)=>Responses.Ok(new{enabled=await mfa.EnabledAsync(User.Subject(),ct)});
 [HttpPost("setup")]public async Task<IResult> Setup(PasswordRequest request,CancellationToken ct)=>Responses.Ok(await mfa.SetupAsync(User.Subject(),await CheckPassword(request.Password),ct));
 [HttpPost("enable")]public async Task<IResult> Enable(VerifyRequest request,CancellationToken ct){await CheckPassword(request.Password);await mfa.VerifyAsync(User.Subject(),request.Code,"ENABLE",ct);return Responses.Ok(new{enabled=true});}
 [HttpPost("disable")]public async Task<IResult> Disable(VerifyRequest request,CancellationToken ct){await CheckPassword(request.Password);await mfa.VerifyAsync(User.Subject(),request.Code,"DISABLE",ct);return Responses.Ok(new{enabled=false});}
}
