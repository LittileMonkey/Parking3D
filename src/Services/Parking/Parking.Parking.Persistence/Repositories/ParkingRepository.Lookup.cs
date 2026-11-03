using Npgsql;
using Parking.Parking.Application.DTOs;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
    /// <summary>
    /// Đọc chi tiết booking và thông tin owner/bãi cho bước phân quyền ở Handler.
    /// Không phục dựng payload QR từ hash nonce trong database.
    /// </summary>
    public async Task<(BookingDetailDto Detail, Guid? CustomerId, Guid LotId)?> GetBookingDetailAsync(
        Guid bookingId,
        CancellationToken ct)
    {
        const string sql = """
            SELECT b.id,b.code,b.lot_id,l.name,b.customer_id,r.slot_id,s.code,b.plate_snapshot,b.vehicle_type,
              b.starts_at,b.ends_at,b.hold_expires_at,b.arrival_deadline,b.status::text,b.estimated_amount,b.created_at
            FROM bookings b JOIN parking_lots l ON l.id=b.lot_id
            LEFT JOIN LATERAL (
              SELECT slot_id FROM slot_reservations WHERE booking_id=b.id
              ORDER BY CASE WHEN status IN ('HELD','CONFIRMED') THEN 0 ELSE 1 END,created_at DESC,id DESC LIMIT 1
            ) r ON true
            LEFT JOIN parking_slots s ON s.id=r.slot_id
            WHERE b.id=@id
            """;

        await using var command = db.CreateCommand(sql);
        command.Parameters.AddWithValue("id", bookingId);
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        var lotId = reader.GetGuid(2);
        var ownerId = reader.IsDBNull(4) ? (Guid?)null : reader.GetGuid(4);

        // Thứ tự cột tương ứng SELECT; LEFT JOIN cho phép booking không còn reservation hiện hành.
        var detail = new BookingDetailDto(
            BookingId: reader.GetGuid(0),
            BookingCode: reader.GetString(1),
            LotId: lotId,
            LotName: reader.GetString(3),
            SlotId: reader.IsDBNull(5) ? null : reader.GetGuid(5),
            SlotCode: reader.IsDBNull(6) ? null : reader.GetString(6),
            PlateSnapshot: reader.GetString(7),
            VehicleType: reader.GetString(8),
            StartsAt: reader.GetFieldValue<DateTimeOffset>(9),
            EndsAt: reader.GetFieldValue<DateTimeOffset>(10),
            HoldExpiresAt: reader.IsDBNull(11) ? null : reader.GetFieldValue<DateTimeOffset>(11),
            ArrivalDeadline: reader.GetFieldValue<DateTimeOffset>(12),
            Status: reader.GetString(13),
            EstimatedAmount: checked((long)reader.GetDecimal(14)),
            QrToken: null,
            CreatedAt: reader.GetFieldValue<DateTimeOffset>(15));

        return (detail, ownerId, lotId);
    }
}
