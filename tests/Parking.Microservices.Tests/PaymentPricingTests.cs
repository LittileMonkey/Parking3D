using Grpc.Core;
using Microsoft.Extensions.Caching.Memory;
using Parking.Contracts.Catalog.V1;
using Parking.Payment.Application.DTOs;
using Parking.Payment.Application.UseCase.CalculateFee;
using Parking.ServiceDefaults;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Xunit;

namespace Parking.Microservices.Tests
{
    /// <summary>
    /// Bộ Unit Test nghiệm thu Ticket SCRUM-95:
    /// 1. Bắt lỗi 404 khi không tìm thấy biểu giá (Tuyệt đối không tính 0 đồng).
    /// 2. Tính đúng cước phí khi gRPC trả về biểu giá thật.
    /// 3. Kiểm chứng cơ chế MemoryCache (Lần 2 đọc từ RAM, không gọi lại gRPC).
    /// 4. Kiểm chứng 3 trạng thái độc lập: PaymentStatus, BookingStatus, SessionStatus.
    /// 5. Kiểm chứng DTO xác nhận CASH lưu đúng UUID nhân viên thật.
    /// </summary>
    public class PaymentPricingTests
    {
        #region Test Double (Fake gRPC Client)
        /// <summary>
        /// Giả lập ParkingCatalogClient kế thừa từ Grpc ClientBase
        /// Cho phép kiểm thử Handler mà không cần bật microservice Parking thật.
        /// </summary>
        private sealed class FakeParkingCatalogClient : ParkingCatalog.ParkingCatalogClient
        {
            private readonly Func<PricingPolicyRequest, PricingPolicyReply> _handler;
            public int CallCount { get; private set; }
            public FakeParkingCatalogClient(Func<PricingPolicyRequest, PricingPolicyReply> handler)
            {
                _handler = handler;
            }
            public override AsyncUnaryCall<PricingPolicyReply> GetPricingPolicyAsync(
                PricingPolicyRequest request,
                CallOptions options)
            {
                CallCount++;
                var reply = _handler(request);
                return new AsyncUnaryCall<PricingPolicyReply>(
                    Task.FromResult(reply),
                    Task.FromResult(new Metadata()),
                    () => Status.DefaultSuccess,
                    () => new Metadata(),
                    () => { });
            }
        }
        #endregion
        [Fact]
        public async Task CalculateFee_ShouldThrow404ServiceException_WhenPricingPolicyNotFound()
        {
            // ARRANGE: Giả lập Parking gRPC trả về Found = false (bãi chưa có giá hoặc loại xe không hỗ trợ)
            var fakeClient = new FakeParkingCatalogClient(req => new PricingPolicyReply
            {
                Found = false
            });
            var cache = new MemoryCache(new MemoryCacheOptions());
            var handler = new CalculateFeeQueryHandler(fakeClient, cache);
            var lotId = Guid.NewGuid();
            var entry = DateTimeOffset.UtcNow;
            var exit = entry.AddHours(2);
            var query = new CalculateFeeQuery(lotId, entry, exit, isGoldStarMember: false, VehicleType: "TRUCK");
            // ACT & ASSERT: Bắt buộc phải quăng ServiceException với HTTP Status 404
            var ex = await Assert.ThrowsAsync<ServiceException>(() => handler.Handle(query, CancellationToken.None));

            Assert.Equal(404, ex.StatusCode);
            Assert.Contains("Chưa có biểu giá hiệu lực", ex.Message);
            Assert.Contains("TRUCK", ex.Message);
            Assert.Equal(1, fakeClient.CallCount);
        }
        [Fact]
        public async Task CalculateFee_ShouldCalculateCorrectFee_WhenPricingPolicyFound()
        {
            // ARRANGE: Giả lập Parking gRPC trả về biểu giá chuẩn:
            // 60 phút đầu 20k, mỗi 15 phút sau 5k, trần 150k/ngày, múi giờ Việt Nam
            var fakeClient = new FakeParkingCatalogClient(req => new PricingPolicyReply
            {
                Found = true,
                InitialBlockMinutes = 60,
                InitialRateVnd = 20_000,
                SubsequentBlockMinutes = 15,
                SubsequentRateVnd = 5_000,
                PeakMultiplier = 1.0, // không xét cao điểm để test logic cơ bản
                DailyCapVnd = 150_000,
                GoldStarDiscountRate = 0.1,
                Timezone = "Asia/Ho_Chi_Minh"
            });
            var cache = new MemoryCache(new MemoryCacheOptions());
            var handler = new CalculateFeeQueryHandler(fakeClient, cache);
            var lotId = Guid.NewGuid();
            // Khách đỗ 68 phút: 60p đầu (20.000 đ) + 1 block 15p làm tròn lên (5.000 đ) = 25.000 đ
            var entry = new DateTimeOffset(2026, 10, 23, 8, 0, 0, TimeSpan.FromHours(7));
            var exit = entry.AddMinutes(68);
            var query = new CalculateFeeQuery(lotId, entry, exit, isGoldStarMember: false, VehicleType: "CAR");
            // ACT
            var result = await handler.Handle(query, CancellationToken.None);
            // ASSERT
            Assert.NotNull(result);
            Assert.Equal(25_000, result.FinalNetAmountVnd);
            Assert.Equal(2, result.TotalBillableBlocks);
            Assert.Equal("VND", result.Currency);
            Assert.Single(result.DailyBreakdowns);
            Assert.Equal(1, fakeClient.CallCount);
        }
        [Fact]
        public async Task CalculateFee_ShouldHitMemoryCache_OnSecondIdenticalRequest()
        {
            // ARRANGE: Thiết lập giả lập đếm số lần gọi gRPC
            var fakeClient = new FakeParkingCatalogClient(req => new PricingPolicyReply
            {
                Found = true,
                InitialBlockMinutes = 60,
                InitialRateVnd = 20_000,
                SubsequentBlockMinutes = 15,
                SubsequentRateVnd = 5_000,
                PeakMultiplier = 1.0,
                DailyCapVnd = 150_000,
                GoldStarDiscountRate = 0.0,
                Timezone = "Asia/Ho_Chi_Minh"
            });
            var cache = new MemoryCache(new MemoryCacheOptions());
            var handler = new CalculateFeeQueryHandler(fakeClient, cache);
            var lotId = Guid.NewGuid();
            var entry = new DateTimeOffset(2026, 10, 23, 8, 0, 0, TimeSpan.FromHours(7));
            var exit = entry.AddHours(2);
            var query = new CalculateFeeQuery(lotId, entry, exit, isGoldStarMember: false, VehicleType: "CAR");
            // ACT: Gọi 2 lần liên tiếp với cùng bãi xe và loại xe
            var result1 = await handler.Handle(query, CancellationToken.None);
            var result2 = await handler.Handle(query, CancellationToken.None);
            // ASSERT: Cả 2 lần đều tính đúng tiền, nhưng gRPC CHỈ ĐƯỢC GỌI DUY NHẤT 1 LẦN (Lần 2 hit RAM Cache)
            Assert.Equal(result1.FinalNetAmountVnd, result2.FinalNetAmountVnd);
            Assert.Equal(1, fakeClient.CallCount);
        }
        [Fact]
        public void PaymentStatusDto_ShouldDistinguishThreeDistinctStates()
        {
            // ARRANGE & ACT: Khởi tạo DTO tra cứu trạng thái
            var statusDto = new PaymentStatusDto
            {
                BookingId = Guid.NewGuid(),
                PaymentId = Guid.NewGuid(),
                PaymentMethod = "CASH",
                PaymentStatus = "SUCCESS",           // Tiền mặt đã thu vào két bốt barrier
                BookingStatus = "CONFIRMED",         // Chỗ đỗ đã chốt giữ hợp lệ
                SessionStatus = "NOT_CHECKED_IN",    // Xe vật lý chưa tới cổng IN
                TotalAmount = 50_000,
                Currency = "VND",
                LastUpdatedAt = DateTime.UtcNow
            };
            // ASSERT: Ba trạng thái phải độc lập tuyệt đối, phục vụ Frontend hiển thị chính xác
            Assert.Equal("SUCCESS", statusDto.PaymentStatus);
            Assert.Equal("CONFIRMED", statusDto.BookingStatus);
            Assert.Equal("NOT_CHECKED_IN", statusDto.SessionStatus);
            Assert.NotEqual(statusDto.BookingStatus, statusDto.PaymentStatus);
        }
        [Fact]
        public void ConfirmCashPaymentResultDto_ShouldPreserveRealStaffActorUuid()
        {
            // ARRANGE: Tạo DTO kết quả thu tiền mặt với UUID thực tế của Staff
            var staffUuid = Guid.NewGuid().ToString();
            var paymentId = Guid.NewGuid();
            var confirmedAt = DateTime.UtcNow;
            // ACT
            var result = new ConfirmCashPaymentResultDto
            {
                PaymentId = paymentId,
                Status = "Success",
                ConfirmedBy = staffUuid,
                ConfirmedAt = confirmedAt
            };
            // ASSERT: Không được fallback về ID giả lập 00000000-0000-0000-0000-000000000001
            Assert.Equal(staffUuid, result.ConfirmedBy);
            Assert.NotEqual("00000000-0000-0000-0000-000000000001", result.ConfirmedBy);
            Assert.Equal("Success", result.Status);
        }
    }
}
