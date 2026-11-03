using Grpc.Core;
using Microsoft.Extensions.Configuration;
using Parking.Contracts.Identity.V1;
using Parking.Parking.Infrastructure;
using Parking.ServiceDefaults;
using Xunit;

namespace Parking.Microservices.Tests;

public sealed class FacilityAccessTests
{
    [Fact]
    public async Task IdentityAllowsAccess_RequestContinues()
    {
        var access = CreateAccess(new StubAuthorizationClient(new AccessReply { Allowed = true }));

        await access.RequireAsync(Guid.NewGuid(), Guid.NewGuid(), "GATE", CancellationToken.None);
    }

    [Fact]
    public async Task IdentityDeniesAccess_ReturnsForbidden()
    {
        var access = CreateAccess(new StubAuthorizationClient(new AccessReply { Allowed = false }));

        var error = await Assert.ThrowsAsync<ServiceException>(() =>
            access.RequireAsync(Guid.NewGuid(), Guid.NewGuid(), "GATE", CancellationToken.None));

        Assert.Equal(403, error.StatusCode);
    }

    [Theory]
    [InlineData(StatusCode.Unavailable, false)]
    [InlineData(StatusCode.DeadlineExceeded, false)]
    [InlineData(StatusCode.Unavailable, true)]
    [InlineData(StatusCode.DeadlineExceeded, true)]
    public async Task IdentityCannotVerifyAccess_ReturnsServiceUnavailable(
        StatusCode statusCode, bool emptyUserId)
    {
        var access = CreateAccess(new StubAuthorizationClient(
            new RpcException(new Status(statusCode, "Test authorization transport failure"))));
        var userId = emptyUserId ? Guid.Empty : Guid.NewGuid();

        var error = await Assert.ThrowsAsync<ServiceException>(() =>
            access.RequireAsync(userId, Guid.NewGuid(), "GATE", CancellationToken.None));

        Assert.Equal(503, error.StatusCode);
    }

    private static FacilityAccess CreateAccess(StubAuthorizationClient client)
        => new(client, new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string?> { ["Grpc:ServiceKey"] = "test-service-key" }).Build());

    private sealed class StubAuthorizationClient : FacilityAuthorization.FacilityAuthorizationClient
    {
        private readonly Task<AccessReply> response;

        public StubAuthorizationClient(AccessReply reply) => response = Task.FromResult(reply);
        public StubAuthorizationClient(RpcException error) => response = Task.FromException<AccessReply>(error);

        public override AsyncUnaryCall<AccessReply> CheckAccessAsync(AccessRequest request, CallOptions options)
            => new(response, Task.FromResult(new Metadata()),
                () => Status.DefaultSuccess, () => new Metadata(), () => { });
    }
}
