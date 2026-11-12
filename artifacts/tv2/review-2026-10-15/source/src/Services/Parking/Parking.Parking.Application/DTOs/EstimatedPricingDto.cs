using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Parking.Application.DTOs
{
    public class EstimatedPricingDto
    {
        public int ExpectedDurationMinutes { get; set; }

        // Tổng số tiền dự kiến (Dùng kiểu decimal cho tiền tệ để không bị sai số)
        public decimal EstimatedTotalFee { get; set; }
        public string Currency { get; set; } = "VND";
        public string BillingDetails { get; set; } = string.Empty;
    }
}
