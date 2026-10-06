using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using ParkingSystem.Application.Common.Interfaces;
using ParkingSystem.Application.Features.ParkingAssistant.DTOs;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Infrastructure.ExternalServices.GenAi.Prompts;

namespace ParkingSystem.Infrastructure.ExternalServices.GenAi;

/// <summary>
/// Dịch vụ Trợ lý ảo AI quản lý ngữ cảnh hội thoại và hỗ trợ tra cứu nghiệp vụ bãi đỗ xe
/// </summary>
public partial class ParkingAssistantService(
    GeminiApiClient geminiClient,
    ILogger<ParkingAssistantService> logger) : IParkingAssistantService
{
    // Lưu tạm session & messages trong bộ nhớ (có thể nâng cấp map sang EF Core DbContext)
    private static readonly ConcurrentDictionary<Guid, ParkingAssistantSession> Sessions = new();

    public async Task<AssistantChatResponseDto> ChatAsync(AssistantChatRequestDto request, CancellationToken cancellationToken = default)
    {
        var sessionId = request.SessionId ?? Guid.NewGuid();

        // 1. Lấy hoặc khởi tạo phiên hội thoại
        var session = Sessions.GetOrAdd(sessionId, id => new ParkingAssistantSession
        {
            Id = id,
            UserId = request.UserId,
            CreatedAt = DateTimeOffset.UtcNow,
            LastActivityAt = DateTimeOffset.UtcNow
        });

        session.LastActivityAt = DateTimeOffset.UtcNow;

        // 2. Thêm tin nhắn của User vào ngữ cảnh
        var userMsg = new ParkingAssistantMessage
        {
            SessionId = session.Id,
            Role = "user",
            Content = request.Message,
            CreatedAt = DateTimeOffset.UtcNow
        };
        session.Messages.Add(userMsg);

        // 3. Xây dựng lịch sử ngắn (tối đa 6 tin nhắn gần nhất)
        var recentHistory = session.Messages
            .OrderByDescending(m => m.CreatedAt)
            .Take(6)
            .Reverse()
            .Select(m => $"{(m.Role == "user" ? "Khách hàng" : "Trợ lý")}: {m.Content}");

        var historyText = string.Join("\n", recentHistory);

        var prompt = ParkingAssistantPrompts.BuildPromptWithContext(
            request.Message,
            historyText,
            request.CurrentParkingLotId.HasValue ? $"Mã bãi xe: {request.CurrentParkingLotId.Value}" : null);

        // 4. Gọi AI Engine
        var aiRawResponse = await geminiClient.GenerateTextAsync(
            ParkingAssistantPrompts.SystemKnowledgeBase,
            prompt,
            cancellationToken);

        // 5. Tách nội dung và các câu gợi ý thao tác [SUGGESTION: ...]
        var (cleanReply, suggestions) = ParseReplyAndSuggestions(aiRawResponse);

        // 6. Lưu tin nhắn của Assistant
        var assistantMsg = new ParkingAssistantMessage
        {
            SessionId = session.Id,
            Role = "assistant",
            Content = cleanReply,
            CreatedAt = DateTimeOffset.UtcNow
        };
        session.Messages.Add(assistantMsg);

        logger.LogInformation("AI Assistant đã phản hồi session {SessionId} thành công.", session.Id);

        return new AssistantChatResponseDto
        {
            SessionId = session.Id,
            ReplyMessage = cleanReply,
            SuggestedActions = suggestions,
            CreatedAt = DateTimeOffset.UtcNow
        };
    }

    public Task<bool> ResetSessionAsync(Guid sessionId, CancellationToken cancellationToken = default)
    {
        var removed = Sessions.TryRemove(sessionId, out _);
        return Task.FromResult(removed);
    }

    private static (string cleanReply, List<string> suggestions) ParseReplyAndSuggestions(string raw)
    {
        var suggestions = new List<string>();
        var matches = SuggestionRegex().Matches(raw);

        foreach (Match match in matches)
        {
            if (match.Groups.Count > 1)
            {
                var text = match.Groups[1].Value.Trim();
                if (!string.IsNullOrWhiteSpace(text))
                {
                    suggestions.Add(text);
                }
            }
        }

        var cleaned = SuggestionRegex().Replace(raw, "").Trim();

        if (suggestions.Count == 0)
        {
            suggestions.AddRange(["Xem giá vé gửi xe", "Quy định mất thẻ xe", "Tìm bãi đỗ xe gần nhất"]);
        }

        return (cleaned, suggestions);
    }

    [GeneratedRegex(@"\[SUGGESTION:\s*(.*?)\]")]
    private static partial Regex SuggestionRegex();
}
