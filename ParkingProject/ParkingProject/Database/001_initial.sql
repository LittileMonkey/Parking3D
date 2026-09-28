CREATE TABLE "Slots" (
    "Id" character varying(24) NOT NULL,
    "Floor" character varying(3) NOT NULL,
    "Zone" character varying(16) NOT NULL,
    "VehicleType" character varying(16) NOT NULL,
    "SlotType" character varying(16) NOT NULL,
    "Status" character varying(16) NOT NULL,
    "ExitOrder" integer NOT NULL,
    CONSTRAINT "PK_Slots" PRIMARY KEY ("Id")
);


CREATE TABLE "Vehicles" (
    "Id" uuid NOT NULL,
    "Plate" character varying(16) NOT NULL,
    "Type" character varying(16) NOT NULL,
    CONSTRAINT "PK_Vehicles" PRIMARY KEY ("Id")
);


CREATE TABLE "Bookings" (
    "Id" uuid NOT NULL,
    "VehicleId" uuid NOT NULL,
    "SlotId" character varying(24) NOT NULL,
    "GuestPhone" character varying(20) NOT NULL,
    "Status" character varying(16) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "HoldUntil" timestamp with time zone NOT NULL,
    "AccessTokenHash" character varying(64) NOT NULL,
    CONSTRAINT "PK_Bookings" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Bookings_Slots_SlotId" FOREIGN KEY ("SlotId") REFERENCES "Slots" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Bookings_Vehicles_VehicleId" FOREIGN KEY ("VehicleId") REFERENCES "Vehicles" ("Id") ON DELETE RESTRICT
);


CREATE UNIQUE INDEX "IX_Bookings_SlotId" ON "Bookings" ("SlotId") WHERE "Status" IN ('PENDING', 'CONFIRMED', 'CHECKED_IN');


CREATE INDEX "IX_Bookings_Status_HoldUntil" ON "Bookings" ("Status", "HoldUntil");


CREATE UNIQUE INDEX "IX_Bookings_VehicleId" ON "Bookings" ("VehicleId") WHERE "Status" IN ('PENDING', 'CONFIRMED', 'CHECKED_IN');


CREATE INDEX "IX_Slots_VehicleType_Status" ON "Slots" ("VehicleType", "Status");


CREATE UNIQUE INDEX "IX_Vehicles_Plate" ON "Vehicles" ("Plate");


