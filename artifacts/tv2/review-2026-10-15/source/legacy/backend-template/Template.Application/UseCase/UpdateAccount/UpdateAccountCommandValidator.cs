using FluentValidation;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Template.Application.UseCase.UpdateAccount
{
    public class UpdateAccountCommandValidator : AbstractValidator<UpdateAccountCommand>
    {
        public UpdateAccountCommandValidator()
        {
            RuleFor(x => x.MemberId).NotEmpty().WithMessage("MemberId is required.");
            RuleFor(x => x.FullName).NotEmpty().WithMessage("FullName is required.");
            RuleFor(x => x.EmailAddress).NotEmpty().WithMessage("EmailAddress is required.")
                                        .EmailAddress().WithMessage("EmailAddress must be a valid email address.");
            RuleFor(x => x.Dob).NotEmpty().WithMessage("Dob is required.");
            RuleFor(x => x.MemberPassword).NotEmpty().WithMessage("MemberPassword is required.")
                                          .MinimumLength(6).WithMessage("MemberPassword must be at least 6 characters long.");
        }
    }
}
