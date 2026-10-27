
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.JsonWebTokens;
using Parking.Identity.Application.Common.Constants;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.DTOs;
using Parking.Identity.Application.DTOs.Response;
using Parking.Identity.Application.UseCase.Account.GetAccountByEmail;
using Parking.Identity.Application.UseCase.Account.GetAccountById;
using Parking.Identity.Application.UseCase.Account.GetAllAccount;
using Parking.Identity.Application.UseCase.Account.UpdateAccount;
using Parking.Identity.Application.UseCase.Authentication.ChangePassword;
using System.Security.Claims;

namespace Parking.Identity.Api.Controllers
{
    [ApiController]
    [Route("api/v1/account")]
    [EnableRateLimiting("general-rate-limit")]
    public class AccountController : Controller
    {
        private readonly ISender sender;
        public AccountController(ISender sender)
        {
            this.sender = sender;
        }
        [HttpGet("information")]
        [Authorize]
        public async Task<IActionResult> GetInfor(CancellationToken cancellationToken)
        {
            var userId = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if(!Guid.TryParse(userId , out var guid))
            {
                return Unauthorized(ApiResponse<object>.Failure( "Invalid user identity.",StatusCodes.Status401Unauthorized, ErrorCode.InvalidAccount));
            }

            var query = new GetAccountByIdQuery
            {
                Id = guid
            };
            var result = await sender.Send(query, cancellationToken);

            var response = ApiResponse<AppUserDto?>.Success(result, "Get Your Information Successfully!!!", StatusCodes.Status200OK);

            return Ok(response);
        }

        [HttpPost("change-password")]
        [Authorize]
        public async Task<IActionResult> ChangePassword(ChangePasswordCommand command, CancellationToken cancellationToken)
        {
            var userId = User.FindFirst(JwtRegisteredClaimNames.Sub) ?? User.FindFirst(ClaimTypes.NameIdentifier);

            if(userId == null || !Guid.TryParse(userId.Value, out var guidId))
            {
                return Unauthorized(ApiResponse<object>.Failure("Invalid user identity.", StatusCodes.Status401Unauthorized, ErrorCode.InvalidAccount));
            }

            command.Id = guidId;

            var result = await sender.Send(command, cancellationToken);

            var response = ApiResponse<bool>.Success(result, "Change Password Successfully!!!", StatusCodes.Status200OK);

            return Ok(response);
        }

        [HttpPost("update-information")]
        [Authorize]
        public async Task<IActionResult> UpdateAccountInformation(UpdateAccountCommand command, CancellationToken cancellationToken)
        {
            var userId = User.FindFirst(JwtRegisteredClaimNames.Sub) ?? User.FindFirst(ClaimTypes.NameIdentifier);

            if (userId == null || !Guid.TryParse(userId.Value, out var guidId))
            {
                return Unauthorized(ApiResponse<object>.Failure("Invalid user identity.", StatusCodes.Status401Unauthorized, ErrorCode.InvalidAccount));
            }

            command.Id = guidId;

            var result = await sender.Send(command, cancellationToken);
            var response = ApiResponse<AppUserDto>.Success(result, "Update Successfully!!!", StatusCodes.Status200OK);

            return Ok(response);
        }

        [HttpGet]
        [Authorize(Roles = AppUserRoles.Admin)]
        public async Task<IActionResult> GetAllAccounts(CancellationToken cancellationToken)
        {
            var query = new GetAllAccountQuery();
            var result = await sender.Send(query, cancellationToken);
            var response = ApiResponse<IEnumerable<AppUserDto>>.Success(result, "Get all accounts successfully.", StatusCodes.Status200OK);

            return Ok(response);
        }

        [HttpGet("by-email")]
        [Authorize(Roles = AppUserRoles.Admin)]
        public async Task<IActionResult> GetAccountByEmail([FromQuery] string email, CancellationToken cancellationToken)
        {
            var query = new GetAccountByEmailQuery
            {
                emailNormalized = email
            };
            var result = await sender.Send(query, cancellationToken);
            var response = ApiResponse<AppUserDto>.Success(result, "Get account by email successfully.", StatusCodes.Status200OK);

            return Ok(response);
        }
    }
}
