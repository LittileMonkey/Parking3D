using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.JsonWebTokens;
using Parking.Identity.Application.Common.Constants;
using Parking.Identity.Application.DTOs;
using Parking.Identity.Application.DTOs.Response;
using Parking.Identity.Application.UseCase.LotStaffAssignment.AddAssignment;
using Parking.Identity.Application.UseCase.StaffAssignment.GetAssignment;
using Parking.Identity.Application.UseCase.StaffAssignment.RevokeAssignment;
using System.Security.Claims;

namespace Parking.Identity.Api.Controllers
{
    [ApiController]
    [Route("api/v1/staff-assignments")]
    public class LotStaffAssignmentsController : Controller
    {
        private readonly ISender sender;
        public LotStaffAssignmentsController(ISender sender)
        {
            this.sender = sender;
        }
        [HttpGet("me")]
        [Authorize(Roles = AppUserRoles.Staff)]
        public async Task<IActionResult> GetMyAssignments(CancellationToken cancellationToken)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

            if (!Guid.TryParse(userId, out var guid))
            {
                return Unauthorized();
            }

            var query = new GetMyLotAssignmentsQuery
            {
                userId = guid
            };

            var result = await sender.Send(query, cancellationToken);
            var response = ApiResponse<IReadOnlyList<LotsAssignmentDto>>.Success(result, "Get Your Assignment Successfully!!", 200);

            return Ok(response);
        }
        [HttpPost]
        [Authorize(Roles = "ADMIN,PARKING_MANAGER")]
        public async Task<IActionResult> AddStaffAssignment(AddAssignmentCommand command, CancellationToken cancellationToken)
        {
            var result = await sender.Send(command, cancellationToken);

            var response = ApiResponse<LotsAssignmentDto>.Success(result, "Add Assignment Successfully!!!", 200);

            return Ok(response);
        }

        [HttpPost("{assignmentId:guid}/revoke")]
        [Authorize(Roles = "ADMIN,PARKING_MANAGER")]
        public async Task<IActionResult> RevokeAssignment(Guid assignmentId, CancellationToken cancellationToken)
        {
            var userIdValue =
                User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (!Guid.TryParse(userIdValue, out var actorId))
            {
                return Unauthorized(
                    ApiResponse<object>.Failure(
                        "Invalid user identity.",
                        StatusCodes.Status401Unauthorized
                    )
                );
            }

            var command = new RevokeLotStaffAssignmentCommand(
                assignmentId,
                actorId
            );

            var result = await sender.Send(command, cancellationToken);

            return result switch
            {
                RevokeAssignmentResult.Success =>
                    Ok(ApiResponse<object>.Success(null, "Staff assignment revoked successfully.",StatusCodes.Status200OK)
                    ),

                RevokeAssignmentResult.NotFound =>
                    NotFound(ApiResponse<object>.Failure( "Assignment not found.", StatusCodes.Status404NotFound)),

                RevokeAssignmentResult.Forbidden =>
                    StatusCode(
                        StatusCodes.Status403Forbidden,
                        ApiResponse<object>.Failure("You do not have permission to revoke this assignment.",StatusCodes.Status403Forbidden)
                    ),

                RevokeAssignmentResult.AlreadyRevoked =>
                    Conflict(ApiResponse<object>.Failure(
                        "Assignment has already been revoked.",
                        StatusCodes.Status409Conflict)
                    ),

                RevokeAssignmentResult.InvalidTarget =>
                    BadRequest(
                        ApiResponse<object>.Failure("Only staff assignments can be revoked.",StatusCodes.Status400BadRequest)),

                _ => StatusCode( 
                    StatusCodes.Status500InternalServerError,
                    ApiResponse<object>.Failure( "An unexpected error occurred.", StatusCodes.Status500InternalServerError)
                )
            };
        }
    }
}
