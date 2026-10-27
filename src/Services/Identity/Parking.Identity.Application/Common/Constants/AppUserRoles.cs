namespace Parking.Identity.Application.Common.Constants
{
    public static class AppUserRoles
    {
        public const string Admin = "ADMIN";
        public const string Manager = "PARKING_MANAGER";
        public const string Staff = "PARKING_STAFF";
        public const string Customer = "CUSTOMER";

        public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            Admin,Manager,Staff,Customer
        };
    }
}
