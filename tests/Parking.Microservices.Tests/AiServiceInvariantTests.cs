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
}
