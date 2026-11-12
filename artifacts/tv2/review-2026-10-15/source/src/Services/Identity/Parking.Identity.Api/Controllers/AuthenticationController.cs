using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Parking.Identity.Application.DTOs;
using Parking.Identity.Application.DTOs.Response;
using Parking.Identity.Application.UseCase.Account.CreateAccount;
using Parking.Identity.Application.UseCase.Authentication.GoogleLogin;
using Parking.Identity.Application.UseCase.Authentication.Login;
using Parking.Identity.Application.UseCase.Authentication.Logout;

namespace Parking.Identity.Api.Controllers
{
    [ApiController]
    [Route("api/v1/auth")]
    public class AuthenticationController : Controller
    {
        private readonly ISender sender;
        public AuthenticationController(ISender sender)
        {
            this.sender = sender;
        }
        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login(LoginCommand command, CancellationToken cancellationToken)
        {
            var result = await sender.Send(command, cancellationToken);

            var response = ApiResponse<AuthenticationResponseDto>.Success(result, "Login Successfully!!!", 200);

            return Ok(response);
        }

        [HttpPost("logout")]
        [Authorize]
        public async Task<IActionResult> logout([FromBody] LogoutCommand command, CancellationToken cancellationToken)
        {
            await sender.Send(command, cancellationToken);
            var response = ApiResponse<Object>.Success(null, "Logout Successfully!!!", 200);
            return Ok(response);
        }

        [HttpPost("register")]
        [AllowAnonymous]
        public async Task<IActionResult> Register(CreateAccountCommand command, CancellationToken cancellation)
        {
            var result = await sender.Send(command, cancellation);

            var response = ApiResponse<AppUserDto>.Success(result, "Register Successfully", 200);

            return Ok(response);
        }

        [HttpPost("google")]
        [AllowAnonymous]
        public async Task<IActionResult> LoginByGoogle(GoogleLoginCommand command, CancellationToken cancellationToken)
        {
            var result = await sender.Send(command, cancellationToken);

            var response = ApiResponse<GoogleLoginResult>.Success(result, "Login Successfully", 200);

            return Ok(response);

        }

    }
}
