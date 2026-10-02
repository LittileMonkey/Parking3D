DROP TRIGGER "TR_AuditLogs_AppendOnly" ON "AuditLogs";
DROP FUNCTION parking_reject_audit_mutation();
ALTER TABLE "OtpChallenges" DROP CONSTRAINT "CK_Otp_Plate";
ALTER TABLE "Vehicles" DROP CONSTRAINT "CK_Vehicles_Plate";
DROP INDEX "UX_Users_EmailCaseInsensitive";
ALTER TABLE "PricingPlans" DROP CONSTRAINT "EX_Plans_LotTime";
ALTER TABLE "Bookings" DROP CONSTRAINT "EX_Bookings_PlateTime";
ALTER TABLE "SlotReservations" DROP CONSTRAINT "EX_Reservations_SlotTime";
