using Grpc.Core;
using Parking.Contracts.Catalog.V1;
using Parking.Parking.Application;
using Parking.Parking.Application.Interfaces; 
using System;
using System.Text.Json;                       
using System.Threading.Tasks;

namespace Parking.Parking.Infrastructure;

public sealed class ParkingCatalogGrpc(IParkingRepository repository, IParkingLotRepository lotRepository) : ParkingCatalog.ParkingCatalogBase{

    
    public override async Task<LotReply> LotExists(LotRequest request, ServerCallContext context)
        {
            if (!Guid.TryParse(request.LotId, out var id))
                throw new RpcException(new Status(StatusCode.InvalidArgument, "UUID required"));
            return new LotReply { Exists = await repository.LotExistsAsync(id, context.CancellationToken) };
        }


    /// <summary>
    /// gRPC Endpoint: Cung cấp cấu hình biểu giá hiệu lực từ CSDL Parking cho phân hệ Payment.
    /// Tái sử dụng IParkingLotRepository mà không cần viết lại câu lệnh SQL.
    /// </summary>
    public override async Task<PricingPolicyReply> GetPricingPolicy(PricingPolicyRequest request, ServerCallContext context)
    {
        // 1. Kiểm tra tính hợp lệ của tham số đầu vào
        if (!Guid.TryParse(request.LotId, out var lotId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Valid UUID required for lot_id"));

        if (string.IsNullOrWhiteSpace(request.VehicleType))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "vehicle_type is required"));


        // 2. Chuyển đổi mốc thời gian Unix timestamp sang DateTime UTC
        var startTime = request.TimestampUnixSeconds > 0
            ? DateTimeOffset.FromUnixTimeSeconds(request.TimestampUnixSeconds).UtcDateTime
            : DateTime.UtcNow;

        // 3. Gọi Repository đọc từ bảng pricing_plans & pricing_rules của Parking DB
        var ruleConfig = await lotRepository.GetPricingRuleConfigAsync(
            lotId, 
            request.VehicleType, 
            startTime, 
            context.CancellationToken);

        // 4. Nếu không tìm thấy biểu giá hiệu lực -> Trả về Found = false
        if (ruleConfig == null)
        {
            return new PricingPolicyReply { Found = false };
        }

        // 5. Bóc tách JSON tham số biểu giá (parameters) an toàn và linh hoạt
        using var doc = JsonDocument.Parse(ruleConfig.Value.ParametersJson);
        var root = doc.RootElement;
        int subsequentMinutes = root.TryGetProperty("blockMinutes", out var bm) ? bm.GetInt32() : 15;
        long subsequentRate = root.TryGetProperty("rateVnd", out var rv) ? rv.GetInt64() : 5000;
        long dailyCap = root.TryGetProperty("dailyCapVnd", out var dc) ? dc.GetInt64() : 150000;
        double multiplier = root.TryGetProperty("multiplier", out var m) ? m.GetDouble() : 1.2;
        if (multiplier < 1.0) 
            multiplier = 1.2;
        // Block đầu tiên (60 phút) tính tương đương 4 block 15p nếu DB không có cấu hình block đầu riêng
        int initialMinutes = root.TryGetProperty("initialBlockMinutes", out var ibm) ? ibm.GetInt32() : 60;
        long initialRate = root.TryGetProperty("initialRateVnd", out var irv)
            ? irv.GetInt64()
            : (subsequentRate * (initialMinutes / Math.Max(subsequentMinutes, 1)));
        string peak1Start = root.TryGetProperty("peak1Start", out var p1s) ? p1s.GetString() ?? "11:30" : "11:30";
        string peak1End = root.TryGetProperty("peak1End", out var p1e) ? p1e.GetString() ?? "13:00" : "13:00";
        string peak2Start = root.TryGetProperty("peak2Start", out var p2s) ? p2s.GetString() ?? "17:30" : "17:30";
        string peak2End = root.TryGetProperty("peak2End", out var p2e) ? p2e.GetString() ?? "19:00" : "19:00";
        double goldStarDiscount = root.TryGetProperty("goldStarDiscountRate", out var gs) ? gs.GetDouble() : 0.10;

        // 6. Đóng gói kết quả trả lời gRPC
        return new PricingPolicyReply
        {
            Found = true,
            InitialBlockMinutes = initialMinutes,
            InitialRateVnd = initialRate,
            SubsequentBlockMinutes = subsequentMinutes,
            SubsequentRateVnd = subsequentRate,
            PeakMultiplier = multiplier,
            Peak1Start = peak1Start,
            Peak1End = peak1End,
            Peak2Start = peak2Start,
            Peak2End = peak2End,
            DailyCapVnd = dailyCap,
            GoldStarDiscountRate = goldStarDiscount,
            Timezone = ruleConfig.Value.Timezone
        };
    }
}
