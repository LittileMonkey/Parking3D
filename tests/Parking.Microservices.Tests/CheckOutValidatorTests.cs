using FluentValidation.TestHelper;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Features.CheckOut.Commands;
using Parking.Parking.Application.Features.CheckOut.Queries;
using Xunit;

namespace Parking.Microservices.Tests;

/// <summary>
/// Bộ Unit Tests kiểm thử tính toàn vẹn và ràng buộc dữ liệu cho luồng Check-out (SCRUM-70).
/// </summary>
public class CheckOutValidatorTests
{
    private readonly GetCheckOutQuoteQueryValidator _quoteValidator = new();
    private readonly ConfirmCheckOutCommandValidator _confirmValidator = new();

    [Fact]
    public void Quote_ShouldPass_WhenRequestIsValid()
    {
        var query = new GetCheckOutQuoteQuery(
            ActorId: Guid.NewGuid(),
            Request: new CheckOutQuoteRequestDto(
                LotId: Guid.NewGuid(),
                GateId: Guid.NewGuid(),
                DetectedPlate: "51A-123.45"));

        var result = _quoteValidator.TestValidate(query);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Quote_ShouldFail_WhenActorOrLotOrGateIsEmpty()
    {
        var query = new GetCheckOutQuoteQuery(
            ActorId: Guid.Empty,
            Request: new CheckOutQuoteRequestDto(
                LotId: Guid.Empty,
                GateId: Guid.Empty,
                DetectedPlate: "51A-123.45"));

        var result = _quoteValidator.TestValidate(query);
        result.ShouldHaveValidationErrorFor(x => x.ActorId);
        result.ShouldHaveValidationErrorFor(x => x.Request.LotId);
        result.ShouldHaveValidationErrorFor(x => x.Request.GateId);
    }

    [Fact]
    public void Quote_ShouldFail_WhenBothPlateAndQrAreMissing()
    {
        var query = new GetCheckOutQuoteQuery(
            ActorId: Guid.NewGuid(),
            Request: new CheckOutQuoteRequestDto(
                LotId: Guid.NewGuid(),
                GateId: Guid.NewGuid(),
                DetectedPlate: string.Empty,
                QrPayload: null));

        var result = _quoteValidator.TestValidate(query);
        result.ShouldHaveValidationErrorFor(x => x.Request.DetectedPlate);
    }

    [Fact]
    public void Confirm_ShouldPass_WhenRequestIsValid()
    {
        var command = new ConfirmCheckOutCommand(
            ActorId: Guid.NewGuid(),
            Request: new ConfirmCheckOutRequestDto(
                SessionId: Guid.NewGuid(),
                GateId: Guid.NewGuid(),
                PaymentMethod: "CASH",
                CashReceived: 10000,
                StaffNotes: "Thu tiền đủ tại bốt"),
            IdempotencyKey: "checkout-key-01");

        var result = _confirmValidator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Confirm_ShouldFail_WhenPaymentMethodIsInvalid()
    {
        var command = new ConfirmCheckOutCommand(
            ActorId: Guid.NewGuid(),
            Request: new ConfirmCheckOutRequestDto(
                SessionId: Guid.NewGuid(),
                GateId: Guid.NewGuid(),
                PaymentMethod: "INVALID_METHOD",
                CashReceived: 10000),
            IdempotencyKey: "checkout-key-01");

        var result = _confirmValidator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Request.PaymentMethod);
    }

    [Fact]
    public void Confirm_ShouldFail_WhenCashReceivedIsNegative()
    {
        var command = new ConfirmCheckOutCommand(
            ActorId: Guid.NewGuid(),
            Request: new ConfirmCheckOutRequestDto(
                SessionId: Guid.NewGuid(),
                GateId: Guid.NewGuid(),
                PaymentMethod: "CASH",
                CashReceived: -5000),
            IdempotencyKey: "checkout-key-01");

        var result = _confirmValidator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Request.CashReceived);
    }

    [Fact]
    public void Confirm_ShouldFail_WhenIdempotencyKeyIsMissing()
    {
        var command = new ConfirmCheckOutCommand(
            ActorId: Guid.NewGuid(),
            Request: new ConfirmCheckOutRequestDto(
                SessionId: Guid.NewGuid(),
                GateId: Guid.NewGuid(),
                PaymentMethod: "CASH",
                CashReceived: 10000),
            IdempotencyKey: string.Empty);

        var result = _confirmValidator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.IdempotencyKey);
    }
}
