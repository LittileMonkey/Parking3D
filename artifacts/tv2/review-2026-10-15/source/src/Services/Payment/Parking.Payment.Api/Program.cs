using Parking.Contracts.Identity.V1;
using Parking.Contracts.Payments.V1;
using Parking.Payment.Api.Middleware;
using Parking.Payment.Application;
using Parking.Payment.Infrastructure;
using Parking.ServiceDefaults;

var builder=WebApplication.CreateBuilder(args);
builder.AddParkingDefaults();
// 1. Cấu hình các gRPC Client gọi sang Identity và Parking
builder.Services.AddGrpcClient<FacilityAuthorization.FacilityAuthorizationClient>(o=>o.Address=new Uri(builder.Configuration["Services:IdentityGrpc"]??"http://identity:8081"));

builder.Services.AddGrpcClient<BookingPaymentQuery.BookingPaymentQueryClient>(o=>o.Address=new Uri(builder.Configuration["Services:ParkingGrpc"]??"http://parking:8081"));

builder.Services.AddGrpcClient<ParkingPaymentEvents.ParkingPaymentEventsClient>(o=>o.Address=new Uri(builder.Configuration["Services:ParkingGrpc"]??"http://parking:8081"));

// 2. Đăng ký các dịch vụ gốc của Payment (Database & Outbox Worker ngầm)
builder.Services.AddScoped<IPaymentService,PaymentService>();
builder.Services.AddHostedService<OutboxWorker>();

// 3. Đăng ký các tầng kiến trúc Clean Architecture theo mẫu Mentor:
builder.Services.AddApplicationServices();                      // Nạp MediatR + FluentValidation + ValidationBehavior
builder.Services.AddInfrastructureServices();                   // Nạp PaymentRepository
builder.Services.AddTransient<ExceptionHandlingMiddleware>();   // Đăng ký bộ gác cổng bắt lỗi
builder.Services.AddControllers();                              // Nạp Controller


var app =builder.Build();
app.UseParkingDefaults("payment");

// 4. Kích hoạt Middleware bắt lỗi ở cổng ngoài cùng
app.UseMiddleware<ExceptionHandlingMiddleware>();


// 5. Giữ nguyên các Minimal API cũ để tương thích ngược
app.MapPost("/api/v1/payments",async(CreatePaymentRequest request,HttpContext context,IPaymentService service,CancellationToken ct)
    => Responses.Ok(await service.CreateAsync(context.User.Subject(),request,context.Request.Headers["Idempotency-Key"].ToString(),ct))).RequireAuthorization();
app.MapPost("/api/v1/parking-lots/{lotId:guid}/payments/{paymentId:guid}/cash-confirmation",async(Guid lotId,Guid paymentId,CashConfirmationRequest request,HttpContext context,IPaymentService service,CancellationToken ct)
    => Responses.Ok(await service.ConfirmCashAsync(context.User.Subject(),lotId,paymentId,request,ct))).RequireAuthorization();

// 6. Kích hoạt định tuyến cho PaymentsController (API S2-06 mới)
app.MapControllers();

await app.RunAsync();
public partial class Program;
