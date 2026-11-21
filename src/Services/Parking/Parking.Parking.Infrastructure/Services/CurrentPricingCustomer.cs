using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Parking.Parking.Application.Interfaces;

namespace Parking.Parking.Infrastructure.Services;

public sealed class CurrentPricingCustomer(IHttpContextAccessor context) : ICurrentPricingCustomer
{
    public Guid? UserId
    {
        get
        {
            var user = context.HttpContext?.User;
            if (user?.Identity?.IsAuthenticated != true) return null;
            var subject = user.FindFirst("sub")?.Value ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(subject, out var id) && id != Guid.Empty ? id : null;
        }
    }
}
