using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Parking.AI.Application.DTOs.Assistant;
using Parking.AI.Application.Interfaces;
using Parking.AI.Domain.Entities;
using Parking.AI.Infrastructure.GenAi.Prompts;

namespace Parking.AI.Infrastructure.GenAi;

/// <summary>
/// Dịch vụ Trợ lý ảo AI quản lý ngữ cảnh hội thoại, tích hợp bộ lọc Guardrails bảo toàn Quota
/// </summary>
public partial class ParkingAssistantService(
    GeminiApiClient geminiClient,
    ILogger<ParkingAssistantService> logger) : IParkingAssistantService
{
    private static readonly ConcurrentDictionary<Guid, ParkingAssistantSession> Sessions = new();
    private static DateTimeOffset _lastCleanup = DateTimeOffset.UtcNow;
    private static readonly object _cleanupLock = new();

    public async Task<AssistantChatResponseDto> ChatAsync(AssistantChatRequestDto request, CancellationToken cancellationToken = default)
    {
        // 1. Dọn dẹp session hết hạn định kỳ (DEF-04: Tránh rò rỉ bộ nhớ RAM)
        EvictExpiredSessions();

        var sessionId = request.SessionId ?? Guid.NewGuid();

        var session = Sessions.GetOrAdd(sessionId, id => new ParkingAssistantSession
        {
            Id = id,
            UserId = request.UserId,
            CreatedAt = DateTimeOffset.UtcNow,
            LastActivityAt = DateTimeOffset.UtcNow
        });

        session.LastActivityAt = DateTimeOffset.UtcNow;

        var userMsg = new ParkingAssistantMessage
        {
            SessionId = session.Id,
            Role = "user",
            Content = request.Message,
            CreatedAt = DateTimeOffset.UtcNow
        };

        // Đồng bộ hóa đa luồng an toàn cho session (DEF-04)
        lock (session)
        {
            session.Messages.Add(userMsg);
            // Giới hạn tối đa 20 tin nhắn mỗi session để kiểm soát bộ nhớ
            if (session.Messages is List<ParkingAssistantMessage> list && list.Count > 20)
            {
                list.RemoveRange(0, list.Count - 20);
            }
        }

        // 🛡️ TẦNG BẢO VỆ 1: LỌC CỤC BỘ KHÔNG TỐN TOKEN (ZERO-COST GUARDRAIL)
        if (IsDefinitelyOutOfDomain(request.Message))
        {
            logger.LogInformation("Phát hiện câu hỏi ngoài phạm vi bãi xe. Từ chối cục bộ để bảo toàn quota: {Query}", request.Message);

            const string rejectionMsg = "Dạ xin lỗi bạn! Tôi là Trợ lý AI chuyên trách của Hệ thống Quản lý Bãi đỗ xe ParkMatrix. Tôi chỉ có thể hỗ trợ các thông tin liên quan đến bãi xe, giá vé, đặt chỗ, quy định gửi xe và an toàn bãi đỗ. Rất mong bạn thông cảm ạ!";
            var defaultSuggestions = new List<string> { "Xem biểu giá gửi xe", "Quy định mất thẻ xe", "Hướng dẫn đặt chỗ trước" };

            var assistantRejection = new ParkingAssistantMessage
            {
                SessionId = session.Id,
                Role = "assistant",
                Content = rejectionMsg,
                CreatedAt = DateTimeOffset.UtcNow
            };

            lock (session)
            {
                session.Messages.Add(assistantRejection);
            }

            return new AssistantChatResponseDto
            {
                SessionId = session.Id,
                ReplyMessage = rejectionMsg,
                SuggestedActions = defaultSuggestions,
                CreatedAt = DateTimeOffset.UtcNow,
                IsFallback = false
            };
        }

        // 2. Xây dựng lịch sử ngắn an toàn đa luồng (tối đa 6 tin nhắn gần nhất)
        string historyText;
        lock (session)
        {
            var recentHistory = session.Messages
                .OrderByDescending(m => m.CreatedAt)
                .Take(6)
                .Reverse()
                .Select(m => $"{(m.Role == "user" ? "Khách hàng" : "Trợ lý")}: {m.Content}");
            historyText = string.Join("\n", recentHistory);
        }

        var prompt = ParkingAssistantPrompts.BuildPromptWithContext(
            request.Message,
            historyText,
            request.CurrentParkingLotId.HasValue ? $"Mã bãi xe: {request.CurrentParkingLotId.Value}" : null);

        // 3. Gọi Gemini API (có theo dõi trạng thái Fallback: DEF-10)
        var (aiRawResponse, isFallback) = await geminiClient.GenerateTextWithStatusAsync(
            ParkingAssistantPrompts.SystemKnowledgeBase,
            prompt,
            cancellationToken);

        var (cleanReply, suggestions) = ParseReplyAndSuggestions(aiRawResponse);

        var assistantMsg = new ParkingAssistantMessage
        {
            SessionId = session.Id,
            Role = "assistant",
            Content = cleanReply,
            CreatedAt = DateTimeOffset.UtcNow
        };

        lock (session)
        {
            session.Messages.Add(assistantMsg);
        }

        logger.LogInformation("AI Assistant đã phản hồi session {SessionId} thành công (Fallback: {IsFallback}).", session.Id, isFallback);

        return new AssistantChatResponseDto
        {
            SessionId = session.Id,
            ReplyMessage = cleanReply,
            SuggestedActions = suggestions,
            CreatedAt = DateTimeOffset.UtcNow,
            IsFallback = isFallback
        };
    }

    public Task<bool> ResetSessionAsync(Guid sessionId, CancellationToken cancellationToken = default)
    {
        var removed = Sessions.TryRemove(sessionId, out _);
        return Task.FromResult(removed);
    }

    private static void EvictExpiredSessions()
    {
        var now = DateTimeOffset.UtcNow;
        if (now - _lastCleanup < TimeSpan.FromMinutes(5)) return;

        lock (_cleanupLock)
        {
            if (now - _lastCleanup < TimeSpan.FromMinutes(5)) return;
            _lastCleanup = now;

            var expiredKeys = Sessions
                .Where(kvp => now - kvp.Value.LastActivityAt > TimeSpan.FromMinutes(45))
                .Select(kvp => kvp.Key)
                .ToList();

            foreach (var key in expiredKeys)
            {
                Sessions.TryRemove(key, out _);
            }
        }
    }

    /// <summary>
    /// Kiểm tra nhanh cục bộ các câu hỏi rõ ràng ngoài phạm vi để chặn trước (tiết kiệm 100% chi phí gọi Gemini)
    /// </summary>
    private static bool IsDefinitelyOutOfDomain(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;

        var lower = text.ToLowerInvariant().Trim();

        // 1. Cho phép các câu chào hỏi / xã giao thông dụng
        var greetings = new[] { "chào", "xin chào", "hello", "hi", "alo", "cảm ơn", "thank", "tạm biệt", "bạn là ai", "bạn tên gì", "giúp gì được" };
        if (greetings.Any(g => lower.Contains(g)) && lower.Length < 30)
        {
            return false;
        }

        // 2. Danh sách từ khóa cấm / lạc đề rõ ràng
        var forbiddenTopics = new[]
        {
            "viết code", "lập trình", "python", "c#", "java", "javascript", "react", "html", "css",
            "làm thơ", "viết văn", "bài thơ", "tình yêu", "người yêu", "tâm sự",
            "thời tiết", "dự báo thời tiết", "mưa không", "nhiệt độ hôm nay",
            "chính trị", "bầu cử", "tổng thống", "chiến tranh", "tin tức",
            "công thức nấu", "món ăn", "cách nấu", "làm bánh",
            "toán học", "giải toán", "phương trình", "đạo hàm",
            "bóng đá", "ca sĩ", "diễn viên", "phim ảnh", "xem phim", "game"
        };

        if (forbiddenTopics.Any(topic => lower.Contains(topic)))
        {
            return true;
        }

        // 3. Nếu câu hỏi dài trên 15 ký tự nhưng hoàn toàn KHÔNG chứa bất kỳ từ khóa nào liên quan đến bãi xe
        var parkingKeywords = new[]
        {
            "xe", "gửi", "đỗ", "bãi", "chỗ", "slot", "tầng", "hầm", "b1", "b2", "b3", "zone",
            "vé", "thẻ", "giá", "phí", "tiền", "thanh toán", "vnpay", "cash", "cọc",
            "mất", "quên", "lấy", "vào", "ra", "cổng", "gate", "barrier", "check-in", "check-out",
            "biển số", "camera", "anpr", "sạc", "ev", "điện", "ô tô", "oto", "xe máy",
            "pccc", "cháy", "khói", "tốc độ", "bảo vệ", "hotline", "đặt chỗ", "booking", "hold", "giữ",
            "bản đồ", "3d", "tìm", "gần", "ở đâu", "hướng dẫn", "quy định", "chính sách"
        };

        if (lower.Length > 20 && !parkingKeywords.Any(k => lower.Contains(k)))
        {
            return true;
        }

        return false;
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
