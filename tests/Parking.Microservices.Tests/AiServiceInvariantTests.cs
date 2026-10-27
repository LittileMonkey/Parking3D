using Parking.AI.Domain;
using Parking.AI.Infrastructure.AiVision;
using Xunit;

namespace Parking.Microservices.Tests;

public sealed class AiServiceInvariantTests
{
    [Theory]
    [InlineData("51K-888.88", "51K88888", "51K-888.88")]
    [InlineData("51k 888.88", "51K88888", "51K-888.88")]
    [InlineData("30H99999", "30H99999", "30H-999.99")]
    [InlineData("59-P1 678.90", "59P167890", "59-P1 678.90")]
    [InlineData("43A-123.45", "43A12345", "43A-123.45")]
    public void PlateSeparation_ProducesValidAlphanumericForDatabaseAndFormattedForDisplay(
        string rawInput, string expectedDbPlate, string expectedDisplayPlate)
    {
        // 1. Phải chuẩn hóa ra dạng sạch dấu cho CSDL (DEF-01)
        var dbPlate = LicensePlateRecognitionService.ToAlphanumericPlate(rawInput);
        Assert.Equal(expectedDbPlate, dbPlate);

        // 2. Chuỗi DB plate phải thỏa mãn ràng buộc regex ^[A-Z0-9]{1,20}$ của CSDL và ImageRules
        Assert.True(ImageRules.IsNormalizedPlate(dbPlate), $"Biển số '{dbPlate}' phải thỏa mãn ImageRules.IsNormalizedPlate");

        // 3. Chuỗi hiển thị UI phải chuẩn hóa đẹp mắt
        var displayPlate = LicensePlateRecognitionService.FormatDisplayPlate(rawInput);
        Assert.Equal(expectedDisplayPlate, displayPlate);
    }

    [Fact]
    public void ReviewPlateSanitization_AllowsFormattedPlateInputWithoutFailing()
    {
        var rawWithSymbols = "51K-888.88";
        var sanitized = rawWithSymbols.Replace("-", "").Replace(".", "").Replace(" ", "").ToUpperInvariant();

        Assert.True(ImageRules.IsNormalizedPlate(sanitized));
        Assert.Equal("51K88888", sanitized);
    }

    [Fact]
    public void ImageRules_ValidatesMagicBytes_ForJpegAndPng()
    {
        // 1. Giả lập Header Magic Bytes chuẩn của ảnh JPEG (FF D8 FF)
        byte[] validJpegBytes = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46];
        Assert.True(ImageRules.IsSupported(validJpegBytes, "image/jpeg"));

        // 2. Giả lập Header Magic Bytes chuẩn của ảnh PNG (89 50 4E 47 0D 0A 1A 0A)
        byte[] validPngBytes = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00];
        Assert.True(ImageRules.IsSupported(validPngBytes, "image/png"));

        // 3. Giả lập file độc hại (.exe hoặc văn bản đổi tên thành .jpg)
        byte[] fakeExeBytes = [0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]; // Chữ ký MZ của file thực thi PE
        Assert.False(ImageRules.IsSupported(fakeExeBytes, "image/jpeg"), "Hệ thống phải từ chối file exe giả mạo đuôi ảnh");
    }

    [Fact]
    public void PythonPlateDetectionResponse_DeserializesLayoutEnrichedResponse()
    {
        var json = """
        {
            "plate_text": "59-P1 678.90",
            "confidence": 0.94,
            "plate_type": "TwoLine",
            "cropped_image_base64": "iVBORw0KGgoAAAANSUhEUgAA",
            "processing_time_ms": 78,
            "status": "valid",
            "format_valid": true,
            "error": null
        }
        """;

        var response = System.Text.Json.JsonSerializer.Deserialize<PythonPlateDetectionResponse>(json, new System.Text.Json.JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        Assert.NotNull(response);
        Assert.Equal("59-P1 678.90", response.PlateText);
        Assert.Equal(0.94, response.Confidence);
        Assert.Equal("TwoLine", response.PlateType);
        Assert.Equal("valid", response.Status);
        Assert.True(response.FormatValid);
        Assert.Equal(78, response.ProcessingTimeMs);
    }
}

