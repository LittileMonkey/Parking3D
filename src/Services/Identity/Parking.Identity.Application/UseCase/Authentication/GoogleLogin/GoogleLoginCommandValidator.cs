using FluentValidation;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

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
