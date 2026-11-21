namespace Parking.Parking.Application.Interfaces;

/// <summary>Validated caller identity for a request-scoped price estimate.</summary>
public interface ICurrentPricingCustomer
{
    Guid? UserId { get; }
}
