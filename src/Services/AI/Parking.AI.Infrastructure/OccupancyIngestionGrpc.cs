using Grpc.Core;
using Npgsql;
using Parking.Contracts.AI.V1;

namespace Parking.AI.Infrastructure;

/// <summary>
/// Dịch vụ gRPC tiếp nhận dữ liệu quan sát công suất bãi đỗ (Snapshot Ingestion) từ Background Worker của Parking Service.
/// Thư viện: <see cref="OccupancyIngestion.OccupancyIngestionBase"/> sinh tự động từ file hợp đồng ai.proto.
/// </summary>
/// <param name="db">Instance <see cref="NpgsqlDataSource"/> kết nối CSDL PostgreSQL của AI Service.</param>
public sealed class OccupancyIngestionGrpc(NpgsqlDataSource db) : OccupancyIngestion.OccupancyIngestionBase
{
    /// <summary>
    /// Ghi nhận 1 bản ghi snapshot trạng thái bãi xe tại một thời điểm xác định (ObservedAt).
    /// </summary>
    /// <param name="request">Request gRPC chứa lotId, vehicleType, usableCapacity, occupiedCount, reservedCount, observedAtUnixSeconds.</param>
    /// <param name="context">Ngữ cảnh gRPC ServerCallContext.</param>
    /// <returns>Đối tượng <see cref="SnapshotReply"/> chứa ID bản ghi vừa được lưu trữ.</returns>
    /// <exception cref="RpcException">Ném InvalidArgument nếu dữ liệu snapshot vi phạm ràng buộc vật lý (tổng xe > sức chứa, thời gian trong tương lai).</exception>
    public override async Task<SnapshotReply> RecordSnapshot(OccupancySnapshotRequest request, ServerCallContext context)
    {
        // 1. Kiểm tra tính hợp lệ của dữ liệu đầu vào theo các ràng buộc bất biến (Invariants)
        if (!Guid.TryParse(request.LotId, out var lot) || lot == Guid.Empty 
            || string.IsNullOrWhiteSpace(request.VehicleType) || request.VehicleType.Length > 32 
            || request.UsableCapacity < 0 || request.OccupiedCount < 0 || request.ReservedCount < 0
            || request.OccupiedCount + request.ReservedCount > request.UsableCapacity)
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid capacity snapshot: tổng số xe chiếm dụng và đặt chỗ không được vượt quá sức chứa."));
        }

        // 2. Chuyển đổi Unix timestamp (giây) sang kiểu UTC DateTime chuẩn của .NET
        DateTime observed;
        try 
        { 
            observed = DateTimeOffset.FromUnixTimeSeconds(request.ObservedAtUnixSeconds).UtcDateTime; 
        }
        catch (ArgumentOutOfRangeException)
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid timestamp: giá trị Unix timestamp không hợp lệ."));
        }

        // Không chấp nhận bản ghi quan sát có thời điểm trong tương lai
        if (observed > DateTime.UtcNow) 
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Future snapshot: thời điểm quan sát không thể nằm trong tương lai."));
        }

        var id = Guid.NewGuid();

        // 3. Thực thi câu lệnh SQL INSERT vào bảng occupancy_snapshots
        // Sử dụng ON CONFLICT ... DO UPDATE RETURNING id để hỗ trợ Upsert an toàn không sợ trùng khóa
        await using var command = db.CreateCommand("""
            INSERT INTO occupancy_snapshots(id, lot_id, vehicle_type, observed_at, usable_capacity, occupied_count, reserved_count, data_source)
            VALUES(@id, @lot, @type, @observed, @cap, @occupied, @reserved, 'ACTUAL')
            ON CONFLICT(lot_id, vehicle_type, observed_at, data_source) 
            DO UPDATE SET observed_at = EXCLUDED.observed_at 
            RETURNING id
            """);
        command.Parameters.AddWithValue("id", id);
        command.Parameters.AddWithValue("lot", lot);
        command.Parameters.AddWithValue("type", request.VehicleType);
        command.Parameters.AddWithValue("observed", observed);
        command.Parameters.AddWithValue("cap", request.UsableCapacity);
        command.Parameters.AddWithValue("occupied", request.OccupiedCount);
        command.Parameters.AddWithValue("reserved", request.ReservedCount);

        // ExecuteScalarAsync trả về giá trị của cột đầu tiên trong dòng đầu tiên (chính là RETURNING id)
        var resultId = (Guid)(await command.ExecuteScalarAsync(context.CancellationToken))!;
        return new SnapshotReply { SnapshotId = resultId.ToString() };
    }
}

