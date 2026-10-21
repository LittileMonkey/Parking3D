using System.Text.RegularExpressions;

namespace Parking.AI.Domain;

/// <summary>
/// Lớp tiện ích cung cấp các quy tắc xác thực hình ảnh nhị phân và chuẩn hóa biển số xe.
/// Sử dụng các kỹ thuật tối ưu hóa hiệu năng cao của C# (.NET 9): ReadOnlySpan, Magic Bytes và Source-Generated Regex.
/// </summary>
public static partial class ImageRules
{
    /// <summary>
    /// Giới hạn dung lượng tối đa cho 1 ảnh tải lên hệ thống: 4MB (4 * 1024 * 1024 bytes).
    /// Mục đích: Ngăn chặn tấn công làm tràn bộ nhớ đệm (Buffer Overflow / Denial of Service).
    /// </summary>
    public const int MaxImageBytes = 4 * 1024 * 1024;

    /// <summary>
    /// Kiểm tra tính hợp lệ của ảnh đầu vào dựa trên chữ ký nhị phân (Magic Bytes) thực tế thay vì chỉ tin tưởng đuôi mở rộng của file.
    /// </summary>
    /// <param name="image">
    /// Vùng nhớ nhị phân biểu diễn dữ liệu file ảnh.
    /// Thư viện: <see cref="ReadOnlySpan{T}"/> trong System là cấu trúc bộ nhớ dạng ref struct hiệu năng cao,
    /// cho phép đọc mảng byte trực tiếp mà không cần phân bổ thêm bộ nhớ trên Heap (Zero-allocation).
    /// </param>
    /// <param name="contentType">Chuỗi MIME type do client gửi lên (VD: "image/png", "image/jpeg").</param>
    /// <returns>True nếu file đúng chuẩn định dạng PNG hoặc JPEG và dung lượng hợp lệ; ngược lại trả về False.</returns>
    public static bool IsSupported(ReadOnlySpan<byte> image, string contentType) =>
        image.Length is >= 8 and <= MaxImageBytes && (contentType switch
        {
            // Định dạng PNG: 8 byte đầu tiên trong file luôn luôn là chữ ký cố định:
            // Hệ thập lục phân: 89 50 4E 47 0D 0A 1A 0A
            // Hệ thập phân: 137, 80, 78, 71, 13, 10, 26, 10
            "image/png" => image[..8].SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),

            // Định dạng JPEG / JPG: 3 byte đầu tiên là dấu hiệu bắt đầu ảnh (Start of Image - SOI Marker):
            // Hệ thập lục phân: FF D8 FF
            // Hệ thập phân: 255, 216, 255
            "image/jpeg" => image[0] == 255 && image[1] == 216 && image[2] == 255,

            // Các định dạng khác (GIF, BMP, WEBP, script giả mạo...) đều bị từ chối
            _ => false
        });

    /// <summary>
    /// Kiểm tra biển số xe có thỏa mãn quy chuẩn lưu trữ CSDL hay không.
    /// Chuẩn lưu trữ: Chỉ chứa ký tự chữ hoa từ A-Z và chữ số từ 0-9, độ dài từ 1 đến 20 ký tự (không dấu gạch nối, không dấu chấm).
    /// </summary>
    /// <param name="plate">Chuỗi biển số cần kiểm tra (VD: "51K88888").</param>
    /// <returns>True nếu chuỗi biển số hợp lệ theo ràng buộc CHECK CSDL.</returns>
    public static bool IsNormalizedPlate(string plate) => !string.IsNullOrEmpty(plate) && PlatePattern().IsMatch(plate);

    /// <summary>
    /// Biểu thức chính quy (Regex) kiểm tra định dạng biển số xe chuẩn hóa: ^[A-Z0-9]{1,20}$
    /// Thư viện: <see cref="GeneratedRegexAttribute"/> (.NET 7+) là Source Generator biên dịch Regex trước lúc Build,
    /// sinh mã C# thuần tối ưu, thay vì thông dịch lúc chạy, giúp kiểm tra biểu thức siêu tốc và không cấp phát thêm bộ nhớ.
    /// </summary>
    [GeneratedRegex("^[A-Z0-9]{1,20}$")]
    private static partial Regex PlatePattern();
}

