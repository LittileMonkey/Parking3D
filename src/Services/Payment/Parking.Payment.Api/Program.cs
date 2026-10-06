using Parking.Contracts.Identity.V1;
using Parking.Contracts.Payments.V1;
using Parking.Payment.Application;
using Parking.Payment.Infrastructure;
using Parking.ServiceDefaults;

var builder=WebApplication.CreateBuilder(args);builder.AddParkingDefaults();
builder.Services.AddGrpcClient<FacilityAuthorization.FacilityAuthorizationClient>(o=>o.Address=new Uri(builder.Configuration["Services:IdentityGrpc"]??"http://identity:8081"));
builder.Services.AddGrpcClient<BookingPaymentQuery.BookingPaymentQueryClient>(o=>o.Address=new Uri(builder.Configuration["Services:ParkingGrpc"]??"http://parking:8081"));
builder.Services.AddGrpcClient<ParkingPaymentEvents.ParkingPaymentEventsClient>(o=>o.Address=new Uri(builder.Configuration["Services:ParkingGrpc"]??"http://parking:8081"));
builder.Services.AddScoped<IPaymentService,PaymentService>();builder.Services.AddHostedService<OutboxWorker>();
var app=builder.Build();app.UseParkingDefaults("payment");
app.MapPost("/api/v1/payments",async(CreatePaymentRequest request,HttpContext context,IPaymentService service,CancellationToken ct)=>
    Responses.Ok(await service.CreateAsync(context.User.Subject(),request,context.Request.Headers["Idempotency-Key"].ToString(),ct))).RequireAuthorization();
app.MapPost("/api/v1/parking-lots/{lotId:guid}/payments/{paymentId:guid}/cash-confirmation",async(Guid lotId,Guid paymentId,CashConfirmationRequest request,HttpContext context,IPaymentService service,CancellationToken ct)=>
    Responses.Ok(await service.ConfirmCashAsync(context.User.Subject(),lotId,paymentId,request,ct))).RequireAuthorization();
await app.RunAsync();
public partial class Program;
