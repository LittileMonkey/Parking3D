using System.Text;
using Microsoft.Extensions.Configuration;
using Parking.AI.Domain;
using Parking.AI.Infrastructure;
using Parking.Identity.Infrastructure;
using Parking.Parking.Domain;
using Parking.ServiceDefaults;
using Xunit;

namespace Parking.Microservices.Tests;

public sealed class CoreInvariantTests
{
    [Theory]
    [InlineData(15,7500)][InlineData(16,15000)][InlineData(120,60000)][InlineData(300,120000)]
    public void PriceUsesFullDurationBlocksAndCap(int minutes,long expected)
    {
        var start=new DateTimeOffset(2026,10,8,2,0,0,TimeSpan.Zero);
        Assert.Equal(expected,new BlockPrice(15,7500,120000,1).Estimate(start,start.AddMinutes(minutes),TimeZoneInfo.Utc));
    }
    [Fact]
    public void CapsArePerLocalDay()
    {
        var start=new DateTimeOffset(2026,10,8,16,0,0,TimeSpan.Zero); // 23:00 Vietnam.
        Assert.Equal(60000,new BlockPrice(15,7500,120000,1).Estimate(start,start.AddHours(2),TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh")));
    }
    [Theory]
    [InlineData("PENDING_PAYMENT",false,60000,60000,true,"CONFIRMED")]
    [InlineData("PENDING_PAYMENT",true,60000,60000,true,"LATE_PAYMENT_RECONCILIATION")]
    [InlineData("PENDING_PAYMENT",false,60000,60000,false,"LATE_PAYMENT_RECONCILIATION")]
    [InlineData("PENDING_PAYMENT",false,30000,60000,true,"PARTIAL_PAYMENT")]
    [InlineData("PENDING_PAYMENT",false,70000,60000,true,"OVERPAYMENT_RECONCILIATION")]
    [InlineData("CONFIRMED",false,60000,60000,true,"RECONCILIATION_REQUIRED")]
    public void PaymentDoesNotOverwriteInvalidReservation(string state,bool expired,long paid,long quote,bool available,string expected)
        =>Assert.Equal(expected,PaymentDecision.ForBooking(state,expired,paid,quote,available));
    [Fact]
    public void PasswordIsSaltedAndVerifiedWithoutPlaintext()
    {
        var one=PasswordHash.Create("test-secret-Password1");var two=PasswordHash.Create("test-secret-Password1");
        Assert.NotEqual(one,two);Assert.True(PasswordHash.Verify("test-secret-Password1",one));Assert.False(PasswordHash.Verify("wrong",one));
        Assert.False(PasswordHash.Verify("wrong","malformed"));Assert.DoesNotContain("test-secret-Password1",one);
    }
    [Fact]
    public void ImagesMustMatchSupportedMagicAndSize()
    {
        var png=new byte[]{137,80,78,71,13,10,26,10};Assert.True(ImageRules.IsSupported(png,"image/png"));
        Assert.False(ImageRules.IsSupported(png,"image/jpeg"));Assert.False(ImageRules.IsSupported(Encoding.UTF8.GetBytes("not-a-real-png"),"image/png"));
        Assert.False(ImageRules.IsSupported(new byte[ImageRules.MaxImageBytes+1],"image/png"));
    }
    [Fact]
    public async Task OcrWithoutProviderFailsInsteadOfInventingPlate()
    {
        var provider=new HttpPlateProvider(new HttpClient(),new ConfigurationBuilder().Build());
        var exception=await Assert.ThrowsAsync<ServiceException>(()=>provider.RecognizeAsync([137,80,78,71,13,10,26,10],"image/png",CancellationToken.None));
        Assert.Equal(503,exception.StatusCode);
    }
    [Fact]
    public void NearestDistanceIsGeographic()
    {
        Assert.Equal(0,SearchMath.Haversine(10,106,10,106));
        Assert.InRange(SearchMath.Haversine(0,0,0,1),111000,112000);
    }
}
