CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

START TRANSACTION;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE "OtpChallenges" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "PhoneNumber" character varying(32) NOT NULL,
    "NormalizedPlate" character varying(32) NOT NULL,
    "Purpose" integer NOT NULL,
    "CodeHash" character varying(128) NOT NULL,
    "ExpiresAt" timestamp with time zone NOT NULL,
    "VerifiedAt" timestamp with time zone,
    "ConsumedAt" timestamp with time zone,
    "InvalidatedAt" timestamp with time zone,
    "FailedAttempts" integer NOT NULL,
    "MaxAttempts" integer NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_OtpChallenges" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_Otp_Attempts" CHECK ("MaxAttempts" > 0 AND "FailedAttempts" BETWEEN 0 AND "MaxAttempts"),
    CONSTRAINT "CK_Otp_Consumption" CHECK ("ConsumedAt" IS NULL OR ("VerifiedAt" IS NOT NULL AND "ConsumedAt" >= "VerifiedAt")),
    CONSTRAINT "CK_Otp_Expiry" CHECK ("ExpiresAt" > "CreatedAt"),
    CONSTRAINT "CK_OtpChallenges_Purpose" CHECK ("Purpose" IN (0))
);

CREATE TABLE "ParkingLots" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "Code" character varying(32) NOT NULL,
    "Name" character varying(200) NOT NULL,
    "Description" character varying(2000),
    "Address" character varying(500) NOT NULL,
    "Latitude" double precision NOT NULL,
    "Longitude" double precision NOT NULL,
    "TimeZoneId" character varying(64) NOT NULL,
    "Status" integer NOT NULL,
    "MapThumbnailUrl" character varying(1000),
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_ParkingLots" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_Lots_Coordinates" CHECK ("Latitude" BETWEEN -90 AND 90 AND "Longitude" BETWEEN -180 AND 180),
    CONSTRAINT "CK_ParkingLots_Status" CHECK ("Status" IN (0,1,2))
);

CREATE TABLE "SlotFeatures" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "Code" character varying(40) NOT NULL,
    "Name" character varying(100) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_SlotFeatures" PRIMARY KEY ("Id")
);

CREATE TABLE "Users" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "FullName" character varying(150) NOT NULL,
    "Email" character varying(254),
    "PhoneNumber" character varying(32),
    "PasswordHash" character varying(512) NOT NULL,
    "PlatformRole" integer NOT NULL,
    "Status" integer NOT NULL,
    "PhoneVerifiedAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_Users" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_Users_Login" CHECK ("Email" IS NOT NULL OR "PhoneNumber" IS NOT NULL),
    CONSTRAINT "CK_Users_PlatformRole" CHECK ("PlatformRole" IN (0,1)),
    CONSTRAINT "CK_Users_Status" CHECK ("Status" IN (0,1,2))
);

