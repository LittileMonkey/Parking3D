using System.Text.RegularExpressions;
using Npgsql;
using Parking.AI.Application;
using Parking.AI.Domain;
using Parking.ServiceDefaults;

namespace Parking.AI.Infrastructure;

public sealed class AIReadService(NpgsqlDataSource db)
{
    public async Task<object> ForecastAsync(Guid lot,string vehicleType,int horizon,CancellationToken ct)
    {
        if(lot==Guid.Empty||string.IsNullOrWhiteSpace(vehicleType)||vehicleType.Length>32||horizon is not (30 or 60 or 120))throw new ServiceException(400,"Valid lot, vehicle type and 30/60/120 minute horizon required");
        var rows=new List<(DateTime Observed,int Capacity,int Occupied)>();
        await using(var query=db.CreateCommand("SELECT observed_at,usable_capacity,occupied_count FROM occupancy_snapshots WHERE lot_id=@lot AND vehicle_type=@type AND data_source='ACTUAL' AND observed_at<=now() ORDER BY observed_at DESC LIMIT 4"))
        {
            query.Parameters.AddWithValue("lot",lot);query.Parameters.AddWithValue("type",vehicleType);await using var r=await query.ExecuteReaderAsync(ct);
            while(await r.ReadAsync(ct))rows.Add((r.GetDateTime(0),r.GetInt32(1),r.GetInt32(2)));
        }
        if(rows.Count<2||DateTime.UtcNow-rows[0].Observed>TimeSpan.FromMinutes(10)||rows[0].Capacity<=0)
            throw new ServiceException(503,"Not enough fresh occupancy observations");
        var capacity=rows[0].Capacity;var prediction=Math.Clamp(Math.Round(rows.Average(r=>(decimal)r.Occupied),3),0,capacity);
        var now=DateTimeOffset.UtcNow;var target=now.AddMinutes(horizon);var id=Guid.NewGuid();
        await using var insert=db.CreateCommand("""
            INSERT INTO occupancy_forecasts(id,lot_id,vehicle_type,generated_at,target_at,data_cutoff_at,usable_capacity,predicted_occupied,model_version,data_source)
            VALUES(@id,@lot,@type,@now,@target,@cutoff,@cap,@prediction,'rolling-mean-v1','ACTUAL')
            """);
        insert.Parameters.AddWithValue("id",id);insert.Parameters.AddWithValue("lot",lot);insert.Parameters.AddWithValue("type",vehicleType);
        insert.Parameters.AddWithValue("now",now.UtcDateTime);insert.Parameters.AddWithValue("target",target.UtcDateTime);insert.Parameters.AddWithValue("cutoff",rows[0].Observed);
        insert.Parameters.AddWithValue("cap",capacity);insert.Parameters.AddWithValue("prediction",prediction);await insert.ExecuteNonQueryAsync(ct);
        return new{id,lotId=lot,vehicleType,generatedAt=now,targetAt=target,dataCutoffAt=rows[0].Observed,usableCapacity=capacity,predictedOccupied=prediction,
            modelVersion="rolling-mean-v1",dataSource="ACTUAL",isAdvisory=true,evaluationStatus="NOT_EVALUATED"};
    }

    public async Task<object> AssistantAsync(Guid lot,string question,CancellationToken ct)
    {
        if(lot==Guid.Empty||string.IsNullOrWhiteSpace(question)||question.Length>1000)throw new ServiceException(400,"Question required, maximum 1000 characters");
        var terms=Regex.Matches(question.ToLowerInvariant(),@"[\p{L}\p{N}]{2,}").Select(m=>m.Value).Distinct().Take(10).ToArray();
        if(terms.Length==0)return new{mode="RETRIEVAL_NO_LLM",answers=Array.Empty<object>(),message="Hãy hỏi về quy trình gửi xe, thanh toán hoặc xe ra."};
        var conditions=string.Join(" OR ",terms.Select((_,i)=>$"lower(c.content) LIKE @q{i}"));
        await using var query=db.CreateCommand($"""
            SELECT d.id,d.revision,d.title,c.section_title,c.content,d.source_reference FROM assistant_documents d
              JOIN assistant_document_chunks c ON c.document_id=d.id
            WHERE d.status='PUBLISHED' AND d.visibility='PUBLIC' AND d.language='vi' AND d.approved_by IS NOT NULL
              AND d.published_at IS NOT NULL AND d.effective_from<=now() AND (d.effective_until IS NULL OR now()<d.effective_until)
              AND (d.lot_id=@lot OR d.lot_id IS NULL) AND ({conditions})
            ORDER BY (d.lot_id IS NOT NULL) DESC,d.revision DESC,c.chunk_index LIMIT 3
            """);
        query.Parameters.AddWithValue("lot",lot);for(var i=0;i<terms.Length;i++)query.Parameters.AddWithValue("q"+i,"%"+terms[i]+"%");
        var answers=new List<object>();await using var r=await query.ExecuteReaderAsync(ct);
        while(await r.ReadAsync(ct))answers.Add(new{documentId=r.GetGuid(0),revision=r.GetInt32(1),title=r.GetString(2),section=r.GetString(3),content=r.GetString(4),source=r.GetString(5)});
        return new{mode="RETRIEVAL_NO_LLM",answers,message=answers.Count==0?"Chưa có hướng dẫn đã duyệt phù hợp. Vui lòng hỏi nhân viên bãi.":"Nội dung từ hướng dẫn công khai đã duyệt; không thực hiện giao dịch."};
    }

