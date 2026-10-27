using FluentValidation;

namespace Parking.Identity.Application.UseCase.Membership.UpdateMemberShip
{
    public class UpdateMembershipCommandValidator : AbstractValidator<UpdateMembershipCommand>
    {
        public UpdateMembershipCommandValidator()
        {
            RuleFor(x => x.UserId)
               .NotEmpty()
               .WithMessage("User ID is required.");

            RuleFor(x => x.TierCode)
                .NotEmpty()
                .WithMessage("Tier code is required.")
                .Must(tier => new[]
                {
                    "STANDARD",
                    "SILVER",
                    "GOLD_STAR"
                }.Contains(tier.Trim().ToUpperInvariant()))
                .WithMessage("Tier code is invalid.");
        }
    }
}
