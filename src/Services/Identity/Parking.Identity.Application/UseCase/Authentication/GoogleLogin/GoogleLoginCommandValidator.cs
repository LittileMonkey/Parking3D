using FluentValidation;

namespace Parking.Identity.Application.UseCase.Authentication.GoogleLogin
{
    public class GoogleLoginCommandValidator : AbstractValidator<GoogleLoginCommand>
    {
        public GoogleLoginCommandValidator()
        {
            RuleFor(x => x.IdToken)
                .NotEmpty()
                .WithMessage("Google ID Token is required.");
        }
    }
}
