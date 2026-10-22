using Parking.Contracts.Identity.V1;
using Parking.Contracts.Payments.V1;
using Parking.Payment.Api.Middleware;
using Parking.Payment.Application;
using Parking.Payment.Application.DTOs;
using Parking.Payment.Application.Interfaces;
using Parking.Payment.Infrastructure;
using Parking.Payment.Infrastructure.Services;
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
builder.Services.AddInfrastructureServices(builder.Configuration); // Nạp PaymentRepository
builder.Services.AddTransient<ExceptionHandlingMiddleware>();   // Đăng ký bộ gác cổng bắt lỗi
builder.Services.AddControllers();                              // Nạp Controller


var app =builder.Build();
app.UseParkingDefaults("payment");

// 4. Kích hoạt Middleware bắt lỗi ở cổng ngoài cùng
app.UseMiddleware<ExceptionHandlingMiddleware>();


// 5. Giữ nguyên các Minimal API cũ để tương thích ngược
app.MapPost("/api/v1/payments", async (CreatePaymentRequest request, HttpContext context, IPaymentService service, CancellationToken ct) =>
{
    // 1. Trích xuất địa chỉ IP của khách hàng từ kết nối mạng
    var ipAddress = context.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

    // 2. Truyền thêm ipAddress vào hàm CreateAsync
    var result = await service.CreateAsync(
                                            context.User.Subject(), request, 
                                            context.Request.Headers["Idempotency-Key"].ToString(), 
                                            ct, 
                                            ipAddress
                                           );
    return Responses.Ok(result);
}).RequireAuthorization();

app.MapPost("/api/v1/parking-lots/{lotId:guid}/payments/{paymentId:guid}/cash-confirmation", async (Guid lotId, Guid paymentId, CashConfirmationRequest request, HttpContext context, IPaymentService service, CancellationToken ct)
    => Responses.Ok(await service.ConfirmCashAsync(context.User.Subject(), lotId, paymentId, request, ct))).RequireAuthorization();


// Endpoint IPN VNPay (Không cần RequireAuthorization — VNPay không mang JWT)
app.MapGet("/api/v1/payments/vnpay/ipn", async (HttpContext context, IPaymentService service, CancellationToken ct) =>
{
    var queryParams = context.Request.Query
        .ToDictionary(kv => kv.Key, kv => kv.Value.ToString());
    var result = await service.HandleVnPayIpnAsync(queryParams, ct);
    return Results.Ok(result);
});

// Endpoint ReturnUrl VNPay — trình duyệt khách hàng bị redirect về đây sau khi thanh toán
// Frontend sẽ đọc IsSuccess để hiển thị trang "Thanh toán thành công" hay "Thất bại"
app.MapGet("/api/v1/payments/vnpay/return", async (HttpContext context, IPaymentService service, CancellationToken ct) =>
{
    var queryParams = context.Request.Query
        .ToDictionary(kv => kv.Key, kv => kv.Value.ToString());
    var result = await service.HandleVnPayReturnAsync(queryParams, ct);
    return Results.Ok(result);
});


// 6. Kích hoạt định tuyến cho PaymentsController (API S2-06 mới)
app.MapControllers();

await app.RunAsync();
public partial class Program;
