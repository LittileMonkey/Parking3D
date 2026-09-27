$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot 'Models'
function Save-Source([string]$relative, [string]$body) {
    $path = Join-Path $root $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $path) | Out-Null
    [System.IO.File]::WriteAllText($path, $body, [System.Text.UTF8Encoding]::new($false))
}
function Model([string]$group, [string]$name, [string]$properties) {
    Save-Source "$group/$name.cs" @"
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class $name : Entity
{
$properties
}
"@
}
Save-Source 'Common/Entity.cs' @'
namespace ParkingSystem.Models;

/// <summary>Base entity. Services must update UpdatedAt when modifying records.</summary>
public abstract class Entity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }
}
'@
$enums = @{
    PlatformRole = 'Customer = 0, Admin = 1'
    LotRole = 'Staff = 0, Manager = 1'
    UserStatus = 'Active = 0, Suspended = 1, Deactivated = 2'
    VehicleType = 'Motorbike = 0, Car = 1, Other = 2'
    FuelType = 'Unknown = 0, Gasoline = 1, Electric = 2, Hybrid = 3'
    ParkingLotStatus = 'Inactive = 0, Active = 1, TemporarilyClosed = 2'
    LevelType = 'Ground = 0, Basement = 1, Floor = 2, Outdoor = 3, Rooftop = 4, Other = 5'
    OperationalStatus = 'Active = 0, Maintenance = 1, Disabled = 2'
    GateType = 'Entry = 0, Exit = 1, EntryAndExit = 2'
    MapStatus = 'Draft = 0, Published = 1, Archived = 2'
    MapObjectType = 'ParkingSlot = 0, Road = 1, Wall = 2, Entrance = 3, Exit = 4, Ramp = 5, Elevator = 6, Stair = 7, Charger = 8, Label = 9, Other = 10'
    BookingMode = 'ExactSlot = 0, AutoSlot = 1'
    BookingStatus = 'PendingPayment = 0, Confirmed = 1, CheckedIn = 2, Completed = 3, Cancelled = 4, Expired = 5, NoShow = 6'
    ReservationStatus = 'Held = 0, Confirmed = 1, Released = 2'
    SessionStatus = 'Active = 0, ExitPending = 1, Completed = 2'
    PricingPlanStatus = 'Draft = 0, Active = 1, Archived = 2'
    PricingRuleType = 'Hourly = 0, PerMinute = 1, BillingUnit = 2, FlatRate = 3, Tiered = 4, DayNight = 5, Overnight = 6, DailyCap = 7, PeakMultiplier = 8, ZoneSurcharge = 9'
    PaymentMethod = 'VnPay = 0, Cash = 1'
    PaymentStatus = 'Pending = 0, Success = 1, Failed = 2, Refunded = 3, PartiallyRefunded = 4'
    PaymentType = 'BookingPrepayment = 0, ParkingFee = 1, OvertimeFee = 2'
    TransactionType = 'Charge = 0, Refund = 1'
    TransactionStatus = 'Pending = 0, Success = 1, Failed = 2'
    OtpPurpose = 'GuestBooking = 0'
    IssueType = 'LostTicket = 0, WrongZone = 1, WrongSlot = 2, UnpaidExit = 3, Overstay = 4, SlotConflict = 5, Other = 6'
    IssueStatus = 'Reported = 0, UnderReview = 1, Confirmed = 2, Rejected = 3, Resolved = 4'
    CameraEventType = 'EntryDetected = 0, ExitDetected = 1, SlotOccupancyDetected = 2, PlateRecognized = 3, BarrierEvent = 4'
    EventReviewStatus = 'Pending = 0, Accepted = 1, NeedsReview = 2, Rejected = 3'
    NotificationChannel = 'Web = 0, Email = 1, Sms = 2'
    NotificationStatus = 'Pending = 0, Sent = 1, Failed = 2'
    AuditActorType = 'User = 0, Guest = 1, System = 2, PaymentGateway = 3, CameraSimulator = 4'
}
foreach ($entry in $enums.GetEnumerator()) {
    Save-Source "Enums/$($entry.Key).cs" "namespace ParkingSystem.Models;`n`npublic enum $($entry.Key)`n{`n    $($entry.Value)`n}`n"
}
Model 'Identity' 'User' @'
    [Required, MaxLength(150)] public string FullName { get; set; } = string.Empty;
    [MaxLength(254)] public string? Email { get; set; }
    [MaxLength(32)] public string? PhoneNumber { get; set; }
    [Required, MaxLength(512), JsonIgnore] public string PasswordHash { get; set; } = string.Empty;
    public PlatformRole PlatformRole { get; set; } = PlatformRole.Customer;
    public UserStatus Status { get; set; } = UserStatus.Active;
    public DateTimeOffset? PhoneVerifiedAt { get; set; }
    public ICollection<Vehicle> Vehicles { get; set; } = new List<Vehicle>();
    public ICollection<FacilityStaffAssignment> StaffAssignments { get; set; } = new List<FacilityStaffAssignment>();
