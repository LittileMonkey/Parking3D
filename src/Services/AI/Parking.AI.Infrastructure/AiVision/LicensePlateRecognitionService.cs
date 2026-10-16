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
/// Dịch vụ nhận diện biển số xe sử dụng kết hợp Python Vision, lưu trữ CSDL ai_plate_recognitions và chuẩn hóa biển số Việt Nam
/// </summary>
public partial class LicensePlateRecognitionService(
    PythonFastApiClient pythonClient,
    NpgsqlDataSource db,
    ILogger<LicensePlateRecognitionService> logger) : ILicensePlateRecognitionService
{
    public async Task<PlateRecognitionResultDto> RecognizePlateAsync(PlateRecognitionRequestDto request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.ImageBase64))
        {
            throw new ServiceException(400, "Yêu cầu chuỗi Base64 imageBase64 hoặc file ảnh hợp lệ.");
        }

        var base64Clean = CleanBase64String(request.ImageBase64);
        byte[] imageBytes;
        try
        {
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

    public async Task<PlateRecognitionResultDto> RecognizePlateFromBytesAsync(
        byte[] imageBytes,
        string gateId,
        string direction,
        Guid? parkingLotId = null,
        string? idempotencyKey = null,
        Guid? uploadedBy = null,
        CancellationToken ct = default)
    {
        var stopwatch = Stopwatch.StartNew();

        if (imageBytes.Length == 0)
        {
            throw new ServiceException(400, "Mảng byte ảnh đầu vào rỗng.");
        }

        // 1. Gọi Python AI Vision Service (YOLOv8 + PaddleOCR hoặc Fallback có cờ)
        var detection = await pythonClient.DetectPlateAsync(imageBytes, ct);

        // 2. Tách biệt chuẩn hóa: PlateNumber (lưu DB / đối soát) và DisplayPlate (hiển thị UI)
        var plateNumber = ToAlphanumericPlate(detection.PlateText);
        var displayPlate = FormatDisplayPlate(detection.PlateText);

        // 3. Đánh giá trạng thái tin cậy
        var status = EvaluateRecognitionStatus(detection.Confidence, plateNumber);

        // 4. Phỏng đoán loại phương tiện dựa trên sê-ri biển số
        var vehicleType = PredictVehicleType(displayPlate);

        // 5. Lưu vết nhận diện vào CSDL PostgreSQL (ai_plate_recognitions) để Staff có thể đối soát (DEF-02)
        var recognitionId = Guid.NewGuid();
        var lotId = parkingLotId ?? Guid.Parse("11111111-1111-1111-1111-111111111111");
        var user = uploadedBy ?? Guid.Parse("00000000-0000-0000-0000-000000000001");
        var key = !string.IsNullOrWhiteSpace(idempotencyKey)
            ? idempotencyKey
            : $"SCAN_{gateId}_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        var digest = Convert.ToHexStringLower(SHA256.HashData(imageBytes));
        var modelVersion = detection.IsFallback ? "simulated-detector-v1" : "yolov8-paddleocr-v1";

        try
        {
            var isNoPlate = string.IsNullOrWhiteSpace(plateNumber);
            var dbStatus = isNoPlate ? "NO_PLATE" : "PENDING_REVIEW";

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
    /// Chuẩn hóa chuỗi biển số dạng chữ và số liền mạch phục vụ lưu trữ CSDL và kiểm tra regex ^[A-Z0-9]{1,20}$
    /// </summary>
    public static string ToAlphanumericPlate(string rawText)
    {
        if (string.IsNullOrWhiteSpace(rawText)) return string.Empty;
        var cleaned = CleanSpecialCharactersRegex().Replace(rawText.ToUpperInvariant().Trim(), "");
        return cleaned.Length > 20 ? cleaned[..20] : cleaned;
    }

    /// <summary>
    /// Định dạng biển số hiển thị thân thiện trên giao diện UI (VD: 51K-888.88 hoặc 59-P1 678.90)
    /// </summary>
    public static string FormatDisplayPlate(string rawText)
    {
        var cleaned = ToAlphanumericPlate(rawText);
        if (cleaned.Length < 7) return cleaned;

        var carMatch = CarPlateRegex().Match(cleaned);
        if (carMatch.Success)
        {
            var province = carMatch.Groups[1].Value;
            var series = carMatch.Groups[2].Value;
            var numbers = carMatch.Groups[3].Value;

            return numbers.Length == 5
                ? $"{province}{series}-{numbers[..3]}.{numbers[3..]}"
                : $"{province}{series}-{numbers}";
        }

        var bikeMatch = BikePlateRegex().Match(cleaned);
        if (bikeMatch.Success)
        {
            var province = bikeMatch.Groups[1].Value;
            var series = bikeMatch.Groups[2].Value;
            var numbers = bikeMatch.Groups[3].Value;

            return numbers.Length == 5
                ? $"{province}-{series} {numbers[..3]}.{numbers[3..]}"
                : $"{province}-{series} {numbers}";
        }

        return cleaned;
    }

    public static string NormalizeVietnamesePlate(string rawText) => FormatDisplayPlate(rawText);

    private static RecognitionStatus EvaluateRecognitionStatus(double confidence, string plateNumber)
    {
        if (string.IsNullOrWhiteSpace(plateNumber)) return RecognitionStatus.Failed;
        if (confidence >= 0.85) return RecognitionStatus.Success;
        if (confidence >= 0.60) return RecognitionStatus.LowConfidence;
        return RecognitionStatus.Failed;
    }

    private static VehicleType PredictVehicleType(string displayPlate)
    {
        if (displayPlate.Contains('-') && displayPlate.Length >= 8)
        {
            var parts = displayPlate.Split(['-', ' '], StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length > 1 && parts[1].Length == 2 && char.IsDigit(parts[1][1]))
            {
                return VehicleType.Motorbike;
            }
        }

        return VehicleType.Car;
    }

    private static string CleanBase64String(string base64)
    {
        if (base64.Contains(','))
        {
            return base64[(base64.IndexOf(',') + 1)..];
        }
        return base64;
    }

    [GeneratedRegex(@"[^A-Z0-9]")]
    private static partial Regex CleanSpecialCharactersRegex();

    [GeneratedRegex(@"^([0-9]{2})([A-Z]{1,2})([0-9]{4,5})$")]
    private static partial Regex CarPlateRegex();

    [GeneratedRegex(@"^([0-9]{2})([A-Z][0-9]|[A-Z]{2})([0-9]{4,5})$")]
    private static partial Regex BikePlateRegex();
}
