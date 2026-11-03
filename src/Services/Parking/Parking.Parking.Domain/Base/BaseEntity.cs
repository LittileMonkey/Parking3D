using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Parking.Domain.Base
{
    public abstract class BaseEntity
    {
        /// <summary>
        /// Khóa chính định danh duy nhất (khớp với cột 'id uuid' trong PostgreSQL).
        /// </summary>
        public Guid Id { get; set; } = Guid.NewGuid();
        /// <summary>
        /// Thời điểm bản ghi được tạo (khớp với cột 'created_at timestamptz' trong DB).
        /// </summary>
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
        /// <summary>
        /// Thời điểm cập nhật bãi xe gần nhất (khớp với cột 'updated_at timestamptz' trong DB).
        /// </summary>
        public DateTimeOffset? UpdatedAt { get; set; }
    }
}
