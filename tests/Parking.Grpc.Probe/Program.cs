using Grpc.Core;
using Grpc.Net.Client;
using Parking.Contracts.Identity.V1;

using var channel=GrpcChannel.ForAddress(args[0]);
var client=new FacilityAuthorization.FacilityAuthorizationClient(channel);
var request=new AccessRequest{UserId=args[1],LotId=args[2],Capability="OCR"};
try
{
    await client.CheckAccessAsync(request,deadline:DateTime.UtcNow.AddSeconds(5));
    throw new Exception("Unauthenticated gRPC call was accepted");
}
catch(RpcException e)when(e.StatusCode==StatusCode.Unauthenticated){}
var key=Environment.GetEnvironmentVariable("Grpc__ServiceKey")??throw new Exception("Test service key missing");
var result=await client.CheckAccessAsync(request,new Metadata{{"x-service-key",key}},DateTime.UtcNow.AddSeconds(5));
var expected=args[3]=="allow";
if(result.Allowed!=expected)throw new Exception("Facility authorization mismatch");
Console.WriteLine("gRPC authentication and facility scope verified");
