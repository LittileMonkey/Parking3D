using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Domain.Pricing
{
    /// <summary>
    /// Value Object biểu diễn một khoảng thời gian nửa đóng nửa mở [Start, End).
    /// </summary>
    public readonly record struct TimeRange
    {
        public DateTimeOffset Start { get; }
        public DateTimeOffset End { get; }

        public TimeRange(DateTimeOffset start, DateTimeOffset end)
        {
            if (end < start)
                throw new ArgumentException("Thời điểm kết thúc (End) không được nhỏ hơn thời điểm bắt đầu (Start).", nameof(end));

            Start = start;
            End = end;
        }
        /// Tổng khoảng thời gian (TimeSpan) của dải thời gian này.
        public TimeSpan Duration => End - Start;
        /// Tổng số phút trôi qua trong khoảng thời gian.
        public double TotalMinutes => Duration.TotalMinutes;
        /// Kiểm tra xem một thời điểm có nằm trọn trong khoảng [Start, End) hay không.
        public bool Contains(DateTimeOffset time) => time >= Start && time < End;

        /// Kiểm tra xem khoảng thời gian này có giao nhau (Overlaps) với một khoảng khác hay không.
        /// Hai khoảng giao nhau khi: Max(Start1, Start2) < Min(End1, End2).
        public bool Overlaps(TimeRange other) => Start < other.End && End > other.Start;

        /// Tìm phần giao nhau (Intersection) giữa 2 khoảng thời gian.
        /// Trả về null nếu 2 khoảng không hề chạm vào nhau.
        public TimeRange? Intersect(TimeRange other)
        {
            var maxStart = Start > other.Start ? Start : other.Start;
            var minEnd = End < other.End ? End : other.End;
            if(maxStart < minEnd)
            {
                return new TimeRange(maxStart, minEnd);
            }

            return null;
        }




    }
}
