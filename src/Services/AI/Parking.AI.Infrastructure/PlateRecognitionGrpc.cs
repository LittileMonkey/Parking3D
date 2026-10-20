using System.Security.Cryptography;
using Grpc.Core;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Parking.AI.Application;
using Parking.AI.Domain;
using Parking.Contracts.AI.V1;

namespace Parking.AI.Infrastructure;

/// <summary>
/// Dịch vụ gRPC tiếp nhận yêu cầu nhận diện biển số xe liên dịch vụ (Inter-service gRPC).
/// Thư viện: <see cref="PlateRecognition.PlateRecognitionBase"/> được sinh tự động bởi thư viện Google.Protobuf và Grpc.Tools từ file ai.proto.
/// </summary>
/// <param name="db">Nguồn kết nối CSDL PostgreSQL <see cref="NpgsqlDataSource"/> hiệu năng cao.</param>
/// <param name="provider">Interface nhà cung cấp giải pháp OCR <see cref="IPlateProvider"/> (VD: HttpPlateProvider).</param>
/// <param name="config">Cấu hình hệ thống <see cref="IConfiguration"/> đọc từ environment/appsettings.</param>
public sealed class PlateRecognitionGrpc(NpgsqlDataSource db, IPlateProvider provider, IConfiguration config) : PlateRecognition.PlateRecognitionBase
{
    /// <summary>
    /// Xử lý RPC Recognize: Tiếp nhận ảnh nhị phân từ Parking Service qua gRPC, kiểm tra chống trùng lặp và ghi nhận kết quả OCR.
    /// </summary>
    /// <param name="request">Đối tượng Request gRPC chứa ảnh nhị phân (ByteString), lotId, uploadedBy, idempotencyKey.</param>
    /// <param name="context">Ngữ cảnh cuộc gọi gRPC <see cref="ServerCallContext"/> quản lý Cancellation Token, Deadline, Headers.</param>
    /// <returns>Đối tượng phản hồi gRPC <see cref="RecognitionReply"/> chứa mã bản ghi, biển số nhận diện và độ tin cậy.</returns>
    /// <exception cref="RpcException">Ném lỗi RPC với các StatusCode chuẩn (InvalidArgument, Unavailable, AlreadyExists).</exception>
    public override async Task<RecognitionReply> Recognize(RecognitionRequest request, ServerCallContext context)
    {
        // 1. Kiểm tra tính hợp lệ của tham số đầu vào (UUID, Khóa Idempotent, và Magic Bytes ảnh)
        if (!Guid.TryParse(request.LotId, out var lot) || lot == Guid.Empty 
            || !Guid.TryParse(request.UploadedBy, out var user) || user == Guid.Empty
            || string.IsNullOrWhiteSpace(request.IdempotencyKey) || request.IdempotencyKey.Length > 128
            || !ImageRules.IsSupported(request.Image.Span, request.ContentType))
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Valid IDs, key and PNG/JPEG image required"));
        }

        // 2. Kiểm tra cấu hình OCR endpoint
        if (string.IsNullOrWhiteSpace(config["AI:OcrEndpoint"]))
        {
            throw new RpcException(new Status(StatusCode.Unavailable, "OCR provider not configured"));
        }

        var ct = context.CancellationToken;

        // 3. Tính toán mã băm SHA-256 (32 bytes = 64 ký tự hex) để tạo dấu vết duy nhất (Digest) cho bức ảnh
        // Thư viện: System.Security.Cryptography.SHA256.HashData tối ưu không phân bổ heap
        var digest = Convert.ToHexStringLower(SHA256.HashData(request.Image.Span));
        var id = Guid.NewGuid();

