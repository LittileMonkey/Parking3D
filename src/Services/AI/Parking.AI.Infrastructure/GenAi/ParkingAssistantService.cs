using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Parking.AI.Application.DTOs.Assistant;
using Parking.AI.Application.Interfaces;
using Parking.AI.Domain.Entities;
using Parking.AI.Infrastructure.GenAi.Prompts;

namespace Parking.AI.Infrastructure.GenAi;

/// <summary>
/// Dịch vụ Trợ lý ảo AI đàm thoại đa lượt (Multi-turn Conversational AI Assistant) cho bãi đỗ xe ParkMatrix.
/// <para>
/// <b>Cơ chế kỹ thuật & Thư viện chủ chốt:</b>
/// <list type="bullet">
///   <item><description><see cref="ConcurrentDictionary{TKey, TValue}"/>: Lưu trữ trạng thái phiên hội thoại trên bộ nhớ RAM đảm bảo an toàn đa luồng (Thread-safe) mà không làm nghẽn toàn bộ tiến trình khi hàng nghìn người dùng truy cập cùng lúc.</description></item>
///   <item><description><b>Sliding Window (Cửa sổ trượt tin nhắn):</b> Giới hạn tối đa 20 tin nhắn trong lịch sử session và chỉ gửi 6 tin nhắn gần nhất tới LLM. Kỹ thuật này giúp khống chế dung lượng RAM cố định $O(1)$ và ngăn hiện tượng tràn Token / phình chi phí API.</description></item>
///   <item><description><b>Double-Checked Locking:</b> Tối ưu hóa chu kỳ dọn dẹp bộ nhớ (Eviction) mỗi 5 phút mà không gây xung đột khóa đa luồng (Lock Contention).</description></item>
///   <item><description><b>Tầng lọc cục bộ 0 đồng (Zero-Cost Guardrails):</b> Kiểm tra nhanh các chủ đề lạc đề (lập trình, làm thơ, bóng đá, thời tiết...) để từ chối ngay lập tức tại C#, tiết kiệm 100% token gọi ra Google Gemini và giảm độ trễ phản hồi về 0ms.</description></item>
///   <item><description><b>Quick Action Chips ([SUGGESTION]):</b> Bóc tách cú pháp thẻ gợi ý để cung cấp các nút bấm tương tác nhanh trên giao diện Frontend.</description></item>
/// </list>
/// </para>
/// </summary>
public partial class ParkingAssistantService(
    GeminiApiClient geminiClient,
    ILogger<ParkingAssistantService> logger) : IParkingAssistantService
{
    /// <summary>
    /// Bảng băm đồng thời lưu trữ các phiên hội thoại trong RAM, khóa theo mã SessionId (<see cref="Guid"/>)
    /// </summary>
    private static readonly ConcurrentDictionary<Guid, ParkingAssistantSession> Sessions = new();

    /// <summary>
    /// Mốc thời gian lần cuối thực hiện quét và giải phóng các session hết hạn
    /// </summary>
    private static DateTimeOffset _lastCleanup = DateTimeOffset.UtcNow;

    /// <summary>
    /// Đối tượng khóa đồng bộ hóa cho tác vụ dọn dẹp bộ nhớ
    /// </summary>
    private static readonly object _cleanupLock = new();

    /// <summary>
    /// Tiếp nhận tin nhắn của khách hàng, duy trì ngữ cảnh hội thoại và sinh câu trả lời thông minh.
    /// </summary>
    /// <param name="request">DTO chứa SessionId, UserId, nội dung tin nhắn và mã bãi xe hiện tại</param>
    /// <param name="cancellationToken">Mã thông báo hủy tác vụ bất đồng bộ</param>
    /// <returns>DTO phản hồi chứa nội dung câu trả lời, danh sách hành động gợi ý và cờ IsFallback</returns>
    public async Task<AssistantChatResponseDto> ChatAsync(AssistantChatRequestDto request, CancellationToken cancellationToken = default)
    {
        // 1. Dọn dẹp session hết hạn định kỳ (DEF-04: Ngăn ngừa rò rỉ bộ nhớ RAM)
        EvictExpiredSessions();

        var sessionId = request.SessionId ?? Guid.NewGuid();

        // GetOrAdd: Khởi tạo phiên mới nếu chưa tồn tại một cách nguyên tử (Atomic operation)
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

        // Đồng bộ hóa đa luồng an toàn cho từng session cụ thể (Granular Lock)
        lock (session)
        {
            session.Messages.Add(userMsg);

            // Cắt giảm danh sách theo cơ chế Cửa sổ trượt (Sliding Window): Chỉ giữ tối đa 20 tin nhắn mới nhất
            if (session.Messages is List<ParkingAssistantMessage> list && list.Count > 20)
            {
                list.RemoveRange(0, list.Count - 20);
            }
        }

        // 🛡️ TẦNG BẢO VỆ 1: LỌC CỤC BỘ KHÔNG TỐN TOKEN (ZERO-COST GUARDRAIL)
        // Nếu câu hỏi hoàn toàn lạc đề hoặc cố ý bẻ khóa prompt (Jailbreak / Out-of-Domain), từ chối ngay lập tức
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

        // 2. Xây dựng lịch sử ngắn an toàn đa luồng (chỉ lấy 6 tin nhắn gần nhất để làm Context cho LLM)
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

        // 3. Gọi Gemini API (theo dõi cờ IsFallback nếu LLM gặp sự cố hoặc offline)
        var (aiRawResponse, isFallback) = await geminiClient.GenerateTextWithStatusAsync(
            ParkingAssistantPrompts.SystemKnowledgeBase,
            prompt,
            cancellationToken);

        // 4. Bóc tách câu trả lời sạch và các nút gợi ý thao tác [SUGGESTION: ...]
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

    /// <summary>
    /// Xóa toàn bộ dữ liệu của một phiên hội thoại khỏi RAM khi người dùng muốn bắt đầu phiên mới hoặc đăng xuất.
    /// </summary>
    /// <param name="sessionId">Mã phiên cần xóa</param>
    /// <param name="cancellationToken">CancellationToken</param>
    /// <returns>True nếu xóa thành công, False nếu phiên không tồn tại</returns>
    public Task<bool> ResetSessionAsync(Guid sessionId, CancellationToken cancellationToken = default)
    {
        var removed = Sessions.TryRemove(sessionId, out _);
        return Task.FromResult(removed);
    }

    /// <summary>
    /// Thu hồi và giải phóng bộ nhớ RAM đối với các session không có hoạt động trong hơn 45 phút.
    /// Áp dụng mẫu thiết kế Double-Checked Locking để kiểm tra nhanh thời gian 5 phút mà không gây Lock Contention.
    /// </summary>
    private static void EvictExpiredSessions()
    {
        var now = DateTimeOffset.UtcNow;
        // Kiểm tra nhanh không cần lock (Fast-path check)
        if (now - _lastCleanup < TimeSpan.FromMinutes(5)) return;

        lock (_cleanupLock)
        {
            // Kiểm tra lại lần 2 bên trong lock (Double check)
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
    /// Kiểm tra nhanh cục bộ các câu hỏi rõ ràng ngoài phạm vi nghiệp vụ bãi xe để chặn trước (tiết kiệm 100% chi phí gọi Gemini).
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

        // 3. Nếu câu hỏi dài trên 20 ký tự nhưng hoàn toàn KHÔNG chứa bất kỳ từ khóa nào liên quan đến bãi xe
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

    /// <summary>
    /// Phân tách câu trả lời của AI thành nội dung hội thoại thuần và danh sách nút gợi ý tương tác nhanh.
    /// </summary>
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

    /// <summary>
    /// Biểu thức chính quy trích xuất các thẻ gợi ý dạng [SUGGESTION: ...]
    /// </summary>
    [GeneratedRegex(@"\[SUGGESTION:\s*(.*?)\]")]
    private static partial Regex SuggestionRegex();
}
