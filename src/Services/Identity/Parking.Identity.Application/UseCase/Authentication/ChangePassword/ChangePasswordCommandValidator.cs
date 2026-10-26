using FluentValidation;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.UseCase.Authentication.ChangePassword
{
    public class ChangePasswordCommandValidator : AbstractValidator<ChangePasswordCommand>
    {
        public ChangePasswordCommandValidator()
        {
            RuleFor(x => x.Password)
                .NotEmpty()
                .WithMessage("Current password is required.")
                .Must(p => p == null || !p.Contains(' '))
                .WithMessage("Current password must not contain spaces.");

            RuleFor(x => x.NewPassword)
                .NotEmpty()
                .WithMessage("New password is required.")
                .MinimumLength(8)
                .WithMessage("New password must be at least 8 characters long.")
                .Must(p => !p.Contains(' '))
                .WithMessage("New password must not contain spaces.")
                .Matches("[A-Z]")
                .WithMessage("New password must contain at least one uppercase letter.");

            RuleFor(x => x.ConfirmPassword)
                .NotEmpty().WithMessage("Confirm password is required.")
                .Equal(x => x.NewPassword).WithMessage("The new password and confirmation password do not match.");
        }
    }
}
