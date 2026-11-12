# 06 - QUY CHUẨN LẬP TRÌNH & QUY TRÌNH PHÁT TRIỂN (CODING & GIT STANDARDS — BASELINE V4)

> Tích hợp tiêu chuẩn C# 13, .NET 9, quy chuẩn phản hồi [APIDesignTemplate.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/Project.CleanArchitecture/docs/APIDesignTemplate.md) và chiến lược quản lý Git [GitlabGuide.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/Project.CleanArchitecture/docs/GitlabGuide.md).

---

## 1. Tiêu chuẩn Ngôn ngữ C# 13 & .NET 9

### 1.1. Cú pháp & Ngôn ngữ Hiện đại
- Dự án sử dụng **.NET 9** và ngôn ngữ **C# 13**.
- Bật bắt buộc kiểm tra Nullable: `<Nullable>enable</Nullable>`.
- Khai báo Namespace theo phạm vi file (File-scoped namespaces):
  ```csharp
  namespace ParkingSystem.Services;
  ```
- Sử dụng Primary Constructors cho Dependency Injection:
  ```csharp
  public class BookingService(
      ParkingDbContext dbContext,
      ILogger<BookingService> logger,
      IPricingEngine pricingEngine) : IBookingService
  {
      // code logic
  }
  ```
- Sử dụng Record types cho các DTOs (Request / Response) bất biến:
  ```csharp
  public record CreateBookingRequest(
      Guid ParkingLotId,
      string VehicleType,
      string NormalizedPlate,
      string PhoneNumber,
      DateTimeOffset StartAt,
      DateTimeOffset EndAt,
      Guid? SlotId = null);
  ```

### 1.2. Khung Phản hồi Chuẩn hóa (ApiResponse<T>)
Mọi API trả về bắt buộc phải sử dụng cấu trúc `ApiResponse<T>`:
```csharp
public class ApiResponse<T>
{
    public T? Result { get; set; }
    public bool IsSuccess { get; set; }
    public int StatusCode { get; set; }
    public string Message { get; set; } = string.Empty;

    public static ApiResponse<T> Success(T result, string message = "Success", int statusCode = 200) =>
        new() { Result = result, IsSuccess = true, StatusCode = statusCode, Message = message };

    public static ApiResponse<T> Failure(string message, int statusCode = 400) =>
        new() { Result = default, IsSuccess = false, StatusCode = statusCode, Message = message };
}
```

---

## 2. Quy chuẩn Kiến trúc & Bảo mật

### 2.1. Phân tách Triệt để DTOs & Domain Entities
- **NGHIÊM CẤM** nhận trực tiếp Entity từ HTTP Request.
- **NGHIÊM CẤM** trả nguyên vẹn Entity ra HTTP Response (đặc biệt là mật khẩu hash, `AuditLogs`, `PhoneNumber` đầy đủ của khách, hoặc `AccessToken` nội bộ).
- Mọi API endpoint nhận vào một `Request` DTO có Data Annotations và trả về một `Response` DTO rõ ràng.

### 2.2. Kiểm soát Phân quyền theo Cơ sở (Facility-Scoped Authorization)
- Khi nhân viên (`Staff`) hoặc quản lý (`Manager`) gọi API thao tác trên một bãi xe, Controller hoặc Service **BẮT BUỘC** phải đối chiếu `ParkingLotId` trong request với quyền của user (được cấp qua bảng `FacilityStaffAssignment`).

### 2.3. Quản lý Giao dịch & Khóa Tuần tự (Transactions & Advisory Locks)
- Thao tác thay đổi trạng thái slot, tạo booking hoặc giải phóng slot bắt buộc phải nằm trong transaction có khóa `pg_advisory_xact_lock`.

---

## 3. Chiến Lược Phân Nhánh Git (Git Branching Strategy theo GitlabGuide)

### 3.1. Các Nhánh Chính và Vai Trò
- **`main` / `master`:** Nhánh Production chính thức, chỉ merge từ các nhánh `release/sprint_<x>`.
- **`develop`:** Nhánh phát triển chung, nhận code từ các nhánh `features` và `hotfix`.
- **`features/Design_<UserStoryName>`:** Nhánh thiết kế (FE: Figma; BE: API Design theo `APIDesignTemplate.md`, diagrams).
- **`features/Implementation_<UserStoryName>`:** Nhánh viết code thực thi và unit tests.
- **`hotfix/Bug_<UserStoryName>`:** Nhánh sửa lỗi nghiêm trọng, sau đó merge vào cả `main` và `develop`.
- **`release/sprint_<x>`:** Nhánh đóng gói tính năng chuẩn bị demo sau mỗi Sprint (ví dụ: `release/sprint_1`).

---

## 4. Tiêu Chuẩn Commit Mã Nguồn (Commit Quality)
- **Rõ ràng & Súc tích:** Mô tả chính xác việc đã làm, ví dụ:
  - `feat: add Haversine nearest parking lot search API`
  - `fix: resolve race condition in slot reservation transaction`
  - `docs: update API Design for gate check-in endpoint`
- **TUYỆT ĐỐI KHÔNG:** Commit mơ hồ như *"Update"*, *"Fix bug"*, *"Edit"* mà không nêu rõ sửa gì.
- **Nguyên tắc Nguyên tử (Atomic Commit):** Mỗi commit chỉ tập trung giải quyết 1 mục tiêu duy nhất (Add Feature, Fix Bug, Refactor, Docs).

---

## 5. Quy Chuẩn Tạo Pull Request (Pull Request & DoD)
Trước khi merge code vào `develop`, lập trình viên phải tạo PR theo mẫu trong [GitlabGuide.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/Project.CleanArchitecture/docs/GitlabGuide.md) và đảm bảo đạt **Definition of Done (DoD)**:
- [ ] Tính năng hoạt động đúng mong đợi và đã qua kiểm thử
- [ ] Code tuân thủ quy chuẩn C# 13, không có cảnh báo linter
- [ ] Đã viết Unit/Integration Tests và toàn bộ tests đều PASS
- [ ] Không chứa bí mật hoặc connection string hardcoded
- [ ] Đã cập nhật tài liệu API và sơ đồ diagrams tương ứng
- [ ] Pipeline CI/CD build thành công
- [ ] Code đã được review và phê duyệt bởi thành viên trong nhóm
