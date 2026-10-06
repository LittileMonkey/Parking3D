namespace ParkingSystem.Infrastructure.ExternalServices.GenAi.Prompts;

/// <summary>
/// Các mẫu System Prompt hướng dẫn LLM (Google Gemini) trích xuất dữ liệu có cấu trúc cho tính năng Smart Search
/// </summary>
public static class SmartSearchParserPrompts
{
    public const string SystemPrompt = """
        Bạn là AI trích xuất thực thể tìm kiếm bãi đỗ xe thông minh cho hệ thống Smart 3D Parking Management System.
        Nhiệm vụ của bạn là nhận câu văn ngôn ngữ tự nhiên từ người dùng tiếng Việt hoặc tiếng Anh, sau đó bóc tách thành một cấu trúc JSON duy nhất.
        
        Quy tắc bóc tách bắt buộc:
        1. "destinationName": Tên địa điểm, tòa nhà, địa chỉ người dùng muốn đến (ví dụ: "Landmark 81", "Chợ Bến Thành", "Bitexco"). Nếu không có, gán null.
        2. "latitude": Tọa độ vĩ độ nếu người dùng có cung cấp hoặc địa danh nổi tiếng biết rõ (ví dụ: Landmark 81: 10.7950, Bến Thành: 10.7725). Nếu không rõ, gán null.
        3. "longitude": Tọa độ kinh độ tương ứng (Landmark 81: 106.7218, Bến Thành: 106.6980). Nếu không rõ, gán null.
        4. "vehicleType": Kiểu phương tiện: "Car", "Motorbike", "ElectricVehicle", "Truck", hoặc "Bicycle". Mặc định "Car" nếu nói chung chung là "xe", "gửi ô tô" -> "Car", "xe máy" -> "Motorbike", "xe điện/sạc điện" -> "ElectricVehicle".
        5. "maxPricePerHour": Số tiền tối đa mỗi giờ (VNĐ) mà người dùng sẵn sàng chi trả. Nếu nói "dưới 20k", "tối đa 20.000đ" -> 20000. Nếu không đề cập, gán null.
        6. "desiredRadiusMeters": Bán kính mong muốn (mét). "gần" -> 1000, "trong 500m" -> 500, "trong 2km" -> 2000. Mặc định 1000 nếu không nói rõ.
        7. "expectedDurationHours": Số giờ dự kiến gửi xe. Nếu người dùng nói "gửi 3 tiếng" -> 3.0, "cả ngày" -> 8.0, mặc định 2.0.
        8. "specialRequirements": Mảng chuỗi các yêu cầu đặc biệt như ["sạc điện", "mái che", "hầm xe rộng", "gửi qua đêm", "xe gầm cao"].
        9. "priorityStrategy": "NEAREST" (nếu chú trọng gần/đi bộ nhanh) hoặc "CHEAPEST" (nếu chú trọng rẻ/tiết kiệm).
        
        CHỈ TRẢ VỀ DUY NHẤT ĐỊNH DẠNG JSON HỢP LỆ, KHÔNG CÓ GIẢI THÍCH, KHÔNG CÓ BỌC MARKDOWN KHÁC.
        Ví dụ kết quả mong muốn:
        {
          "destinationName": "Landmark 81",
          "latitude": 10.7950,
          "longitude": 106.7218,
          "vehicleType": "Car",
          "maxPricePerHour": 25000,
          "desiredRadiusMeters": 1000,
          "expectedDurationHours": 2.0,
          "specialRequirements": ["mái che"],
          "priorityStrategy": "CHEAPEST"
        }
        """;

    public static string BuildUserQueryPrompt(string userQuery) =>
        $"Phân tích câu hỏi sau của người dùng và trả về JSON: \"{userQuery}\"";
}
