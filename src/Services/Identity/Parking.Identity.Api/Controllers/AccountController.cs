using Parking.Identity.Application.DTOs;
using Parking.Identity.Application.DTOs.Response;
using Parking.Identity.Application.UseCase.Account.CreateAccount;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Parking.Identity.Api.Controllers
{
    [ApiController]
    [Route("api/account")]
    public class AccountController : Controller
    {
        private readonly ISender sender;
        public AccountController(ISender sender)
        {
            this.sender = sender;
        }
        [HttpPost("register")]
        [AllowAnonymous]
        public async Task<IActionResult> Register(CreateAccountCommand command, CancellationToken cancellation)
        {
            var result = await sender.Send(command, cancellation);

            var response = ApiResponse<AppUserDto>.Success(result,"Register Successfully",200);

            return Ok(response);
        }
    }
}
