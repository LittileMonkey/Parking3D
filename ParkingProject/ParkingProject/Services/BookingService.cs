using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using ParkingProject.Contracts;
using ParkingProject.Data;
using ParkingProject.Domain;

namespace ParkingProject.Services;

public class BookingRuleException(string message) : Exception(message);

public class BookingService(ParkingDbContext db, TimeProvider clock)
{
    // Một transaction lock chung cho các thao tác thay đổi booking trong bản nền tảng.
    // PostgreSQL giữ lock xuyên nhiều API instance, tự giải phóng khi commit/rollback.
    public async Task LockAsync(CancellationToken ct) =>
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(26092301)", ct);

    public async Task ExpireAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var expired = await db.Bookings.Include(x => x.Slot)
            .Where(x => x.Status == BookingStatus.CONFIRMED && x.HoldUntil <= now).ToListAsync(ct);
        foreach (var booking in expired)
        {
            booking.Status = BookingStatus.EXPIRED;
            if (booking.Slot.Status == SlotStatus.RESERVED) booking.Slot.Status = SlotStatus.AVAILABLE;
        }
        await db.SaveChangesAsync(ct);
    }

    public async Task<BookingCreated> CreateAsync(CreateGuestBooking request, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await LockAsync(ct);
        await ExpireAsync(ct);
        if (request.VehicleType == VehicleType.MOTORBIKE && request.SlotId is not null)
            throw new BookingRuleException("Xe máy được tự động cấp slot, không chọn trực tiếp.");

        var plate = NormalizePlate(request.Plate);
        if (plate.Length < 5 || !plate.All(char.IsAsciiLetterOrDigit))
            throw new BookingRuleException("Biển số phải có ít nhất 5 chữ/số hợp lệ.");
        var vehicle = await db.Vehicles.SingleOrDefaultAsync(x => x.Plate == plate, ct);
        if (vehicle is not null && vehicle.Type != request.VehicleType)
            throw new BookingRuleException("Loại phương tiện không khớp biển số đã đăng ký.");
        if (vehicle is not null && await db.Bookings.AnyAsync(x => x.VehicleId == vehicle.Id &&
            (x.Status == BookingStatus.PENDING || x.Status == BookingStatus.CONFIRMED || x.Status == BookingStatus.CHECKED_IN), ct))
            throw new BookingRuleException("Xe đã có booking đang hoạt động.");

        var slots = db.Slots.Where(x => x.VehicleType == request.VehicleType);
        var total = await slots.CountAsync(ct);
        var occupied = await slots.CountAsync(x => x.Status == SlotStatus.OCCUPIED, ct);
        if (total == 0 || occupied * 100L > total * 90L)
            throw new BookingRuleException("CAPACITY_LOCKED: bãi không nhận thêm loại phương tiện này.");

        // Bản nền tảng chỉ cấp NORMAL; slot đặc biệt cần luồng xác minh quyền riêng.
        var candidates = slots.Where(x => x.Status == SlotStatus.AVAILABLE && x.SlotType == SlotType.NORMAL);
        if (request.SlotId is not null) candidates = candidates.Where(x => x.Id == request.SlotId);
        var slot = await candidates.OrderBy(x => x.ExitOrder).ThenBy(x => x.Id).FirstOrDefaultAsync(ct)
            ?? throw new BookingRuleException("Không có slot thường phù hợp đang trống.");
        if (vehicle is null)
        {
            vehicle = new Vehicle { Plate = plate, Type = request.VehicleType };
            db.Vehicles.Add(vehicle);
        }
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var now = clock.GetUtcNow();
        var booking = new Booking
        {
            Vehicle = vehicle, Slot = slot, SlotId = slot.Id, GuestPhone = request.Phone,
            CreatedAt = now, HoldUntil = now.AddMinutes(5), AccessTokenHash = HashToken(token)
        };
        slot.Status = SlotStatus.RESERVED;
        db.Bookings.Add(booking);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return new BookingCreated(View(booking), token);
    }

    public async Task<BookingView?> GetAsync(Guid id, string token, CancellationToken ct)
    {
        var hash = HashToken(token);
        var booking = await db.Bookings.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.AccessTokenHash == hash, ct);
        return booking is null ? null : View(booking);
    }

    public async Task<BookingView?> CancelAsync(Guid id, string token, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await LockAsync(ct);
        await ExpireAsync(ct);
        var hash = HashToken(token);
        var booking = await db.Bookings.Include(x => x.Slot).SingleOrDefaultAsync(x => x.Id == id && x.AccessTokenHash == hash, ct);
        if (booking is null) return null;
        if (booking.Status != BookingStatus.CANCELLED)
        {
            if (booking.Status != BookingStatus.CONFIRMED)
                throw new BookingRuleException("Chỉ hủy booking đang CONFIRMED.");
            booking.Status = BookingStatus.CANCELLED;
            if (booking.Slot.Status == SlotStatus.RESERVED) booking.Slot.Status = SlotStatus.AVAILABLE;
            await db.SaveChangesAsync(ct);
        }
        await transaction.CommitAsync(ct);
        return View(booking);
    }

    public static string NormalizePlate(string plate) => string.Concat(plate.Where(char.IsLetterOrDigit)).ToUpperInvariant();
    private static string HashToken(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
    private static BookingView View(Booking b) => new(b.Id, b.SlotId, b.Status, b.CreatedAt, b.HoldUntil);
}
