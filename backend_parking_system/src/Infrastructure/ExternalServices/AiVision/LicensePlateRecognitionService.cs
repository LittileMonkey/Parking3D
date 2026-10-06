using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using ParkingSystem.Application.Common.Interfaces;
using ParkingSystem.Application.Features.LicensePlate.DTOs;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Infrastructure.ExternalServices.AiVision;

/// <summary>
/// Dịch vụ nhận diện biển số xe sử dụng kết hợp Python Vision và quy chuẩn xử lý hậu kỳ biển số Việt Nam
/// </summary>
public partial class LicensePlateRecognitionService(
    PythonFastApiClient pythonClient,
    ILogger<LicensePlateRecognitionService> logger) : ILicensePlateRecognitionService
{
    public async Task<PlateRecognitionResultDto> RecognizePlateAsync(PlateRecognitionRequestDto request, CancellationToken ct = default)
    {
        byte[]? imageBytes = null;

        if (!string.IsNullOrWhiteSpace(request.ImageBase64))
        {
            var base64Clean = CleanBase64String(request.ImageBase64);
            try
            {
                imageBytes = Convert.FromBase64String(base64Clean);
            }
            catch (FormatException ex)
            {
                logger.LogWarning(ex, "Chuỗi Base64 không hợp lệ khi quét biển số tại cổng {GateId}", request.GateId);
                return new PlateRecognitionResultDto
                {
                    Status = RecognitionStatus.Failed,
                    RawPlate = string.Empty,
                    NormalizedPlate = string.Empty,
                    Confidence = 0.0,
                    PlateType = "Unknown",
                    ProcessingTimeMs = 0
                };
            }
        }

        imageBytes ??= [];

        return await RecognizePlateFromBytesAsync(imageBytes, request.GateId, request.Direction, request.ParkingLotId, ct);
    }

    public async Task<PlateRecognitionResultDto> RecognizePlateFromBytesAsync(
        byte[] imageBytes,
        string gateId,
        string direction,
        Guid? parkingLotId = null,
        CancellationToken ct = default)
    {
        var stopwatch = Stopwatch.StartNew();

        // 1. Gọi Python AI Vision Service (YOLOv8 + PaddleOCR)
        var detection = await pythonClient.DetectPlateAsync(imageBytes, ct);

        // 2. Làm sạch và chuẩn hóa biển số theo quy chuẩn Việt Nam
        var normalized = NormalizeVietnamesePlate(detection.PlateText);

        // 3. Đánh giá trạng thái tin cậy
        var status = EvaluateRecognitionStatus(detection.Confidence, normalized);

        // 4. Phỏng đoán loại phương tiện dựa trên sê-ri biển số
        var vehicleType = PredictVehicleType(normalized);

        stopwatch.Stop();

        // 5. Chuẩn bị log nghiệp vụ
        var log = new LicensePlateLog
        {
            RawPlate = detection.PlateText,
            NormalizedPlate = normalized,
            Confidence = detection.Confidence,
            GateId = gateId,
            Direction = direction,
            Status = status,
            VehicleType = vehicleType,
            PlateType = detection.PlateType,
            CroppedPlateBase64 = detection.CroppedImageBase64,
            ParkingLotId = parkingLotId
        };

        logger.LogInformation(
            "Biển số nhận diện thành công: {Normalized} | Confidence: {Confidence:P1} | Gate: {GateId} | Direction: {Direction} | Time: {Time}ms",
            normalized, detection.Confidence, gateId, direction, stopwatch.ElapsedMilliseconds);

        return new PlateRecognitionResultDto
        {
            NormalizedPlate = normalized,
            RawPlate = detection.PlateText,
            Confidence = Math.Round(detection.Confidence, 3),
            PlateType = detection.PlateType,
            CroppedPlateBase64 = detection.CroppedImageBase64,
            Status = status,
            VehicleTypeSuggestion = vehicleType,
            ProcessingTimeMs = stopwatch.ElapsedMilliseconds
        };
    }

    /// <summary>
    /// Chuẩn hóa chuỗi biển số xe Việt Nam:
    /// Loại bỏ ký tự đặc biệt thừa, phân tách chuẩn dạng '51K-888.88' hoặc '59-P1 123.45'
    /// </summary>
    public static string NormalizeVietnamesePlate(string rawText)
    {
        if (string.IsNullOrWhiteSpace(rawText)) return string.Empty;

        // Chuyển chữ hoa, thay thế khoảng trắng và ký tự đặc biệt không mong muốn
        var cleaned = rawText.ToUpperInvariant().Trim();
        cleaned = CleanSpecialCharactersRegex().Replace(cleaned, "");

        // Tách số tỉnh (2 số đầu)
        if (cleaned.Length >= 7)
        {
            // Kiểm tra biển ô tô 1 dòng thông dụng (VD: 51K88888 -> 51K-888.88)
            var carMatch = CarPlateRegex().Match(cleaned);
            if (carMatch.Success)
            {
                var province = carMatch.Groups[1].Value;
                var series = carMatch.Groups[2].Value;
                var numbers = carMatch.Groups[3].Value;

                if (numbers.Length == 5)
                {
                    return $"{province}{series}-{numbers[..3]}.{numbers[3..]}";
                }
                if (numbers.Length == 4)
                {
                    return $"{province}{series}-{numbers}";
                }
            }

            // Kiểm tra biển xe máy 2 dòng thông dụng (VD: 59P167890 -> 59-P1 678.90)
            var bikeMatch = BikePlateRegex().Match(cleaned);
            if (bikeMatch.Success)
            {
                var province = bikeMatch.Groups[1].Value;
                var series = bikeMatch.Groups[2].Value;
                var numbers = bikeMatch.Groups[3].Value;

                if (numbers.Length == 5)
                {
                    return $"{province}-{series} {numbers[..3]}.{numbers[3..]}";
                }
                if (numbers.Length == 4)
                {
                    return $"{province}-{series} {numbers}";
                }
            }
        }

        return cleaned;
    }

    private static RecognitionStatus EvaluateRecognitionStatus(double confidence, string normalizedPlate)
    {
        if (string.IsNullOrWhiteSpace(normalizedPlate)) return RecognitionStatus.Failed;
        if (confidence >= 0.85) return RecognitionStatus.Success;
        if (confidence >= 0.60) return RecognitionStatus.LowConfidence;
        return RecognitionStatus.Failed;
    }

    private static VehicleType PredictVehicleType(string plate)
    {
        // Xe máy thường có 2 ký tự sê-ri chứa cả chữ và số (ví dụ: P1, B2, FA, K8...)
        if (plate.Contains("-") && plate.Length >= 8)
        {
            var parts = plate.Split(new[] { '-', ' ' }, StringSplitOptions.RemoveEmptyEntries);
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
