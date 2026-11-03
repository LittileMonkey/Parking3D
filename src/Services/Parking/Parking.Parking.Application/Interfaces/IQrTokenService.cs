namespace Parking.Parking.Application.Interfaces;

// Hợp đồng QR để Application không phụ thuộc thư viện ký hoặc cách lưu database.
public interface IQrTokenService
{
    /// <summary>Tạo payload ký cho booking, bãi, xe và hạn dùng; trả hash nonce để lưu riêng.</summary>
    GeneratedQrToken GenerateToken(
        Guid bookingId, Guid lotId, Guid vehicleId, DateTimeOffset expiresAt);

    /// <summary>Xác minh chữ ký, cấu trúc và hạn dùng; Repository kiểm tra tiếp trạng thái consume/revoke.</summary>
    bool TryValidateAndExtract(string qrPayload, out ValidatedQrToken? payload);
}

// Payload chỉ trả cho người được quyền; database chỉ lưu NonceHash và thời hạn.
public sealed record GeneratedQrToken(
    string QrPayload, string NonceHash, DateTimeOffset ExpiresAt);

// Claims đã qua xác minh mật mã, chưa có nghĩa QR còn sử dụng được trong database.
public sealed record ValidatedQrToken(
    Guid BookingId, Guid LotId, Guid VehicleId, string NonceHash, DateTimeOffset ExpiresAt);
