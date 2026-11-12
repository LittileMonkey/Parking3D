using System.Text.RegularExpressions;

namespace Parking.AI.Domain;

public static partial class ImageRules
{
    public const int MaxImageBytes = 4 * 1024 * 1024;
    public static bool IsSupported(ReadOnlySpan<byte> image, string contentType) =>
        image.Length is >= 8 and <= MaxImageBytes && (contentType switch
        {
            "image/png" => image[..8].SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
            "image/jpeg" => image[0] == 255 && image[1] == 216 && image[2] == 255,
            _ => false
        });
    public static bool IsNormalizedPlate(string plate) => !string.IsNullOrEmpty(plate) && PlatePattern().IsMatch(plate);
    [GeneratedRegex("^[A-Z0-9]{1,20}$")]
    private static partial Regex PlatePattern();
}
