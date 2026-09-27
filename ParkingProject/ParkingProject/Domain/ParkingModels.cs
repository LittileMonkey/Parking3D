namespace ParkingProject.Domain;

public enum VehicleType { MOTORBIKE, CAR }
public enum SlotType { NORMAL, EV_CHARGING, PRIORITY, ACCESSIBLE }
public enum SlotStatus { AVAILABLE, RESERVED, OCCUPIED, MAINTENANCE, DISABLED }
public enum BookingStatus { PENDING, CONFIRMED, EXPIRED, CANCELLED, CHECKED_IN, COMPLETED, NO_SHOW }

public class ParkingSlot
{
    public string Id { get; set; } = "";
    public string Floor { get; set; } = "";
    public string Zone { get; set; } = "";
    public VehicleType VehicleType { get; set; }
    public SlotType SlotType { get; set; }
    public SlotStatus Status { get; set; }
    // Thứ tự tương đối trong dữ liệu demo; cần cập nhật từ bản vẽ 3D thực tế.
    public int ExitOrder { get; set; }
    public uint Version { get; set; }
}

public class Vehicle
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Plate { get; set; } = "";
    public VehicleType Type { get; set; }
}

public class Booking
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid VehicleId { get; set; }
    public Vehicle Vehicle { get; set; } = null!;
    public string SlotId { get; set; } = "";
    public ParkingSlot Slot { get; set; } = null!;
    public string GuestPhone { get; set; } = "";
    public BookingStatus Status { get; set; } = BookingStatus.CONFIRMED;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset HoldUntil { get; set; }
    // Chỉ trả token gốc một lần khi tạo booking; database lưu hash.
    public string AccessTokenHash { get; set; } = "";
}
