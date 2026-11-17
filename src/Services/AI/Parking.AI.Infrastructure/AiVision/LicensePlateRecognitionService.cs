using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Npgsql;
using Parking.AI.Application.DTOs.LicensePlate;
using Parking.AI.Application.Interfaces;
using Parking.AI.Domain;
using Parking.AI.Domain.Entities;
using Parking.AI.Domain.Enums;
using Parking.ServiceDefaults;

namespace Parking.AI.Infrastructure.AiVision;

/// <summary>
/// Dịch vụ cốt lõi nhận diện biển số xe (ANPR OCR) cho hệ thống bãi đỗ xe thông minh.
/// <para>
/// <b>Thư viện & Công nghệ chủ chốt:</b>
/// <list type="bullet">
///   <item><description><see cref="System.Diagnostics.Stopwatch"/>: Đo lường độ trễ (latency) của mô hình AI với độ chính xác phần cứng cực cao (High-resolution hardware timer).</description></item>
///   <item><description><see cref="System.Security.Cryptography.SHA256"/>: Băm mảng byte ảnh thành chuỗi băm hex 64 ký tự để định danh ảnh chống trùng lặp và phục vụ Audit trail.</description></item>
///   <item><description><see cref="Npgsql.NpgsqlDataSource"/>: Thực thi câu lệnh SQL thuần bảo vệ bằng tham số hóa (Parameterized queries) và xử lý tính lũy đẳng (Idempotency) qua <c>ON CONFLICT ... DO NOTHING</c>.</description></item>
///   <item><description><see cref="System.Text.RegularExpressions.GeneratedRegexAttribute"/>: C# Source Generator dịch các biểu thức chính quy thành mã C# tối ưu hóa tĩnh ngay lúc compile, loại bỏ hoàn toàn chi phí regex parsing tại runtime.</description></item>
///   <item><description><b>Tiêu chuẩn Biển số Việt Nam:</b> Phân loại tự động ô tô (51K-888.88) và xe máy (59-P1 678.90) dựa theo quy chuẩn Bộ Công An.</description></item>
/// </list>
/// </para>
/// </summary>
public partial class LicensePlateRecognitionService(
    PythonFastApiClient pythonClient,
    NpgsqlDataSource db,
    ILogger<LicensePlateRecognitionService> logger) : ILicensePlateRecognitionService
{
    /// <summary>
    /// Nhận diện biển số xe từ chuỗi hình ảnh Base64 (hỗ trợ cả chuỗi thuần Base64 và Data URL có tiền tố <c>data:image/...;base64,</c>).
    /// </summary>
    /// <param name="request">DTO chứa chuỗi ảnh Base64, mã cổng, hướng di chuyển, và mã bãi xe</param>
    /// <param name="ct">Mã thông báo hủy tác vụ (<see cref="CancellationToken"/>)</param>
    /// <returns>Kết quả nhận diện chuẩn hóa gồm biển số, độ tin cậy, gợi ý loại phương tiện và thời gian xử lý</returns>
    /// <exception cref="ServiceException">Ném lỗi 400 nếu chuỗi Base64 rỗng, sai định dạng hoặc vượt quá dung lượng cho phép</exception>
    public async Task<PlateRecognitionResultDto> RecognizePlateAsync(PlateRecognitionRequestDto request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.ImageBase64))
        {
            throw new ServiceException(400, "Yêu cầu chuỗi Base64 imageBase64 hoặc file ảnh hợp lệ.");
        }

        // Loại bỏ phần header Data URL nếu có (ví dụ: data:image/jpeg;base64,...)
        var base64Clean = CleanBase64String(request.ImageBase64);
        byte[] imageBytes;
        try
        {
            // Convert.FromBase64String: Chuyển đổi chuỗi văn bản ASCII sang mảng byte nhị phân của file ảnh
            imageBytes = Convert.FromBase64String(base64Clean);
        }
        catch (FormatException ex)
        {
            logger.LogWarning(ex, "Chuỗi Base64 không hợp lệ khi quét biển số tại cổng {GateId}", request.GateId);
            throw new ServiceException(400, "Định dạng chuỗi Base64 của ảnh không hợp lệ.");
        }

        if (imageBytes.Length == 0)
        {
            throw new ServiceException(400, "Dữ liệu ảnh rỗng sau khi giải mã Base64.");
        }

        if (imageBytes.Length > ImageRules.MaxImageBytes)
        {
            throw new ServiceException(400, $"Kích thước ảnh vượt quá giới hạn cho phép ({ImageRules.MaxImageBytes / 1024 / 1024}MB).");
        }

        return await RecognizePlateFromBytesAsync(
            imageBytes,
            request.GateId,
            request.Direction,
            request.ParkingLotId,
            request.IdempotencyKey,
            request.UploadedBy,
            ct);
    }

    /// <summary>
    /// Nhận diện biển số xe từ mảng byte thô, tích hợp lưu vết kiểm toán (Audit Trail) vào CSDL PostgreSQL.
    /// </summary>
    /// <param name="imageBytes">Mảng byte của ảnh</param>
    /// <param name="gateId">Mã cổng quét biển (ví dụ: GATE_IN_01)</param>
    /// <param name="direction">Hướng xe (IN: xe vào, OUT: xe ra)</param>
    /// <param name="parkingLotId">Mã định danh bãi xe (nếu có)</param>
    /// <param name="idempotencyKey">Khóa chống gửi trùng quét ảnh nhiều lần</param>
    /// <param name="uploadedBy">Mã định danh nhân viên hoặc người dùng thực hiện</param>
    /// <param name="ct">CancellationToken</param>
    public async Task<PlateRecognitionResultDto> RecognizePlateFromBytesAsync(
        byte[] imageBytes,
        string gateId,
        string direction,
        Guid? parkingLotId = null,
        string? idempotencyKey = null,
        Guid? uploadedBy = null,
        CancellationToken ct = default)
    {
        // Stopwatch.StartNew(): Sử dụng bộ đếm chu kỳ phần cứng độ phân giải cao để đo chính xác thời gian xử lý AI
        var stopwatch = Stopwatch.StartNew();

        if (imageBytes.Length == 0)
        {
            throw new ServiceException(400, "Mảng byte ảnh đầu vào rỗng.");
        }

        // 1. Gọi Python AI Vision Service (YOLOv8 cắt vùng biển số + PaddleOCR nhận diện ký tự)
        var detection = await pythonClient.DetectPlateAsync(imageBytes, ct);

        // 2. Tách biệt 2 dạng chuẩn hóa:
        // - PlateNumber: Dạng liền mạch viết hoa (ví dụ: 51K88888) dùng để lưu DB, lập chỉ mục Index, và so khớp barrier
        // - DisplayPlate: Dạng hiển thị người dùng (ví dụ: 51K-888.88) phục vụ UI/UX theo tiêu chuẩn biển số VN
        var plateNumber = ToAlphanumericPlate(detection.PlateText);
        var displayPlate = FormatDisplayPlate(detection.PlateText);

        // 3. Đánh giá trạng thái tin cậy của thuật toán (Success: >= 85%, LowConfidence: >= 60%, Failed: < 60%)
        var status = EvaluateRecognitionStatus(detection.Confidence, plateNumber);

        // 4. Phỏng đoán loại phương tiện (Car vs Motorbike) dựa trên sê-ri biển số
        var vehicleType = PredictVehicleType(displayPlate);

        // 5. Lưu vết nhận diện vào CSDL PostgreSQL (ai_plate_recognitions) để Staff đối soát thủ công nếu cần (DEF-02)
        var recognitionId = Guid.NewGuid();
        var lotId = parkingLotId ?? Guid.Parse("11111111-1111-1111-1111-111111111111");
        var user = uploadedBy ?? Guid.Parse("00000000-0000-0000-0000-000000000001");
        var key = !string.IsNullOrWhiteSpace(idempotencyKey)
            ? idempotencyKey
            : $"SCAN_{gateId}_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";

        // SHA256.HashData: Tạo mã băm không thể đảo ngược từ ảnh để kiểm tra trùng lặp
        var digest = Convert.ToHexStringLower(SHA256.HashData(imageBytes));
        var modelVersion = detection.IsFallback ? "simulated-detector-v1" : "yolov8-paddleocr-v1";

        try
        {
            var isNoPlate = string.IsNullOrWhiteSpace(plateNumber);
            var dbStatus = isNoPlate ? "NO_PLATE" : "PENDING_REVIEW";

            // Npgsql parameterized query với cơ chế ON CONFLICT DO NOTHING đảm bảo tính lũy đẳng (Idempotency)
            await using var insert = db.CreateCommand("""
                INSERT INTO ai_plate_recognitions(
                    id, lot_id, uploaded_by, idempotency_key, image_sha256,
                    candidate_plate, confidence, status, model_version, expires_at
                )
                VALUES(
                    @id, @lot, @user, @key, @digest,
                    @plate, @conf, @status, @model, now() + interval '24 hours'
                )
                ON CONFLICT(lot_id, uploaded_by, idempotency_key) DO NOTHING
                """);
            insert.Parameters.AddWithValue("id", recognitionId);
            insert.Parameters.AddWithValue("lot", lotId);
            insert.Parameters.AddWithValue("user", user);
            insert.Parameters.AddWithValue("key", key);
            insert.Parameters.AddWithValue("digest", digest);
            insert.Parameters.AddWithValue("plate", isNoPlate ? DBNull.Value : plateNumber);
            insert.Parameters.AddWithValue("conf", isNoPlate ? DBNull.Value : Math.Round(detection.Confidence, 5));
            insert.Parameters.AddWithValue("status", dbStatus);
            insert.Parameters.AddWithValue("model", modelVersion);

            await insert.ExecuteNonQueryAsync(ct);
        }
        catch (Exception ex)
        {
            // Bắt lỗi ghi DB mềm dẻo: Nếu CSDL gặp sự cố tạm thời, hệ thống vẫn trả kết quả nhận diện cho cổng barrier
            logger.LogWarning(ex, "Lưu bản ghi nhận diện vào ai_plate_recognitions thất bại (tiếp tục trả kết quả cho client)");
        }

        stopwatch.Stop();

        logger.LogInformation(
            "Biển số nhận diện thành công: {DisplayPlate} (DB: {PlateNumber}) | Conf: {Confidence:P1} | Gate: {GateId} | Dir: {Direction} | Time: {Time}ms | Fallback: {IsFallback}",
            displayPlate, plateNumber, detection.Confidence, gateId, direction, stopwatch.ElapsedMilliseconds, detection.IsFallback);

        return new PlateRecognitionResultDto
        {
            RecognitionId = recognitionId,
            PlateNumber = plateNumber,
            NormalizedPlate = plateNumber,
            DisplayPlate = displayPlate,
            RawPlate = detection.PlateText,
            Confidence = Math.Round(detection.Confidence, 3),
            PlateType = detection.PlateType,
            CroppedPlateBase64 = detection.CroppedImageBase64,
            Status = status,
            VehicleTypeSuggestion = vehicleType,
            ProcessingTimeMs = stopwatch.ElapsedMilliseconds,
            IsFallback = detection.IsFallback
        };
    }

    /// <summary>
    /// Chuẩn hóa chuỗi biển số xe thành dạng chỉ gồm chữ in hoa và chữ số liền mạch (<c>^[A-Z0-9]{1,20}$</c>).
    /// Loại bỏ mọi ký tự đặc biệt, dấu chấm, dấu phẩy, khoảng trắng để phục vụ tìm kiếm và so sánh tuyệt đối trong Database.
    /// </summary>
    /// <param name="rawText">Chuỗi biển số gốc thô từ bộ OCR</param>
    public static string ToAlphanumericPlate(string rawText)
    {
        if (string.IsNullOrWhiteSpace(rawText)) return string.Empty;
        var cleaned = CleanSpecialCharactersRegex().Replace(rawText.ToUpperInvariant().Trim(), "");
        return cleaned.Length > 20 ? cleaned[..20] : cleaned;
    }

    /// <summary>
    /// Các sê-ri gồm 2 chữ cái đặc thù của xe ô tô tại Việt Nam (Thông tư 24/2023/TT-BCA và Thông tư 58/2020/TT-BCA).
    /// Ngoài các sê-ri chuyên biệt này, tất cả các biển có sê-ri 2 chữ cái (như AA, AB, AL, FA...) đều là biển xe máy.
    /// </summary>
    private static readonly HashSet<string> SpecialCarSeries = new(StringComparer.OrdinalIgnoreCase)
    {
        "LD", "DA", "MK", "CD", "KT", "HC", "RM", "NG", "NN", "QT"
    };

    /// <summary>
    /// Định dạng biển số hiển thị thân thiện trên giao diện UI/UX theo quy chuẩn Việt Nam.
    /// <para>
    /// - Ô tô 5 số tiêu chuẩn: <b>51K-888.88</b>
    /// - Ô tô 4 số tiêu chuẩn: <b>51A-1234</b>
    /// - Ô tô sê-ri 2 chữ cái đặc thù: <b>51LD-123.45</b>
    /// - Xe máy cũ (1 chữ + 1 số): <b>59-P1 678.90</b> hoặc <b>59-F1 1234</b>
    /// - Xe máy mới (2 chữ cái theo TT 24/2023): <b>78-AL 123.45</b> hoặc <b>29-AB 1234</b>
    /// </para>
    /// </summary>
    public static string FormatDisplayPlate(string rawText)
    {
        if (string.IsNullOrWhiteSpace(rawText)) return string.Empty;

        // 0. Nếu chuỗi gốc có dấu phân cách rõ ràng cho xe máy 4 số cũ (VD: 59-F1 1234 hoặc 59-F1-1234)
        var rawBike4Match = RawBike4DigitsRegex().Match(rawText.Trim().ToUpperInvariant());
        if (rawBike4Match.Success)
        {
            return $"{rawBike4Match.Groups[1].Value}-{rawBike4Match.Groups[2].Value} {rawBike4Match.Groups[3].Value}";
        }

        var cleaned = ToAlphanumericPlate(rawText);
        if (cleaned.Length < 7) return cleaned;

        // 1. Kiểm tra mẫu biển xe ô tô 5 số tiêu chuẩn: 2 số tỉnh + 1 chữ cái sê-ri + đúng 5 số (VD: 51K88888, 30H99999, 43A12345)
        var car5Match = Car5DigitsPlateRegex().Match(cleaned);
        if (car5Match.Success)
        {
            var province = car5Match.Groups[1].Value;
            var series = car5Match.Groups[2].Value;
            var numbers = car5Match.Groups[3].Value;
            return $"{province}{series}-{numbers[..3]}.{numbers[3..]}";
        }

        // 2. Kiểm tra mẫu biển xe ô tô 4 số tiêu chuẩn: 2 số tỉnh + 1 chữ cái sê-ri + đúng 4 số (VD: 51A1234, 29H5678)
        var car4Match = Car4DigitsPlateRegex().Match(cleaned);
        if (car4Match.Success)
        {
            var province = car4Match.Groups[1].Value;
            var series = car4Match.Groups[2].Value;
            var numbers = car4Match.Groups[3].Value;
            return $"{province}{series}-{numbers}";
        }

        // 3. Kiểm tra mẫu biển số xe máy sê-ri cũ: 2 số tỉnh + 1 chữ cái 1 số sê-ri + 4-5 số (VD: 59P167890, 59F11234)
        var bikeOldMatch = BikeOldPlateRegex().Match(cleaned);
        if (bikeOldMatch.Success)
        {
            var province = bikeOldMatch.Groups[1].Value;
            var series = bikeOldMatch.Groups[2].Value;
            var numbers = bikeOldMatch.Groups[3].Value;

            return numbers.Length == 5
                ? $"{province}-{series} {numbers[..3]}.{numbers[3..]}"
                : $"{province}-{series} {numbers}";
        }

        // 4. Kiểm tra mẫu biển sê-ri 2 chữ cái (VD: 78AL12345 hoặc 51LD12345):
        // - Nếu là sê-ri ô tô chuyên biệt (LD, DA, MK, CD, KT, HC, RM...): định dạng kiểu ô tô (VD: 51LD-123.45)
        // - Các sê-ri 2 chữ cái khác (VD: 78AL, 29AB, 59AA...): định dạng kiểu xe máy chuẩn Thông tư 24/2023 (VD: 78-AL 123.45)
        var twoLetterMatch = TwoLetterSeriesPlateRegex().Match(cleaned);
        if (twoLetterMatch.Success)
        {
            var province = twoLetterMatch.Groups[1].Value;
            var series = twoLetterMatch.Groups[2].Value;
            var numbers = twoLetterMatch.Groups[3].Value;

            if (SpecialCarSeries.Contains(series))
            {
                return numbers.Length == 5
                    ? $"{province}{series}-{numbers[..3]}.{numbers[3..]}"
                    : $"{province}{series}-{numbers}";
            }

            return numbers.Length == 5
                ? $"{province}-{series} {numbers[..3]}.{numbers[3..]}"
                : $"{province}-{series} {numbers}";
        }

        return cleaned;
    }

    /// <summary>
    /// Phương thức tương thích ngược alias cho <see cref="FormatDisplayPlate(string)"/>
    /// </summary>
    public static string NormalizeVietnamesePlate(string rawText) => FormatDisplayPlate(rawText);

    /// <summary>
    /// Đánh giá trạng thái nhận diện dựa trên ngưỡng độ tin cậy toán học:
    /// - &gt;= 85%: Thành công (Success)
    /// - 60% .. 84%: Độ tin cậy trung bình (LowConfidence - cảnh báo nhân viên soát lại)
    /// - &lt; 60% hoặc không có biển: Thất bại (Failed)
    /// </summary>
    private static RecognitionStatus EvaluateRecognitionStatus(double confidence, string plateNumber)
    {
        if (string.IsNullOrWhiteSpace(plateNumber)) return RecognitionStatus.Failed;
        if (confidence >= 0.85) return RecognitionStatus.Success;
        if (confidence >= 0.60) return RecognitionStatus.LowConfidence;
        return RecognitionStatus.Failed;
    }

    /// <summary>
    /// Phỏng đoán loại phương tiện (Ô tô vs Xe máy) dựa trên đặc điểm cấu trúc ký tự sê-ri biển số:
    /// - Xe máy cũ: Sê-ri gồm 1 chữ cái và 1 chữ số (ví dụ: P1, B2, C1, N1).
    /// - Xe máy mới (Thông tư 24/2023): Sê-ri gồm 2 chữ cái (ví dụ: AL, AA, AB...), loại trừ mã ô tô chuyên biệt (LD, DA...).
    /// </summary>
    private static VehicleType PredictVehicleType(string displayPlate)
    {
        if (displayPlate.Contains('-') && displayPlate.Length >= 8)
        {
            var parts = displayPlate.Split(['-', ' '], StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length > 1 && parts[1].Length == 2)
            {
                var series = parts[1];
                // Sê-ri xe máy cũ: 1 chữ cái + 1 chữ số (P1, B2...)
                if (char.IsLetter(series[0]) && char.IsDigit(series[1]))
                {
                    return VehicleType.Motorbike;
                }
                // Sê-ri xe máy mới (TT 24/2023): 2 chữ cái (AL, AA, AB...) không thuộc mã ô tô chuyên biệt
                if (char.IsLetter(series[0]) && char.IsLetter(series[1]) && !SpecialCarSeries.Contains(series))
                {
                    return VehicleType.Motorbike;
                }
            }
        }

        return VehicleType.Car;
    }

    /// <summary>
    /// Xóa tiền tố Data URL khỏi chuỗi Base64 (ví dụ: <c>data:image/jpeg;base64,....</c> -> <c>....</c>)
    /// </summary>
    private static string CleanBase64String(string base64)
    {
        if (base64.Contains(','))
        {
            return base64[(base64.IndexOf(',') + 1)..];
        }
        return base64;
    }

    /// <summary>
    /// Biểu thức chính quy loại bỏ tất cả ký tự không phải chữ cái A-Z và chữ số 0-9.
    /// Sử dụng Source Generator của .NET sinh mã tĩnh, tối ưu hóa tốc độ và không cấp phát heap.
    /// </summary>
    [GeneratedRegex(@"[^A-Z0-9]")]
    private static partial Regex CleanSpecialCharactersRegex();

    /// <summary>
    /// Biểu thức chính quy phát hiện biển số xe ô tô 5 số tiêu chuẩn:
    /// Nhóm 1: 2 chữ số mã tỉnh (VD: 51, 30, 43, 29)
    /// Nhóm 2: 1 chữ cái sê-ri (VD: A, B, C, K, H)
    /// Nhóm 3: Đúng 5 chữ số thứ tự (VD: 88888, 99999)
    /// </summary>
    [GeneratedRegex(@"^([0-9]{2})([A-Z])([0-9]{5})$")]
    private static partial Regex Car5DigitsPlateRegex();

    /// <summary>
    /// Biểu thức chính quy phát hiện biển số xe ô tô 4 số tiêu chuẩn:
    /// Nhóm 1: 2 chữ số mã tỉnh (VD: 51, 30, 43, 29)
    /// Nhóm 2: 1 chữ cái sê-ri (VD: A, B, C, K, H)
    /// Nhóm 3: Đúng 4 chữ số thứ tự (VD: 1234, 5678)
    /// </summary>
    [GeneratedRegex(@"^([0-9]{2})([A-Z])([0-9]{4})$")]
    private static partial Regex Car4DigitsPlateRegex();

    /// <summary>
    /// Biểu thức chính quy phát hiện biển số có sê-ri 2 chữ cái (VD: 78AL12345, 51LD12345, 29AB99999):
    /// Nhóm 1: 2 chữ số mã tỉnh
    /// Nhóm 2: 2 chữ cái sê-ri
    /// Nhóm 3: 4 đến 5 chữ số thứ tự
    /// </summary>
    [GeneratedRegex(@"^([0-9]{2})([A-Z]{2})([0-9]{4,5})$")]
    private static partial Regex TwoLetterSeriesPlateRegex();

    /// <summary>
    /// Biểu thức chính quy phát hiện biển số xe máy sê-ri cũ 4 số có ký tự phân cách (VD: 59-F1 1234, 59-F1-1234):
    /// </summary>
    [GeneratedRegex(@"^([0-9]{2})[- ]([A-Z][0-9])[- ]?([0-9]{4})$")]
    private static partial Regex RawBike4DigitsRegex();

    /// <summary>
    /// Biểu thức chính quy phát hiện biển số xe máy sê-ri cũ Việt Nam:
    /// Nhóm 1: 2 chữ số mã tỉnh (VD: 59, 29, 60)
    /// Nhóm 2: Sê-ri xe máy gồm 1 chữ cái + 1 chữ số (VD: P1, X2, F1)
    /// Nhóm 3: 4 đến 5 chữ số thứ tự (VD: 67890, 1234)
    /// </summary>
    [GeneratedRegex(@"^([0-9]{2})([A-Z][0-9])([0-9]{4,5})$")]
    private static partial Regex BikeOldPlateRegex();
}
