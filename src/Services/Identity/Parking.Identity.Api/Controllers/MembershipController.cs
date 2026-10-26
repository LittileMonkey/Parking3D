using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Constants;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.DTOs;
using Parking.Identity.Application.DTOs.Response;
using Parking.Identity.Application.UseCase.Membership.GetMyMembership;
using Parking.Identity.Application.UseCase.Membership.UpdateMemberShip;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Parking.Identity.Api.Controllers
{
    [ApiController]
    [Route("api/v1/membership")]
    [EnableRateLimiting("general-rate-limit")]
    public class MembershipController : Controller
    {
        private readonly ISender sender;
        public MembershipController(ISender sender)
        {
            this.sender = sender;
        }
        private Guid GetCurrentUserId()
        {
            var userId = User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(userId, out var guid))
            {
                throw new AppException(ErrorCode.Unauthorized, "The current user's ID is missing or invalid.");
            }
            return guid;
        }
        [HttpGet("me")]
        [Authorize]
        public async Task<IActionResult> GetMyMembership(CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();

            var query = new GetMyMembershipQuery
            {
                UserId = userId
            };

            var result = await sender.Send(query, cancellationToken);

            var response = ApiResponse<MemberShipDto>.Success(result, "Get Your MemberShip Successfully!!!", StatusCodes.Status200OK);
            return Ok(response);
        }
        [HttpPut("{userId:guid}")]
        [Authorize(Roles = AppUserRoles.Admin)]
        public async Task<IActionResult> UpdateMembership([FromRoute] Guid userId, [FromBody] UpdateMembershipCommand command, CancellationToken cancellationToken)
        {
            command.UserId = userId;

            var result = await sender.Send(command, cancellationToken);

            var response = ApiResponse<MemberShipDto>.Success(result, $"Update Membership Successfully !!!", StatusCodes.Status200OK);
            return Ok(response);
        }
    }
}
