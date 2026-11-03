using Parking.Parking.Domain.Base;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Parking.Domain.Entities
{
    public class ParkingLot : BaseEntity
    {
        /// <summary>
        /// Mã định danh viết tắt của bãi xe (VD: LOT-Q1-01).
        /// Khớp với cột 'code varchar(50)' trong bảng parking_lots.
        /// </summary>
        public string Code { get; set; } = string.Empty;
        /// <summary>
        /// Tên bãi đỗ xe (VD: "Bãi đỗ xe trung tâm Quận 1").
        /// Khớp với cột 'name varchar(200)' trong bảng parking_lots.
        /// </summary>
        public string Name { get; set; } = string.Empty;
        /// <summary>
        /// Địa chỉ thực tế của bãi xe.
        /// Khớp với cột 'address text' trong bảng parking_lots.
        /// </summary>
        public string Address { get; set; } = string.Empty;
        /// <summary>
        /// Tọa độ Vĩ độ GPS phục vụ thuật toán khoảng cách Haversine.
        /// Khớp với cột 'latitude double precision' trong DB.
        /// </summary>
        public double Latitude { get; set; }
        /// <summary>
        /// Tọa độ Kinh độ GPS phục vụ thuật toán khoảng cách Haversine.
        /// Khớp với cột 'longitude double precision' trong DB.
        /// </summary>
        public double Longitude { get; set; }
        /// <summary>
        /// Trạng thái hoạt động của bãi đỗ (ACTIVE, INACTIVE, ARCHIVED).
        /// Khớp với cột 'status' trong DB.
        /// </summary>
        public string Status { get; set; } = "ACTIVE";
        /// <summary>
        /// Số lượng chỗ trống khả dụng thực tế của bãi xe đối với loại xe đang tra cứu.
        /// Giá trị này được tính toán động (Derived / Computed Property) từ Database qua COUNT slot khả dụng.
        /// </summary>
        public int AvailableSlots { get; set; }

        #region Domain Logic / Business Methods
        /// <summary>
        /// Cập nhật tọa độ GPS của bãi xe với kiểm tra ràng buộc vĩ độ [-90, 90] và kinh độ [-180, 180].
        /// </summary>
        public void UpdateCoordinates(double latitude, double longitude)
        {
            if (latitude < -90.0 || latitude > 90.0)
                throw new ArgumentOutOfRangeException(nameof(latitude), "Vĩ độ (Latitude) phải nằm trong khoảng [-90, 90].");

            if (longitude < -180.0 || longitude > 180.0)
                throw new ArgumentOutOfRangeException(nameof(longitude), "Kinh độ (Longitude) phải nằm trong khoảng [-180, 180].");


            Latitude = latitude;
            Longitude = longitude;
            UpdatedAt = DateTimeOffset.UtcNow;
        }

        /// <summary>
        /// Cập nhật trạng thái bãi xe (ACTIVE, INACTIVE, ARCHIVED).
        /// </summary>
        public void UpdateStatus(string newStatus)
        {
            if (string.IsNullOrWhiteSpace(newStatus))
                throw new ArgumentException("Trạng thái không được để trống.");

            newStatus = newStatus.Trim().ToUpperInvariant();

            if (newStatus != "ACTIVE" &&
                newStatus != "INACTIVE" &&
                newStatus != "ARCHIVED")
            {
                throw new ArgumentException("Trạng thái không hợp lệ.");
            }

            Status = newStatus;
            UpdatedAt = DateTimeOffset.UtcNow;
        }

        /// <summary>
        /// Kiểm tra xem bãi đỗ xe có đang mở cửa / hoạt động để tiếp nhận xe hay không.
        /// </summary>
        public bool IsActive() => string.Equals(Status, "ACTIVE", StringComparison.OrdinalIgnoreCase);
        #endregion


    }
}
