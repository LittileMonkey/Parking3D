using Parking.Identity.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.Common.Interface
{
    public interface IPasswordHasherService
    {
        string HashPassword(AppUser appUser, string password);
        bool VerifiedPassword(AppUser appUser, string password, string passwordHash);
    }
}
