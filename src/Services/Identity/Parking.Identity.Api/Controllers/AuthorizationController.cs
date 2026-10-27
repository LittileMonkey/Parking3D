using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Parking.Identity.Application.Common.Constants;
using Parking.Identity.Application.DTOs;
using Parking.Identity.Application.DTOs.Response;
using Parking.Identity.Application.UseCase.Authorization.UpdateAuthorization;

namespace Parking.Identity.Api.Controllers
{
    [ApiController]
    [Route("api/v1/author")]
    [EnableRateLimiting("general-rate-limit")]
    public class AuthorizationController : Controller
    {
        private readonly ISender sender;
       
        public AuthorizationController(ISender sender)
        {
            this.sender = sender;
        }
        [HttpPost("update-role")]
        [Authorize(Roles = AppUserRoles.Admin)]
        public async Task<IActionResult> UpdateRole(UpdateAuthorizationStaffCommand command, CancellationToken cancellationToken)
        {
            var result = await sender.Send(command, cancellationToken);

            var response = ApiResponse<AppUserDto>.Success(result, "Update Role Successfully!!!", StatusCodes.Status200OK);

            return Ok(response);
        }
    }
}
