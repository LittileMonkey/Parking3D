using Microsoft.Extensions.Caching.Memory;
using Parking.Parking.Application.Interfaces;
using Parking.Parking.Domain;
using System.Text.Json;

namespace Parking.Parking.Infrastructure.Services;

public sealed class EstimatedPriceService(IParkingLotRepository repository, IMemoryCache cache) : IEstimatedPriceService
{
    public async Task<EstimatedPriceResult> CalculateEstimatedFeeAsync(Guid lotId, string vehicleType, DateTime startTime, int expectedDurationMinutes)
    {
        // Resolve at the requested effective time on every call. A lot-only 30-minute
        // cache can return another version after publication or for a future booking.
        _ = cache;
        var rule = await repository.GetPricingRuleConfigAsync(lotId, vehicleType, startTime);
        if (rule is null) return new EstimatedPriceResult { TotalFee = -1, Currency = "VND", Details = "No effective price" };
        var price = JsonSerializer.Deserialize<BlockPrice>(rule.Value.ParametersJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new InvalidOperationException("Invalid pricing rules");
        var start = new DateTimeOffset(startTime.ToUniversalTime());
        var total = price.Estimate(start, start.AddMinutes(expectedDurationMinutes), TimeZoneInfo.FindSystemTimeZoneById(rule.Value.Timezone));
        return new EstimatedPriceResult { TotalFee = total, Currency = "VND", Details = $"Block {price.BlockMinutes}p, {price.RateVnd:N0} VND/block, daily cap {price.DailyCapVnd:N0} VND" };
    }
}
