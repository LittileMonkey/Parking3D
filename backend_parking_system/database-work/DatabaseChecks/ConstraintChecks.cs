using Npgsql;
using ParkingSystem.Data;
using ParkingSystem.Models;
using Microsoft.EntityFrameworkCore;

internal static class ConstraintChecks
{
    public static async Task Run(ParkingDbContext db, NpgsqlConnection connection)
    {
        // This suite is intended for a freshly migrated, empty development database only.
        foreach (var entity in db.Model.GetEntityTypes())
        {
            await using var check = connection.CreateCommand();
            check.CommandText = $"SELECT EXISTS (SELECT 1 FROM \"{entity.GetTableName()}\")";
            if ((bool)(await check.ExecuteScalarAsync())!)
                throw new InvalidOperationException("Refusing verification: business database must be empty.");
        }
        await using var tx = await db.Database.BeginTransactionAsync();
        var passed = 0;
        async Task Reject(string label, string sqlState, FormattableString sql)
        {
            await tx.CreateSavepointAsync("expected_failure");
            try
            {
                await db.Database.ExecuteSqlInterpolatedAsync(sql);
                throw new InvalidOperationException("Constraint did not reject: " + label);
            }
            catch (PostgresException ex) when (ex.SqlState == sqlState)
            {
                await tx.RollbackToSavepointAsync("expected_failure");
                passed++;
                Console.WriteLine("PASS " + label);
            }
            await tx.ReleaseSavepointAsync("expected_failure");
        }
        try
        {
            var stamp = Guid.NewGuid().ToString("N")[..10];
            var user = new User { FullName = "Constraint test", Email = stamp + "@example.invalid", PasswordHash = "TEST_ONLY" };
            var lot = new ParkingLot { Code = "TEST" + stamp, Name = "Test", Address = "Test" };
            var otherLot = new ParkingLot { Code = "OTHER" + stamp, Name = "Other", Address = "Test" };
            var level = new ParkingLevel { ParkingLot = lot, Code = "G", Name = "Ground" };
            var zone = new Zone { ParkingLotId = lot.Id, ParkingLevel = level, Code = "A", Name = "A" };
            var slot = new ParkingSlot { ParkingLotId = lot.Id, Zone = zone, Code = "A1", SupportedVehicleTypes = [VehicleType.Car] };
            var slot2 = new ParkingSlot { ParkingLotId = lot.Id, Zone = zone, Code = "A2", SupportedVehicleTypes = [VehicleType.Car] };
            var v1 = new Vehicle { OwnerUser = user, LicensePlate = "TEST1", NormalizedPlate = "TEST1" + stamp.ToUpperInvariant(), VehicleType = VehicleType.Car };
            var v2 = new Vehicle { OwnerUser = user, LicensePlate = "TEST2", NormalizedPlate = "TEST2" + stamp.ToUpperInvariant(), VehicleType = VehicleType.Car };
            db.AddRange(user, lot, otherLot, level, zone, slot, slot2, v1, v2);
            await db.SaveChangesAsync();
            var start = DateTimeOffset.UtcNow.AddDays(1);
            Booking NewBooking(Vehicle vehicle, DateTimeOffset from, DateTimeOffset until) => new()
            {
                BookingCode = Guid.NewGuid().ToString("N"), ParkingLotId = lot.Id, UserId = user.Id,
                VehicleId = vehicle.Id, PlateSnapshot = vehicle.LicensePlate, NormalizedPlate = vehicle.NormalizedPlate,
                VehicleType = VehicleType.Car, StartAt = from, EndAt = until, HoldExpiresAt = DateTimeOffset.UtcNow.AddMinutes(15), QuotedTotal = 10000
            };
            var b1 = NewBooking(v1, start, start.AddHours(1));
            var b2 = NewBooking(v2, start, start.AddHours(1));
            var b3 = NewBooking(v1, start.AddHours(1), start.AddHours(2));
            db.AddRange(b1, b2, b3);
            await db.SaveChangesAsync();
            db.SlotReservations.Add(new SlotReservation { ParkingLotId = lot.Id, BookingId = b1.Id, ParkingSlotId = slot.Id, ReservedFrom = start, ReservedUntil = start.AddHours(1) });
            db.SlotReservations.Add(new SlotReservation { ParkingLotId = lot.Id, BookingId = b3.Id, ParkingSlotId = slot.Id, ReservedFrom = start.AddHours(1), ReservedUntil = start.AddHours(2) });
            await db.SaveChangesAsync();
            Console.WriteLine("PASS adjacent booking/reservation windows [start,end)"); passed++;

            await Reject("overlapping plate booking", "23P01", $"UPDATE \"Bookings\" SET \"StartAt\"={start.AddMinutes(30)} WHERE \"Id\"={b3.Id}");
            await Reject("overlapping slot reservation", "23P01", $"INSERT INTO \"SlotReservations\" (\"BookingId\",\"ParkingSlotId\",\"ParkingLotId\",\"ReservedFrom\",\"ReservedUntil\",\"Status\") VALUES ({b2.Id},{slot.Id},{lot.Id},{start},{start.AddHours(1)},0)");
            await Reject("cross-lot reservation", "23503", $"INSERT INTO \"SlotReservations\" (\"BookingId\",\"ParkingSlotId\",\"ParkingLotId\",\"ReservedFrom\",\"ReservedUntil\",\"Status\") VALUES ({b2.Id},{slot2.Id},{otherLot.Id},{start},{start.AddHours(1)},0)");
            await Reject("invalid role", "23514", $"UPDATE \"Users\" SET \"PlatformRole\"=77 WHERE \"Id\"={user.Id}");
            await Reject("invalid vehicle types", "23514", $"UPDATE \"ParkingSlots\" SET \"SupportedVehicleTypes\"=ARRAY[99] WHERE \"Id\"={slot.Id}");
            await Reject("restrict parent deletion", "23503", $"DELETE FROM \"ParkingLots\" WHERE \"Id\"={lot.Id}");

            var session = new ParkingSession { ParkingLotId = lot.Id, ParkingSlotId = slot.Id, VehicleId = v1.Id, PlateSnapshot = v1.LicensePlate, NormalizedPlate = v1.NormalizedPlate, EnteredAt = DateTimeOffset.UtcNow, Status = SessionStatus.ExitPending };
            var session2 = new ParkingSession { ParkingLotId = lot.Id, ParkingSlotId = slot2.Id, VehicleId = v2.Id, PlateSnapshot = v2.LicensePlate, NormalizedPlate = v2.NormalizedPlate, EnteredAt = DateTimeOffset.UtcNow };
            db.AddRange(session, session2);
            await db.SaveChangesAsync();
            await Reject("ExitPending still occupies slot", "23505", $"UPDATE \"ParkingSessions\" SET \"ParkingSlotId\"={slot.Id} WHERE \"Id\"={session2.Id}");
            await Reject("one physical session per plate", "23505", $"UPDATE \"ParkingSessions\" SET \"NormalizedPlate\"={v1.NormalizedPlate} WHERE \"Id\"={session2.Id}");
            await Reject("cannot complete without exit", "23514", $"UPDATE \"ParkingSessions\" SET \"Status\"=2 WHERE \"Id\"={session.Id}");
            var payment = new Payment { BookingId = b1.Id, Amount = 10000, IdempotencyKey = stamp };
            db.Add(payment);
            await db.SaveChangesAsync();
            await Reject("payment exactly one owner", "23514", $"UPDATE \"Payments\" SET \"ParkingSessionId\"={session.Id} WHERE \"Id\"={payment.Id}");
            await Reject("nonnegative money", "23514", $"UPDATE \"Payments\" SET \"Amount\"=-1 WHERE \"Id\"={payment.Id}");
            await Reject("cash requires confirming staff", "23514", $"UPDATE \"Payments\" SET \"Method\"=1,\"Status\"=1 WHERE \"Id\"={payment.Id}");
            await Reject("payment idempotency", "23505", $"INSERT INTO \"Payments\" (\"BookingId\",\"Amount\",\"Currency\",\"Type\",\"Method\",\"Status\",\"Version\",\"IdempotencyKey\") VALUES ({b2.Id},10000,'VND',0,0,0,1,{stamp})");
            var t1 = new PaymentTransaction { PaymentId = payment.Id, Provider = "TEST", RequestReference = "R1" + stamp, EventKey = "E1" + stamp, ProviderReference = "P1" + stamp };
            var t2 = new PaymentTransaction { PaymentId = payment.Id, Provider = "TEST", RequestReference = "R2" + stamp, EventKey = "E2" + stamp, ProviderReference = "P2" + stamp };
            db.AddRange(t1, t2);
            await db.SaveChangesAsync();
            await Reject("duplicate payment callback", "23505", $"UPDATE \"PaymentTransactions\" SET \"EventKey\"={t1.EventKey} WHERE \"Id\"={t2.Id}");
            var audit = new AuditLog { ActorType = AuditActorType.System, Action = "TEST", EntityType = "TEST", EntityId = stamp };
            db.Add(audit);
            await db.SaveChangesAsync();
            await Reject("append-only audit in PostgreSQL", "23514", $"DELETE FROM \"AuditLogs\" WHERE \"Id\"={audit.Id}");
            var map1 = new MapVersion { ParkingLotId = lot.Id, VersionNumber = 1, Status = MapStatus.Published };
            var map2 = new MapVersion { ParkingLotId = lot.Id, VersionNumber = 2 };
            db.AddRange(map1, map2);
            await db.SaveChangesAsync();
            await Reject("one published map per lot", "23505", $"UPDATE \"MapVersions\" SET \"Status\"=1 WHERE \"Id\"={map2.Id}");
            slot.Code = "A1-EDIT";
            await db.SaveChangesAsync();
            if (slot.Version != 2 || slot.UpdatedAt is null) throw new InvalidOperationException("Version/timestamp update failed");
            if (!(await db.ParkingSlots.AsNoTracking().SingleAsync(x => x.Id == slot.Id)).SupportedVehicleTypes.SequenceEqual([VehicleType.Car])) throw new InvalidOperationException("Enum array roundtrip failed");
            Console.WriteLine("PASS EF enum-array roundtrip and version/timestamp update"); passed++;
            // Simulate a concurrent writer advancing the version behind the tracked entity.
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"ParkingSlots\" SET \"Version\"=3 WHERE \"Id\"={slot.Id}");
            slot.Code = "STALE";
            try { await db.SaveChangesAsync(); throw new InvalidOperationException("Stale update was accepted"); }
            catch (DbUpdateConcurrencyException) { Console.WriteLine("PASS optimistic concurrency conflict"); passed++; }
        }
        finally
        {
            await tx.RollbackAsync();
            db.ChangeTracker.Clear();
        }
        Console.WriteLine($"Constraint checks passed: {passed}; all test data rolled back.");
        Console.WriteLine("Applied migrations: " + string.Join(", ", await db.Database.GetAppliedMigrationsAsync()));
        if ((await db.Database.GetPendingMigrationsAsync()).Any()) throw new InvalidOperationException("Pending migrations remain");
        foreach (var entity in db.Model.GetEntityTypes())
        {
            await using var count = connection.CreateCommand();
            count.CommandText = $"SELECT count(*) FROM \"{entity.GetTableName()}\"";
            if ((long)(await count.ExecuteScalarAsync())! != 0) throw new InvalidOperationException("Unexpected data remains in " + entity.GetTableName());
        }
        Console.WriteLine("PASS all 28 business tables empty after rollback.");
    }
}
