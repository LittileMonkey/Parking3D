using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Parking.Parking.Application.Interfaces;

namespace Parking.Parking.Infrastructure.Services;

// Ký và xác minh payload QR. Persistence kiểm tra trạng thái đã dùng/thu hồi trong DB.
public sealed class QrTokenService : IQrTokenService
{
    private const string TokenPrefix = "PARK1";
    private readonly byte[] _signingKey;
    private readonly TimeProvider _clock;

    /// <summary>Đọc khóa ký từ cấu hình riêng và nhận đồng hồ; từ chối khóa thiếu hoặc dưới 32 byte.</summary>
    public QrTokenService(IConfiguration configuration, TimeProvider clock)
    {
        var secret = configuration["Qr:SigningKey"];
        if (string.IsNullOrWhiteSpace(secret))
            throw new InvalidOperationException("Qr:SigningKey is required");

        _signingKey = Encoding.UTF8.GetBytes(secret);
        if (_signingKey.Length < 32)
            throw new InvalidOperationException("Qr:SigningKey must contain at least 32 bytes");

        _clock = clock;
    }

    /// <summary>Tạo QR ký HMAC gắn booking, bãi, xe và nonce ngẫu nhiên; trả hash nonce để lưu database.</summary>
    public GeneratedQrToken GenerateToken(Guid bookingId, Guid lotId, Guid vehicleId, DateTimeOffset expiresAt)
    {
        if (bookingId == Guid.Empty || lotId == Guid.Empty || vehicleId == Guid.Empty)
            throw new ArgumentException("Booking, lot and vehicle IDs are required. ");
        if (expiresAt <= _clock.GetUtcNow())
            throw new ArgumentException("QR expiry must be in the future");

        // Nonce riêng cho mỗi lần cấp; DB chỉ lưu hash để đối chiếu khi consume.
        var nonce = Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(32));
        var claims = new QrClaims(bookingId, lotId, vehicleId, nonce, expiresAt);
        var body = Convert.ToBase64String(JsonSerializer.SerializeToUtf8Bytes(claims));
        var contentToSign = $"{TokenPrefix}.{body}";
        var signature = HMACSHA256.HashData(_signingKey, Encoding.UTF8.GetBytes(contentToSign));
        var qrPayload = $"{contentToSign}.{Convert.ToHexStringLower(signature)}";
        return new GeneratedQrToken(qrPayload, HashNonce(nonce), expiresAt);
    }

    /// <summary>Kiểm tra cấu trúc, chữ ký và hạn dùng rồi đọc claims; trạng thái đã dùng hoặc thu hồi do Repository kiểm tra.</summary>
    public bool TryValidateAndExtract(string qrPayload, out ValidatedQrToken? payload)
    {
        payload = null;
        if (string.IsNullOrWhiteSpace(qrPayload) || qrPayload.Length > 2048)
            return false;

        var parts = qrPayload.Split('.');
        if (parts.Length != 3 || parts[0] != TokenPrefix || parts[2].Length != 64)
            return false;

        try
        {
            // Xác minh chữ ký trước khi đọc claims; so sánh constant-time để bảo vệ key.
            var contentToSign = $"{parts[0]}.{parts[1]}";
            var expectedSignature = HMACSHA256.HashData(_signingKey, Encoding.UTF8.GetBytes(contentToSign));
            var actualSignature = Convert.FromHexString(parts[2]);
            if (!CryptographicOperations.FixedTimeEquals(actualSignature, expectedSignature))
                return false;

            var claims = JsonSerializer.Deserialize<QrClaims>(Convert.FromBase64String(parts[1]));
            if (claims is null ||
                claims.BookingId == Guid.Empty ||
                claims.LotId == Guid.Empty ||
                claims.VehicleId == Guid.Empty ||
                claims.Nonce is not { Length: 64 } ||
                claims.ExpiresAt <= _clock.GetUtcNow())
                return false;

            // Nonce phải là hexadecimal hợp lệ trước khi tính hash cho truy vấn DB.
            _ = Convert.FromHexString(claims.Nonce);
            payload = new ValidatedQrToken(
                claims.BookingId, claims.LotId, claims.VehicleId, HashNonce(claims.Nonce), claims.ExpiresAt);
            return true;
        }
        catch (Exception exception) when (exception is FormatException or JsonException)
        {
            return false;
        }
    }

    /// <summary>Băm nonce bằng SHA-256 để database không phải lưu nonce gốc trong payload.</summary>
    private static string HashNonce(string nonce) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(nonce)));

    private sealed record QrClaims(
        Guid BookingId, Guid LotId, Guid VehicleId, string Nonce, DateTimeOffset ExpiresAt);
}
