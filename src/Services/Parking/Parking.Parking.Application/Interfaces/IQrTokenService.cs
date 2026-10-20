namespace Parking.Parking.Application.Interfaces;

// Hợp đồng ký/xác minh QR; Application không phụ thuộc cách mã hóa hoặc lưu DB.
public interface IQrTokenService
{
    GeneratedQrToken GenerateToken(
        Guid bookingId,
        Guid lotId,
        Guid vehicleId,
        DateTimeOffset expiresAt);

    bool TryValidateAndExtract(
        string qrPayload,
        out ValidatedQrToken? payload);
}

public sealed record GeneratedQrToken(
    string QrPayload,
    string NonceHash,
    DateTimeOffset ExpiresAt
);

public sealed record ValidatedQrToken(
    Guid BookingId,
    Guid LotId,
    Guid VehicleId,
    string NonceHash,
    DateTimeOffset ExpiresAt
);
