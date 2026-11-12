using Google.Protobuf;
using Microsoft.Extensions.Configuration;
using Parking.Contracts.AI.V1;
using Parking.Contracts.Identity.V1;
using Parking.Parking.Application;
using Parking.ServiceDefaults;

namespace Parking.Parking.Infrastructure;

public sealed class FacilityAccess(FacilityAuthorization.FacilityAuthorizationClient client, IConfiguration config) : IFacilityAccess
{
    public async Task RequireAsync(Guid userId, Guid lotId, string capability, CancellationToken ct)
    {
        var result = await client.CheckAccessAsync(new AccessRequest { UserId=userId.ToString(),LotId=lotId.ToString(),Capability=capability },
            headers:GrpcHeaders.For(config),deadline:DateTime.UtcNow.AddSeconds(3),cancellationToken:ct);
        if(!result.Allowed) throw new ServiceException(403,"Current account/lot permission denied");
    }
}

public sealed class RecognitionClient(PlateRecognition.PlateRecognitionClient client, IConfiguration config) : IRecognitionClient
{
    public async Task<RecognitionView> RecognizeAsync(Guid userId, Guid lotId, string key, RecognitionUpload upload, CancellationToken ct)
    {
        if(string.IsNullOrWhiteSpace(key)||key.Length>128 || upload.ImageBase64 is null || upload.ImageBase64.Length>6*1024*1024)
            throw new ServiceException(400,"Valid Idempotency-Key and bounded image required");
        byte[] bytes;
        try{bytes=Convert.FromBase64String(upload.ImageBase64);}catch(FormatException){throw new ServiceException(400,"Invalid base64 image");}
        var result=await client.RecognizeAsync(new RecognitionRequest { LotId=lotId.ToString(),UploadedBy=userId.ToString(),
            IdempotencyKey=key,Image=ByteString.CopyFrom(bytes),ContentType=upload.ContentType },headers:GrpcHeaders.For(config),
            deadline:DateTime.UtcNow.AddSeconds(12),cancellationToken:ct);
        return new RecognitionView(Guid.Parse(result.RecognitionId),result.Status,string.IsNullOrEmpty(result.CandidatePlate)?null:result.CandidatePlate,
            result.HasConfidence?result.Confidence:null,result.ModelVersion);
    }
}
