namespace Parking.Parking.Domain;

// Quy tắc biển số dùng cho validation và đối chiếu xe, không phụ thuộc HTTP/DB.
public static class PlateNumber
{
    public static bool TryNormalize(string? value, out string normalized)
    {
        normalized = string.Empty;
        if (string.IsNullOrWhiteSpace(value) || value.Length > 40) return false;
        var result = new System.Text.StringBuilder();
        foreach (var character in value.ToUpperInvariant())
        {
            if (character is >= 'A' and <= 'Z' or >= '0' and <= '9') result.Append(character);
            else if (character is not (' ' or '-' or '.')) return false;
        }
        normalized = result.ToString();
        return normalized.Length is >= 1 and <= 20;
    }
}
