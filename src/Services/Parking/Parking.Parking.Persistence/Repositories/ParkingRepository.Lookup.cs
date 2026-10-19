using Npgsql;
using Parking.Parking.Application.DTOs;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
    // Kèm owner/lot để Application kiểm tra quyền trước khi trả dữ liệu cho client.
    public async Task<(BookingDetailDto Detail, Guid? CustomerId, Guid LotId)?> GetBookingDetailAsync(
        Guid bookingId, CancellationToken ct)
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
        await using var cmd = db.CreateCommand(sql);
        cmd.Parameters.AddWithValue("id", bookingId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        var lotId = reader.GetGuid(2);
        var owner = reader.IsDBNull(4) ? (Guid?)null : reader.GetGuid(4);
        // QR issuance belongs to SCRUM-49. Never expose a nonce hash as a scannable token.
        var detail = new BookingDetailDto(reader.GetGuid(0),reader.GetString(1),lotId,reader.GetString(3),
            reader.IsDBNull(5) ? null : reader.GetGuid(5),reader.IsDBNull(6) ? null : reader.GetString(6),
            reader.GetString(7),reader.GetString(8),reader.GetFieldValue<DateTimeOffset>(9),reader.GetFieldValue<DateTimeOffset>(10),
            reader.IsDBNull(11) ? null : reader.GetFieldValue<DateTimeOffset>(11),reader.GetFieldValue<DateTimeOffset>(12),
            reader.GetString(13),checked((long)reader.GetDecimal(14)),null,reader.GetFieldValue<DateTimeOffset>(15));
        return (detail,owner,lotId);
    }
}
