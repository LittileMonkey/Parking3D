using Parking.ServiceDefaults;
using System.Threading.RateLimiting;

var builder=WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders().AddJsonConsole();
builder.Services.AddReverseProxy().LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));
builder.Services.AddCors(o=>o.AddDefaultPolicy(p=>p.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>()??["http://localhost:5173"])
    .AllowAnyMethod().AllowAnyHeader()));
builder.Services.AddHttpClient("readiness",c=>c.Timeout=TimeSpan.FromSeconds(2));
builder.Services.AddRateLimiter(options=>
{
    options.GlobalLimiter=PartitionedRateLimiter.Create<HttpContext,string>(context=>
        RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString()??"unknown",_=>new FixedWindowRateLimiterOptions
        {PermitLimit=builder.Configuration.GetValue("RateLimit:PermitLimit",20),Window=TimeSpan.FromMinutes(1),QueueLimit=0,AutoReplenishment=true}));
    options.OnRejected=async(context,ct)=>
    {
        context.HttpContext.Response.StatusCode=429;
        await context.HttpContext.Response.WriteAsJsonAsync(new ApiResponse<object>(null,false,429,"Too many requests"),ct);
    };
});
var app=builder.Build();app.UseCors();
app.UseRateLimiter();
app.UseStatusCodePages(async c=>
{
    var response=c.HttpContext.Response;
    await response.WriteAsJsonAsync(new ApiResponse<object>(null,false,response.StatusCode,
        response.StatusCode is 502 or 503 or 504?"Upstream service unavailable":"Request failed"));
});
app.Use(async(context,next)=>
{
    var correlation=Guid.TryParse(context.Request.Headers["X-Correlation-Id"],out var id)?id:Guid.NewGuid();
    context.TraceIdentifier=correlation.ToString();context.Response.Headers["X-Correlation-Id"]=correlation.ToString();
    await next(context);
});
app.MapGet("/health/live",()=>Responses.Ok(new{service="gateway",status="live"}));
app.MapGet("/health/ready",async(IHttpClientFactory clients,CancellationToken ct)=>
{
    var ready=new Dictionary<string,bool>();
    foreach(var service in new[]{"identity","parking","payment","ai"})
    {
        try
        {
            var uri=builder.Configuration[$"Services:{service}Http"]??$"http://{service}:8080";
            using var response=await clients.CreateClient("readiness").GetAsync(uri+"/health/ready",ct);
            ready[service]=response.IsSuccessStatusCode;
        }
        catch(HttpRequestException){ready[service]=false;}
        catch(TaskCanceledException){ready[service]=false;}
    }
    var ok=ready.Values.All(x=>x);var status=ok?200:503;
    return Results.Json(new ApiResponse<object>(new{service="gateway",dependencies=ready},ok,status,ok?"Ready":"Dependencies unavailable"),statusCode:status);
});
app.MapReverseProxy();app.MapFallback(()=>Responses.Error(404,"Endpoint not found"));
await app.RunAsync();
public partial class Program;