CREATE TABLE "EntranceExits" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "ParkingLotId" uuid NOT NULL,
    "Code" character varying(32) NOT NULL,
    "Name" character varying(100) NOT NULL,
    "GateType" integer NOT NULL,
    "IsActive" boolean NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_EntranceExits" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_EntranceExits_GateType" CHECK ("GateType" IN (0,1,2)),
    CONSTRAINT "FK_EntranceExits_ParkingLots_ParkingLotId" FOREIGN KEY ("ParkingLotId") REFERENCES "ParkingLots" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "MapVersions" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "ParkingLotId" uuid NOT NULL,
    "VersionNumber" integer NOT NULL,
    "Status" integer NOT NULL,
    "PublishedAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_MapVersions" PRIMARY KEY ("Id"),
    CONSTRAINT "AK_MapVersions_Id_ParkingLotId" UNIQUE ("Id", "ParkingLotId"),
    CONSTRAINT "CK_MapVersions_Number" CHECK ("VersionNumber" > 0),
    CONSTRAINT "CK_MapVersions_Status" CHECK ("Status" IN (0,1,2)),
    CONSTRAINT "FK_MapVersions_ParkingLots_ParkingLotId" FOREIGN KEY ("ParkingLotId") REFERENCES "ParkingLots" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "OperatingHours" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "ParkingLotId" uuid NOT NULL,
    "DayOfWeek" integer NOT NULL,
    "IsClosed" boolean NOT NULL,
    "IsOpen24Hours" boolean NOT NULL,
    "OpensAt" time without time zone,
    "ClosesAt" time without time zone,
    "ClosesNextDay" boolean NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_OperatingHours" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_Hours_Interval" CHECK ((("IsClosed" <> "IsOpen24Hours") AND "OpensAt" IS NULL AND "ClosesAt" IS NULL AND NOT "ClosesNextDay") OR (NOT "IsClosed" AND NOT "IsOpen24Hours" AND "OpensAt" IS NOT NULL AND "ClosesAt" IS NOT NULL AND ((NOT "ClosesNextDay" AND "OpensAt" < "ClosesAt") OR ("ClosesNextDay" AND "ClosesAt" < "OpensAt")))),
    CONSTRAINT "CK_OperatingHours_DayOfWeek" CHECK ("DayOfWeek" IN (0,1,2,3,4,5,6)),
    CONSTRAINT "FK_OperatingHours_ParkingLots_ParkingLotId" FOREIGN KEY ("ParkingLotId") REFERENCES "ParkingLots" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "ParkingLevels" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "ParkingLotId" uuid NOT NULL,
    "Code" character varying(32) NOT NULL,
    "Name" character varying(100) NOT NULL,
    "LevelType" integer NOT NULL,
    "DisplayOrder" integer NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_ParkingLevels" PRIMARY KEY ("Id"),
    CONSTRAINT "AK_ParkingLevels_Id_ParkingLotId" UNIQUE ("Id", "ParkingLotId"),
    CONSTRAINT "CK_ParkingLevels_LevelType" CHECK ("LevelType" IN (0,1,2,3,4,5)),
    CONSTRAINT "FK_ParkingLevels_ParkingLots_ParkingLotId" FOREIGN KEY ("ParkingLotId") REFERENCES "ParkingLots" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "ParkingPolicies" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "ParkingLotId" uuid NOT NULL,
    "AllowGuestBookings" boolean NOT NULL,
    "PaymentHoldMinutes" integer NOT NULL,
    "MinimumBookingMinutes" integer NOT NULL,
    "MaximumBookingMinutes" integer NOT NULL,
    "RequireFullPrepayment" boolean NOT NULL,
    "RefundUnusedTimeOnEarlyExit" boolean NOT NULL,
    "ChargeOvertime" boolean NOT NULL,
    "EarlyArrivalMinutes" integer,
    "LateArrivalMinutes" integer,
    "QrLifetimeMinutes" integer,
    "ExitGraceMinutes" integer,
    "CancellationRefundCutoffMinutes" integer,
    "CancellationRefundPercent" numeric(18,2),
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_ParkingPolicies" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_Policy_Durations" CHECK ("PaymentHoldMinutes" > 0 AND "MinimumBookingMinutes" > 0 AND "MaximumBookingMinutes" >= "MinimumBookingMinutes"),
    CONSTRAINT "CK_Policy_OptionalWindows" CHECK (("EarlyArrivalMinutes" IS NULL OR "EarlyArrivalMinutes" >= 0) AND ("LateArrivalMinutes" IS NULL OR "LateArrivalMinutes" >= 0) AND ("QrLifetimeMinutes" IS NULL OR "QrLifetimeMinutes" > 0) AND ("ExitGraceMinutes" IS NULL OR "ExitGraceMinutes" >= 0)),
    CONSTRAINT "CK_Policy_Refund" CHECK (("CancellationRefundCutoffMinutes" IS NULL AND "CancellationRefundPercent" IS NULL) OR ("CancellationRefundCutoffMinutes" IS NOT NULL AND "CancellationRefundCutoffMinutes" >= 0 AND "CancellationRefundPercent" IS NOT NULL AND "CancellationRefundPercent" BETWEEN 0 AND 100)),
    CONSTRAINT "FK_ParkingPolicies_ParkingLots_ParkingLotId" FOREIGN KEY ("ParkingLotId") REFERENCES "ParkingLots" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "PricingPlans" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "ParkingLotId" uuid NOT NULL,
    "Name" character varying(150) NOT NULL,
    "VersionNumber" integer NOT NULL,
    "EffectiveFrom" timestamp with time zone NOT NULL,
    "EffectiveTo" timestamp with time zone,
    "Status" integer NOT NULL,
    "Currency" character varying(3) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_PricingPlans" PRIMARY KEY ("Id"),
    CONSTRAINT "AK_PricingPlans_Id_ParkingLotId" UNIQUE ("Id", "ParkingLotId"),
    CONSTRAINT "CK_Plans_Period" CHECK ("VersionNumber" > 0 AND ("EffectiveTo" IS NULL OR "EffectiveTo" > "EffectiveFrom")),
    CONSTRAINT "CK_PricingPlans_Status" CHECK ("Status" IN (0,1,2)),
    CONSTRAINT "FK_PricingPlans_ParkingLots_ParkingLotId" FOREIGN KEY ("ParkingLotId") REFERENCES "ParkingLots" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "AuditLogs" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "ActorUserId" uuid,
    "ActorType" integer NOT NULL,
    "ParkingLotId" uuid,
    "Action" character varying(100) NOT NULL,
    "EntityType" character varying(100) NOT NULL,
    "EntityId" character varying(128) NOT NULL,
    "OldValueJson" jsonb,
    "NewValueJson" jsonb,
    "Reason" character varying(1000),
    "RequestId" character varying(128),
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_AuditLogs" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_AuditLogs_ActorType" CHECK ("ActorType" IN (0,1,2,3,4)),
    CONSTRAINT "FK_AuditLogs_ParkingLots_ParkingLotId" FOREIGN KEY ("ParkingLotId") REFERENCES "ParkingLots" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_AuditLogs_Users_ActorUserId" FOREIGN KEY ("ActorUserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "StaffAssignments" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "UserId" uuid NOT NULL,
    "ParkingLotId" uuid NOT NULL,
    "Role" integer NOT NULL,
    "ActiveFrom" timestamp with time zone NOT NULL,
    "ActiveTo" timestamp with time zone,
    "RevokedAt" timestamp with time zone,
    "AssignedByUserId" uuid,
    "CanManageStaffAssignments" boolean NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_StaffAssignments" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_Assignments_Delegation" CHECK (NOT "CanManageStaffAssignments" OR "Role" = 1),
    CONSTRAINT "CK_Assignments_Period" CHECK ("ActiveTo" IS NULL OR "ActiveTo" > "ActiveFrom"),
    CONSTRAINT "CK_StaffAssignments_Role" CHECK ("Role" IN (0,1)),
    CONSTRAINT "FK_StaffAssignments_ParkingLots_ParkingLotId" FOREIGN KEY ("ParkingLotId") REFERENCES "ParkingLots" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_StaffAssignments_Users_AssignedByUserId" FOREIGN KEY ("AssignedByUserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_StaffAssignments_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "Vehicles" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "OwnerUserId" uuid,
    "LicensePlate" character varying(32) NOT NULL,
    "NormalizedPlate" character varying(32) NOT NULL,
    "VehicleType" integer NOT NULL,
    "FuelType" integer NOT NULL,
    "IsActive" boolean NOT NULL,
    "IsPrimary" boolean NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_Vehicles" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_Vehicles_FuelType" CHECK ("FuelType" IN (0,1,2,3)),
    CONSTRAINT "CK_Vehicles_VehicleType" CHECK ("VehicleType" IN (0,1,2)),
    CONSTRAINT "FK_Vehicles_Users_OwnerUserId" FOREIGN KEY ("OwnerUserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "Zones" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "ParkingLotId" uuid NOT NULL,
    "ParkingLevelId" uuid NOT NULL,
    "Code" character varying(32) NOT NULL,
    "Name" character varying(100) NOT NULL,
    "Status" integer NOT NULL,
    "AllocationPriority" integer NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_Zones" PRIMARY KEY ("Id"),
    CONSTRAINT "AK_Zones_Id_ParkingLotId" UNIQUE ("Id", "ParkingLotId"),
    CONSTRAINT "CK_Zones_Status" CHECK ("Status" IN (0,1,2)),
    CONSTRAINT "FK_Zones_ParkingLevels_ParkingLevelId_ParkingLotId" FOREIGN KEY ("ParkingLevelId", "ParkingLotId") REFERENCES "ParkingLevels" ("Id", "ParkingLotId") ON DELETE RESTRICT
);