'@
Model 'Identity' 'FacilityStaffAssignment' @'
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid ParkingLotId { get; set; }
    public ParkingLot ParkingLot { get; set; } = null!;
    public LotRole Role { get; set; } = LotRole.Staff;
    public DateTimeOffset ActiveFrom { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ActiveTo { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public Guid? AssignedByUserId { get; set; }
    public User? AssignedByUser { get; set; }
    // Explicit delegation; being a Manager alone does not grant staff-assignment permission.
    public bool CanManageStaffAssignments { get; set; }
'@
Model 'Identity' 'OtpChallenge' @'
    [Required, MaxLength(32)] public string PhoneNumber { get; set; } = string.Empty;
    [Required, MaxLength(32)] public string NormalizedPlate { get; set; } = string.Empty;
    public OtpPurpose Purpose { get; set; } = OtpPurpose.GuestBooking;
    // Store a keyed hash (HMAC), never the raw OTP. Keep the key outside the database.
    [Required, MaxLength(128), JsonIgnore] public string CodeHash { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? VerifiedAt { get; set; }
    public DateTimeOffset? ConsumedAt { get; set; }
    public DateTimeOffset? InvalidatedAt { get; set; }
    public int FailedAttempts { get; set; }
    public int MaxAttempts { get; set; } = 5;
'@
Model 'Identity' 'Vehicle' @'
    public Guid? OwnerUserId { get; set; }
    public User? OwnerUser { get; set; }
    [Required, MaxLength(32)] public string LicensePlate { get; set; } = string.Empty;
    [Required, MaxLength(32)] public string NormalizedPlate { get; set; } = string.Empty;
    public VehicleType VehicleType { get; set; }
    public FuelType FuelType { get; set; } = FuelType.Unknown;
    public bool IsActive { get; set; } = true;
    public bool IsPrimary { get; set; }
'@
Model 'Parking' 'ParkingLot' @'
    [Required, MaxLength(32)] public string Code { get; set; } = string.Empty;
    [Required, MaxLength(200)] public string Name { get; set; } = string.Empty;
    [MaxLength(2000)] public string? Description { get; set; }
    [Required, MaxLength(500)] public string Address { get; set; } = string.Empty;
    [Range(-90d, 90d)] public double Latitude { get; set; }
    [Range(-180d, 180d)] public double Longitude { get; set; }
    [Required, MaxLength(64)] public string TimeZoneId { get; set; } = "Asia/Ho_Chi_Minh";
    public ParkingLotStatus Status { get; set; } = ParkingLotStatus.Inactive;
    [MaxLength(1000)] public string? MapThumbnailUrl { get; set; }
    public ICollection<ParkingLevel> Levels { get; set; } = new List<ParkingLevel>();
    public ICollection<OperatingHours> OperatingHours { get; set; } = new List<OperatingHours>();
    public ICollection<EntranceExit> Gates { get; set; } = new List<EntranceExit>();
    public ParkingPolicy? Policy { get; set; }
'@
Model 'Parking' 'ParkingLevel' @'
    public Guid ParkingLotId { get; set; }
    public ParkingLot ParkingLot { get; set; } = null!;
    [Required, MaxLength(32)] public string Code { get; set; } = string.Empty;
    [Required, MaxLength(100)] public string Name { get; set; } = string.Empty;
    public LevelType LevelType { get; set; }
    public int DisplayOrder { get; set; }
    public ICollection<Zone> Zones { get; set; } = new List<Zone>();
'@
Model 'Parking' 'Zone' @'
    public Guid ParkingLevelId { get; set; }
    public ParkingLevel ParkingLevel { get; set; } = null!;
    [Required, MaxLength(32)] public string Code { get; set; } = string.Empty;
    [Required, MaxLength(100)] public string Name { get; set; } = string.Empty;
    public OperationalStatus Status { get; set; } = OperationalStatus.Active;
    public int AllocationPriority { get; set; }
    public ICollection<ParkingSlot> Slots { get; set; } = new List<ParkingSlot>();
'@
Model 'Parking' 'ParkingSlot' @'
    public Guid ZoneId { get; set; }
    public Zone Zone { get; set; } = null!;
    [Required, MaxLength(32)] public string Code { get; set; } = string.Empty;
    public List<VehicleType> SupportedVehicleTypes { get; set; } = new();
    public OperationalStatus OperationalStatus { get; set; } = OperationalStatus.Active;
    public decimal? WidthMeters { get; set; }
    public decimal? LengthMeters { get; set; }
    public decimal? DistanceToExitMeters { get; set; }
    // Application-managed optimistic concurrency token; increment on every update.
    [ConcurrencyCheck] public long Version { get; set; } = 1;
    public ICollection<ParkingSlotFeature> Features { get; set; } = new List<ParkingSlotFeature>();
'@
Model 'Parking' 'SlotFeature' @'
    [Required, MaxLength(40)] public string Code { get; set; } = string.Empty;
    [Required, MaxLength(100)] public string Name { get; set; } = string.Empty;
    public ICollection<ParkingSlotFeature> Slots { get; set; } = new List<ParkingSlotFeature>();
'@
Model 'Parking' 'ParkingSlotFeature' @'
    public Guid ParkingSlotId { get; set; }
    public ParkingSlot ParkingSlot { get; set; } = null!;
    public Guid SlotFeatureId { get; set; }
    public SlotFeature SlotFeature { get; set; } = null!;
'@
Model 'Parking' 'OperatingHours' @'
    public Guid ParkingLotId { get; set; }
    public ParkingLot ParkingLot { get; set; } = null!;
    public DayOfWeek DayOfWeek { get; set; }
    public bool IsClosed { get; set; }
    public bool IsOpen24Hours { get; set; }
    public TimeOnly? OpensAt { get; set; }
    public TimeOnly? ClosesAt { get; set; }
    // True means ClosesAt belongs to the following local calendar day.
    public bool ClosesNextDay { get; set; }
'@
Model 'Parking' 'EntranceExit' @'
    public Guid ParkingLotId { get; set; }
    public ParkingLot ParkingLot { get; set; } = null!;
    [Required, MaxLength(32)] public string Code { get; set; } = string.Empty;
    [Required, MaxLength(100)] public string Name { get; set; } = string.Empty;
    public GateType GateType { get; set; }
    public bool IsActive { get; set; } = true;
'@
Model 'Parking' 'ParkingPolicy' @'
    public Guid ParkingLotId { get; set; }
    public ParkingLot ParkingLot { get; set; } = null!;
    public bool AllowGuestBookings { get; set; } = true;
    public int PaymentHoldMinutes { get; set; } = 15;
    public int MinimumBookingMinutes { get; set; } = 30;
    public int MaximumBookingMinutes { get; set; } = 1440;
    public bool RequireFullPrepayment { get; set; } = true;
    public bool RefundUnusedTimeOnEarlyExit { get; set; } = false;
    public bool ChargeOvertime { get; set; } = true;
    // Null means not agreed/configured yet; do not silently interpret as zero.
    public int? EarlyArrivalMinutes { get; set; }
    public int? LateArrivalMinutes { get; set; }
    public int? QrLifetimeMinutes { get; set; }
    public int? ExitGraceMinutes { get; set; }
    public int? CancellationRefundCutoffMinutes { get; set; }
    public decimal? CancellationRefundPercent { get; set; }
'@
Model 'Maps' 'MapVersion' @'
    public Guid ParkingLotId { get; set; }
    public ParkingLot ParkingLot { get; set; } = null!;
    public int VersionNumber { get; set; }
    public MapStatus Status { get; set; } = MapStatus.Draft;
    public DateTimeOffset? PublishedAt { get; set; }
    public ICollection<MapObject> Objects { get; set; } = new List<MapObject>();
'@
Model 'Maps' 'MapObject' @'
    public Guid MapVersionId { get; set; }
    public MapVersion MapVersion { get; set; } = null!;
    public Guid? ParkingLevelId { get; set; }
    public ParkingLevel? ParkingLevel { get; set; }
    public Guid? ParkingSlotId { get; set; }
    public ParkingSlot? ParkingSlot { get; set; }
    public MapObjectType ObjectType { get; set; }
    public double PositionX { get; set; }
    public double PositionY { get; set; }
    public double PositionZ { get; set; }
    public double RotationX { get; set; }
    public double RotationY { get; set; }
    public double RotationZ { get; set; }
    public double ScaleX { get; set; } = 1;
    public double ScaleY { get; set; } = 1;
    public double ScaleZ { get; set; } = 1;
    [Column(TypeName = "jsonb")] public string MetadataJson { get; set; } = "{}";
'@
Model 'Bookings' 'Booking' @'
    [Required, MaxLength(40)] public string BookingCode { get; set; } = string.Empty;
    public Guid ParkingLotId { get; set; }
    public ParkingLot ParkingLot { get; set; } = null!;
    public Guid? UserId { get; set; }
    public User? User { get; set; }
    public Guid? VehicleId { get; set; }
    public Vehicle? Vehicle { get; set; }
    [Required, MaxLength(32)] public string PlateSnapshot { get; set; } = string.Empty;
    [Required, MaxLength(32)] public string NormalizedPlate { get; set; } = string.Empty;
    public VehicleType VehicleType { get; set; }
    [MaxLength(32)] public string? GuestPhoneNumber { get; set; }
    public Guid? GuestOtpChallengeId { get; set; }
    public OtpChallenge? GuestOtpChallenge { get; set; }
    public BookingMode Mode { get; set; }
    public DateTimeOffset StartAt { get; set; }
    public DateTimeOffset EndAt { get; set; }
    public DateTimeOffset HoldExpiresAt { get; set; }
    public BookingStatus Status { get; set; } = BookingStatus.PendingPayment;
    [Column(TypeName = "numeric(18,2)")] public decimal QuotedTotal { get; set; }
    [Required, StringLength(3)] public string Currency { get; set; } = "VND";
    [ConcurrencyCheck] public long Version { get; set; } = 1;
    public ICollection<SlotReservation> Reservations { get; set; } = new List<SlotReservation>();
    public ICollection<QRToken> QrTokens { get; set; } = new List<QRToken>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public ParkingSession? Session { get; set; }
    public PricingSnapshot? PricingSnapshot { get; set; }
'@
Model 'Bookings' 'SlotReservation' @'
    public Guid BookingId { get; set; }
    public Booking Booking { get; set; } = null!;
    public Guid ParkingSlotId { get; set; }
    public ParkingSlot ParkingSlot { get; set; } = null!;
    public DateTimeOffset ReservedFrom { get; set; }
    public DateTimeOffset ReservedUntil { get; set; }
    public ReservationStatus Status { get; set; } = ReservationStatus.Held;
    public DateTimeOffset? ReleasedAt { get; set; }
    [MaxLength(500)] public string? ReleaseReason { get; set; }
'@
Model 'Bookings' 'QRToken' @'
    public Guid BookingId { get; set; }
    public Booking Booking { get; set; } = null!;
    [Required, MaxLength(128), JsonIgnore] public string NonceHash { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? ConsumedAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
'@
Model 'Bookings' 'ParkingSession' @'
    public Guid ParkingLotId { get; set; }
    public ParkingLot ParkingLot { get; set; } = null!;
    public Guid? BookingId { get; set; }
    public Booking? Booking { get; set; }
    public Guid? VehicleId { get; set; }
    public Vehicle? Vehicle { get; set; }
    [Required, MaxLength(32)] public string PlateSnapshot { get; set; } = string.Empty;
    [Required, MaxLength(32)] public string NormalizedPlate { get; set; } = string.Empty;
    public VehicleType VehicleType { get; set; }
    public Guid ParkingSlotId { get; set; }
    public ParkingSlot ParkingSlot { get; set; } = null!;
    public DateTimeOffset EnteredAt { get; set; }
    public DateTimeOffset? ExitRequestedAt { get; set; }
    public DateTimeOffset? ExitedAt { get; set; }
    public DateTimeOffset? FeeCalculatedThrough { get; set; }
    public SessionStatus Status { get; set; } = SessionStatus.Active;
    [Column(TypeName = "numeric(18,2)")] public decimal? FinalFee { get; set; }
    [Required, StringLength(3)] public string Currency { get; set; } = "VND";
    [ConcurrencyCheck] public long Version { get; set; } = 1;
    public PricingSnapshot? PricingSnapshot { get; set; }
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
'@
Model 'Pricing' 'PricingPlan' @'
    public Guid ParkingLotId { get; set; }
    public ParkingLot ParkingLot { get; set; } = null!;
    [Required, MaxLength(150)] public string Name { get; set; } = string.Empty;
    public int VersionNumber { get; set; }
    public DateTimeOffset EffectiveFrom { get; set; }
    public DateTimeOffset? EffectiveTo { get; set; }
    public PricingPlanStatus Status { get; set; } = PricingPlanStatus.Draft;
    [Required, StringLength(3)] public string Currency { get; set; } = "VND";
    public ICollection<PricingRule> Rules { get; set; } = new List<PricingRule>();
'@
Model 'Pricing' 'PricingRule' @'
    public Guid PricingPlanId { get; set; }
    public PricingPlan PricingPlan { get; set; } = null!;
    public Guid? ZoneId { get; set; }
    public Zone? Zone { get; set; }
    public PricingRuleType RuleType { get; set; }
    public VehicleType VehicleType { get; set; }
    public int Priority { get; set; }
    // Validate a typed rule payload in the pricing service before saving/publishing.
    [Column(TypeName = "jsonb")] public string ParametersJson { get; set; } = "{}";
'@
Model 'Pricing' 'PricingSnapshot' @'
    public Guid PricingPlanId { get; set; }
    public PricingPlan PricingPlan { get; set; } = null!;
    public Guid? BookingId { get; set; }
    public Booking? Booking { get; set; }
    public Guid? ParkingSessionId { get; set; }
    public ParkingSession? ParkingSession { get; set; }
    public int PricingPlanVersion { get; set; }
    [Column(TypeName = "jsonb")] public string ResolvedRulesJson { get; set; } = "{}";
    [Required, StringLength(3)] public string Currency { get; set; } = "VND";
    public DateTimeOffset CapturedAt { get; set; } = DateTimeOffset.UtcNow;
'@
Model 'Payments' 'Payment' @'
    // Exactly one of BookingId/ParkingSessionId must be present.
    public Guid? BookingId { get; set; }
    public Booking? Booking { get; set; }
    public Guid? ParkingSessionId { get; set; }
    public ParkingSession? ParkingSession { get; set; }
    [Column(TypeName = "numeric(18,2)")] public decimal Amount { get; set; }
    [Required, StringLength(3)] public string Currency { get; set; } = "VND";
    public PaymentType Type { get; set; }
    public PaymentMethod Method { get; set; }
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
    [Required, MaxLength(128)] public string IdempotencyKey { get; set; } = string.Empty;
    public DateTimeOffset? PaidAt { get; set; }
    public Guid? CashConfirmedByUserId { get; set; }
    public User? CashConfirmedByUser { get; set; }
    [ConcurrencyCheck] public long Version { get; set; } = 1;
    public ICollection<PaymentTransaction> Transactions { get; set; } = new List<PaymentTransaction>();
'@
Model 'Payments' 'PaymentTransaction' @'
    public Guid PaymentId { get; set; }
    public Payment Payment { get; set; } = null!;
    [Required, MaxLength(40)] public string Provider { get; set; } = string.Empty;
    [MaxLength(128)] public string? ProviderReference { get; set; }
    [Required, MaxLength(128)] public string RequestReference { get; set; } = string.Empty;
    [MaxLength(200)] public string? EventKey { get; set; }
    public TransactionType Type { get; set; }
    public TransactionStatus Status { get; set; } = TransactionStatus.Pending;
    [Column(TypeName = "numeric(18,2)")] public decimal Amount { get; set; }
    [MaxLength(40)] public string? ResponseCode { get; set; }
    public DateTimeOffset? VerifiedAt { get; set; }
'@
Model 'Operations' 'AuditLog' @'
    public Guid? ActorUserId { get; set; }
    public User? ActorUser { get; set; }
    public AuditActorType ActorType { get; set; }
    public Guid? ParkingLotId { get; set; }
    public ParkingLot? ParkingLot { get; set; }
    [Required, MaxLength(100)] public string Action { get; set; } = string.Empty;
    [Required, MaxLength(100)] public string EntityType { get; set; } = string.Empty;
    [Required, MaxLength(128)] public string EntityId { get; set; } = string.Empty;
    [Column(TypeName = "jsonb")] public string? OldValueJson { get; set; }
    [Column(TypeName = "jsonb")] public string? NewValueJson { get; set; }
    [MaxLength(1000)] public string? Reason { get; set; }
    [MaxLength(128)] public string? RequestId { get; set; }
'@
Model 'Operations' 'Notification' @'
    public Guid? UserId { get; set; }
    public User? User { get; set; }
    public Guid? BookingId { get; set; }
    public Booking? Booking { get; set; }
    [MaxLength(254)] public string? Recipient { get; set; }
    public NotificationChannel Channel { get; set; } = NotificationChannel.Web;
    public NotificationStatus Status { get; set; } = NotificationStatus.Pending;
    [Required, MaxLength(200)] public string Title { get; set; } = string.Empty;
    [Required, MaxLength(4000)] public string Body { get; set; } = string.Empty;
    public DateTimeOffset? SentAt { get; set; }
    public DateTimeOffset? ReadAt { get; set; }
'@
Model 'Operations' 'CameraEvent' @'
    public Guid ParkingLotId { get; set; }
    public ParkingLot ParkingLot { get; set; } = null!;
    [Required, MaxLength(128)] public string ExternalEventId { get; set; } = string.Empty;
    [Required, MaxLength(64)] public string CameraId { get; set; } = string.Empty;
    public Guid? ParkingSlotId { get; set; }
    public ParkingSlot? ParkingSlot { get; set; }
    public CameraEventType EventType { get; set; }
    public DateTimeOffset OccurredAt { get; set; }
    [MaxLength(32)] public string? PlateNumber { get; set; }
    [Range(0d, 1d)] public double? Confidence { get; set; }
    public EventReviewStatus ReviewStatus { get; set; } = EventReviewStatus.Pending;
    public Guid? ReviewedByUserId { get; set; }
    public User? ReviewedByUser { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
'@
Model 'Operations' 'ParkingIssue' @'
    public Guid ParkingLotId { get; set; }
    public ParkingLot ParkingLot { get; set; } = null!;
    public Guid? ParkingSessionId { get; set; }
    public ParkingSession? ParkingSession { get; set; }
    public Guid? BookingId { get; set; }
    public Booking? Booking { get; set; }
    public Guid? CameraEventId { get; set; }
    public CameraEvent? CameraEvent { get; set; }
    public IssueType Type { get; set; }
    public IssueStatus Status { get; set; } = IssueStatus.Reported;
    [Required, MaxLength(2000)] public string Description { get; set; } = string.Empty;
    public Guid? ReportedByUserId { get; set; }
    public User? ReportedByUser { get; set; }
    public Guid? ResolvedByUserId { get; set; }
    public User? ResolvedByUser { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
    [MaxLength(2000)] public string? Resolution { get; set; }
'@
