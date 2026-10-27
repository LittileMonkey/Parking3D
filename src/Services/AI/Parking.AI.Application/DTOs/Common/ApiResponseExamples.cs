namespace Parking.AI.Application.DTOs.Common;

/// <summary>
/// Mẫu phản hồi chuẩn HTTP 400 - Dữ liệu yêu cầu không hợp lệ (Validation Error)
/// </summary>
public record ErrorResponse400
{
    /// <summary>Dữ liệu kết quả luôn luôn là null khi xảy ra lỗi</summary>
    /// <example>null</example>
    public object? Result { get; init; } = null;

    /// <summary>Trạng thái thành công</summary>
    /// <example>false</example>
    public bool IsSuccess { get; init; } = false;

    /// <summary>Mã trạng thái HTTP</summary>
    /// <example>400</example>
    public int StatusCode { get; init; } = 400;

    /// <summary>Chi tiết nguyên nhân lỗi cụ thể</summary>
    /// <example>Dữ liệu yêu cầu không hợp lệ (Ví dụ: naturalLanguagePrompt không được để trống hoặc vượt quá 500 ký tự; hoặc ảnh không đúng định dạng JPEG/PNG; hoặc kích thước vượt quá 10MB)</example>
    public string Message { get; init; } = "Dữ liệu yêu cầu không hợp lệ (Ví dụ: naturalLanguagePrompt không được để trống hoặc vượt quá 500 ký tự; hoặc ảnh không đúng định dạng JPEG/PNG; hoặc kích thước vượt quá 10MB)";
}

/// <summary>
/// Mẫu phản hồi chuẩn HTTP 401 - Chưa xác thực tài khoản (Unauthorized)
/// </summary>
public record ErrorResponse401
{
    /// <example>null</example>
    public object? Result { get; init; } = null;

    /// <example>false</example>
    public bool IsSuccess { get; init; } = false;

    /// <example>401</example>
    public int StatusCode { get; init; } = 401;

    /// <example>Yêu cầu xác thực tài khoản. Vui lòng đính kèm Bearer JWT Token hợp lệ vào Authorization Header.</example>
    public string Message { get; init; } = "Yêu cầu xác thực tài khoản. Vui lòng đính kèm Bearer JWT Token hợp lệ vào Authorization Header.";
}

/// <summary>
/// Mẫu phản hồi chuẩn HTTP 403 - Không có quyền hạn thao tác (Forbidden)
/// </summary>
public record ErrorResponse403
{
    /// <example>null</example>
    public object? Result { get; init; } = null;

    /// <example>false</example>
    public bool IsSuccess { get; init; } = false;

    /// <example>403</example>
    public int StatusCode { get; init; } = 403;

    /// <example>Tài khoản không có quyền thao tác trên cơ sở này (Facility Permission Denied). Yêu cầu quyền ADMIN hoặc OCR tương ứng.</example>
    public string Message { get; init; } = "Tài khoản không có quyền thao tác trên cơ sở này (Facility Permission Denied). Yêu cầu quyền ADMIN hoặc OCR tương ứng.";
}

/// <summary>
/// Mẫu phản hồi chuẩn HTTP 404 - Không tìm thấy tài nguyên (Not Found)
/// </summary>
public record ErrorResponse404
{
    /// <example>null</example>
    public object? Result { get; init; } = null;

    /// <example>false</example>
    public bool IsSuccess { get; init; } = false;

    /// <example>404</example>
    public int StatusCode { get; init; } = 404;

    /// <example>Tài nguyên, bãi xe hoặc phiên hội thoại yêu cầu không tồn tại.</example>
    public string Message { get; init; } = "Tài nguyên, bãi xe hoặc phiên hội thoại yêu cầu không tồn tại.";
}

/// <summary>
/// Mẫu phản hồi chuẩn HTTP 409 - Xung đột phiên bản hoặc dữ liệu (Conflict)
/// </summary>
public record ErrorResponse409
{
    /// <example>null</example>
    public object? Result { get; init; } = null;

    /// <example>false</example>
    public bool IsSuccess { get; init; } = false;

    /// <example>409</example>
    public int StatusCode { get; init; } = 409;

    /// <example>Xung đột phiên bản dữ liệu (Optimistic Lock Version Conflict) hoặc bản ghi đã được xử lý trước đó.</example>
    public string Message { get; init; } = "Xung đột phiên bản dữ liệu (Optimistic Lock Version Conflict) hoặc bản ghi đã được xử lý trước đó.";
}

/// <summary>
/// Mẫu phản hồi chuẩn HTTP 500 - Lỗi máy chủ nội bộ hoặc gián đoạn dịch vụ
/// </summary>
public record ErrorResponse500
{
    /// <example>null</example>
    public object? Result { get; init; } = null;

    /// <example>false</example>
    public bool IsSuccess { get; init; } = false;

    /// <example>500</example>
    public int StatusCode { get; init; } = 500;

    /// <example>Lỗi máy chủ nội bộ hoặc kết nối cơ sở dữ liệu PostgreSQL tạm thời gián đoạn.</example>
    public string Message { get; init; } = "Lỗi máy chủ nội bộ hoặc kết nối cơ sở dữ liệu PostgreSQL tạm thời gián đoạn.";
}

/// <summary>
/// DTO chuẩn hóa kết quả dự báo công suất bãi xe
/// </summary>
public record OccupancyForecastDto
{
    public Guid Id { get; init; } = Guid.Parse("3fa85f64-5717-4562-b3fc-2c963f66afa6");
    public Guid LotId { get; init; } = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public string VehicleType { get; init; } = "Car";
    public DateTimeOffset GeneratedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset TargetAt { get; init; } = DateTimeOffset.UtcNow.AddMinutes(60);
    public DateTimeOffset DataCutoffAt { get; init; } = DateTimeOffset.UtcNow.AddMinutes(-5);
    public int UsableCapacity { get; init; } = 100;
    public decimal PredictedOccupied { get; init; } = 42.5m;
    public string ModelVersion { get; init; } = "rolling-mean-v1";
    public string DataSource { get; init; } = "ACTUAL";
    public bool IsAdvisory { get; init; } = true;
    public string EvaluationStatus { get; init; } = "NOT_EVALUATED";
}

/// <summary>
/// DTO chuẩn hóa kết quả tra cứu FAQ / Quy định bãi xe (No-LLM)
/// </summary>
public record AssistantFaqDto
{
    public string Mode { get; init; } = "RETRIEVAL_NO_LLM";
    public List<AssistantFaqItemDto> Answers { get; init; } =
    [
        new AssistantFaqItemDto
        {
            DocumentId = Guid.Parse("3fa85f64-5717-4562-b3fc-2c963f66afa6"),
            Revision = 1,
            Title = "Quy định gửi xe ParkMatrix",
            Section = "Biểu phí tiêu chuẩn",
            Content = "Xe ô tô: 20.000đ/2 giờ đầu, 15.000đ/giờ tiếp theo. Xe máy: 5.000đ/lượt ban ngày.",
            Source = "BOD-2026-REG-01"
        }
    ];
    public string Message { get; init; } = "Nội dung từ hướng dẫn công khai đã duyệt; không thực hiện giao dịch.";
}

public record AssistantFaqItemDto
{
    public Guid DocumentId { get; init; }
    public int Revision { get; init; }
    public string Title { get; init; } = string.Empty;
    public string Section { get; init; } = string.Empty;
    public string Content { get; init; } = string.Empty;
    public string Source { get; init; } = string.Empty;
}

public record EntityIdResultDto(Guid Id);
public record EntityStatusResultDto(Guid Id, string Status);