CREATE TABLE "Bookings" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "BookingCode" character varying(40) NOT NULL,
    "ParkingLotId" uuid NOT NULL,
    "UserId" uuid,
    "VehicleId" uuid,
    "PlateSnapshot" character varying(32) NOT NULL,
    "NormalizedPlate" character varying(32) NOT NULL,
    "VehicleType" integer NOT NULL,
    "GuestPhoneNumber" character varying(32),
    "GuestOtpChallengeId" uuid,
    "Mode" integer NOT NULL,
    "StartAt" timestamp with time zone NOT NULL,
    "EndAt" timestamp with time zone NOT NULL,
    "HoldExpiresAt" timestamp with time zone NOT NULL,
    "Status" integer NOT NULL,
    "QuotedTotal" numeric(18,2) NOT NULL,
    "Currency" character varying(3) NOT NULL,
    "Version" bigint NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_Bookings" PRIMARY KEY ("Id"),
    CONSTRAINT "AK_Bookings_Id_ParkingLotId" UNIQUE ("Id", "ParkingLotId"),
    CONSTRAINT "CK_Bookings_Amount" CHECK ("QuotedTotal" >= 0),
    CONSTRAINT "CK_Bookings_Guest" CHECK (("UserId" IS NULL AND "GuestPhoneNumber" IS NOT NULL AND "GuestOtpChallengeId" IS NOT NULL) OR ("UserId" IS NOT NULL AND "VehicleId" IS NOT NULL AND "GuestOtpChallengeId" IS NULL)),
    CONSTRAINT "CK_Bookings_Interval" CHECK ("StartAt" < "EndAt"),
    CONSTRAINT "CK_Bookings_Mode" CHECK ("Mode" IN (0,1)),
    CONSTRAINT "CK_Bookings_Plate" CHECK ("NormalizedPlate" ~ '^[A-Z0-9]+$'),
    CONSTRAINT "CK_Bookings_Status" CHECK ("Status" IN (0,1,2,3,4,5,6)),
    CONSTRAINT "CK_Bookings_VehicleType" CHECK ("VehicleType" IN (0,1,2)),
    CONSTRAINT "CK_Bookings_Version" CHECK ("Version" > 0),
    CONSTRAINT "FK_Bookings_OtpChallenges_GuestOtpChallengeId" FOREIGN KEY ("GuestOtpChallengeId") REFERENCES "OtpChallenges" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Bookings_ParkingLots_ParkingLotId" FOREIGN KEY ("ParkingLotId") REFERENCES "ParkingLots" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Bookings_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Bookings_Vehicles_VehicleId" FOREIGN KEY ("VehicleId") REFERENCES "Vehicles" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "ParkingSlots" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "ParkingLotId" uuid NOT NULL,
    "ZoneId" uuid NOT NULL,
    "Code" character varying(32) NOT NULL,
    "SupportedVehicleTypes" integer[] NOT NULL,
    "OperationalStatus" integer NOT NULL,
    "WidthMeters" numeric(18,2),
    "LengthMeters" numeric(18,2),
    "DistanceToExitMeters" numeric(18,2),
    "Version" bigint NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_ParkingSlots" PRIMARY KEY ("Id"),
    CONSTRAINT "AK_ParkingSlots_Id_ParkingLotId" UNIQUE ("Id", "ParkingLotId"),
    CONSTRAINT "CK_ParkingSlots_OperationalStatus" CHECK ("OperationalStatus" IN (0,1,2)),
    CONSTRAINT "CK_ParkingSlots_Version" CHECK ("Version" > 0),
    CONSTRAINT "CK_Slots_Dimensions" CHECK (("WidthMeters" IS NULL OR "WidthMeters" > 0) AND ("LengthMeters" IS NULL OR "LengthMeters" > 0) AND ("DistanceToExitMeters" IS NULL OR "DistanceToExitMeters" >= 0)),
    CONSTRAINT "CK_Slots_VehicleTypes" CHECK (cardinality("SupportedVehicleTypes") > 0 AND "SupportedVehicleTypes" <@ ARRAY[0,1,2] AND array_position("SupportedVehicleTypes", NULL) IS NULL),
    CONSTRAINT "FK_ParkingSlots_Zones_ZoneId_ParkingLotId" FOREIGN KEY ("ZoneId", "ParkingLotId") REFERENCES "Zones" ("Id", "ParkingLotId") ON DELETE RESTRICT
);

