using FluentValidation.TestHelper;
using Parking.Payment.Application.UseCase.CreatePaymentQrCommand;
using System;
using Xunit;

namespace Parking.Microservices.Tests
{
    public class CreatePaymentQrCommandValidatorTests
    {
        private readonly CreatePaymentQrCommandValidator _validator = new();
        [Fact]
        public void ShouldHaveError_WhenBookingIdIsEmpty()
        {
            // ARRANGE: BookingId bị rỗng (Guid.Empty)
            var command = new CreatePaymentQrCommand(
                BookingId: Guid.Empty,
                UserId: Guid.NewGuid()
            );
            // ACT
            var result = _validator.TestValidate(command);
            // ASSERT: Chặn lại với đúng thông điệp lỗi
            result.ShouldHaveValidationErrorFor(x => x.BookingId)
                .WithErrorMessage("Mã đơn đặt chỗ (BookingId) không được để trống.");
        }
        [Fact]
        public void ShouldHaveError_WhenUserIdIsEmpty()
        {
            // ARRANGE: UserId bị rỗng
            var command = new CreatePaymentQrCommand(
                BookingId: Guid.NewGuid(),
                UserId: Guid.Empty
            );
            // ACT
            var result = _validator.TestValidate(command);
            // ASSERT
            result.ShouldHaveValidationErrorFor(x => x.UserId)
                .WithErrorMessage("Mã người dùng (UserId) không được để trống.");
        }
        [Fact]
        public void ShouldNotHaveError_WhenCommandIsValid()
        {
            // ARRANGE: Đầy đủ thông tin hợp lệ
            var command = new CreatePaymentQrCommand(
                BookingId: Guid.NewGuid(),
                UserId: Guid.NewGuid(),
                IpAddress: "127.0.0.1",
                IdempotencyKey: "test-idempotency-key"
            );
            // ACT
            var result = _validator.TestValidate(command);
            // ASSERT: Vượt qua bộ kiểm tra thành công
            result.ShouldNotHaveAnyValidationErrors();
        }
    }
}
