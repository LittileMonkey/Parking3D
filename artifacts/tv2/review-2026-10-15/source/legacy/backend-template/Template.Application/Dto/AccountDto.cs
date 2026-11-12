using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Template.Application.Dto
{
    public class AccountDto
    {
        public string MemberId { get; set; } = null!;

        public string MemberPassword { get; set; } = null!;

        public string FullName { get; set; } = null!;

        public string? EmailAddress { get; set; }

        public string MemberRole { get; set; } = null!;
        public string? Status { get; set; }

        public DateOnly? Dob { get; set; }
    }
}