CREATE TABLE "PricingRules" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "ParkingLotId" uuid NOT NULL,
    "PricingPlanId" uuid NOT NULL,
    "ZoneId" uuid,
    "RuleType" integer NOT NULL,
    "VehicleType" integer NOT NULL,
    "Priority" integer NOT NULL,
    "ParametersJson" jsonb NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_PricingRules" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_PricingRules_RuleType" CHECK ("RuleType" IN (0,1,2,3,4,5,6,7,8,9)),
    CONSTRAINT "CK_PricingRules_VehicleType" CHECK ("VehicleType" IN (0,1,2)),
    CONSTRAINT "CK_Rules_Json" CHECK (jsonb_typeof("ParametersJson") = 'object'),
    CONSTRAINT "FK_PricingRules_PricingPlans_PricingPlanId_ParkingLotId" FOREIGN KEY ("PricingPlanId", "ParkingLotId") REFERENCES "PricingPlans" ("Id", "ParkingLotId") ON DELETE RESTRICT,
    CONSTRAINT "FK_PricingRules_Zones_ZoneId_ParkingLotId" FOREIGN KEY ("ZoneId", "ParkingLotId") REFERENCES "Zones" ("Id", "ParkingLotId") ON DELETE RESTRICT
);

CREATE TABLE "Notifications" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "UserId" uuid,
    "BookingId" uuid,
    "Recipient" character varying(254),
    "Channel" integer NOT NULL,
    "Status" integer NOT NULL,
    "Title" character varying(200) NOT NULL,
    "Body" character varying(4000) NOT NULL,
    "SentAt" timestamp with time zone,
    "ReadAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_Notifications" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_Notifications_Channel" CHECK ("Channel" IN (0,1,2)),
    CONSTRAINT "CK_Notifications_Status" CHECK ("Status" IN (0,1,2)),
    CONSTRAINT "FK_Notifications_Bookings_BookingId" FOREIGN KEY ("BookingId") REFERENCES "Bookings" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Notifications_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "QRTokens" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "BookingId" uuid NOT NULL,
    "NonceHash" character varying(128) NOT NULL,
    "ExpiresAt" timestamp with time zone NOT NULL,
    "ConsumedAt" timestamp with time zone,
    "RevokedAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_QRTokens" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_QR_Expiry" CHECK ("ExpiresAt" > "CreatedAt"),
    CONSTRAINT "FK_QRTokens_Bookings_BookingId" FOREIGN KEY ("BookingId") REFERENCES "Bookings" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "CameraEvents" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "ParkingLotId" uuid NOT NULL,
    "ExternalEventId" character varying(128) NOT NULL,
    "CameraId" character varying(64) NOT NULL,
    "ParkingSlotId" uuid,
    "EventType" integer NOT NULL,
    "OccurredAt" timestamp with time zone NOT NULL,
    "PlateNumber" character varying(32),
    "Confidence" double precision,
    "ReviewStatus" integer NOT NULL,
    "ReviewedByUserId" uuid,
    "ReviewedAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_CameraEvents" PRIMARY KEY ("Id"),
    CONSTRAINT "AK_CameraEvents_Id_ParkingLotId" UNIQUE ("Id", "ParkingLotId"),
    CONSTRAINT "CK_Camera_Confidence" CHECK ("Confidence" IS NULL OR "Confidence" BETWEEN 0 AND 1),
    CONSTRAINT "CK_CameraEvents_EventType" CHECK ("EventType" IN (0,1,2,3,4)),
    CONSTRAINT "CK_CameraEvents_ReviewStatus" CHECK ("ReviewStatus" IN (0,1,2,3)),
    CONSTRAINT "FK_CameraEvents_ParkingLots_ParkingLotId" FOREIGN KEY ("ParkingLotId") REFERENCES "ParkingLots" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_CameraEvents_ParkingSlots_ParkingSlotId_ParkingLotId" FOREIGN KEY ("ParkingSlotId", "ParkingLotId") REFERENCES "ParkingSlots" ("Id", "ParkingLotId") ON DELETE RESTRICT,
    CONSTRAINT "FK_CameraEvents_Users_ReviewedByUserId" FOREIGN KEY ("ReviewedByUserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "MapObjects" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "ParkingLotId" uuid NOT NULL,
    "MapVersionId" uuid NOT NULL,
    "ParkingLevelId" uuid,
    "ParkingSlotId" uuid,
    "ObjectType" integer NOT NULL,
    "PositionX" double precision NOT NULL,
    "PositionY" double precision NOT NULL,
    "PositionZ" double precision NOT NULL,
    "RotationX" double precision NOT NULL,
    "RotationY" double precision NOT NULL,
    "RotationZ" double precision NOT NULL,
    "ScaleX" double precision NOT NULL,
    "ScaleY" double precision NOT NULL,
    "ScaleZ" double precision NOT NULL,
    "MetadataJson" jsonb NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_MapObjects" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_MapObjects_ObjectType" CHECK ("ObjectType" IN (0,1,2,3,4,5,6,7,8,9,10)),
    CONSTRAINT "CK_MapObjects_Scale" CHECK ("ScaleX" > 0 AND "ScaleY" > 0 AND "ScaleZ" > 0),
    CONSTRAINT "CK_MapObjects_Slot" CHECK (("ObjectType" = 0) = ("ParkingSlotId" IS NOT NULL)),
    CONSTRAINT "FK_MapObjects_MapVersions_MapVersionId_ParkingLotId" FOREIGN KEY ("MapVersionId", "ParkingLotId") REFERENCES "MapVersions" ("Id", "ParkingLotId") ON DELETE RESTRICT,
    CONSTRAINT "FK_MapObjects_ParkingLevels_ParkingLevelId_ParkingLotId" FOREIGN KEY ("ParkingLevelId", "ParkingLotId") REFERENCES "ParkingLevels" ("Id", "ParkingLotId") ON DELETE RESTRICT,
    CONSTRAINT "FK_MapObjects_ParkingSlots_ParkingSlotId_ParkingLotId" FOREIGN KEY ("ParkingSlotId", "ParkingLotId") REFERENCES "ParkingSlots" ("Id", "ParkingLotId") ON DELETE RESTRICT
);

