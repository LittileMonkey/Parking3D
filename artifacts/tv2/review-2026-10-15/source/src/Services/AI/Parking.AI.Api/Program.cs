using Parking.AI.Application;
using Parking.AI.Infrastructure;
using Parking.Contracts.Identity.V1;
using Parking.ServiceDefaults;

var builder=WebApplication.CreateBuilder(args);builder.AddParkingDefaults();
builder.Services.AddHttpClient<IPlateProvider,HttpPlateProvider>(http=>http.Timeout=TimeSpan.FromSeconds(10));
builder.Services.AddScoped<AIReadService>();
builder.Services.AddGrpcClient<FacilityAuthorization.FacilityAuthorizationClient>(o=>o.Address=new Uri(builder.Configuration["Services:IdentityGrpc"]??"http://identity:8081"));
var app=builder.Build();app.UseParkingDefaults("ai");app.MapGrpcService<PlateRecognitionGrpc>();app.MapGrpcService<OccupancyIngestionGrpc>();
app.MapGet("/api/v1/parking-lots/{lotId:guid}/occupancy-forecasts",async(Guid lotId,string vehicleType,int horizonMinutes,AIReadService service,CancellationToken ct)=>Responses.Ok(await service.ForecastAsync(lotId,vehicleType,horizonMinutes,ct)));
app.MapPost("/api/v1/parking-lots/{lotId:guid}/assistant",async(Guid lotId,AssistantRequest request,AIReadService service,CancellationToken ct)=>Responses.Ok(await service.AssistantAsync(lotId,request.Question,ct)));
app.MapPost("/api/v1/ai/documents",async(DocumentRequest request,HttpContext context,FacilityAuthorization.FacilityAuthorizationClient identity,AIReadService service,CancellationToken ct)=>
{
    await Require(context.User.Subject(),Guid.Empty,"ADMIN",identity,ct);
    return Responses.Ok(new{id=await service.CreateDocumentAsync(context.User.Subject(),request,ct)});
}).RequireAuthorization();
app.MapPost("/api/v1/ai/documents/{id:guid}/publish",async(Guid id,PublishRequest request,HttpContext context,FacilityAuthorization.FacilityAuthorizationClient identity,AIReadService service,CancellationToken ct)=>
{
    await Require(context.User.Subject(),Guid.Empty,"ADMIN",identity,ct);
    if(!request.ConfirmPublicContentReviewed)throw new ServiceException(400,"Explicit public-content review confirmation required");
    await service.PublishAsync(context.User.Subject(),id,request.Version,ct);return Responses.Ok(new{id,status="PUBLISHED"});
}).RequireAuthorization();
app.MapPost("/api/v1/parking-lots/{lotId:guid}/plate-recognitions/{id:guid}/review",async(Guid lotId,Guid id,PlateReviewRequest request,HttpContext context,FacilityAuthorization.FacilityAuthorizationClient identity,AIReadService service,CancellationToken ct)=>
{
    await Require(context.User.Subject(),lotId,"OCR",identity,ct);
    await service.ReviewAsync(context.User.Subject(),lotId,id,request,ct);return Responses.Ok(new{id,status="REVIEWED"});
}).RequireAuthorization();
await app.RunAsync();

async Task Require(Guid user,Guid lot,string capability,FacilityAuthorization.FacilityAuthorizationClient identity,CancellationToken ct)
{
    var reply=await identity.CheckAccessAsync(new AccessRequest{UserId=user.ToString(),LotId=lot.ToString(),Capability=capability},headers:GrpcHeaders.For(builder.Configuration),deadline:DateTime.UtcNow.AddSeconds(3),cancellationToken:ct);
    if(!reply.Allowed)throw new ServiceException(403,"Current account/lot permission denied");
}
public sealed record PublishRequest(int Version,bool ConfirmPublicContentReviewed);
public partial class Program;
