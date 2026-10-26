using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.DTOs;
using Parking.Identity.Application.DTOs.Response;
using Parking.Identity.Application.UseCase.UserVehicleUseCase.CreateUserVehicle;
using Parking.Identity.Application.UseCase.UserVehicleUseCase.DeleteUserVehicle;
using Parking.Identity.Application.UseCase.UserVehicleUseCase.GetUserVehicle;
using Parking.Identity.Application.UseCase.UserVehicleUseCase.GetUserVehicles;
using Parking.Identity.Application.UseCase.UserVehicleUseCase.UpdateUserVehicle;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Parking.Identity.Api.Controllers
{
    [ApiController]
    [Route("api/v1/user-vehicles")]
    [EnableRateLimiting("general-rate-limit")]
    public class UserVehiclesController : Controller
    {
        private readonly ISender sender;
        public UserVehiclesController(ISender sender)
        {
            this.sender = sender;
        }
        private Guid GetCurrentUserId()
        {
            var userId = User.FindFirst(JwtRegisteredClaimNames.Sub) ?? User.FindFirst(ClaimTypes.NameIdentifier);

            if (userId == null || !Guid.TryParse(userId.Value, out var guid))
            {
                throw new AppException(ErrorCode.Unauthorized, "The current user's ID is missing or invalid.");
            }
            return guid;
        }
        // POST: api/v1/user-vehicles
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> CreateUserVehicle(CreateVehicleCommand command, CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();

            command.UserId = userId;

            var result = await sender.Send(command, cancellationToken);

            var response = ApiResponse<UserVehicleDto>.Success(result, "Create Vehicle Successfully", StatusCodes.Status200OK);

            return Ok(response);
        }
        // GET: api/v1/user-vehicles
        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetUserVehicles(CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();

            var query = new GetUserVehiclesQuery
            {
                UserId = userId
            };

            var result = await sender.Send(query, cancellationToken);

            var response = ApiResponse<List<UserVehicleDto>>.Success(result, "Get All Of Vehicle Successfully", StatusCodes.Status200OK);
            return Ok(response);
        }
        // GET: api/v1/user-vehicles/{vehicleId}
        [HttpGet("{vehicleId:guid}")]
        [Authorize]
        public async Task<IActionResult> GetUserVehicleById(Guid vehicleId, CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();

            var query = new GetUserVehicleByIdQuery
            {
                UserId = userId,
                VehicleId = vehicleId
            };

            var result = await sender.Send(query, cancellationToken);

            var response = ApiResponse<UserVehicleDto>.Success(result, "Get Vehicle Successfully", StatusCodes.Status200OK);
            return Ok(response);
        }
        // PUT: api/v1/user-vehicles/{vehicleId}
        [HttpPut("{vehicleId:guid}")]
        [Authorize]
        public async Task<IActionResult> UpdateUserVehicle(Guid vehicleId, UpdateUserVehicleCommand command, CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();

            command.UserId = userId;
            command.VehicleId = vehicleId;

            var result = await sender.Send(command, cancellationToken);

            var response = ApiResponse<UserVehicleDto>.Success(
                result,
                "Update vehicle successfully.",
                StatusCodes.Status200OK);

            return Ok(response);
        }

        // DELETE: api/v1/user-vehicles/{vehicleId}
        [HttpDelete("{vehicleId:guid}")]
        [Authorize]
        public async Task<IActionResult> DeleteUserVehicle(Guid vehicleId, CancellationToken cancellationToken)
        {
            var command = new DeleteUserVehicleCommand
            {
                UserId = GetCurrentUserId(),
                VehicleId = vehicleId
            };

            await sender.Send(command, cancellationToken);

            var response = ApiResponse<object>.Success(null, "Delete vehicle successfully.", StatusCodes.Status200OK);

            return Ok(response);
        }
    }
}
