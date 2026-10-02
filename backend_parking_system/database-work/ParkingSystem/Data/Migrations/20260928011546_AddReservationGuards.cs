using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParkingSystem.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddReservationGuards : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
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

""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
DROP TRIGGER "TR_AuditLogs_AppendOnly" ON "AuditLogs";
DROP FUNCTION parking_reject_audit_mutation();
ALTER TABLE "OtpChallenges" DROP CONSTRAINT "CK_Otp_Plate";
ALTER TABLE "Vehicles" DROP CONSTRAINT "CK_Vehicles_Plate";
DROP INDEX "UX_Users_EmailCaseInsensitive";
ALTER TABLE "PricingPlans" DROP CONSTRAINT "EX_Plans_LotTime";
ALTER TABLE "Bookings" DROP CONSTRAINT "EX_Bookings_PlateTime";
ALTER TABLE "SlotReservations" DROP CONSTRAINT "EX_Reservations_SlotTime";

""");
        }
    }
}