CREATE TABLE "ParkingSessions" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "ParkingLotId" uuid NOT NULL,
    "BookingId" uuid,
    "VehicleId" uuid,
    "PlateSnapshot" character varying(32) NOT NULL,
    "NormalizedPlate" character varying(32) NOT NULL,
    "VehicleType" integer NOT NULL,
    "ParkingSlotId" uuid NOT NULL,
    "EnteredAt" timestamp with time zone NOT NULL,
    "ExitRequestedAt" timestamp with time zone,
    "ExitedAt" timestamp with time zone,
    "FeeCalculatedThrough" timestamp with time zone,
    "Status" integer NOT NULL,
    "FinalFee" numeric(18,2),
    "Currency" character varying(3) NOT NULL,
    "Version" bigint NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_ParkingSessions" PRIMARY KEY ("Id"),
    CONSTRAINT "AK_ParkingSessions_Id_ParkingLotId" UNIQUE ("Id", "ParkingLotId"),
    CONSTRAINT "CK_ParkingSessions_Status" CHECK ("Status" IN (0,1,2)),
    CONSTRAINT "CK_ParkingSessions_VehicleType" CHECK ("VehicleType" IN (0,1,2)),
    CONSTRAINT "CK_ParkingSessions_Version" CHECK ("Version" > 0),
    CONSTRAINT "CK_Sessions_Exit" CHECK (("Status" = 2 AND "ExitedAt" IS NOT NULL AND "ExitedAt" >= "EnteredAt") OR ("Status" IN (0,1) AND "ExitedAt" IS NULL)),
    CONSTRAINT "CK_Sessions_Fee" CHECK ("FinalFee" IS NULL OR "FinalFee" >= 0),
    CONSTRAINT "CK_Sessions_Plate" CHECK ("NormalizedPlate" ~ '^[A-Z0-9]+$'),
    CONSTRAINT "FK_ParkingSessions_Bookings_BookingId_ParkingLotId" FOREIGN KEY ("BookingId", "ParkingLotId") REFERENCES "Bookings" ("Id", "ParkingLotId") ON DELETE RESTRICT,
    CONSTRAINT "FK_ParkingSessions_ParkingLots_ParkingLotId" FOREIGN KEY ("ParkingLotId") REFERENCES "ParkingLots" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_ParkingSessions_ParkingSlots_ParkingSlotId_ParkingLotId" FOREIGN KEY ("ParkingSlotId", "ParkingLotId") REFERENCES "ParkingSlots" ("Id", "ParkingLotId") ON DELETE RESTRICT,
    CONSTRAINT "FK_ParkingSessions_Vehicles_VehicleId" FOREIGN KEY ("VehicleId") REFERENCES "Vehicles" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "ParkingSlotFeatures" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "ParkingSlotId" uuid NOT NULL,
    "SlotFeatureId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_ParkingSlotFeatures" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ParkingSlotFeatures_ParkingSlots_ParkingSlotId" FOREIGN KEY ("ParkingSlotId") REFERENCES "ParkingSlots" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_ParkingSlotFeatures_SlotFeatures_SlotFeatureId" FOREIGN KEY ("SlotFeatureId") REFERENCES "SlotFeatures" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "SlotReservations" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "ParkingLotId" uuid NOT NULL,
    "BookingId" uuid NOT NULL,
    "ParkingSlotId" uuid NOT NULL,
    "ReservedFrom" timestamp with time zone NOT NULL,
    "ReservedUntil" timestamp with time zone NOT NULL,
    "Status" integer NOT NULL,
    "ReleasedAt" timestamp with time zone,
    "ReleaseReason" character varying(500),
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_SlotReservations" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_Reservations_Interval" CHECK ("ReservedFrom" < "ReservedUntil"),
    CONSTRAINT "CK_SlotReservations_Status" CHECK ("Status" IN (0,1,2)),
    CONSTRAINT "FK_SlotReservations_Bookings_BookingId_ParkingLotId" FOREIGN KEY ("BookingId", "ParkingLotId") REFERENCES "Bookings" ("Id", "ParkingLotId") ON DELETE RESTRICT,
    CONSTRAINT "FK_SlotReservations_ParkingSlots_ParkingSlotId_ParkingLotId" FOREIGN KEY ("ParkingSlotId", "ParkingLotId") REFERENCES "ParkingSlots" ("Id", "ParkingLotId") ON DELETE RESTRICT
);

