using Microsoft.Extensions.Configuration;
using Parking.Parking.Domain;
using Parking.Parking.Infrastructure.Services;
using Xunit;

namespace Parking.Microservices.Tests;

public sealed class QrTokenTests
{
    private sealed class Clock : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = DateTimeOffset.UtcNow;
        public override DateTimeOffset GetUtcNow() => Now;
    }

    [Fact]
    public void QrBindsBookingLotVehicleAndRejectsTamperWrongKeyAndExpiry()
    {
        var clock = new Clock();
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string?> { ["Qr:SigningKey"] = new string('q', 64) }).Build();
        var service = new QrTokenService(configuration, clock);
        var booking = Guid.NewGuid(); var lot = Guid.NewGuid(); var vehicle = Guid.NewGuid();
        var token = service.GenerateToken(booking, lot, vehicle, clock.Now.AddMinutes(5));
        Assert.True(service.TryValidateAndExtract(token.QrPayload, out var parsed));
        Assert.NotNull(parsed);
        Assert.Equal((booking, lot, vehicle, token.NonceHash),
            (parsed.BookingId, parsed.LotId, parsed.VehicleId, parsed.NonceHash));
        Assert.NotEqual(token.NonceHash, service.GenerateToken(booking, lot, vehicle, clock.Now.AddMinutes(5)).NonceHash);
        var tampered = token.QrPayload[..^1] + (token.QrPayload[^1] == '0' ? '1' : '0');
        Assert.False(service.TryValidateAndExtract(tampered, out _));
        var wrongKey = new QrTokenService(new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string?> { ["Qr:SigningKey"] = new string('x', 64) }).Build(), clock);
        Assert.False(wrongKey.TryValidateAndExtract(token.QrPayload, out _));
        clock.Now = token.ExpiresAt;
        Assert.False(service.TryValidateAndExtract(token.QrPayload, out _));
    }

    [Theory]
    [InlineData("")]
    [InlineData("PARK1.%%%..")]
    [InlineData("anything")]
    public void MalformedQrIsRejected(string value)
    {
        var service = new QrTokenService(new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string?> { ["Qr:SigningKey"] = new string('q', 64) }).Build(), TimeProvider.System);
        Assert.False(service.TryValidateAndExtract(value, out _));
        Assert.False(service.TryValidateAndExtract(new string('x', 2049), out _));
    }

    [Theory]
    [InlineData("51a-123.45", true, "51A12345")]
    [InlineData("51A 12345", true, "51A12345")]
    [InlineData("51A/12345", false, "")]
    [InlineData("", false, "")]
    public void ObservedPlateRequiresSupportedCharacters(string value, bool valid, string normalized)
    {
        Assert.Equal(valid, PlateNumber.TryNormalize(value, out var result));
        if (valid) Assert.Equal(normalized, result);
    }
}
