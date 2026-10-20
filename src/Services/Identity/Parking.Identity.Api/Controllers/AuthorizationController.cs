using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Parking.Identity.Application.Common.Constants;
using Parking.Identity.Application.DTOs;
using Parking.Identity.Application.DTOs.Response;
using Parking.Identity.Application.UseCase.Authorization.UpdateAuthorization;

namespace Parking.Identity.Api.Controllers
{
    [ApiController]
    [Route("api/v1/author")]
    public class AuthorizationController : Controller
    {
        private readonly ISender sender;
       
        public AuthorizationController(ISender sender)
        {
            this.sender = sender;
        }
        [HttpPost("update-role")]
        public async Task<IActionResult> UpdateRole(UpdateAuthorizationStaffCommand command, CancellationToken cancellationToken)
        {
            var result = await sender.Send(command, cancellationToken);

            var response = ApiResponse<AppUserDto>.Success(result, "Update Role Successfully!!!", 200);

            return Ok(response);
        }
    }
}
