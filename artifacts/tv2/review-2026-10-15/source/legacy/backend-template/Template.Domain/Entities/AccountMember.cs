using System;
using System.Collections.Generic;

namespace Template.Domain.Entities;

public partial class AccountMember
{
    public string MemberId { get; set; } = null!;

    public string MemberPassword { get; set; } = null!;

    public string FullName { get; set; } = null!;

    public string? EmailAddress { get; set; }

    public string MemberRole { get; set; } = null!;

    public DateOnly? Dob { get; set; }

    public string? Status { get; set; }

    public AccountMember() { }

    public AccountMember(string fullName, string emailAddress, string memberPassword, string memberRole, string? status, DateOnly? dob)
    {
        MemberId = Guid.NewGuid().ToString();
        FullName = fullName;
        EmailAddress = emailAddress;
        MemberPassword = memberPassword;
        Dob = dob;
        MemberRole = memberRole;
        Status = status ?? "Active";
    }

    public void UpdateMember(string fullName, string emailAddress, string memberPassword, DateOnly? dob)
    {
        FullName = fullName;
        EmailAddress = emailAddress;
        MemberPassword = memberPassword;
        Dob = dob;
    }
}