    public async Task<Guid> CreateDocumentAsync(Guid actor,DocumentRequest request,CancellationToken ct)
    {
        if(request.Revision<1||string.IsNullOrWhiteSpace(request.DocumentKey)||request.DocumentKey.Length>128
            ||string.IsNullOrWhiteSpace(request.Title)||request.Title.Length>300||string.IsNullOrWhiteSpace(request.SourceReference)
            ||string.IsNullOrWhiteSpace(request.Content)||request.Content.Length>16000||request.EffectiveUntil<=request.EffectiveFrom)
            throw new ServiceException(400,"Invalid document revision/content/effective period");
        var id=Guid.NewGuid();await using var conn=await db.OpenConnectionAsync(ct);await using var tx=await conn.BeginTransactionAsync(ct);
        await using var command=new NpgsqlCommand("""
            INSERT INTO assistant_documents(id,lot_id,document_key,revision,title,status,source_reference,effective_from,effective_until)
            VALUES(@id,@lot,@key,@revision,@title,'DRAFT',@source,@from,@until);
            INSERT INTO assistant_document_chunks(document_id,chunk_index,section_title,content) VALUES(@id,0,@title,@content);
            INSERT INTO audit_logs(id,lot_id,actor_user_id,actor_type,action,entity_type,entity_id,created_at)
            VALUES(gen_random_uuid(),@lot,@actor,'USER','CREATE_ASSISTANT_DOCUMENT','DOCUMENT',@entity,now());
            """,conn,tx);
        command.Parameters.AddWithValue("id",id);command.Parameters.AddWithValue("lot",NpgsqlTypes.NpgsqlDbType.Uuid,(object?)request.LotId??DBNull.Value);
        command.Parameters.AddWithValue("key",request.DocumentKey.Trim());command.Parameters.AddWithValue("revision",request.Revision);command.Parameters.AddWithValue("title",request.Title.Trim());
        command.Parameters.AddWithValue("source",request.SourceReference.Trim());command.Parameters.AddWithValue("from",request.EffectiveFrom.UtcDateTime);
        command.Parameters.AddWithValue("until",NpgsqlTypes.NpgsqlDbType.TimestampTz,(object?)request.EffectiveUntil?.UtcDateTime??DBNull.Value);
        command.Parameters.AddWithValue("content",request.Content);command.Parameters.AddWithValue("actor",actor);command.Parameters.AddWithValue("entity",id.ToString());
        await command.ExecuteNonQueryAsync(ct);await tx.CommitAsync(ct);return id;
    }

    public async Task PublishAsync(Guid actor,Guid document,int version,CancellationToken ct)
    {
        await using var conn=await db.OpenConnectionAsync(ct);await using var tx=await conn.BeginTransactionAsync(ct);
        await using var command=new NpgsqlCommand("UPDATE assistant_documents SET status='PUBLISHED',approved_by=@actor,published_at=now(),version=version+1,updated_at=now() WHERE id=@id AND status='DRAFT' AND version=@version",conn,tx);
        command.Parameters.AddWithValue("actor",actor);command.Parameters.AddWithValue("id",document);command.Parameters.AddWithValue("version",version);
        if(await command.ExecuteNonQueryAsync(ct)!=1)throw new ServiceException(409,"Document state/version conflict");
        await using var audit=new NpgsqlCommand("INSERT INTO audit_logs(id,actor_user_id,actor_type,action,entity_type,entity_id,created_at) VALUES(gen_random_uuid(),@actor,'USER','PUBLISH_ASSISTANT_DOCUMENT','DOCUMENT',@entity,now())",conn,tx);
        audit.Parameters.AddWithValue("actor",actor);audit.Parameters.AddWithValue("entity",document.ToString());await audit.ExecuteNonQueryAsync(ct);await tx.CommitAsync(ct);
    }

    public async Task ReviewAsync(Guid actor,Guid lot,Guid recognition,PlateReviewRequest request,CancellationToken ct)
    {
        if(!ImageRules.IsNormalizedPlate(request.Plate)||request.Version<1||string.IsNullOrWhiteSpace(request.Reason)||request.Reason.Length>500)throw new ServiceException(400,"Normalized plate, version and reason required");
        await using var conn=await db.OpenConnectionAsync(ct);await using var tx=await conn.BeginTransactionAsync(ct);
        await using var command=new NpgsqlCommand("""
            UPDATE ai_plate_recognitions SET status='REVIEWED',reviewed_plate=@plate,reviewed_by=@actor,reviewed_at=now(),updated_at=now(),version=version+1
            WHERE id=@id AND lot_id=@lot AND status='PENDING_REVIEW' AND version=@version AND expires_at>now()
            """,conn,tx);
        command.Parameters.AddWithValue("plate",request.Plate);command.Parameters.AddWithValue("actor",actor);command.Parameters.AddWithValue("id",recognition);command.Parameters.AddWithValue("lot",lot);command.Parameters.AddWithValue("version",request.Version);
        if(await command.ExecuteNonQueryAsync(ct)!=1)throw new ServiceException(409,"Recognition state/version/expiry conflict");
        await using var audit=new NpgsqlCommand("INSERT INTO audit_logs(id,lot_id,actor_user_id,actor_type,action,entity_type,entity_id,reason,created_at) VALUES(gen_random_uuid(),@lot,@actor,'USER','REVIEW_PLATE','PLATE_RECOGNITION',@entity,@reason,now())",conn,tx);
        audit.Parameters.AddWithValue("lot",lot);audit.Parameters.AddWithValue("actor",actor);audit.Parameters.AddWithValue("entity",recognition.ToString());audit.Parameters.AddWithValue("reason",request.Reason);
        await audit.ExecuteNonQueryAsync(ct);await tx.CommitAsync(ct);
    }
}
