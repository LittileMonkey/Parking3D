namespace Parking.Identity.Domain.Entities
{
    public class UserMembership
    {
        public Guid UserId { get; set; }

        public string TierCode { get; set; } = "STANDARD";

        public DateTime UpdatedAt { get; set; }

        public virtual AppUser User { get; set; } = null!;
    }
}
