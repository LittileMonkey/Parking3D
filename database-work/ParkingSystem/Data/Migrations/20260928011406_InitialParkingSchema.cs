using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParkingSystem.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialParkingSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:btree_gist", ",,");

            migrationBuilder.CreateTable(
                name: "OtpChallenges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    PhoneNumber = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    NormalizedPlate = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Purpose = table.Column<int>(type: "integer", nullable: false),
                    CodeHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    VerifiedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ConsumedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    InvalidatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    FailedAttempts = table.Column<int>(type: "integer", nullable: false),
                    MaxAttempts = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OtpChallenges", x => x.Id);
                    table.CheckConstraint("CK_Otp_Attempts", "\"MaxAttempts\" > 0 AND \"FailedAttempts\" BETWEEN 0 AND \"MaxAttempts\"");
                    table.CheckConstraint("CK_Otp_Consumption", "\"ConsumedAt\" IS NULL OR (\"VerifiedAt\" IS NOT NULL AND \"ConsumedAt\" >= \"VerifiedAt\")");
                    table.CheckConstraint("CK_Otp_Expiry", "\"ExpiresAt\" > \"CreatedAt\"");
                    table.CheckConstraint("CK_OtpChallenges_Purpose", "\"Purpose\" IN (0)");
                });

            migrationBuilder.CreateTable(
                name: "ParkingLots",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    Code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Latitude = table.Column<double>(type: "double precision", nullable: false),
                    Longitude = table.Column<double>(type: "double precision", nullable: false),
                    TimeZoneId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    MapThumbnailUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParkingLots", x => x.Id);
                    table.CheckConstraint("CK_Lots_Coordinates", "\"Latitude\" BETWEEN -90 AND 90 AND \"Longitude\" BETWEEN -180 AND 180");
                    table.CheckConstraint("CK_ParkingLots_Status", "\"Status\" IN (0,1,2)");
                });

            migrationBuilder.CreateTable(
                name: "SlotFeatures",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SlotFeatures", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    FullName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: true),
                    PhoneNumber = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    PasswordHash = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    PlatformRole = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    PhoneVerifiedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                    table.CheckConstraint("CK_Users_Login", "\"Email\" IS NOT NULL OR \"PhoneNumber\" IS NOT NULL");
                    table.CheckConstraint("CK_Users_PlatformRole", "\"PlatformRole\" IN (0,1)");
                    table.CheckConstraint("CK_Users_Status", "\"Status\" IN (0,1,2)");
                });

            migrationBuilder.CreateTable(
                name: "EntranceExits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    ParkingLotId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    GateType = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EntranceExits", x => x.Id);
                    table.CheckConstraint("CK_EntranceExits_GateType", "\"GateType\" IN (0,1,2)");
                    table.ForeignKey(
                        name: "FK_EntranceExits_ParkingLots_ParkingLotId",
                        column: x => x.ParkingLotId,
                        principalTable: "ParkingLots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MapVersions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    ParkingLotId = table.Column<Guid>(type: "uuid", nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    PublishedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MapVersions", x => x.Id);
                    table.UniqueConstraint("AK_MapVersions_Id_ParkingLotId", x => new { x.Id, x.ParkingLotId });
                    table.CheckConstraint("CK_MapVersions_Number", "\"VersionNumber\" > 0");
                    table.CheckConstraint("CK_MapVersions_Status", "\"Status\" IN (0,1,2)");
                    table.ForeignKey(
                        name: "FK_MapVersions_ParkingLots_ParkingLotId",
                        column: x => x.ParkingLotId,
                        principalTable: "ParkingLots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OperatingHours",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    ParkingLotId = table.Column<Guid>(type: "uuid", nullable: false),
                    DayOfWeek = table.Column<int>(type: "integer", nullable: false),
                    IsClosed = table.Column<bool>(type: "boolean", nullable: false),
                    IsOpen24Hours = table.Column<bool>(type: "boolean", nullable: false),
                    OpensAt = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    ClosesAt = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    ClosesNextDay = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OperatingHours", x => x.Id);
                    table.CheckConstraint("CK_Hours_Interval", "((\"IsClosed\" <> \"IsOpen24Hours\") AND \"OpensAt\" IS NULL AND \"ClosesAt\" IS NULL AND NOT \"ClosesNextDay\") OR (NOT \"IsClosed\" AND NOT \"IsOpen24Hours\" AND \"OpensAt\" IS NOT NULL AND \"ClosesAt\" IS NOT NULL AND ((NOT \"ClosesNextDay\" AND \"OpensAt\" < \"ClosesAt\") OR (\"ClosesNextDay\" AND \"ClosesAt\" < \"OpensAt\")))");
                    table.CheckConstraint("CK_OperatingHours_DayOfWeek", "\"DayOfWeek\" IN (0,1,2,3,4,5,6)");
                    table.ForeignKey(
                        name: "FK_OperatingHours_ParkingLots_ParkingLotId",
                        column: x => x.ParkingLotId,
                        principalTable: "ParkingLots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ParkingLevels",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    ParkingLotId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    LevelType = table.Column<int>(type: "integer", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParkingLevels", x => x.Id);
                    table.UniqueConstraint("AK_ParkingLevels_Id_ParkingLotId", x => new { x.Id, x.ParkingLotId });
                    table.CheckConstraint("CK_ParkingLevels_LevelType", "\"LevelType\" IN (0,1,2,3,4,5)");
                    table.ForeignKey(
                        name: "FK_ParkingLevels_ParkingLots_ParkingLotId",
                        column: x => x.ParkingLotId,
                        principalTable: "ParkingLots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ParkingPolicies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    ParkingLotId = table.Column<Guid>(type: "uuid", nullable: false),
                    AllowGuestBookings = table.Column<bool>(type: "boolean", nullable: false),
                    PaymentHoldMinutes = table.Column<int>(type: "integer", nullable: false),
                    MinimumBookingMinutes = table.Column<int>(type: "integer", nullable: false),
                    MaximumBookingMinutes = table.Column<int>(type: "integer", nullable: false),
                    RequireFullPrepayment = table.Column<bool>(type: "boolean", nullable: false),
                    RefundUnusedTimeOnEarlyExit = table.Column<bool>(type: "boolean", nullable: false),
                    ChargeOvertime = table.Column<bool>(type: "boolean", nullable: false),
                    EarlyArrivalMinutes = table.Column<int>(type: "integer", nullable: true),
                    LateArrivalMinutes = table.Column<int>(type: "integer", nullable: true),
                    QrLifetimeMinutes = table.Column<int>(type: "integer", nullable: true),
                    ExitGraceMinutes = table.Column<int>(type: "integer", nullable: true),
                    CancellationRefundCutoffMinutes = table.Column<int>(type: "integer", nullable: true),
                    CancellationRefundPercent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParkingPolicies", x => x.Id);
                    table.CheckConstraint("CK_Policy_Durations", "\"PaymentHoldMinutes\" > 0 AND \"MinimumBookingMinutes\" > 0 AND \"MaximumBookingMinutes\" >= \"MinimumBookingMinutes\"");
                    table.CheckConstraint("CK_Policy_OptionalWindows", "(\"EarlyArrivalMinutes\" IS NULL OR \"EarlyArrivalMinutes\" >= 0) AND (\"LateArrivalMinutes\" IS NULL OR \"LateArrivalMinutes\" >= 0) AND (\"QrLifetimeMinutes\" IS NULL OR \"QrLifetimeMinutes\" > 0) AND (\"ExitGraceMinutes\" IS NULL OR \"ExitGraceMinutes\" >= 0)");
                    table.CheckConstraint("CK_Policy_Refund", "(\"CancellationRefundCutoffMinutes\" IS NULL AND \"CancellationRefundPercent\" IS NULL) OR (\"CancellationRefundCutoffMinutes\" IS NOT NULL AND \"CancellationRefundCutoffMinutes\" >= 0 AND \"CancellationRefundPercent\" IS NOT NULL AND \"CancellationRefundPercent\" BETWEEN 0 AND 100)");
                    table.ForeignKey(
                        name: "FK_ParkingPolicies_ParkingLots_ParkingLotId",
                        column: x => x.ParkingLotId,
                        principalTable: "ParkingLots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PricingPlans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    ParkingLotId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
                    EffectiveFrom = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    EffectiveTo = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PricingPlans", x => x.Id);
                    table.UniqueConstraint("AK_PricingPlans_Id_ParkingLotId", x => new { x.Id, x.ParkingLotId });
                    table.CheckConstraint("CK_Plans_Period", "\"VersionNumber\" > 0 AND (\"EffectiveTo\" IS NULL OR \"EffectiveTo\" > \"EffectiveFrom\")");
                    table.CheckConstraint("CK_PricingPlans_Status", "\"Status\" IN (0,1,2)");
                    table.ForeignKey(
                        name: "FK_PricingPlans_ParkingLots_ParkingLotId",
                        column: x => x.ParkingLotId,
                        principalTable: "ParkingLots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AuditLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActorType = table.Column<int>(type: "integer", nullable: false),
                    ParkingLotId = table.Column<Guid>(type: "uuid", nullable: true),
                    Action = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    EntityType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    EntityId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    OldValueJson = table.Column<string>(type: "jsonb", nullable: true),
                    NewValueJson = table.Column<string>(type: "jsonb", nullable: true),
                    Reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    RequestId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLogs", x => x.Id);
                    table.CheckConstraint("CK_AuditLogs_ActorType", "\"ActorType\" IN (0,1,2,3,4)");
                    table.ForeignKey(
                        name: "FK_AuditLogs_ParkingLots_ParkingLotId",
                        column: x => x.ParkingLotId,
                        principalTable: "ParkingLots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AuditLogs_Users_ActorUserId",
                        column: x => x.ActorUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "StaffAssignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParkingLotId = table.Column<Guid>(type: "uuid", nullable: false),
                    Role = table.Column<int>(type: "integer", nullable: false),
                    ActiveFrom = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ActiveTo = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RevokedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AssignedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CanManageStaffAssignments = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StaffAssignments", x => x.Id);
                    table.CheckConstraint("CK_Assignments_Delegation", "NOT \"CanManageStaffAssignments\" OR \"Role\" = 1");
                    table.CheckConstraint("CK_Assignments_Period", "\"ActiveTo\" IS NULL OR \"ActiveTo\" > \"ActiveFrom\"");
                    table.CheckConstraint("CK_StaffAssignments_Role", "\"Role\" IN (0,1)");
                    table.ForeignKey(
                        name: "FK_StaffAssignments_ParkingLots_ParkingLotId",
                        column: x => x.ParkingLotId,
                        principalTable: "ParkingLots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StaffAssignments_Users_AssignedByUserId",
                        column: x => x.AssignedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StaffAssignments_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Vehicles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    OwnerUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    LicensePlate = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    NormalizedPlate = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    VehicleType = table.Column<int>(type: "integer", nullable: false),
                    FuelType = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsPrimary = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Vehicles", x => x.Id);
                    table.CheckConstraint("CK_Vehicles_FuelType", "\"FuelType\" IN (0,1,2,3)");
                    table.CheckConstraint("CK_Vehicles_VehicleType", "\"VehicleType\" IN (0,1,2)");
                    table.ForeignKey(
                        name: "FK_Vehicles_Users_OwnerUserId",
                        column: x => x.OwnerUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Zones",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    ParkingLotId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParkingLevelId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    AllocationPriority = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Zones", x => x.Id);
                    table.UniqueConstraint("AK_Zones_Id_ParkingLotId", x => new { x.Id, x.ParkingLotId });
                    table.CheckConstraint("CK_Zones_Status", "\"Status\" IN (0,1,2)");
                    table.ForeignKey(
                        name: "FK_Zones_ParkingLevels_ParkingLevelId_ParkingLotId",
                        columns: x => new { x.ParkingLevelId, x.ParkingLotId },
                        principalTable: "ParkingLevels",
                        principalColumns: new[] { "Id", "ParkingLotId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Bookings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    BookingCode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ParkingLotId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    VehicleId = table.Column<Guid>(type: "uuid", nullable: true),
                    PlateSnapshot = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    NormalizedPlate = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    VehicleType = table.Column<int>(type: "integer", nullable: false),
                    GuestPhoneNumber = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    GuestOtpChallengeId = table.Column<Guid>(type: "uuid", nullable: true),
                    Mode = table.Column<int>(type: "integer", nullable: false),
                    StartAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    EndAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    HoldExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    QuotedTotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Bookings", x => x.Id);
                    table.UniqueConstraint("AK_Bookings_Id_ParkingLotId", x => new { x.Id, x.ParkingLotId });
                    table.CheckConstraint("CK_Bookings_Amount", "\"QuotedTotal\" >= 0");
                    table.CheckConstraint("CK_Bookings_Guest", "(\"UserId\" IS NULL AND \"GuestPhoneNumber\" IS NOT NULL AND \"GuestOtpChallengeId\" IS NOT NULL) OR (\"UserId\" IS NOT NULL AND \"VehicleId\" IS NOT NULL AND \"GuestOtpChallengeId\" IS NULL)");
                    table.CheckConstraint("CK_Bookings_Interval", "\"StartAt\" < \"EndAt\"");
                    table.CheckConstraint("CK_Bookings_Mode", "\"Mode\" IN (0,1)");
                    table.CheckConstraint("CK_Bookings_Plate", "\"NormalizedPlate\" ~ '^[A-Z0-9]+$'");
                    table.CheckConstraint("CK_Bookings_Status", "\"Status\" IN (0,1,2,3,4,5,6)");
                    table.CheckConstraint("CK_Bookings_VehicleType", "\"VehicleType\" IN (0,1,2)");
                    table.CheckConstraint("CK_Bookings_Version", "\"Version\" > 0");
                    table.ForeignKey(
                        name: "FK_Bookings_OtpChallenges_GuestOtpChallengeId",
                        column: x => x.GuestOtpChallengeId,
                        principalTable: "OtpChallenges",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Bookings_ParkingLots_ParkingLotId",
                        column: x => x.ParkingLotId,
                        principalTable: "ParkingLots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Bookings_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Bookings_Vehicles_VehicleId",
                        column: x => x.VehicleId,
                        principalTable: "Vehicles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ParkingSlots",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    ParkingLotId = table.Column<Guid>(type: "uuid", nullable: false),
                    ZoneId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    SupportedVehicleTypes = table.Column<int[]>(type: "integer[]", nullable: false),
                    OperationalStatus = table.Column<int>(type: "integer", nullable: false),
                    WidthMeters = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    LengthMeters = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    DistanceToExitMeters = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParkingSlots", x => x.Id);
                    table.UniqueConstraint("AK_ParkingSlots_Id_ParkingLotId", x => new { x.Id, x.ParkingLotId });
                    table.CheckConstraint("CK_ParkingSlots_OperationalStatus", "\"OperationalStatus\" IN (0,1,2)");
                    table.CheckConstraint("CK_ParkingSlots_Version", "\"Version\" > 0");
                    table.CheckConstraint("CK_Slots_Dimensions", "(\"WidthMeters\" IS NULL OR \"WidthMeters\" > 0) AND (\"LengthMeters\" IS NULL OR \"LengthMeters\" > 0) AND (\"DistanceToExitMeters\" IS NULL OR \"DistanceToExitMeters\" >= 0)");
                    table.CheckConstraint("CK_Slots_VehicleTypes", "cardinality(\"SupportedVehicleTypes\") > 0 AND \"SupportedVehicleTypes\" <@ ARRAY[0,1,2] AND array_position(\"SupportedVehicleTypes\", NULL) IS NULL");
                    table.ForeignKey(
                        name: "FK_ParkingSlots_Zones_ZoneId_ParkingLotId",
                        columns: x => new { x.ZoneId, x.ParkingLotId },
                        principalTable: "Zones",
                        principalColumns: new[] { "Id", "ParkingLotId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PricingRules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    ParkingLotId = table.Column<Guid>(type: "uuid", nullable: false),
                    PricingPlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    ZoneId = table.Column<Guid>(type: "uuid", nullable: true),
                    RuleType = table.Column<int>(type: "integer", nullable: false),
                    VehicleType = table.Column<int>(type: "integer", nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    ParametersJson = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PricingRules", x => x.Id);
                    table.CheckConstraint("CK_PricingRules_RuleType", "\"RuleType\" IN (0,1,2,3,4,5,6,7,8,9)");
                    table.CheckConstraint("CK_PricingRules_VehicleType", "\"VehicleType\" IN (0,1,2)");
                    table.CheckConstraint("CK_Rules_Json", "jsonb_typeof(\"ParametersJson\") = 'object'");
                    table.ForeignKey(
                        name: "FK_PricingRules_PricingPlans_PricingPlanId_ParkingLotId",
                        columns: x => new { x.PricingPlanId, x.ParkingLotId },
                        principalTable: "PricingPlans",
                        principalColumns: new[] { "Id", "ParkingLotId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PricingRules_Zones_ZoneId_ParkingLotId",
                        columns: x => new { x.ZoneId, x.ParkingLotId },
                        principalTable: "Zones",
                        principalColumns: new[] { "Id", "ParkingLotId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Notifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    BookingId = table.Column<Guid>(type: "uuid", nullable: true),
                    Recipient = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: true),
                    Channel = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Body = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    SentAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ReadAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notifications", x => x.Id);
                    table.CheckConstraint("CK_Notifications_Channel", "\"Channel\" IN (0,1,2)");
                    table.CheckConstraint("CK_Notifications_Status", "\"Status\" IN (0,1,2)");
                    table.ForeignKey(
                        name: "FK_Notifications_Bookings_BookingId",
                        column: x => x.BookingId,
                        principalTable: "Bookings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Notifications_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "QRTokens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    BookingId = table.Column<Guid>(type: "uuid", nullable: false),
                    NonceHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ConsumedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RevokedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QRTokens", x => x.Id);
                    table.CheckConstraint("CK_QR_Expiry", "\"ExpiresAt\" > \"CreatedAt\"");
                    table.ForeignKey(
                        name: "FK_QRTokens_Bookings_BookingId",
                        column: x => x.BookingId,
                        principalTable: "Bookings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CameraEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    ParkingLotId = table.Column<Guid>(type: "uuid", nullable: false),
                    ExternalEventId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    CameraId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ParkingSlotId = table.Column<Guid>(type: "uuid", nullable: true),
                    EventType = table.Column<int>(type: "integer", nullable: false),
                    OccurredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    PlateNumber = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    Confidence = table.Column<double>(type: "double precision", nullable: true),
                    ReviewStatus = table.Column<int>(type: "integer", nullable: false),
                    ReviewedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReviewedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CameraEvents", x => x.Id);
                    table.UniqueConstraint("AK_CameraEvents_Id_ParkingLotId", x => new { x.Id, x.ParkingLotId });
                    table.CheckConstraint("CK_Camera_Confidence", "\"Confidence\" IS NULL OR \"Confidence\" BETWEEN 0 AND 1");
                    table.CheckConstraint("CK_CameraEvents_EventType", "\"EventType\" IN (0,1,2,3,4)");
                    table.CheckConstraint("CK_CameraEvents_ReviewStatus", "\"ReviewStatus\" IN (0,1,2,3)");
                    table.ForeignKey(
                        name: "FK_CameraEvents_ParkingLots_ParkingLotId",
                        column: x => x.ParkingLotId,
                        principalTable: "ParkingLots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CameraEvents_ParkingSlots_ParkingSlotId_ParkingLotId",
                        columns: x => new { x.ParkingSlotId, x.ParkingLotId },
                        principalTable: "ParkingSlots",
                        principalColumns: new[] { "Id", "ParkingLotId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CameraEvents_Users_ReviewedByUserId",
                        column: x => x.ReviewedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MapObjects",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    ParkingLotId = table.Column<Guid>(type: "uuid", nullable: false),
                    MapVersionId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParkingLevelId = table.Column<Guid>(type: "uuid", nullable: true),
                    ParkingSlotId = table.Column<Guid>(type: "uuid", nullable: true),
                    ObjectType = table.Column<int>(type: "integer", nullable: false),
                    PositionX = table.Column<double>(type: "double precision", nullable: false),
                    PositionY = table.Column<double>(type: "double precision", nullable: false),
                    PositionZ = table.Column<double>(type: "double precision", nullable: false),
                    RotationX = table.Column<double>(type: "double precision", nullable: false),
                    RotationY = table.Column<double>(type: "double precision", nullable: false),
                    RotationZ = table.Column<double>(type: "double precision", nullable: false),
                    ScaleX = table.Column<double>(type: "double precision", nullable: false),
                    ScaleY = table.Column<double>(type: "double precision", nullable: false),
                    ScaleZ = table.Column<double>(type: "double precision", nullable: false),
                    MetadataJson = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MapObjects", x => x.Id);
                    table.CheckConstraint("CK_MapObjects_ObjectType", "\"ObjectType\" IN (0,1,2,3,4,5,6,7,8,9,10)");
                    table.CheckConstraint("CK_MapObjects_Scale", "\"ScaleX\" > 0 AND \"ScaleY\" > 0 AND \"ScaleZ\" > 0");
                    table.CheckConstraint("CK_MapObjects_Slot", "(\"ObjectType\" = 0) = (\"ParkingSlotId\" IS NOT NULL)");
                    table.ForeignKey(
                        name: "FK_MapObjects_MapVersions_MapVersionId_ParkingLotId",
                        columns: x => new { x.MapVersionId, x.ParkingLotId },
                        principalTable: "MapVersions",
                        principalColumns: new[] { "Id", "ParkingLotId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MapObjects_ParkingLevels_ParkingLevelId_ParkingLotId",
                        columns: x => new { x.ParkingLevelId, x.ParkingLotId },
                        principalTable: "ParkingLevels",
                        principalColumns: new[] { "Id", "ParkingLotId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MapObjects_ParkingSlots_ParkingSlotId_ParkingLotId",
                        columns: x => new { x.ParkingSlotId, x.ParkingLotId },
                        principalTable: "ParkingSlots",
                        principalColumns: new[] { "Id", "ParkingLotId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ParkingSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    ParkingLotId = table.Column<Guid>(type: "uuid", nullable: false),
                    BookingId = table.Column<Guid>(type: "uuid", nullable: true),
                    VehicleId = table.Column<Guid>(type: "uuid", nullable: true),
                    PlateSnapshot = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    NormalizedPlate = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    VehicleType = table.Column<int>(type: "integer", nullable: false),
                    ParkingSlotId = table.Column<Guid>(type: "uuid", nullable: false),
                    EnteredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExitRequestedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ExitedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    FeeCalculatedThrough = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    FinalFee = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParkingSessions", x => x.Id);
                    table.UniqueConstraint("AK_ParkingSessions_Id_ParkingLotId", x => new { x.Id, x.ParkingLotId });
                    table.CheckConstraint("CK_ParkingSessions_Status", "\"Status\" IN (0,1,2)");
                    table.CheckConstraint("CK_ParkingSessions_VehicleType", "\"VehicleType\" IN (0,1,2)");
                    table.CheckConstraint("CK_ParkingSessions_Version", "\"Version\" > 0");
                    table.CheckConstraint("CK_Sessions_Exit", "(\"Status\" = 2 AND \"ExitedAt\" IS NOT NULL AND \"ExitedAt\" >= \"EnteredAt\") OR (\"Status\" IN (0,1) AND \"ExitedAt\" IS NULL)");
                    table.CheckConstraint("CK_Sessions_Fee", "\"FinalFee\" IS NULL OR \"FinalFee\" >= 0");
                    table.CheckConstraint("CK_Sessions_Plate", "\"NormalizedPlate\" ~ '^[A-Z0-9]+$'");
                    table.ForeignKey(
                        name: "FK_ParkingSessions_Bookings_BookingId_ParkingLotId",
                        columns: x => new { x.BookingId, x.ParkingLotId },
                        principalTable: "Bookings",
                        principalColumns: new[] { "Id", "ParkingLotId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ParkingSessions_ParkingLots_ParkingLotId",
                        column: x => x.ParkingLotId,
                        principalTable: "ParkingLots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ParkingSessions_ParkingSlots_ParkingSlotId_ParkingLotId",
                        columns: x => new { x.ParkingSlotId, x.ParkingLotId },
                        principalTable: "ParkingSlots",
                        principalColumns: new[] { "Id", "ParkingLotId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ParkingSessions_Vehicles_VehicleId",
                        column: x => x.VehicleId,
                        principalTable: "Vehicles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ParkingSlotFeatures",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    ParkingSlotId = table.Column<Guid>(type: "uuid", nullable: false),
                    SlotFeatureId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParkingSlotFeatures", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ParkingSlotFeatures_ParkingSlots_ParkingSlotId",
                        column: x => x.ParkingSlotId,
                        principalTable: "ParkingSlots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ParkingSlotFeatures_SlotFeatures_SlotFeatureId",
                        column: x => x.SlotFeatureId,
                        principalTable: "SlotFeatures",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SlotReservations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    ParkingLotId = table.Column<Guid>(type: "uuid", nullable: false),
                    BookingId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParkingSlotId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReservedFrom = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ReservedUntil = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ReleasedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ReleaseReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SlotReservations", x => x.Id);
                    table.CheckConstraint("CK_Reservations_Interval", "\"ReservedFrom\" < \"ReservedUntil\"");
                    table.CheckConstraint("CK_SlotReservations_Status", "\"Status\" IN (0,1,2)");
                    table.ForeignKey(
                        name: "FK_SlotReservations_Bookings_BookingId_ParkingLotId",
                        columns: x => new { x.BookingId, x.ParkingLotId },
                        principalTable: "Bookings",
                        principalColumns: new[] { "Id", "ParkingLotId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SlotReservations_ParkingSlots_ParkingSlotId_ParkingLotId",
                        columns: x => new { x.ParkingSlotId, x.ParkingLotId },
                        principalTable: "ParkingSlots",
                        principalColumns: new[] { "Id", "ParkingLotId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ParkingIssues",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    ParkingLotId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParkingSessionId = table.Column<Guid>(type: "uuid", nullable: true),
                    BookingId = table.Column<Guid>(type: "uuid", nullable: true),
                    CameraEventId = table.Column<Guid>(type: "uuid", nullable: true),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    ReportedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ResolvedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ResolvedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Resolution = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParkingIssues", x => x.Id);
                    table.CheckConstraint("CK_ParkingIssues_Status", "\"Status\" IN (0,1,2,3,4)");
                    table.CheckConstraint("CK_ParkingIssues_Type", "\"Type\" IN (0,1,2,3,4,5,6)");
                    table.ForeignKey(
                        name: "FK_ParkingIssues_Bookings_BookingId_ParkingLotId",
                        columns: x => new { x.BookingId, x.ParkingLotId },
                        principalTable: "Bookings",
                        principalColumns: new[] { "Id", "ParkingLotId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ParkingIssues_CameraEvents_CameraEventId_ParkingLotId",
                        columns: x => new { x.CameraEventId, x.ParkingLotId },
                        principalTable: "CameraEvents",
                        principalColumns: new[] { "Id", "ParkingLotId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ParkingIssues_ParkingLots_ParkingLotId",
                        column: x => x.ParkingLotId,
                        principalTable: "ParkingLots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ParkingIssues_ParkingSessions_ParkingSessionId_ParkingLotId",
                        columns: x => new { x.ParkingSessionId, x.ParkingLotId },
                        principalTable: "ParkingSessions",
                        principalColumns: new[] { "Id", "ParkingLotId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ParkingIssues_Users_ReportedByUserId",
                        column: x => x.ReportedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ParkingIssues_Users_ResolvedByUserId",
                        column: x => x.ResolvedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Payments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    BookingId = table.Column<Guid>(type: "uuid", nullable: true),
                    ParkingSessionId = table.Column<Guid>(type: "uuid", nullable: true),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Method = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    IdempotencyKey = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    PaidAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CashConfirmedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Payments", x => x.Id);
                    table.CheckConstraint("CK_Payments_Amount", "\"Amount\" >= 0");
                    table.CheckConstraint("CK_Payments_Cash", "\"Method\" <> 1 OR \"Status\" NOT IN (1,3,4) OR \"CashConfirmedByUserId\" IS NOT NULL");
                    table.CheckConstraint("CK_Payments_Method", "\"Method\" IN (0,1)");
                    table.CheckConstraint("CK_Payments_Owner", "(\"BookingId\" IS NULL) <> (\"ParkingSessionId\" IS NULL)");
                    table.CheckConstraint("CK_Payments_Status", "\"Status\" IN (0,1,2,3,4)");
                    table.CheckConstraint("CK_Payments_Type", "\"Type\" IN (0,1,2)");
                    table.CheckConstraint("CK_Payments_Version", "\"Version\" > 0");
                    table.ForeignKey(
                        name: "FK_Payments_Bookings_BookingId",
                        column: x => x.BookingId,
                        principalTable: "Bookings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Payments_ParkingSessions_ParkingSessionId",
                        column: x => x.ParkingSessionId,
                        principalTable: "ParkingSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Payments_Users_CashConfirmedByUserId",
                        column: x => x.CashConfirmedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PricingSnapshots",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    ParkingLotId = table.Column<Guid>(type: "uuid", nullable: false),
                    PricingPlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    BookingId = table.Column<Guid>(type: "uuid", nullable: true),
                    ParkingSessionId = table.Column<Guid>(type: "uuid", nullable: true),
                    PricingPlanVersion = table.Column<int>(type: "integer", nullable: false),
                    ResolvedRulesJson = table.Column<string>(type: "jsonb", nullable: false),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    CapturedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PricingSnapshots", x => x.Id);
                    table.CheckConstraint("CK_Snapshots_Owner", "\"BookingId\" IS NOT NULL OR \"ParkingSessionId\" IS NOT NULL");
                    table.ForeignKey(
                        name: "FK_PricingSnapshots_Bookings_BookingId_ParkingLotId",
                        columns: x => new { x.BookingId, x.ParkingLotId },
                        principalTable: "Bookings",
                        principalColumns: new[] { "Id", "ParkingLotId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PricingSnapshots_ParkingSessions_ParkingSessionId_ParkingLo~",
                        columns: x => new { x.ParkingSessionId, x.ParkingLotId },
                        principalTable: "ParkingSessions",
                        principalColumns: new[] { "Id", "ParkingLotId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PricingSnapshots_PricingPlans_PricingPlanId_ParkingLotId",
                        columns: x => new { x.PricingPlanId, x.ParkingLotId },
                        principalTable: "PricingPlans",
                        principalColumns: new[] { "Id", "ParkingLotId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PaymentTransactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    PaymentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Provider = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ProviderReference = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    RequestReference = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    EventKey = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ResponseCode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    VerifiedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaymentTransactions", x => x.Id);
                    table.CheckConstraint("CK_PaymentTransactions_Status", "\"Status\" IN (0,1,2)");
                    table.CheckConstraint("CK_PaymentTransactions_Type", "\"Type\" IN (0,1)");
                    table.CheckConstraint("CK_Transactions_Amount", "\"Amount\" >= 0");
                    table.ForeignKey(
                        name: "FK_PaymentTransactions_Payments_PaymentId",
                        column: x => x.PaymentId,
                        principalTable: "Payments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_ActorUserId",
                table: "AuditLogs",
                column: "ActorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_ParkingLotId_CreatedAt",
                table: "AuditLogs",
                columns: new[] { "ParkingLotId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_BookingCode",
                table: "Bookings",
                column: "BookingCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_GuestOtpChallengeId",
                table: "Bookings",
                column: "GuestOtpChallengeId",
                unique: true,
                filter: "\"GuestOtpChallengeId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_ParkingLotId_StartAt",
                table: "Bookings",
                columns: new[] { "ParkingLotId", "StartAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_Status_HoldExpiresAt",
                table: "Bookings",
                columns: new[] { "Status", "HoldExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_UserId",
                table: "Bookings",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_VehicleId",
                table: "Bookings",
                column: "VehicleId");

            migrationBuilder.CreateIndex(
                name: "IX_CameraEvents_ParkingLotId_CameraId_ExternalEventId",
                table: "CameraEvents",
                columns: new[] { "ParkingLotId", "CameraId", "ExternalEventId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CameraEvents_ParkingSlotId_ParkingLotId",
                table: "CameraEvents",
                columns: new[] { "ParkingSlotId", "ParkingLotId" });

            migrationBuilder.CreateIndex(
                name: "IX_CameraEvents_ReviewedByUserId",
                table: "CameraEvents",
                column: "ReviewedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_EntranceExits_ParkingLotId_Code",
                table: "EntranceExits",
                columns: new[] { "ParkingLotId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MapObjects_MapVersionId_ParkingLotId",
                table: "MapObjects",
                columns: new[] { "MapVersionId", "ParkingLotId" });

            migrationBuilder.CreateIndex(
                name: "IX_MapObjects_MapVersionId_ParkingSlotId",
                table: "MapObjects",
                columns: new[] { "MapVersionId", "ParkingSlotId" },
                unique: true,
                filter: "\"ParkingSlotId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_MapObjects_ParkingLevelId_ParkingLotId",
                table: "MapObjects",
                columns: new[] { "ParkingLevelId", "ParkingLotId" });

            migrationBuilder.CreateIndex(
                name: "IX_MapObjects_ParkingSlotId_ParkingLotId",
                table: "MapObjects",
                columns: new[] { "ParkingSlotId", "ParkingLotId" });

            migrationBuilder.CreateIndex(
                name: "IX_MapVersions_ParkingLotId",
                table: "MapVersions",
                column: "ParkingLotId",
                unique: true,
                filter: "\"Status\" = 1");

            migrationBuilder.CreateIndex(
                name: "IX_MapVersions_ParkingLotId_VersionNumber",
                table: "MapVersions",
                columns: new[] { "ParkingLotId", "VersionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_BookingId",
                table: "Notifications",
                column: "BookingId");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId_ReadAt",
                table: "Notifications",
                columns: new[] { "UserId", "ReadAt" });

            migrationBuilder.CreateIndex(
                name: "IX_OperatingHours_ParkingLotId_DayOfWeek",
                table: "OperatingHours",
                columns: new[] { "ParkingLotId", "DayOfWeek" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OtpChallenges_PhoneNumber_Purpose_CreatedAt",
                table: "OtpChallenges",
                columns: new[] { "PhoneNumber", "Purpose", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ParkingIssues_BookingId_ParkingLotId",
                table: "ParkingIssues",
                columns: new[] { "BookingId", "ParkingLotId" });

            migrationBuilder.CreateIndex(
                name: "IX_ParkingIssues_CameraEventId_ParkingLotId",
                table: "ParkingIssues",
                columns: new[] { "CameraEventId", "ParkingLotId" });

            migrationBuilder.CreateIndex(
                name: "IX_ParkingIssues_ParkingLotId",
                table: "ParkingIssues",
                column: "ParkingLotId");

            migrationBuilder.CreateIndex(
                name: "IX_ParkingIssues_ParkingSessionId_ParkingLotId",
                table: "ParkingIssues",
                columns: new[] { "ParkingSessionId", "ParkingLotId" });

            migrationBuilder.CreateIndex(
                name: "IX_ParkingIssues_ReportedByUserId",
                table: "ParkingIssues",
                column: "ReportedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ParkingIssues_ResolvedByUserId",
                table: "ParkingIssues",
                column: "ResolvedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ParkingLevels_ParkingLotId_Code",
                table: "ParkingLevels",
                columns: new[] { "ParkingLotId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ParkingLots_Code",
                table: "ParkingLots",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ParkingPolicies_ParkingLotId",
                table: "ParkingPolicies",
                column: "ParkingLotId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ParkingSessions_BookingId",
                table: "ParkingSessions",
                column: "BookingId",
                unique: true,
                filter: "\"BookingId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ParkingSessions_BookingId_ParkingLotId",
                table: "ParkingSessions",
                columns: new[] { "BookingId", "ParkingLotId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ParkingSessions_NormalizedPlate",
                table: "ParkingSessions",
                column: "NormalizedPlate",
                unique: true,
                filter: "\"Status\" IN (0,1)");

            migrationBuilder.CreateIndex(
                name: "IX_ParkingSessions_ParkingLotId",
                table: "ParkingSessions",
                column: "ParkingLotId");

            migrationBuilder.CreateIndex(
                name: "IX_ParkingSessions_ParkingSlotId",
                table: "ParkingSessions",
                column: "ParkingSlotId",
                unique: true,
                filter: "\"Status\" IN (0,1)");

            migrationBuilder.CreateIndex(
                name: "IX_ParkingSessions_ParkingSlotId_ParkingLotId",
                table: "ParkingSessions",
                columns: new[] { "ParkingSlotId", "ParkingLotId" });

            migrationBuilder.CreateIndex(
                name: "IX_ParkingSessions_VehicleId",
                table: "ParkingSessions",
                column: "VehicleId");

            migrationBuilder.CreateIndex(
                name: "IX_ParkingSlotFeatures_ParkingSlotId_SlotFeatureId",
                table: "ParkingSlotFeatures",
                columns: new[] { "ParkingSlotId", "SlotFeatureId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ParkingSlotFeatures_SlotFeatureId",
                table: "ParkingSlotFeatures",
                column: "SlotFeatureId");

            migrationBuilder.CreateIndex(
                name: "IX_ParkingSlots_ZoneId_Code",
                table: "ParkingSlots",
                columns: new[] { "ZoneId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ParkingSlots_ZoneId_ParkingLotId",
                table: "ParkingSlots",
                columns: new[] { "ZoneId", "ParkingLotId" });

            migrationBuilder.CreateIndex(
                name: "IX_Payments_BookingId",
                table: "Payments",
                column: "BookingId");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_CashConfirmedByUserId",
                table: "Payments",
                column: "CashConfirmedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_IdempotencyKey",
                table: "Payments",
                column: "IdempotencyKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Payments_ParkingSessionId",
                table: "Payments",
                column: "ParkingSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentTransactions_PaymentId",
                table: "PaymentTransactions",
                column: "PaymentId");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentTransactions_Provider_EventKey",
                table: "PaymentTransactions",
                columns: new[] { "Provider", "EventKey" },
                unique: true,
                filter: "\"EventKey\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentTransactions_Provider_ProviderReference",
                table: "PaymentTransactions",
                columns: new[] { "Provider", "ProviderReference" },
                unique: true,
                filter: "\"ProviderReference\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentTransactions_Provider_RequestReference",
                table: "PaymentTransactions",
                columns: new[] { "Provider", "RequestReference" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PricingPlans_ParkingLotId_VersionNumber",
                table: "PricingPlans",
                columns: new[] { "ParkingLotId", "VersionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PricingRules_PricingPlanId_ParkingLotId",
                table: "PricingRules",
                columns: new[] { "PricingPlanId", "ParkingLotId" });

            migrationBuilder.CreateIndex(
                name: "IX_PricingRules_ZoneId_ParkingLotId",
                table: "PricingRules",
                columns: new[] { "ZoneId", "ParkingLotId" });

            migrationBuilder.CreateIndex(
                name: "IX_PricingSnapshots_BookingId_ParkingLotId",
                table: "PricingSnapshots",
                columns: new[] { "BookingId", "ParkingLotId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PricingSnapshots_ParkingSessionId_ParkingLotId",
                table: "PricingSnapshots",
                columns: new[] { "ParkingSessionId", "ParkingLotId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PricingSnapshots_PricingPlanId_ParkingLotId",
                table: "PricingSnapshots",
                columns: new[] { "PricingPlanId", "ParkingLotId" });

            migrationBuilder.CreateIndex(
                name: "IX_QRTokens_BookingId",
                table: "QRTokens",
                column: "BookingId");

            migrationBuilder.CreateIndex(
                name: "IX_QRTokens_NonceHash",
                table: "QRTokens",
                column: "NonceHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SlotFeatures_Code",
                table: "SlotFeatures",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SlotReservations_BookingId",
                table: "SlotReservations",
                column: "BookingId",
                unique: true,
                filter: "\"Status\" IN (0,1)");

            migrationBuilder.CreateIndex(
                name: "IX_SlotReservations_BookingId_ParkingLotId",
                table: "SlotReservations",
                columns: new[] { "BookingId", "ParkingLotId" });

            migrationBuilder.CreateIndex(
                name: "IX_SlotReservations_ParkingSlotId_ParkingLotId",
                table: "SlotReservations",
                columns: new[] { "ParkingSlotId", "ParkingLotId" });

            migrationBuilder.CreateIndex(
                name: "IX_StaffAssignments_AssignedByUserId",
                table: "StaffAssignments",
                column: "AssignedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffAssignments_ParkingLotId_UserId",
                table: "StaffAssignments",
                columns: new[] { "ParkingLotId", "UserId" });

            migrationBuilder.CreateIndex(
                name: "IX_StaffAssignments_UserId",
                table: "StaffAssignments",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true,
                filter: "\"Email\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Users_PhoneNumber",
                table: "Users",
                column: "PhoneNumber",
                unique: true,
                filter: "\"PhoneNumber\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Vehicles_NormalizedPlate",
                table: "Vehicles",
                column: "NormalizedPlate",
                unique: true,
                filter: "\"IsActive\"");

            migrationBuilder.CreateIndex(
                name: "IX_Vehicles_OwnerUserId",
                table: "Vehicles",
                column: "OwnerUserId",
                unique: true,
                filter: "\"IsActive\" AND \"IsPrimary\" AND \"OwnerUserId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Zones_ParkingLevelId_Code",
                table: "Zones",
                columns: new[] { "ParkingLevelId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Zones_ParkingLevelId_ParkingLotId",
                table: "Zones",
                columns: new[] { "ParkingLevelId", "ParkingLotId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditLogs");

            migrationBuilder.DropTable(
                name: "EntranceExits");

            migrationBuilder.DropTable(
                name: "MapObjects");

            migrationBuilder.DropTable(
                name: "Notifications");

            migrationBuilder.DropTable(
                name: "OperatingHours");

            migrationBuilder.DropTable(
                name: "ParkingIssues");

            migrationBuilder.DropTable(
                name: "ParkingPolicies");

            migrationBuilder.DropTable(
                name: "ParkingSlotFeatures");

            migrationBuilder.DropTable(
                name: "PaymentTransactions");

            migrationBuilder.DropTable(
                name: "PricingRules");

            migrationBuilder.DropTable(
                name: "PricingSnapshots");

            migrationBuilder.DropTable(
                name: "QRTokens");

            migrationBuilder.DropTable(
                name: "SlotReservations");

            migrationBuilder.DropTable(
                name: "StaffAssignments");

            migrationBuilder.DropTable(
                name: "MapVersions");

            migrationBuilder.DropTable(
                name: "CameraEvents");

            migrationBuilder.DropTable(
                name: "SlotFeatures");

            migrationBuilder.DropTable(
                name: "Payments");

            migrationBuilder.DropTable(
                name: "PricingPlans");

            migrationBuilder.DropTable(
                name: "ParkingSessions");

            migrationBuilder.DropTable(
                name: "Bookings");

            migrationBuilder.DropTable(
                name: "ParkingSlots");

            migrationBuilder.DropTable(
                name: "OtpChallenges");

            migrationBuilder.DropTable(
                name: "Vehicles");

            migrationBuilder.DropTable(
                name: "Zones");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "ParkingLevels");

            migrationBuilder.DropTable(
                name: "ParkingLots");
        }
    }
}
