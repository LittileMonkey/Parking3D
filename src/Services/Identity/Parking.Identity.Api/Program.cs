using Parking.Identity.Application;
using Parking.Identity.Infrastructure;
using Parking.ServiceDefaults;
using Parking.Contracts.Catalog.V1;

var builder = WebApplication.CreateBuilder(args);
builder.AddParkingDefaults();
builder.Services.AddScoped<IIdentityService, IdentityService>();
builder.Services.AddGrpcClient<ParkingCatalog.ParkingCatalogClient>(o=>o.Address=new Uri(builder.Configuration["Services:ParkingGrpc"]??"http://parking:8081"));
var app = builder.Build();
app.UseParkingDefaults("identity");
app.MapGrpcService<FacilityAuthorizationGrpc>();
app.MapPost("/api/v1/auth/register", async (RegisterRequest request, IIdentityService service, CancellationToken ct) =>
    Responses.Ok(new { userId = await service.RegisterAsync(request, ct) }, "Registered"));
app.MapPost("/api/v1/auth/login", async (LoginRequest request, IIdentityService service, CancellationToken ct) =>
    Responses.Ok(await service.LoginAsync(request, ct)));
app.MapPost("/api/v1/staff-assignments", async (AssignmentRequest request, HttpContext context, IIdentityService service, ParkingCatalog.ParkingCatalogClient catalog, CancellationToken ct) =>
{
    if(!await service.CheckAccessAsync(context.User.Subject(),Guid.Empty,"ADMIN",ct))throw new ServiceException(403,"Admin permission required");
    var lot=await catalog.LotExistsAsync(new LotRequest{LotId=request.LotId.ToString()},headers:GrpcHeaders.For(builder.Configuration),deadline:DateTime.UtcNow.AddSeconds(3),cancellationToken:ct);
    if(!lot.Exists)throw new ServiceException(404,"Lot not found");
    return Responses.Ok(new { assignmentId = await service.AssignAsync(context.User.Subject(), request, ct) });
}).RequireAuthorization();
await using (var scope = app.Services.CreateAsyncScope())
    await scope.ServiceProvider.GetRequiredService<IIdentityService>().BootstrapAsync(CancellationToken.None);
await app.RunAsync();

public partial class Program;
