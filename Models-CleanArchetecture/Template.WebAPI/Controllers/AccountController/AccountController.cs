using MediatR;
using Microsoft.AspNetCore.Mvc;
using Template.Application.UseCase.Account;
using Template.Application.UseCase.DeleteAccount;
using Template.Application.UseCase.GetAccountById;
using Template.Application.UseCase.GetAllAccount;
using Template.Application.UseCase.UpdateAccount;
using Template.Domain.Entities;

namespace Template.WebAPI.Controllers.AccountController
{
    [ApiController]
    [Route("api/accounts")]
    public class AccountController : ControllerBase
    {
        private readonly ISender sender;

        public AccountController(ISender sender)
        {
            this.sender = sender;
        }

        [HttpPost]
        public async Task<IActionResult> CreateAccount([FromBody] CreateAccountCommand command,CancellationToken cancellationToken)
        {
            var createAccount = await sender.Send(command, cancellationToken);

            //return CreatedAtAction(
            //    nameof(GetAccountById),
            //    new { id = createAccount.MemberId },
            //    createAccount);

            return Ok(new
            {
                StatusCode = 200,
                Message = "Account created successfully",
                Result = createAccount
            });
        }
        public async Task<IActionResult> GetAllAccount()
        {
            var result = await sender.Send(new GetAllAccountQuery(), CancellationToken.None);
            return Ok(result);
        }
        [HttpGet("{id}")]
        public async Task<IActionResult> GetAccountById(string id)
        {

            var command = new GetAccountByIdQuery()
            {
                memberId = id
            };

            var result = await sender.Send(command, CancellationToken.None);

            if (result == null)
            {
                return NotFound();
            }
            return Ok(result);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateAccount(string id, [FromBody] UpdateAccountCommand command)
        {
            if(id != command.MemberId)
            {
                return BadRequest("ID in the URL does not match ID in the request body.");
            }
            var result = await sender.Send(command);

            if (result == null)
            {
                return NotFound();
            }
            return Ok(result);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAccount(string id)
        {
            var command = new DeleteAccountCommand()
            {
                MemberId = id
            };

            var result = await sender.Send(command);

            return NoContent();
        }
    }
}