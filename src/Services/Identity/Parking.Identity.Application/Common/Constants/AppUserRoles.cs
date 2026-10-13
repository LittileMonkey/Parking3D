using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.Common.Constants
{
    public static class AppUserRoles
    {
        public const string Admin = "ADMIN";
        public const string Manager = "MANAGER";
        public const string Staff = "STAFF";
        public const string Customer = "CUSTOMER";

        public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            Admin,Manager,Staff,Customer
        };
    }
}
