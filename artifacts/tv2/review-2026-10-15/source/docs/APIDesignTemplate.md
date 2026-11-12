# HƯỚNG DẪN THIẾT KẾ API (API DESIGN TEMPLATE)

Tài liệu này định nghĩa cấu trúc chuẩn bắt buộc khi thiết kế một API endpoint mới cho hệ thống (đặc biệt áp dụng cho nhánh `features/Design_<UserStoryName>`).

---

## 1. Cấu Trúc Tổng Quan Thiết Kế API

Mỗi tài liệu thiết kế API phải bao gồm đầy đủ 6 phần:
1. **Overview (Tổng quan):** Mô tả mục đích và vai trò của API.
2. **API Specification (Đặc tả kỹ thuật):** HTTP Method, Endpoint URL, Phân quyền truy cập (Permission).
3. **Request Sample:** JSON Body mẫu và Bảng mô tả chi tiết từng trường dữ liệu.
4. **Response Sample:** Cấu trúc phản hồi chuẩn (`ApiResponse<T>`).
5. **Validation & Error Handling:** Danh sách mã lỗi, thông báo lỗi cụ thể cho từng trường hợp vi phạm.
6. **Diagrams:** Activity Diagram (Luồng hoạt động) & Sequence Diagram (Trình tự tương tác giữa các tầng Controller, Service, Database).

---

## 2. Quy Chuẩn Khung Phản Hồi Chuẩn (Standard API Response Envelope)

Mọi API của hệ thống bắt buộc phải bọc dữ liệu trả về theo cấu trúc `ApiResponse<T>`:

### 2.1. Phản hồi Thành công (Success Response — 200/201)
```json
{
  "result": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "d7a1c883-12ab-4c34-8be0-3b4c5d6e7f8a"
  },
  "isSuccess": true,
  "statusCode": 200,
  "message": "Sign in successfully"
}
```

### 2.2. Phản hồi Lỗi Kiểm tra Dữ liệu (Validation Error — 400)
```json
{
  "result": null,
  "isSuccess": false,
  "statusCode": 400,
  "message": "userName is missing."
}
```

### 2.3. Phản hồi Sai Thông tin Xác thực (Authentication Error — 400 / 401)
```json
{
  "result": null,
  "isSuccess": false,
  "statusCode": 400,
  "message": "Incorrect username or password. Try again."
}
```

---

## 3. Ví Dụ Mẫu Hoàn Chỉnh (Sample: User Login API)

### 3.1. Overview
API cho phép người dùng đăng nhập vào hệ thống bằng tài khoản và mật khẩu, trả về JWT Access Token và Refresh Token nếu xác thực thành công.

### 3.2. API Specification
- **Method:** `POST`
- **URL:** `/api/v1/auth/login`
- **Permission:** Public / Anonymous (`N/A`)

### 3.3. Request Sample
```json
{
  "userName": "johndoe",
  "password": "Password@123"
}
```

**Bảng Đặc tả Dữ liệu Đầu vào (Fields):**

| Field | Description | Data Type | Required | Examples |
| :--- | :--- | :--- | :---: | :--- |
| `userName` | Tên đăng nhập tài khoản người dùng | `string` | Có | `"johndoe"` |
| `password` | Mật khẩu tài khoản người dùng | `string` | Có | `"Password@123"` |

### 3.4. Response Sample
```json
{
  "result": {
    "accessToken": "eyJhbGciOiJIUzI1Ni...",
    "refreshToken": "d7a1c883-12ab..."
  },
  "isSuccess": true,
  "statusCode": 200,
  "message": "Sign in successfully"
}
```

### 3.5. Validation & Error Codes

| Status Code | Description | Response Body Example |
| :---: | :--- | :--- |
| **400** | Thiếu trường username | `{"result": null, "isSuccess": false, "statusCode": 400, "message": "userName is missing."}` |
| **400** | Thiếu trường password | `{"result": null, "isSuccess": false, "statusCode": 400, "message": "password is missing."}` |
| **400** | Sai username hoặc password | `{"result": null, "isSuccess": false, "statusCode": 400, "message": "Incorrect username or password. Try again."}` |

---

### 3.6. Activity Diagram (Sơ đồ Luồng Hoạt động)

```mermaid
flowchart TD
    Start([Người dùng nhập Username & Password]) --> ClickLogin[Người dùng nhấn nút Login]
    ClickLogin --> ValidateReq{Kiểm tra tính hợp lệ của Request}
    
    ValidateReq -- Không hợp lệ --> ShowError[Trả về thông báo lỗi 400]
    ShowError --> EndFail([Kết thúc])
    
    ValidateReq -- Hợp lệ --> QueryDB[Truy vấn Database kiểm tra tài khoản]
    QueryDB --> CheckCred{Khớp tài khoản & mật khẩu?}
    
    CheckCred -- Không khớp --> AuthError[Trả về thông báo sai tài khoản/mật khẩu]
    AuthError --> EndFail
    
    CheckCred -- Khớp --> GenToken[Tạo JWT Access Token & Refresh Token]
    GenToken --> SaveToken[Lưu Refresh Token và gán Expire Time]
    SaveToken --> ReturnSuccess[Trả về kết quả thành công 200 kèm Token]
    ReturnSuccess --> EndSuccess([Đăng nhập thành công])
```

---

### 3.7. Sequence Diagram (Sơ đồ Trình tự Tương tác)

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Client
    participant Controller as AuthController
    participant Service as AuthService
    participant DB as Database (PostgreSQL)

    User->>Controller: POST /api/v1/auth/login (userName, password)
    activate Controller
    Controller->>Controller: Validate Model State

    alt Validation Thất bại
        Controller-->>User: 400 Bad Request (Validation Error)
    else Validation Hợp lệ
        Controller->>Service: LoginAsync(request)
        activate Service
        Service->>DB: FindUserByUsername(userName)
        activate DB
        DB-->>Service: User Record / Null
        deactivate DB

        alt Sai thông tin đăng nhập
            Service-->>Controller: LoginFailedException ("Incorrect username or password")
            Controller-->>User: 400 Bad Request ("Incorrect username or password")
        else Thông tin hợp lệ
            Service->>Service: Verify Password Hash (BCrypt/Argon2)
            Service->>Service: Generate JWT AccessToken & RefreshToken
            Service->>DB: Save RefreshToken(userId, token, expiry)
            activate DB
            DB-->>Service: Saved OK
            deactivate DB
            Service-->>Controller: LoginResult(tokens)
            deactivate Service
            Controller-->>User: 200 OK (isSuccess: true, tokens)
        end
    end
    deactivate Controller
```