        // 4. Tạo bản ghi ban đầu với trạng thái PROCESSING trong CSDL PostgreSQL
        // Sử dụng cú pháp ON CONFLICT(lot_id, uploaded_by, idempotency_key) DO NOTHING để đảm bảo tính Idempotent
        await using (var insert = db.CreateCommand("""
            INSERT INTO ai_plate_recognitions(id, lot_id, uploaded_by, idempotency_key, image_sha256, status, model_version, expires_at)
            VALUES(@id, @lot, @user, @key, @digest, 'PROCESSING', 'pending-provider', now() + interval '24 hours')
            ON CONFLICT(lot_id, uploaded_by, idempotency_key) DO NOTHING
            """))
        {
            insert.Parameters.AddWithValue("id", id);
            insert.Parameters.AddWithValue("lot", lot);
            insert.Parameters.AddWithValue("user", user);
            insert.Parameters.AddWithValue("key", request.IdempotencyKey);
            insert.Parameters.AddWithValue("digest", digest);

            // Nếu không có dòng nào được chèn (insert == 0) nghĩa là khóa IdempotencyKey đã tồn tại -> Client đang gửi lại (Retry)
            if (await insert.ExecuteNonQueryAsync(ct) == 0)
            {
                await using var query = db.CreateCommand("""
                    SELECT id, status, candidate_plate, confidence, model_version, image_sha256 
                    FROM ai_plate_recognitions 
                    WHERE lot_id = @lot AND uploaded_by = @user AND idempotency_key = @key
                    """);
                query.Parameters.AddWithValue("lot", lot);
                query.Parameters.AddWithValue("user", user);
                query.Parameters.AddWithValue("key", request.IdempotencyKey);

                await using var r = await query.ExecuteReaderAsync(ct);
                await r.ReadAsync(ct);

                // Khóa lặp nhưng hash ảnh khác nhau -> Báo lỗi đã tồn tại khóa cho ảnh khác
                if (r.GetString(5) != digest)
                    throw new RpcException(new Status(StatusCode.AlreadyExists, "Key reused for another image"));

                if (r.GetString(1) is "PROCESSING" or "FAILED")
                    throw new RpcException(new Status(StatusCode.Unavailable, "Recognition pending or failed; inspect record before retrying"));

                var reply = new RecognitionReply
                {
                    RecognitionId = r.GetGuid(0).ToString(),
                    Status = r.GetString(1),
                    CandidatePlate = r.IsDBNull(2) ? "" : r.GetString(2),
                    ModelVersion = r.GetString(4)
                };

                if (!r.IsDBNull(3))
                    reply.Confidence = (double)r.GetDecimal(3);

                return reply;
            }
        }

        // 5. Thực hiện gọi Provider để nhận diện biển số từ ảnh
        try
        {
            var candidate = await provider.RecognizeAsync(request.Image.ToByteArray(), request.ContentType, ct);

            await using var update = db.CreateCommand("""
                UPDATE ai_plate_recognitions 
                SET candidate_plate = @plate, confidence = @confidence, status = @status, 
                    model_version = @model, version = version + 1, updated_at = now() 
                WHERE id = @id
                """);
            update.Parameters.AddWithValue("id", id);
            update.Parameters.AddWithValue("plate", NpgsqlTypes.NpgsqlDbType.Varchar, (object?)candidate.Plate ?? DBNull.Value);
            update.Parameters.AddWithValue("confidence", NpgsqlTypes.NpgsqlDbType.Numeric, (object?)candidate.Confidence ?? DBNull.Value);
            update.Parameters.AddWithValue("status", candidate.Plate is null ? "NO_PLATE" : "PENDING_REVIEW");
            update.Parameters.AddWithValue("model", candidate.ModelVersion);
            await update.ExecuteNonQueryAsync(ct);

            var reply = new RecognitionReply
            {
                RecognitionId = id.ToString(),
                Status = candidate.Plate is null ? "NO_PLATE" : "PENDING_REVIEW",
                CandidatePlate = candidate.Plate ?? "",
                ModelVersion = candidate.ModelVersion
            };
            if (candidate.Confidence.HasValue)
                reply.Confidence = candidate.Confidence.Value;

            return reply;
        }
        catch (Exception e) when (e is not RpcException)
        {
            // 6. Xử lý sự cố: Nếu hủy request hoặc OCR gặp sự cố, tuyệt đối không để bản ghi kẹt ở trạng thái 'PROCESSING' vĩnh viễn
            // Sử dụng CancellationTokenSource độc lập 3 giây để thực hiện dọn dẹp trạng thái
            using var cleanup = new CancellationTokenSource(TimeSpan.FromSeconds(3));
            await using var failure = db.CreateCommand("""
                UPDATE ai_plate_recognitions 
                SET status = 'FAILED', failure_code = 'PROVIDER_UNAVAILABLE', version = version + 1, updated_at = now() 
                WHERE id = @id
                """);
            failure.Parameters.AddWithValue("id", id);
            await failure.ExecuteNonQueryAsync(cleanup.Token);

            throw new RpcException(new Status(StatusCode.Unavailable, "OCR provider failed; use Staff/manual fallback"));
        }
    }
}

