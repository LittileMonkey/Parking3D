using Parking.Payment.Domain.Pricing;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Domain.Entities
{
    /// <summary>
    /// Domain Entity đại diện cho biểu giá thực tế của một bãi xe cụ thể, gắn liền với loại phương tiện và thời hạn hiệu lực.
    /// </summary>
    public class PricingPlan
    {
        public Guid Id { get; private set; }
        public Guid ParkingLotId { get; private set; }
        public string VehicleType { get; private set; } = string.Empty;
        public PricingPolicy Policy { get; private set; } = default!;
        public DateTimeOffset EffectiveFrom { get; private set; }
        public DateTimeOffset? EffectiveTo { get; private set; }
        public bool IsActive { get; private set; }
        public DateTimeOffset CreatedAt { get; private set; }


        private PricingPlan() { }

        public PricingPlan(Guid id, Guid parkingLotId, string vehicleType, PricingPolicy policy, DateTimeOffset effectiveFrom,DateTimeOffset? effectiveTo = null, bool isActive = true)
        {
            if(id == Guid.Empty)
                throw new ArgumentException("Mã định danh biểu giá (Id) không được để trống", nameof(id));

            if (parkingLotId == Guid.Empty)
                throw new ArgumentException("Mã bãi xe (ParkingLotId) không được để trống", nameof(parkingLotId));

            if (string.IsNullOrWhiteSpace(vehicleType))
                throw new ArgumentException("Loại phương tiện không được để trống", nameof(vehicleType));

            ArgumentNullException.ThrowIfNull(policy);
            policy.Validate();

            if (effectiveTo.HasValue && effectiveTo.Value <= effectiveFrom)
                throw new ArgumentException("Thời điểm kết thúc hiệu lực phải lớn hơn thời điểm bắt đầu.", nameof(effectiveTo));

            Id = id;
            ParkingLotId = parkingLotId;
            VehicleType = vehicleType.Trim().ToUpperInvariant();
            Policy = policy;
            EffectiveFrom = effectiveFrom;
            EffectiveTo = effectiveTo;
            IsActive = isActive;
            CreatedAt = DateTimeOffset.UtcNow;


        }

        /// <summary>
        /// Kiểm tra xem biểu giá này có đang có hiệu lực tại một thời điểm nhất định hay không.
        /// </summary>
        public bool isEffectiveAt(DateTimeOffset time)
            => IsActive && time >= EffectiveFrom && (!EffectiveTo.HasValue || time <= EffectiveTo.Value);

        /// <summary>
        /// Nghiệp vụ cập nhật chính sách giá mới cho bãi đỗ xe.
        /// </summary>
        public void UpdatePolicy(PricingPolicy newPolicy)
        {
            ArgumentNullException.ThrowIfNull(newPolicy);
            newPolicy.Validate();
            Policy = newPolicy;
        }
        /// <summary>
        /// Vô hiệu hóa biểu giá này (khi bãi xe ngừng áp dụng).
        /// </summary>
        public void Deactivate() => IsActive = false;

        /// <summary>
        /// Kích hoạt biểu giá này
        /// </summary>
        public void Activate() => IsActive = true;
    }
}
