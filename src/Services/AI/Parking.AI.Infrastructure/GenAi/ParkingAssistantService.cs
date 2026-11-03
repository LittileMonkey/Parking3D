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
/// <b>Cơ chế kỹ thuật &amp; Thư viện chủ chốt:</b>
/// <list type="bullet">
///   <item><description><see cref="ConcurrentDictionary{TKey, TValue}"/>: Lưu trữ trạng thái phiên hội thoại trên bộ nhớ RAM đảm bảo an toàn đa luồng (Thread-safe) mà không làm nghẽn toàn bộ tiến trình khi hàng nghìn người dùng truy cập cùng lúc.</description></item>
///   <item><description><b>Sliding Window (Cửa sổ trượt tin nhắn):</b> Giới hạn tối đa 20 tin nhắn trong lịch sử session và chỉ gửi 6 tin nhắn gần nhất tới LLM. Kỹ thuật này giúp khống chế dung lượng RAM cố định $O(1)$ và ngăn hiện tượng tràn Token / phình chi phí API.</description></item>
///   <item><description><b>Double-Checked Locking:</b> Tối ưu hóa chu kỳ dọn dẹp bộ nhớ (Eviction) mỗi 5 phút mà không gây xung đột khóa đa luồng (Lock Contention).</description></item>
///   <item><description><b>Context-Aware Guardrails (Bộ lọc ngữ cảnh thông minh):</b> Nhận diện đầy đủ từ vựng bãi đỗ xe, địa chỉ/đường xá, thời gian, giá cả và tôn trọng mạch hội thoại đa lượt (Multi-turn follow-up), chỉ chặn các yêu cầu hoàn toàn lạc đề (viết code, làm thơ, giải toán...).</description></item>
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

        bool hasPriorContext;
        // Đồng bộ hóa đa luồng an toàn cho từng session cụ thể (Granular Lock)
        lock (session)
        {
            hasPriorContext = session.Messages.Count > 0;
            session.Messages.Add(userMsg);

            // Cắt giảm danh sách theo cơ chế Cửa sổ trượt (Sliding Window): Chỉ giữ tối đa 20 tin nhắn mới nhất
            if (session.Messages is List<ParkingAssistantMessage> list && list.Count > 20)
            {
                list.RemoveRange(0, list.Count - 20);
            }
        }

        // 🛡️ TẦNG BẢO VỆ 1: LỌC CỤC BỘ THÔNG MINH THEO NGỮ CẢNH (CONTEXT-AWARE GUARDRAIL)
        // Chỉ từ chối khi câu hỏi thực sự lạc đề (viết code, làm thơ, giải toán...) và không phải câu hỏi nối tiếp trong phiên hội thoại
        if (IsDefinitelyOutOfDomain(request.Message, hasPriorContext))
        {
            logger.LogInformation("Phát hiện câu hỏi ngoài phạm vi bãi xe. Từ chối cục bộ: {Query}", request.Message);

            const string rejectionMsg = "Dạ xin lỗi bạn! Tôi là Trợ lý AI chuyên trách của Hệ thống Quản lý Bãi đỗ xe ParkMatrix. Tôi chỉ có thể hỗ trợ các thông tin liên quan đến bãi xe, vị trí đường đi, giá vé, đặt chỗ, quy định gửi xe và an toàn bãi đỗ. Rất mong bạn thông cảm ạ!";
            var defaultSuggestions = new List<string> { "Xem biểu giá gửi xe", "Quy định mất thẻ xe", "Tìm bãi đỗ xe gần Landmark 81" };

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
                .Skip(1) // Bỏ qua tin nhắn user hiện tại vì đã nằm ở phần "Khách hàng hỏi:" cuối prompt
                .Take(6)
                .Reverse()
                .Select(m => $"{(m.Role == "user" ? "Khách hàng" : "Trợ lý")}: {m.Content}");
            historyText = string.Join("\n", recentHistory);
        }

        var prompt = ParkingAssistantPrompts.BuildPromptWithContext(
            request.Message,
            historyText,
            request.CurrentParkingLotId.HasValue ? $"Mã bãi xe: {request.CurrentParkingLotId.Value}" : null);

        // 3. Gọi LLM (Local Ollama qwen2.5:3b -> Gemini Cloud -> Rule-based Fallback)
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
    /// Kiểm tra câu hỏi có thực sự nằm ngoài phạm vi nghiệp vụ bãi đỗ xe hay không.
    /// Hỗ trợ đầy đủ từ vựng vị trí, đường xá, thời gian, phí, dịch vụ và các câu hỏi nối tiếp ngữ cảnh (Multi-turn Follow-up).
    /// </summary>
    public static bool IsDefinitelyOutOfDomain(string text, bool hasPriorContext = false)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;

        var lower = text.ToLowerInvariant().Trim();

        // 1. Bộ từ khóa cốt lõi về phương tiện & bãi đỗ: Nếu câu hỏi có chứa các từ này (VD: "Đi xem phim ở Landmark thì gửi xe ở đâu?"), LUÔN CHO PHÉP
        string[] coreParkingTerms =
        [
            "bãi xe", "bãi đỗ", "bãi giữ", "đỗ xe", "đậu xe", "gửi xe", "giữ xe",
            "chỗ đỗ", "chỗ đậu", "ô đỗ", "slot", "vé xe", "thẻ xe", "parkmatrix"
        ];
        if (coreParkingTerms.Any(lower.Contains))
        {
            return false;
        }

        // 2. Danh sách chủ đề hoàn toàn ngoài phạm vi (Viết code, làm thơ, giải toán, nấu ăn, chính trị...)
        string[] strictlyForbiddenTopics =
        [
            "viết code", "lập trình", "code python", "code c#", "code java", "javascript", "react", "html", "css",
            "làm thơ", "sáng tác thơ", "viết văn", "bài thơ", "tình yêu", "người yêu", "tâm sự",
            "dự báo thời tiết", "nhiệt độ hôm nay",
            "chính trị", "bầu cử", "tổng thống", "chiến tranh",
            "công thức nấu", "cách nấu", "làm bánh",
            "giải toán", "phương trình", "đạo hàm", "tích phân",
            "bóng đá", "ca sĩ", "diễn viên"
        ];

        if (strictlyForbiddenTopics.Any(lower.Contains))
        {
            return true;
        }

        // 3. Nếu đang trong một phiên hội thoại đa lượt đã có ngữ cảnh trước đó (VD: khách hỏi tiếp "Nó nằm trên đường nào?", "Còn chỗ không?", "Mấy giờ đóng cửa?"),
        // luôn cho phép đi tiếp vào LLM để nối mạch hội thoại
        if (hasPriorContext)
        {
            return false;
        }

        // 4. Cho phép các câu chào hỏi, xã giao hoặc câu hỏi ngắn
        string[] greetingsAndConversational =
        [
            "chào", "xin chào", "hello", "hi", "alo", "cảm ơn", "thank", "tạm biệt",
            "bạn là ai", "bạn tên gì", "giúp gì", "tư vấn", "hỗ trợ", "cho hỏi", "cho mình hỏi", "cho tôi hỏi"
        ];
        if (greetingsAndConversational.Any(lower.Contains) || lower.Length <= 25)
        {
            return false;
        }

        // 5. Bộ từ vựng mở rộng bao phủ toàn diện nghiệp vụ Bãi đỗ xe, Vị trí/Đường xá, Thời gian, Giá cả, Đặt chỗ & Sự cố
        string[] comprehensiveParkingKeywords =
        [
            // Phương tiện & Hạ tầng bãi xe
            "xe", "ô tô", "oto", "xế", "mô tô", "moto", "tay ga", "ev", "điện",
            "gửi", "đỗ", "đậu", "bãi", "chỗ", "ô trống", "còn trống", "hết chỗ", "đầy", "sức chứa",
            "tầng", "hầm", "b1", "b2", "b3", "zone", "khu", "mái che", "ngoài trời", "trong nhà",
            "cổng", "gate", "barrier", "lối vào", "lối ra", "vào", "ra",

            // Vị trí, Địa chỉ, Đường xá & Điều hướng (Giải quyết triệt để câu hỏi "nằm trên đường nào", "địa chỉ ở đâu"...)
            "vị trí", "địa chỉ", "đường", "phố", "nằm", "ở đâu", "chỗ nào", "đoạn nào", "số mấy", "bên nào", "hướng nào",
            "quận", "phường", "bình thạnh", "sài gòn", "tp.hcm", "hcm",
            "landmark", "vinhomes", "bến thành", "tân sơn nhất", "sân bay", "bitexco",
            "nguyễn hữu cảnh", "điện biên phủ", "ung văn khiêm", "cầu sài gòn", "tòa nhà", "chung cư", "trung tâm",
            "gần", "xa", "khoảng cách", "bao xa", "km", "mét", "đi bộ", "chỉ đường", "bản đồ", "map", "3d", "tọa độ",

            // Giá vé, Chi phí & Thanh toán
            "vé", "thẻ", "giá", "phí", "tiền", "cước", "bao nhiêu", "rẻ", "đắt", "mắc", "tiết kiệm",
            "miễn phí", "free", "ưu đãi", "khuyến mãi", "vé tháng", "vé ngày", "vé lượt", "qua đêm", "ban ngày", "ban đêm",
            "thanh toán", "trả tiền", "chuyển khoản", "vnpay", "momo", "cash", "tiền mặt", "qr", "hóa đơn", "biên lai", "cọc", "hoàn tiền", "phạt",

            // Đặt chỗ, Thời gian & Giờ vận hành
            "đặt", "booking", "book", "hold", "giữ", "hủy", "cancel", "đổi", "gia hạn",
            "trễ", "muộn", "sớm", "quá giờ", "lố giờ", "mở cửa", "đóng cửa", "hoạt động",
            "mấy giờ", "bao lâu", "thời gian", "thời lượng", "tiếng", "giờ", "phút", "ngày", "tháng", "tuần", "hôm nay", "ngày mai", "cuối tuần",
            "check-in", "checkin", "check-out", "checkout",

            // Sự cố, An toàn, Biển số, Sạc điện & Hỗ trợ
            "mất", "quên", "rơi", "hỏng", "lỗi", "sự cố",
            "biển số", "camera", "anpr", "ocr", "quét", "nhận diện", "cccd", "căn cước", "cà vẹt", "cavet", "giấy tờ", "chính chủ",
            "sạc", "trụ sạc", "pin", "pccc", "cháy", "khói", "an toàn", "an ninh", "tốc độ",
            "bảo vệ", "nhân viên", "quản lý", "liên hệ", "hotline", "điện thoại", "tổng đài",
            "quy định", "nội quy", "chính sách", "thủ tục", "hướng dẫn", "thông tin", "chi tiết"
        ];

        return !comprehensiveParkingKeywords.Any(lower.Contains);
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
