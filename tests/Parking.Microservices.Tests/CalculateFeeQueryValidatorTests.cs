using FluentValidation.TestHelper;
using Parking.Payment.Application.UseCase.CalculateFee;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Xunit;

namespace Parking.Microservices.Tests
{
    public class CalculateFeeQueryValidatorTests
    {
        private readonly CalculateFeeQueryValidator _validator = new();
        [Fact]
        public void ShouldHaveError_WhenParkingLotIdIsEmpty()
        {
            // ARRANGE: Mã bãi xe bị rỗng (Guid.Empty)
            var query = new CalculateFeeQuery(
                ParkingLotId: Guid.Empty,
                EntryTime: DateTimeOffset.UtcNow,
                ExitTime: DateTimeOffset.UtcNow.AddHours(2)
            );
            // ACT: Chạy bộ kiểm tra Validator
            var result = _validator.TestValidate(query);
            // ASSERT: Bắt buộc phải có lỗi ở trường ParkingLotId
            result.ShouldHaveValidationErrorFor(x => x.ParkingLotId)
                .WithErrorMessage("Mã bãi đỗ xe (ParkingLotId) không được để trống.");
        }
        [Fact]
        public void ShouldHaveError_WhenExitTimeIsBeforeEntryTime()
        {
            // ARRANGE: Giờ ra (ExitTime) trước giờ vào 30 phút
            var entry = DateTimeOffset.UtcNow;
            var exit = entry.AddMinutes(-30);
            var query = new CalculateFeeQuery(
                ParkingLotId: Guid.NewGuid(),
                EntryTime: entry,
                ExitTime: exit
            );
            // ACT
            var result = _validator.TestValidate(query);
            // ASSERT: Bắt buộc phải chặn lại và báo lỗi giờ ra phải lớn hơn giờ vào
            result.ShouldHaveValidationErrorFor(x => x.ExitTime)
                .WithErrorMessage("Thời gian ra bãi (ExitTime) phải lớn hơn thời gian vào (EntryTime).");
        }
        [Fact]
        public void ShouldHaveError_WhenExitTimeEqualsEntryTime()
        {
            // ARRANGE: Giờ ra bằng đúng giờ vào
            var entry = DateTimeOffset.UtcNow;
            var query = new CalculateFeeQuery(
                ParkingLotId: Guid.NewGuid(),
                EntryTime: entry,
                ExitTime: entry
            );
            // ACT
            var result = _validator.TestValidate(query);
            // ASSERT: Phải báo lỗi
            result.ShouldHaveValidationErrorFor(x => x.ExitTime);
        }
        [Fact]
        public void ShouldHaveError_WhenParkingDurationExceeds30Days()
        {
            // ARRANGE: Thời gian gửi xe là 31 ngày (vượt trần quy định 30 ngày)
            var entry = DateTimeOffset.UtcNow;
            var exit = entry.AddDays(31);
            var query = new CalculateFeeQuery(
                ParkingLotId: Guid.NewGuid(),
                EntryTime: entry,
                ExitTime: exit
            );
            // ACT
            var result = _validator.TestValidate(query);
            // ASSERT: Bắt buộc phải báo lỗi vượt quá 30 ngày
            result.ShouldHaveValidationErrorFor(x => (x.ExitTime - x.EntryTime).TotalDays)
                .WithErrorMessage("Khoảng thời gian gửi xe cho một lần tính cước không được vượt quá 30 ngày.");
        }
        [Fact]
        public void ShouldNotHaveError_WhenQueryIsValid()
        {
            // ARRANGE: Dữ liệu hoàn toàn chuẩn chỉnh (đỗ 3 tiếng, có mã bãi xe hợp lệ)
            var entry = DateTimeOffset.UtcNow;
            var exit = entry.AddHours(3);
            var query = new CalculateFeeQuery(
                ParkingLotId: Guid.NewGuid(),
                EntryTime: entry,
                ExitTime: exit,
                isGoldStarMember: true,
                VehicleType: "CAR"
            );
            // ACT
            var result = _validator.TestValidate(query);
            // ASSERT: Không được phép có bất kỳ lỗi nào!
            result.ShouldNotHaveAnyValidationErrors();
        }
    }
}
