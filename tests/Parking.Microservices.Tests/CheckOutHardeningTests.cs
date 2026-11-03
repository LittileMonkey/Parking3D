using FluentValidation.TestHelper;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Features.CheckOut.Commands;
using Xunit;
using Microsoft.Extensions.Configuration;
using Parking.Parking.Infrastructure.Services;
using Parking.Parking.Domain;
using Parking.ServiceDefaults;

namespace Parking.Microservices.Tests;

public sealed class CheckOutHardeningTests
{
    private sealed class Clock : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = DateTimeOffset.UtcNow;
        public override DateTimeOffset GetUtcNow()=>Now;
    }

    [Fact]
    public void SignedQuoteRejectsTamperingWrongKeyExpiryAndEntryQr()
    {
        var clock=new Clock();
        var config=new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{["Qr:SigningKey"]=new string('s',64)}).Build();
        var tokens=new CheckOutTokens(config,clock);
        var proof=new CheckOutProof(Guid.NewGuid(),Guid.NewGuid(),Guid.NewGuid(),Guid.NewGuid(),Guid.NewGuid(),
            Guid.NewGuid(),Guid.NewGuid(),Guid.NewGuid(),"51A12345",clock.Now,clock.Now.AddMinutes(5),7500);
        var token=tokens.SignQuote(proof);
        Assert.Equal(proof,tokens.ValidateQuote(token));
        Assert.Throws<ServiceException>(()=>tokens.ValidateQuote(token[..^1]+(token[^1]=='0'?'1':'0')));
        var wrong=new CheckOutTokens(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{["Qr:SigningKey"]=new string('w',64)}).Build(),clock);
        Assert.Throws<ServiceException>(()=>wrong.ValidateQuote(token));
        var entry=new QrTokenService(config,clock).GenerateToken(Guid.NewGuid(),proof.LotId,proof.VehicleId,clock.Now.AddMinutes(5));
        Assert.Throws<ServiceException>(()=>tokens.ValidateExitQr(entry.QrPayload));
        var exit=tokens.IssueExitQr(proof.SessionId,proof.LotId);
        Assert.Equal((proof.SessionId,proof.LotId),tokens.ValidateExitQr(exit.QrPayload));
        Assert.Throws<ServiceException>(()=>tokens.ValidateQuote(exit.QrPayload));
        clock.Now=proof.ExpiresAt;
        Assert.Throws<ServiceException>(()=>tokens.ValidateQuote(token));
        Assert.Throws<ServiceException>(()=>tokens.ValidateExitQr(exit.QrPayload));
    }

    [Theory]
    [InlineData(0,0)]
    [InlineData(1,7500)]
    [InlineData(30,7500)]
    [InlineData(60,7500)]
    [InlineData(900,7500)]
    [InlineData(901,15000)]
    public void FeeUsesExactTimeAndRoundsUpBlocks(int seconds,long expected)
    {
        var end=DateTimeOffset.Parse("2026-11-01T10:00:00+07:00");
        var amount=CheckOutFee.Calculate(true,end.AddHours(-1),end,end.AddSeconds(seconds),
            "{\"blockMinutes\":15,\"rateVnd\":7500,\"dailyCapVnd\":120000,\"multiplier\":1}",TimeZoneInfo.Utc.Id);
        Assert.Equal(expected,amount);
    }

    [Fact]
    public void BookingAlreadyAtDailyCapDoesNotPayTheCapAgainForOvertime()
    {
        var start=DateTimeOffset.Parse("2026-11-01T08:00:00Z");
        var end=start.AddHours(4);
        var fee=CheckOutFee.Calculate(true,start,end,end.AddSeconds(1),
            "{\"blockMinutes\":15,\"rateVnd\":7500,\"dailyCapVnd\":120000,\"multiplier\":1}","UTC");
        Assert.Equal(0,fee);
    }
    [Fact]
    public void ConfirmRequiresObservedPlateAndServerQuote()
    {
        var command = new ConfirmCheckOutCommand(Guid.NewGuid(),
            new ConfirmCheckOutRequestDto(Guid.NewGuid(), Guid.NewGuid(), "NONE"), "exit");
        var result = new ConfirmCheckOutCommandValidator().TestValidate(command);
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == "Request.DetectedPlate");
        Assert.Contains(result.Errors, error => error.PropertyName == "Request.QuoteToken");
        Assert.Contains(result.Errors, error => error.PropertyName == "Request.StaffObservedExit");
    }

    [Fact]
    public void PrepaidIsNotAnUnverifiedPaymentOverride()
    {
        var command = new ConfirmCheckOutCommand(Guid.NewGuid(),
            new ConfirmCheckOutRequestDto(Guid.NewGuid(), Guid.NewGuid(), "PREPAID"), "exit");
        var result = new ConfirmCheckOutCommandValidator().TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Request.PaymentMethod);
    }
}
