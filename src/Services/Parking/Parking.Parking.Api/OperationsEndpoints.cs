using Parking.Parking.Application;
using Parking.Parking.Persistence;
using Parking.ServiceDefaults;

namespace Parking.Parking.Api;

public static class OperationsEndpoints
{
    public static void MapLotOperations(this WebApplication app)
    {
        var group = app.MapGroup("/api/v1/parking-lots/{lotId:guid}").RequireAuthorization();
        group.MapGet("/active-reservations", async (Guid lotId, HttpContext ctx, IFacilityAccess access, SlotReallocationRepository repo, CancellationToken ct) =>
        {
            await access.RequireAsync(ctx.User.Subject(),lotId,"GATE",ct);
            return Responses.Ok(await repo.ListAsync(lotId,ct));
        });
        group.MapPost("/bookings/{bookingId:guid}/reallocate", async (Guid lotId, Guid bookingId, ReallocateBooking request, HttpContext ctx, IFacilityAccess access, SlotReallocationRepository repo, CancellationToken ct) =>
        {
            await access.RequireAsync(ctx.User.Subject(),lotId,"GATE",ct);
            await repo.MoveAsync(lotId,bookingId,ctx.User.Subject(),request,ct);
            return Responses.Ok(new { bookingId, slotId=request.TargetSlotId });
        });
        group.MapGet("/booking-cancellations", async (Guid lotId, HttpContext ctx, IFacilityAccess access, BookingCancellationRepository repo, CancellationToken ct) =>
        {
            await access.RequireAsync(ctx.User.Subject(),lotId,"MANAGER",ct);
            return Responses.Ok(await repo.ListForLotAsync(lotId,ct));
        });
        group.MapGet("/staff-shifts", async (Guid lotId, HttpContext ctx, IFacilityAccess access, OperationsRepository repo, CancellationToken ct) =>
        {
            await access.RequireAsync(ctx.User.Subject(),lotId,"HANDOVER",ct);
            return Responses.Ok(await repo.ShiftsAsync(lotId,ct));
        });
        group.MapPost("/staff-shifts", async (Guid lotId, HttpContext ctx, IFacilityAccess access, OperationsRepository repo, CancellationToken ct) =>
        {
            await access.RequireAsync(ctx.User.Subject(),lotId,"HANDOVER",ct);
            return Responses.Ok(new { id=await repo.StartShiftAsync(lotId,ctx.User.Subject(),ct) });
        });
        group.MapGet("/operations-summary", async (Guid lotId, DateTimeOffset from, DateTimeOffset until, HttpContext ctx, IFacilityAccess access, OperationsRepository repo, CancellationToken ct) =>
        {
            await access.RequireAsync(ctx.User.Subject(),lotId,"GATE",ct);
            return Responses.Ok(await repo.UsageAsync(lotId,from,until,ct));
        });
        group.MapGet("/usage-report", async (Guid lotId, DateTimeOffset from, DateTimeOffset until, HttpContext ctx, IFacilityAccess access, OperationsRepository repo, CancellationToken ct) =>
        {
            await access.RequireAsync(ctx.User.Subject(), lotId, "REPORT", ct);
            return Responses.Ok(await repo.UsageAsync(lotId, from, until, ct));
        });
        group.MapGet("/pricing-plans", async (Guid lotId, string vehicleType, HttpContext ctx, IFacilityAccess access, OperationsRepository repo, CancellationToken ct) =>
        {
            await access.RequireAsync(ctx.User.Subject(), lotId, "MANAGER", ct);
            return Responses.Ok(await repo.PricingAsync(lotId, vehicleType, ct));
        });
        group.MapPost("/pricing-plans", async (Guid lotId, PublishPricing request, HttpContext ctx, IFacilityAccess access, OperationsRepository repo, CancellationToken ct) =>
        {
            await access.RequireAsync(ctx.User.Subject(), lotId, "MANAGER", ct);
            return Responses.Ok(await repo.PublishAsync(lotId, ctx.User.Subject(), request, ct));
        });
        group.MapGet("/operational-slots", async (Guid lotId, HttpContext ctx, IFacilityAccess access, OperationsRepository repo, CancellationToken ct) =>
        {
            await access.RequireAsync(ctx.User.Subject(), lotId, "GATE", ct);
            return Responses.Ok(await repo.SlotsAsync(lotId, ct));
        });
        group.MapPatch("/slots/{slotId:guid}/operation", async (Guid lotId, Guid slotId, ChangeSlotOperation request, HttpContext ctx, IFacilityAccess access, OperationsRepository repo, CancellationToken ct) =>
        {
            await access.RequireAsync(ctx.User.Subject(), lotId, "GATE", ct);
            await repo.ChangeSlotAsync(lotId, slotId, ctx.User.Subject(), request, ct);
            return Responses.Ok(new { slotId, lotId, operationalStatus = request.Status });
        });
        group.MapGet("/audit-logs", async (Guid lotId, DateTimeOffset from, DateTimeOffset until, HttpContext ctx, IFacilityAccess access, OperationsRepository repo, CancellationToken ct) =>
        {
            await access.RequireAsync(ctx.User.Subject(), lotId, "REPORT", ct);
            return Responses.Ok(await repo.AuditAsync(lotId, from, until, ct));
        });
    }
}
