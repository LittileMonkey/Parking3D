using System.Security.Cryptography;
using System.Text;
using Grpc.Core;
using Grpc.Core.Interceptors;
using Microsoft.Extensions.Configuration;

namespace Parking.ServiceDefaults;

public sealed class ServiceKeyInterceptor(IConfiguration config) : Interceptor
{
    public override async Task<TResponse> UnaryServerHandler<TRequest, TResponse>(
        TRequest request, ServerCallContext context, UnaryServerMethod<TRequest, TResponse> continuation)
    {
        var actual = context.RequestHeaders.GetValue("x-service-key") ?? "";
        var expected = config["Grpc:ServiceKey"] ?? "";
        if (expected.Length < 32 || !CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(actual), Encoding.UTF8.GetBytes(expected)))
            throw new RpcException(new Status(StatusCode.Unauthenticated, "Service authentication required"));
        return await continuation(request, context);
    }
}

public static class GrpcHeaders
{
    public static Metadata For(IConfiguration configuration) =>
        new() { { "x-service-key", configuration["Grpc:ServiceKey"] ?? "" } };
}
