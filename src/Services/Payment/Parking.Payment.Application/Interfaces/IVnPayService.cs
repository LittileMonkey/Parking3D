using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.Interfaces
{
    
    /// <summary>
    /// Giao diện dịch vụ tạo link thanh toán và xác minh chữ ký VNPay.
    /// </summary>

    public interface IVnPayService
    {
        ///<summary>
        ///Sinh đường link thanh toán VNPay gửi cho khách hàng (thời hạn 5 phút)
        /// </summary>
        string CreatePaymentUrl(string transactionRef, long amountMinor, string orderInfo, string ipAddress);


        ///<summary>
        ///Kiểm tra tính hợp lệ của chữ ký HMAC-SHA512 từ callback của VNPay (IPN/Return)
        /// </summary>
        bool ValidateSignature(IDictionary<string, string> queryParameters, string inputHash);

    }
}
