using System.Security.Cryptography;
using Grpc.Core;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Parking.AI.Application;
using Parking.AI.Domain;
using Parking.Contracts.AI.V1;

namespace Parking.AI.Infrastructure;

public sealed class PlateRecognitionGrpc(NpgsqlDataSource db, IPlateProvider provider, IConfiguration config) : PlateRecognition.PlateRecognitionBase
{
    public override async Task<RecognitionReply> Recognize(RecognitionRequest request, ServerCallContext context)
    {
        if (!Guid.TryParse(request.LotId, out var lot) || lot == Guid.Empty || !Guid.TryParse(request.UploadedBy, out var user) || user == Guid.Empty
            || string.IsNullOrWhiteSpace(request.IdempotencyKey) || request.IdempotencyKey.Length > 128
            || !ImageRules.IsSupported(request.Image.Span, request.ContentType))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Valid IDs, key and PNG/JPEG image required"));
        if (string.IsNullOrWhiteSpace(config["AI:OcrEndpoint"]))
            throw new RpcException(new Status(StatusCode.Unavailable, "OCR provider not configured"));
        var ct = context.CancellationToken; var digest = Convert.ToHexStringLower(SHA256.HashData(request.Image.Span));
        var id = Guid.NewGuid();
        await using (var insert = db.CreateCommand("""
            INSERT INTO ai_plate_recognitions(id,lot_id,uploaded_by,idempotency_key,image_sha256,status,model_version,expires_at)
            VALUES(@id,@lot,@user,@key,@digest,'PROCESSING','pending-provider',now()+interval '24 hours')
            ON CONFLICT(lot_id,uploaded_by,idempotency_key) DO NOTHING
            """))
        {
            insert.Parameters.AddWithValue("id",id); insert.Parameters.AddWithValue("lot",lot); insert.Parameters.AddWithValue("user",user);
            insert.Parameters.AddWithValue("key",request.IdempotencyKey); insert.Parameters.AddWithValue("digest",digest);
            if (await insert.ExecuteNonQueryAsync(ct) == 0)
            {
                await using var query = db.CreateCommand("SELECT id,status,candidate_plate,confidence,model_version,image_sha256 FROM ai_plate_recognitions WHERE lot_id=@lot AND uploaded_by=@user AND idempotency_key=@key");
                query.Parameters.AddWithValue("lot",lot); query.Parameters.AddWithValue("user",user); query.Parameters.AddWithValue("key",request.IdempotencyKey);
                await using var r=await query.ExecuteReaderAsync(ct); await r.ReadAsync(ct);
                if (r.GetString(5)!=digest) throw new RpcException(new Status(StatusCode.AlreadyExists,"Key reused for another image"));
                if (r.GetString(1) is "PROCESSING" or "FAILED") throw new RpcException(new Status(StatusCode.Unavailable,"Recognition pending or failed; inspect record before retrying"));
                var reply=new RecognitionReply { RecognitionId=r.GetGuid(0).ToString(), Status=r.GetString(1),CandidatePlate=r.IsDBNull(2)?"":r.GetString(2),ModelVersion=r.GetString(4) };
                if (!r.IsDBNull(3)) reply.Confidence=(double)r.GetDecimal(3); return reply;
            }
        }
        try
        {
            var candidate=await provider.RecognizeAsync(request.Image.ToByteArray(), request.ContentType, ct);
            await using var update=db.CreateCommand("UPDATE ai_plate_recognitions SET candidate_plate=@plate,confidence=@confidence,status=@status,model_version=@model,version=version+1,updated_at=now() WHERE id=@id");
            update.Parameters.AddWithValue("id",id); update.Parameters.AddWithValue("plate",NpgsqlTypes.NpgsqlDbType.Varchar,(object?)candidate.Plate??DBNull.Value);
            update.Parameters.AddWithValue("confidence",NpgsqlTypes.NpgsqlDbType.Numeric,(object?)candidate.Confidence??DBNull.Value);
            update.Parameters.AddWithValue("status",candidate.Plate is null?"NO_PLATE":"PENDING_REVIEW"); update.Parameters.AddWithValue("model",candidate.ModelVersion);
            await update.ExecuteNonQueryAsync(ct);
            var reply=new RecognitionReply { RecognitionId=id.ToString(),Status=candidate.Plate is null?"NO_PLATE":"PENDING_REVIEW",CandidatePlate=candidate.Plate??"",ModelVersion=candidate.ModelVersion };
            if(candidate.Confidence.HasValue) reply.Confidence=candidate.Confidence.Value; return reply;
        }
        catch (Exception e) when (e is not RpcException)
        {
            // Cancellation must not leave an eternal PROCESSING row. Cleanup has its own short deadline.
            using var cleanup=new CancellationTokenSource(TimeSpan.FromSeconds(3));
            await using var failure=db.CreateCommand("UPDATE ai_plate_recognitions SET status='FAILED',failure_code='PROVIDER_UNAVAILABLE',version=version+1,updated_at=now() WHERE id=@id");
            failure.Parameters.AddWithValue("id",id); await failure.ExecuteNonQueryAsync(cleanup.Token);
            throw new RpcException(new Status(StatusCode.Unavailable,"OCR provider failed; use Staff/manual fallback"));
        }
    }
}