CREATE TABLE "ParkingIssues" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "ParkingLotId" uuid NOT NULL,
    "ParkingSessionId" uuid,
    "BookingId" uuid,
    "CameraEventId" uuid,
    "Type" integer NOT NULL,
    "Status" integer NOT NULL,
    "Description" character varying(2000) NOT NULL,
    "ReportedByUserId" uuid,
    "ResolvedByUserId" uuid,
    "ResolvedAt" timestamp with time zone,
    "Resolution" character varying(2000),
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_ParkingIssues" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_ParkingIssues_Status" CHECK ("Status" IN (0,1,2,3,4)),
    CONSTRAINT "CK_ParkingIssues_Type" CHECK ("Type" IN (0,1,2,3,4,5,6)),
    CONSTRAINT "FK_ParkingIssues_Bookings_BookingId_ParkingLotId" FOREIGN KEY ("BookingId", "ParkingLotId") REFERENCES "Bookings" ("Id", "ParkingLotId") ON DELETE RESTRICT,
    CONSTRAINT "FK_ParkingIssues_CameraEvents_CameraEventId_ParkingLotId" FOREIGN KEY ("CameraEventId", "ParkingLotId") REFERENCES "CameraEvents" ("Id", "ParkingLotId") ON DELETE RESTRICT,
    CONSTRAINT "FK_ParkingIssues_ParkingLots_ParkingLotId" FOREIGN KEY ("ParkingLotId") REFERENCES "ParkingLots" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_ParkingIssues_ParkingSessions_ParkingSessionId_ParkingLotId" FOREIGN KEY ("ParkingSessionId", "ParkingLotId") REFERENCES "ParkingSessions" ("Id", "ParkingLotId") ON DELETE RESTRICT,
    CONSTRAINT "FK_ParkingIssues_Users_ReportedByUserId" FOREIGN KEY ("ReportedByUserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_ParkingIssues_Users_ResolvedByUserId" FOREIGN KEY ("ResolvedByUserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "Payments" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "BookingId" uuid,
    "ParkingSessionId" uuid,
    "Amount" numeric(18,2) NOT NULL,
    "Currency" character varying(3) NOT NULL,
    "Type" integer NOT NULL,
    "Method" integer NOT NULL,
    "Status" integer NOT NULL,
    "IdempotencyKey" character varying(128) NOT NULL,
    "PaidAt" timestamp with time zone,
    "CashConfirmedByUserId" uuid,
    "Version" bigint NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_Payments" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_Payments_Amount" CHECK ("Amount" >= 0),
    CONSTRAINT "CK_Payments_Cash" CHECK ("Method" <> 1 OR "Status" NOT IN (1,3,4) OR "CashConfirmedByUserId" IS NOT NULL),
    CONSTRAINT "CK_Payments_Method" CHECK ("Method" IN (0,1)),
    CONSTRAINT "CK_Payments_Owner" CHECK (("BookingId" IS NULL) <> ("ParkingSessionId" IS NULL)),
    CONSTRAINT "CK_Payments_Status" CHECK ("Status" IN (0,1,2,3,4)),
    CONSTRAINT "CK_Payments_Type" CHECK ("Type" IN (0,1,2)),
    CONSTRAINT "CK_Payments_Version" CHECK ("Version" > 0),
    CONSTRAINT "FK_Payments_Bookings_BookingId" FOREIGN KEY ("BookingId") REFERENCES "Bookings" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Payments_ParkingSessions_ParkingSessionId" FOREIGN KEY ("ParkingSessionId") REFERENCES "ParkingSessions" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Payments_Users_CashConfirmedByUserId" FOREIGN KEY ("CashConfirmedByUserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "PricingSnapshots" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "ParkingLotId" uuid NOT NULL,
    "PricingPlanId" uuid NOT NULL,
    "BookingId" uuid,
    "ParkingSessionId" uuid,
    "PricingPlanVersion" integer NOT NULL,
    "ResolvedRulesJson" jsonb NOT NULL,
    "Currency" character varying(3) NOT NULL,
    "CapturedAt" timestamp with time zone NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_PricingSnapshots" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_Snapshots_Owner" CHECK ("BookingId" IS NOT NULL OR "ParkingSessionId" IS NOT NULL),
    CONSTRAINT "FK_PricingSnapshots_Bookings_BookingId_ParkingLotId" FOREIGN KEY ("BookingId", "ParkingLotId") REFERENCES "Bookings" ("Id", "ParkingLotId") ON DELETE RESTRICT,
    CONSTRAINT "FK_PricingSnapshots_ParkingSessions_ParkingSessionId_ParkingLo~" FOREIGN KEY ("ParkingSessionId", "ParkingLotId") REFERENCES "ParkingSessions" ("Id", "ParkingLotId") ON DELETE RESTRICT,
    CONSTRAINT "FK_PricingSnapshots_PricingPlans_PricingPlanId_ParkingLotId" FOREIGN KEY ("PricingPlanId", "ParkingLotId") REFERENCES "PricingPlans" ("Id", "ParkingLotId") ON DELETE RESTRICT
);

CREATE TABLE "PaymentTransactions" (
    "Id" uuid NOT NULL DEFAULT (gen_random_uuid()),
    "PaymentId" uuid NOT NULL,
    "Provider" character varying(40) NOT NULL,
    "ProviderReference" character varying(128),
    "RequestReference" character varying(128) NOT NULL,
    "EventKey" character varying(200),
    "Type" integer NOT NULL,
    "Status" integer NOT NULL,
    "Amount" numeric(18,2) NOT NULL,
    "ResponseCode" character varying(40),
    "VerifiedAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now()),
    "UpdatedAt" timestamp with time zone,
    CONSTRAINT "PK_PaymentTransactions" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_PaymentTransactions_Status" CHECK ("Status" IN (0,1,2)),
    CONSTRAINT "CK_PaymentTransactions_Type" CHECK ("Type" IN (0,1)),
    CONSTRAINT "CK_Transactions_Amount" CHECK ("Amount" >= 0),
    CONSTRAINT "FK_PaymentTransactions_Payments_PaymentId" FOREIGN KEY ("PaymentId") REFERENCES "Payments" ("Id") ON DELETE RESTRICT
);

CREATE INDEX "IX_AuditLogs_ActorUserId" ON "AuditLogs" ("ActorUserId");

CREATE INDEX "IX_AuditLogs_ParkingLotId_CreatedAt" ON "AuditLogs" ("ParkingLotId", "CreatedAt");

CREATE UNIQUE INDEX "IX_Bookings_BookingCode" ON "Bookings" ("BookingCode");

CREATE UNIQUE INDEX "IX_Bookings_GuestOtpChallengeId" ON "Bookings" ("GuestOtpChallengeId") WHERE "GuestOtpChallengeId" IS NOT NULL;

CREATE INDEX "IX_Bookings_ParkingLotId_StartAt" ON "Bookings" ("ParkingLotId", "StartAt");

CREATE INDEX "IX_Bookings_Status_HoldExpiresAt" ON "Bookings" ("Status", "HoldExpiresAt");

CREATE INDEX "IX_Bookings_UserId" ON "Bookings" ("UserId");

CREATE INDEX "IX_Bookings_VehicleId" ON "Bookings" ("VehicleId");

CREATE UNIQUE INDEX "IX_CameraEvents_ParkingLotId_CameraId_ExternalEventId" ON "CameraEvents" ("ParkingLotId", "CameraId", "ExternalEventId");

CREATE INDEX "IX_CameraEvents_ParkingSlotId_ParkingLotId" ON "CameraEvents" ("ParkingSlotId", "ParkingLotId");

CREATE INDEX "IX_CameraEvents_ReviewedByUserId" ON "CameraEvents" ("ReviewedByUserId");

CREATE UNIQUE INDEX "IX_EntranceExits_ParkingLotId_Code" ON "EntranceExits" ("ParkingLotId", "Code");

CREATE INDEX "IX_MapObjects_MapVersionId_ParkingLotId" ON "MapObjects" ("MapVersionId", "ParkingLotId");

CREATE UNIQUE INDEX "IX_MapObjects_MapVersionId_ParkingSlotId" ON "MapObjects" ("MapVersionId", "ParkingSlotId") WHERE "ParkingSlotId" IS NOT NULL;

CREATE INDEX "IX_MapObjects_ParkingLevelId_ParkingLotId" ON "MapObjects" ("ParkingLevelId", "ParkingLotId");

CREATE INDEX "IX_MapObjects_ParkingSlotId_ParkingLotId" ON "MapObjects" ("ParkingSlotId", "ParkingLotId");

CREATE UNIQUE INDEX "IX_MapVersions_ParkingLotId" ON "MapVersions" ("ParkingLotId") WHERE "Status" = 1;

CREATE UNIQUE INDEX "IX_MapVersions_ParkingLotId_VersionNumber" ON "MapVersions" ("ParkingLotId", "VersionNumber");

CREATE INDEX "IX_Notifications_BookingId" ON "Notifications" ("BookingId");

CREATE INDEX "IX_Notifications_UserId_ReadAt" ON "Notifications" ("UserId", "ReadAt");

CREATE UNIQUE INDEX "IX_OperatingHours_ParkingLotId_DayOfWeek" ON "OperatingHours" ("ParkingLotId", "DayOfWeek");

CREATE INDEX "IX_OtpChallenges_PhoneNumber_Purpose_CreatedAt" ON "OtpChallenges" ("PhoneNumber", "Purpose", "CreatedAt");

CREATE INDEX "IX_ParkingIssues_BookingId_ParkingLotId" ON "ParkingIssues" ("BookingId", "ParkingLotId");

CREATE INDEX "IX_ParkingIssues_CameraEventId_ParkingLotId" ON "ParkingIssues" ("CameraEventId", "ParkingLotId");

CREATE INDEX "IX_ParkingIssues_ParkingLotId" ON "ParkingIssues" ("ParkingLotId");

CREATE INDEX "IX_ParkingIssues_ParkingSessionId_ParkingLotId" ON "ParkingIssues" ("ParkingSessionId", "ParkingLotId");

CREATE INDEX "IX_ParkingIssues_ReportedByUserId" ON "ParkingIssues" ("ReportedByUserId");

CREATE INDEX "IX_ParkingIssues_ResolvedByUserId" ON "ParkingIssues" ("ResolvedByUserId");

CREATE UNIQUE INDEX "IX_ParkingLevels_ParkingLotId_Code" ON "ParkingLevels" ("ParkingLotId", "Code");

CREATE UNIQUE INDEX "IX_ParkingLots_Code" ON "ParkingLots" ("Code");

CREATE UNIQUE INDEX "IX_ParkingPolicies_ParkingLotId" ON "ParkingPolicies" ("ParkingLotId");

CREATE UNIQUE INDEX "IX_ParkingSessions_BookingId" ON "ParkingSessions" ("BookingId") WHERE "BookingId" IS NOT NULL;

CREATE UNIQUE INDEX "IX_ParkingSessions_BookingId_ParkingLotId" ON "ParkingSessions" ("BookingId", "ParkingLotId");

CREATE UNIQUE INDEX "IX_ParkingSessions_NormalizedPlate" ON "ParkingSessions" ("NormalizedPlate") WHERE "Status" IN (0,1);

CREATE INDEX "IX_ParkingSessions_ParkingLotId" ON "ParkingSessions" ("ParkingLotId");

CREATE UNIQUE INDEX "IX_ParkingSessions_ParkingSlotId" ON "ParkingSessions" ("ParkingSlotId") WHERE "Status" IN (0,1);

CREATE INDEX "IX_ParkingSessions_ParkingSlotId_ParkingLotId" ON "ParkingSessions" ("ParkingSlotId", "ParkingLotId");

CREATE INDEX "IX_ParkingSessions_VehicleId" ON "ParkingSessions" ("VehicleId");

CREATE UNIQUE INDEX "IX_ParkingSlotFeatures_ParkingSlotId_SlotFeatureId" ON "ParkingSlotFeatures" ("ParkingSlotId", "SlotFeatureId");

CREATE INDEX "IX_ParkingSlotFeatures_SlotFeatureId" ON "ParkingSlotFeatures" ("SlotFeatureId");

CREATE UNIQUE INDEX "IX_ParkingSlots_ZoneId_Code" ON "ParkingSlots" ("ZoneId", "Code");

CREATE INDEX "IX_ParkingSlots_ZoneId_ParkingLotId" ON "ParkingSlots" ("ZoneId", "ParkingLotId");

CREATE INDEX "IX_Payments_BookingId" ON "Payments" ("BookingId");

CREATE INDEX "IX_Payments_CashConfirmedByUserId" ON "Payments" ("CashConfirmedByUserId");

CREATE UNIQUE INDEX "IX_Payments_IdempotencyKey" ON "Payments" ("IdempotencyKey");

CREATE INDEX "IX_Payments_ParkingSessionId" ON "Payments" ("ParkingSessionId");

CREATE INDEX "IX_PaymentTransactions_PaymentId" ON "PaymentTransactions" ("PaymentId");

CREATE UNIQUE INDEX "IX_PaymentTransactions_Provider_EventKey" ON "PaymentTransactions" ("Provider", "EventKey") WHERE "EventKey" IS NOT NULL;

CREATE UNIQUE INDEX "IX_PaymentTransactions_Provider_ProviderReference" ON "PaymentTransactions" ("Provider", "ProviderReference") WHERE "ProviderReference" IS NOT NULL;

CREATE UNIQUE INDEX "IX_PaymentTransactions_Provider_RequestReference" ON "PaymentTransactions" ("Provider", "RequestReference");

CREATE UNIQUE INDEX "IX_PricingPlans_ParkingLotId_VersionNumber" ON "PricingPlans" ("ParkingLotId", "VersionNumber");

CREATE INDEX "IX_PricingRules_PricingPlanId_ParkingLotId" ON "PricingRules" ("PricingPlanId", "ParkingLotId");

CREATE INDEX "IX_PricingRules_ZoneId_ParkingLotId" ON "PricingRules" ("ZoneId", "ParkingLotId");

CREATE UNIQUE INDEX "IX_PricingSnapshots_BookingId_ParkingLotId" ON "PricingSnapshots" ("BookingId", "ParkingLotId");

CREATE UNIQUE INDEX "IX_PricingSnapshots_ParkingSessionId_ParkingLotId" ON "PricingSnapshots" ("ParkingSessionId", "ParkingLotId");

CREATE INDEX "IX_PricingSnapshots_PricingPlanId_ParkingLotId" ON "PricingSnapshots" ("PricingPlanId", "ParkingLotId");

CREATE INDEX "IX_QRTokens_BookingId" ON "QRTokens" ("BookingId");

CREATE UNIQUE INDEX "IX_QRTokens_NonceHash" ON "QRTokens" ("NonceHash");

CREATE UNIQUE INDEX "IX_SlotFeatures_Code" ON "SlotFeatures" ("Code");

CREATE UNIQUE INDEX "IX_SlotReservations_BookingId" ON "SlotReservations" ("BookingId") WHERE "Status" IN (0,1);

CREATE INDEX "IX_SlotReservations_BookingId_ParkingLotId" ON "SlotReservations" ("BookingId", "ParkingLotId");

CREATE INDEX "IX_SlotReservations_ParkingSlotId_ParkingLotId" ON "SlotReservations" ("ParkingSlotId", "ParkingLotId");

CREATE INDEX "IX_StaffAssignments_AssignedByUserId" ON "StaffAssignments" ("AssignedByUserId");

CREATE INDEX "IX_StaffAssignments_ParkingLotId_UserId" ON "StaffAssignments" ("ParkingLotId", "UserId");

CREATE INDEX "IX_StaffAssignments_UserId" ON "StaffAssignments" ("UserId");

CREATE UNIQUE INDEX "IX_Users_Email" ON "Users" ("Email") WHERE "Email" IS NOT NULL;

CREATE UNIQUE INDEX "IX_Users_PhoneNumber" ON "Users" ("PhoneNumber") WHERE "PhoneNumber" IS NOT NULL;

CREATE UNIQUE INDEX "IX_Vehicles_NormalizedPlate" ON "Vehicles" ("NormalizedPlate") WHERE "IsActive";

CREATE UNIQUE INDEX "IX_Vehicles_OwnerUserId" ON "Vehicles" ("OwnerUserId") WHERE "IsActive" AND "IsPrimary" AND "OwnerUserId" IS NOT NULL;

CREATE UNIQUE INDEX "IX_Zones_ParkingLevelId_Code" ON "Zones" ("ParkingLevelId", "Code");

CREATE INDEX "IX_Zones_ParkingLevelId_ParkingLotId" ON "Zones" ("ParkingLevelId", "ParkingLotId");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260928011406_InitialParkingSchema', '10.0.12');

COMMIT;

START TRANSACTION;
ALTER TABLE "SlotReservations"
ADD CONSTRAINT "EX_Reservations_SlotTime" EXCLUDE USING gist
("ParkingSlotId" WITH =, tstzrange("ReservedFrom", "ReservedUntil", '[)') WITH &&)
WHERE ("Status" IN (0,1));

ALTER TABLE "Bookings"
ADD CONSTRAINT "EX_Bookings_PlateTime" EXCLUDE USING gist
("NormalizedPlate" WITH =, tstzrange("StartAt", "EndAt", '[)') WITH &&)
WHERE ("Status" IN (0,1,2));

-- Each lot's plan is a complete price list containing rules for its vehicle/zone types.
ALTER TABLE "PricingPlans"
ADD CONSTRAINT "EX_Plans_LotTime" EXCLUDE USING gist
("ParkingLotId" WITH =, tstzrange("EffectiveFrom", "EffectiveTo", '[)') WITH &&)
WHERE ("Status" = 1);

CREATE UNIQUE INDEX "UX_Users_EmailCaseInsensitive" ON "Users" (lower("Email")) WHERE "Email" IS NOT NULL;
ALTER TABLE "Vehicles" ADD CONSTRAINT "CK_Vehicles_Plate" CHECK ("NormalizedPlate" ~ '^[A-Z0-9]+$');
ALTER TABLE "OtpChallenges" ADD CONSTRAINT "CK_Otp_Plate" CHECK ("NormalizedPlate" ~ '^[A-Z0-9]+$');

CREATE FUNCTION parking_reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER "TR_AuditLogs_AppendOnly" BEFORE UPDATE OR DELETE ON "AuditLogs"
FOR EACH ROW EXECUTE FUNCTION parking_reject_audit_mutation();


INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260928011546_AddReservationGuards', '10.0.12');

COMMIT;

