using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Parking.AI.Infrastructure.GenAi;
using Parking.AI.Infrastructure.GenAi.Prompts;
using Xunit;

namespace Parking.Microservices.Tests;

public sealed class HoldAssistantTests
{
    [Fact]
    public async Task HoldAssistantExplainsFiveMinutePaymentWindowWithoutCancellingConfirmedBookings()
    {
        using var http = new HttpClient();
        var client = new GeminiApiClient(http, new ConfigurationBuilder().Build(), NullLogger<GeminiApiClient>.Instance);
        var result = await client.GenerateTextWithStatusAsync(ParkingAssistantPrompts.SystemKnowledgeBase, "Thời gian giữ chỗ là bao lâu?");
        Assert.True(result.IsFallback);
        Assert.Contains("5 phút", result.Text);
        Assert.Contains("thanh toán", result.Text);
        Assert.DoesNotContain("15 phút", result.Text);
        Assert.DoesNotContain("chưa qua barrier", result.Text);
        Assert.Contains("5 phút", ParkingAssistantPrompts.SystemKnowledgeBase);
        Assert.DoesNotContain("sau 15 phút xe chưa qua barrier", ParkingAssistantPrompts.SystemKnowledgeBase);
    }
}
