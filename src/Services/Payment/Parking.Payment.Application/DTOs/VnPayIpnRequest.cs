namespace Parking.Payment.Application.DTOs;


/// <summary>
/// Các tham số query string VNPay gửi về endpoint IPN sau khi khách hoàn tất thanh toán.
/// </summary>
public sealed record VnPayIpnRequest(
    string vnp_TmnCode,
    string vnp_Amount,
    string vnp_BankCode,
    string vnp_BankTranNo,
    string vnp_CardType,
    string vnp_PayDate,
    string vnp_OrderInfo,
    string vnp_TransactionNo,
    string vnp_ResponseCode,
    string vnp_TransactionStatus,
    string vnp_TxnRef,
    string vnp_SecureHashType,
    string vnp_SecureHash);

public sealed record VnPayIpnResult(string RspCode, string Message);

/// <summary>
/// Kết quả trả về cho trình duyệt của khách hàng sau khi VNPay redirect về ReturnUrl.
/// IsSuccess = true khi vnp_ResponseCode = "00" VÀ chữ ký hợp lệ.
/// </summary>
public sealed record VnPayReturnResult(
    bool IsSuccess,
    string Message,
    string TxnRef,
    long Amount,
    string BankCode,
    string TransactionNo,
    string ResponseCode);