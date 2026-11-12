using Npgsql;
using Parking.Contracts.Catalog.V1;
using Parking.Contracts.Identity.V1;
using Parking.Contracts.Payments.V1;
using Parking.Contracts.Checkout.V1;
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

// THÊM: Đăng ký ParkingCatalogClient để gọi sang Parking lấy biểu giá
builder.Services.AddGrpcClient<ParkingCatalog.ParkingCatalogClient>(o=>o.Address=new Uri(builder.Configuration["Services:ParkingGrpc"]??"http://parking:8081"));
// THÊM: Bật bộ nhớ đệm MemoryCache trong Payment để đệm biểu giá 30 phút
builder.Services.AddMemoryCache();


// 2. Đăng ký các dịch vụ gốc của Payment (Database & Outbox Worker ngầm)
builder.Services.AddScoped<IPaymentService,PaymentService>();
builder.Services.AddGrpcClient<ParkingCheckoutQuery.ParkingCheckoutQueryClient>(o=>o.Address=new Uri(builder.Configuration["Services:ParkingGrpc"]??"http://parking:8081"));
builder.Services.AddGrpcClient<ParkingCheckoutEvents.ParkingCheckoutEventsClient>(o=>o.Address=new Uri(builder.Configuration["Services:ParkingGrpc"]??"http://parking:8081"));
builder.Services.AddScoped<CheckoutPaymentService>();
builder.Services.AddHostedService<OutboxWorker>();
builder.Services.AddScoped<RefundService>();
builder.Services.AddHttpClient("refund-provider",client=>client.Timeout=TimeSpan.FromSeconds(20));
builder.Services.AddHostedService<RefundWorker>();

// 3. Đăng ký các tầng kiến trúc Clean Architecture theo mẫu Mentor:
builder.Services.AddApplicationServices();                      // Nạp MediatR + FluentValidation + ValidationBehavior
builder.Services.AddInfrastructureServices(builder.Configuration); // Nạp PaymentRepository
builder.Services.AddTransient<ExceptionHandlingMiddleware>();   // Đăng ký bộ gác cổng bắt lỗi
builder.Services.AddControllers();                              // Nạp Controller



builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseParkingDefaults("payment");
Parking.Payment.Api.ReportingEndpoints.MapPaymentReports(app);
Parking.Payment.Api.RefundEndpoints.MapRefunds(app);
if(app.Environment.IsDevelopment()){app.UseSwagger();app.UseSwaggerUI();}


// 4. Kích hoạt Middleware bắt lỗi ở cổng ngoài cùng
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.MapGrpcService<CheckoutSettlementGrpc>();
app.MapPost("/api/v1/payments/checkout/vnpay",async(CheckoutVnPayRequest request,HttpContext context,CheckoutPaymentService service,CancellationToken ct)=>
    Responses.Ok(await service.PrepareVnPayAsync(context.User.Subject(),request.QuoteToken,
        context.Connection.RemoteIpAddress?.ToString()??"127.0.0.1",ct))).RequireAuthorization();


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

app.MapGet("/api/v1/payments/{bookingId:guid}/cash-request", async (
    Guid bookingId, Guid lotId, HttpContext context, NpgsqlDataSource db,
    FacilityAuthorization.FacilityAuthorizationClient identity, IConfiguration config, CancellationToken ct) =>
{
    var permission = await identity.CheckAccessAsync(new AccessRequest
    {
        UserId = context.User.Subject().ToString(), LotId = lotId.ToString(), Capability = "CASH"
    }, headers: GrpcHeaders.For(config), deadline: DateTime.UtcNow.AddSeconds(3), cancellationToken: ct);
    if (!permission.Allowed) return Responses.Error(403, "Assigned active Staff required.");
    await using var command = db.CreateCommand("""
        SELECT p.id, p.amount, a.currency, p.status::text, p.version
        FROM payments p JOIN billing_accounts a ON a.id = p.account_id
        WHERE a.booking_id = @booking AND a.lot_id = @lot AND p.method = 'CASH'
        ORDER BY (p.status = 'SUCCESS') DESC, p.created_at DESC LIMIT 1
        """);
    command.Parameters.AddWithValue("booking", bookingId);
    command.Parameters.AddWithValue("lot", lotId);
    await using var reader = await command.ExecuteReaderAsync(ct);
    if (!await reader.ReadAsync(ct)) return Responses.Error(404, "Booking has no cash payment request.");
    return Responses.Ok(new PaymentView(reader.GetGuid(0), lotId, bookingId,
        reader.GetInt64(1), reader.GetString(2), "CASH", reader.GetString(3), reader.GetInt32(4)));
}).RequireAuthorization();

app.MapPost("/api/v1/parking-lots/{lotId:guid}/payments/{paymentId:guid}/cash-confirmation", async (Guid lotId, Guid paymentId, CashConfirmationRequest request, HttpContext context, IPaymentService service, CancellationToken ct)
    => Responses.Ok(await service.ConfirmCashAsync(context.User.Subject(), lotId, paymentId, request, ct))).RequireAuthorization();


// Endpoint IPN VNPay (Không cần RequireAuthorization — VNPay không mang JWT)
app.MapGet("/api/v1/payments/vnpay/ipn", async (HttpContext context, IPaymentService service, CheckoutPaymentService checkout, CancellationToken ct) =>
{
    var queryParams = context.Request.Query
        .ToDictionary(kv => kv.Key, kv => kv.Value.ToString());
    var result = queryParams.TryGetValue("vnp_TxnRef",out var reference)&&reference.StartsWith("CO",StringComparison.Ordinal)
        ? await checkout.HandleIpnAsync(queryParams,ct) : await service.HandleVnPayIpnAsync(queryParams, ct);
    return Results.Ok(result);
});

// Endpoint ReturnUrl VNPay — trình duyệt khách hàng bị redirect về đây sau khi thanh toán
// Frontend sẽ đọc IsSuccess để hiển thị trang "Thanh toán thành công" hay "Thất bại"
app.MapGet("/api/v1/payments/vnpay/return", async (HttpContext context, IPaymentService service, CancellationToken ct) =>
{
    if(context.Request.Headers.Accept.ToString().Contains("text/html",StringComparison.OrdinalIgnoreCase))
    {
        var frontend=app.Configuration["Frontend:BaseUrl"]??"http://localhost:3000";
        return Results.Redirect(frontend.TrimEnd('/')+"/payment-return"+context.Request.QueryString);
    }
    var queryParams = context.Request.Query
        .ToDictionary(kv => kv.Key, kv => kv.Value.ToString());
    var result = await service.HandleVnPayReturnAsync(queryParams, ct);
    return Results.Ok(result);
});


// 6. Kích hoạt định tuyến cho PaymentsController (API S2-06 mới)
app.MapControllers();

await app.RunAsync();
public partial class Program;
