using FluentValidation.TestHelper;
using Parking.Payment.Application.UseCase.GetPaymentReceipt;
using System;
using Xunit;
namespace Parking.Microservices.Tests
{
    public class GetPaymentReceiptQueryValidatorTests
    {
        private readonly GetPaymentReceiptQueryValidator _validator = new();
        [Fact]
        public void ShouldHaveError_WhenPaymentIdIsEmpty()
        {
            // ARRANGE: PaymentId bị rỗng
            var query = new GetPaymentReceiptQuery(Guid.Empty);
            // ACT
            var result = _validator.TestValidate(query);
            // ASSERT: Phải chặn lại ngay từ cửa
            result.ShouldHaveValidationErrorFor(x => x.PaymentId)
                .WithErrorMessage("Mã thanh toán (PaymentId) không được để trống.");
        }
        [Fact]
        public void ShouldNotHaveError_WhenPaymentIdIsValid()
        {
            // ARRANGE: PaymentId hợp lệ
            var query = new GetPaymentReceiptQuery(Guid.NewGuid());
            // ACT
            var result = _validator.TestValidate(query);
            // ASSERT: Hợp lệ 100%
            result.ShouldNotHaveAnyValidationErrors();
        }
    }
}
