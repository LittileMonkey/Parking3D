
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.JsonWebTokens;
using Parking.Identity.Application.DTOs;
using Parking.Identity.Application.DTOs.Response;
using Parking.Identity.Application.UseCase.Account.GetAccountById;
using System.Security.Claims;

namespace Parking.Identity.Api.Controllers
{
    [ApiController]
    [Route("api/v1/account")]
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
                return Unauthorized(ApiResponse<object>.Failure( "Invalid user identity.",StatusCodes.Status401Unauthorized));
            }

            var query = new GetAccountByIdQuery
            {
                Id = guid
            };
            var result = await sender.Send(query, cancellationToken);

            var response = ApiResponse<AppUserDto?>.Success(result, "Get Your Information Successfully!!!", 200);

            return Ok(response);
        }
    }
}
