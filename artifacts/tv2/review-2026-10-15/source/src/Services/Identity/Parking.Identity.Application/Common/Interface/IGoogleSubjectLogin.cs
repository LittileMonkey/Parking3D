using Parking.Identity.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.Common.Interface
{
    public interface IGoogleSubjectLogin
    {
        Task<AppUser> GetByGoogleSubject(string googleSubject, CancellationToken cancellationToken);
    }
}
