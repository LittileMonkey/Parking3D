using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Parking.Identity.Domain.Entities;
using Parking.Identity.Persistence;
using Parking.Identity.Persistence.Service;
using Parking.Parking.Application;
using Parking.Parking.Persistence;
using Xunit;

namespace Parking.Microservices.Tests;
public sealed partial class ParkingWorkflowTests
{
 [PostgresFact]
 public async Task DailyGraceIsReservedOnceAndUnusedCancellationReleasesIt()
 {
  var start=new DateTimeOffset(DateTime.UtcNow.Date.AddDays(1).AddHours(3),TimeSpan.Zero);
  var first=await repository.CreateBookingAsync(Customer,new BookingRequest(Lot,Slot,Vehicle,start,start.AddHours(1)),"grace-first",Ct);
  var second=await repository.CreateBookingAsync(Customer,new BookingRequest(Lot,Slot,Vehicle,start.AddHours(2),start.AddHours(3)),"grace-second",Ct);
  Assert.Equal(22500,first.EstimatedAmount);Assert.Equal(30000,second.EstimatedAmount);
  Assert.Equal(1L,await Scalar("SELECT count(*) FROM daily_grace_claims"));
  var cancellation=new BookingCancellationRepository(data,TimeProvider.System);
  await cancellation.CancelAsync(first.Id,Customer,new CancelBookingRequest("Test cancelled before arrival"),Ct);
  Assert.Equal(0L,await Scalar("SELECT count(*) FROM daily_grace_claims"));
  var replacement=await repository.CreateBookingAsync(Customer,new BookingRequest(Lot,Slot,Vehicle,start,start.AddHours(1)),"grace-replacement",Ct);
  Assert.Equal(22500,replacement.EstimatedAmount);
  Assert.True(Convert.ToInt64(await Scalar("SELECT count(*) FROM user_notifications"))>=3);
 }
 [PostgresFact]
 public async Task ConcurrentRefreshCanConsumeOriginalTokenOnlyOnce()
 {
  var original=new AuthToken{Id=Guid.NewGuid(),UserId=Customer,TokenHash=Guid.NewGuid().ToString(),FamilyId=Guid.NewGuid(),Purpose="RefreshToken",CreatedAt=DateTime.UtcNow,ExpiresAt=DateTime.UtcNow.AddDays(1)};
  await using(var context=CheckOutIdentityContext())await new AuthTokenRepository(context).AddAsync(original,Ct);
  async Task<bool> Rotate(){await using var context=CheckOutIdentityContext();return await new AuthTokenRepository(context).RotateAsync(original.Id,new AuthToken{Id=Guid.NewGuid(),UserId=Customer,TokenHash=Guid.NewGuid().ToString(),FamilyId=original.FamilyId,Purpose="RefreshToken",CreatedAt=DateTime.UtcNow,ExpiresAt=DateTime.UtcNow.AddDays(1)},Ct);}
  var results=await Task.WhenAll(Enumerable.Range(0,8).Select(_=>Rotate()));Assert.Single(results,x=>x);
  await using var check=CheckOutIdentityContext();Assert.Equal(2,await check.AuthTokens.CountAsync());Assert.NotNull((await check.AuthTokens.SingleAsync(x=>x.Id==original.Id)).ConsumedAt);
 }
 [PostgresFact]
 public async Task MfaSetupEncryptsSecretAndThreeInvalidCodesLockVerification()
 {
  await using var identity=NpgsqlDataSource.Create(identityConnection);
  var config=new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{["Mfa:EncryptionKey"]=new string('a',64)}).Build();
  var service=new MfaService(identity,config);await service.SetupAsync(Customer,"qa@example.test",Ct);
  Assert.False(await service.EnabledAsync(Customer,Ct));
  for(var i=0;i<3;i++)await Assert.ThrowsAsync<global::Parking.Identity.Application.Common.AppException.AppException>(()=>service.VerifyAsync(Customer,"xxxxxx","ENABLE",Ct));
  await using var query=identity.CreateCommand("SELECT octet_length(secret_cipher)>20 AND failures=3 AND locked_until>now() FROM user_mfa");Assert.Equal(true,await query.ExecuteScalarAsync());
 }
}

