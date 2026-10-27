using System.Text;

namespace Parking.Parking.Domain;

// Dùng cùng một quy tắc cho validation và đối chiếu biển số khi check-in.
public static class PlateNumber
{
    /// <summary>
    /// Chuẩn hóa về A–Z/0–9, bỏ khoảng trắng, dấu gạch và chấm.
    /// Từ chối đầu vào rỗng, quá dài hoặc có ký tự khác; đây không phải bộ kiểm tra mọi định dạng biển số quốc gia.
    /// </summary>
    public static bool TryNormalize(string? value, out string normalized)
    {
        normalized = string.Empty;
        if (string.IsNullOrWhiteSpace(value) || value.Length > 40)
        {
            return false;
        }

        var result = new StringBuilder();
        foreach (var character in value.ToUpperInvariant())
        {
            if (character is >= 'A' and <= 'Z' or >= '0' and <= '9')
            {
                result.Append(character);
            }
            else if (character is not (' ' or '-' or '.'))
            {
                return false;
            }
        }

        normalized = result.ToString();
        return normalized.Length is >= 1 and <= 20;
    }
}
