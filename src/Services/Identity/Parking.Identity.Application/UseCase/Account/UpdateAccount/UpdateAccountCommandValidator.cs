using FluentValidation;

namespace Parking.Identity.Application.UseCase.Account.UpdateAccount
{
    public class UpdateAccountCommandValidator : AbstractValidator<UpdateAccountCommand>
    {
        public UpdateAccountCommandValidator()
        {
            RuleFor(x => x.EmailNormalized)
               .NotEmpty().WithMessage("Email is required")
               .MaximumLength(255)
               .WithMessage("Email must not exceed 255 characters.")
               .EmailAddress()
               .WithMessage("Invalid email format.")
               .Must(email => !email.Contains(' '))
               .WithMessage("Email must not contain spaces.");

            RuleFor(x => x.FullName).NotEmpty().WithMessage("Full name is required.")
                    .MaximumLength(100).WithMessage("Full name must not exceed 100 characters.");

            RuleFor(x => x.PhoneE164)
                    .NotEmpty().WithMessage("Phone number is required.")
                    .Matches(@"^\+[1-9]\d{7,14}$").WithMessage("Invalid phone number format.");
        }
    }
}
