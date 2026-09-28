using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ParkingProject.Data;
using ParkingProject.Domain;
namespace ParkingProject.Controllers;

[ApiController]
[Route("api/slots")]
public class SlotsController(ParkingDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(string? floor, VehicleType? vehicleType, SlotStatus? status,
        int page = 1, int pageSize = 100, CancellationToken ct = default)
    {
        if (page < 1 || page > 100000 || pageSize < 1 || pageSize > 200)
            return BadRequest(new { message = "page từ 1 đến 100000; pageSize từ 1 đến 200." });
        if ((vehicleType.HasValue && !Enum.IsDefined(vehicleType.Value)) || (status.HasValue && !Enum.IsDefined(status.Value)))
            return BadRequest(new { message = "Loại xe hoặc trạng thái không hợp lệ." });
        var query = db.Slots.AsNoTracking().AsQueryable();
        if (floor is not null) query = query.Where(x => x.Floor == floor);
        if (vehicleType.HasValue) query = query.Where(x => x.VehicleType == vehicleType);
        if (status.HasValue) query = query.Where(x => x.Status == status);
        var total = await query.CountAsync(ct);
        var items = await query.OrderBy(x => x.Id).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new { slotId = x.Id, x.Floor, x.Zone, x.VehicleType, x.SlotType, x.Status, x.ExitOrder }).ToListAsync(ct);
        return Ok(new { total, page, pageSize, items });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id, CancellationToken ct)
    {
        var slot = await db.Slots.AsNoTracking().Where(x => x.Id == id)
            .Select(x => new { slotId = x.Id, x.Floor, x.Zone, x.VehicleType, x.SlotType, x.Status, x.ExitOrder }).SingleOrDefaultAsync(ct);
        return slot is null ? NotFound() : Ok(slot);
    }
}
