# THIẾT KẾ API: VNPAY-QR ĐỘNG & THANH TOÁN TIỀN MẶT BỐT TRỰC KÈM E-RECEIPT (SCRUM-72 [S3-06])

- **Mã User Story:** `SCRUM-72` | Phân hệ: `[S3-06][TV7 Sơn][P0]`
- **Sprint:** SCRUM Sprint 3
- **Owner:** TV7 Sơn (Payment & Pricing)
- **Phối hợp liên kết:** TV4 Tiến (Staff UI - Bốt trực), TV6 Hàn (Check-out & Mở barrier cổng ra)
- **Trạng thái:** Design Phase (Chuẩn theo APIDesignTemplate.md)

---

## 1. Overview (Tổng quan Nghiệp vụ)

Tài liệu này đặc tả toàn diện các API thuộc phân hệ thanh toán tại cổng và bốt trực:
1. **API 1 - Sinh mã VNPay-QR động (`Create VNPay-QR`):** Sinh mã QR thanh toán động theo đơn đặt xe, chứa số tiền đã tính từ Pricing Engine (S3-05), mã giao dịch tham chiếu duy nhất, thời hạn quét đúng **5 phút** khớp với thời gian giữ chỗ (`Hold Policy - BR-08`). **Được xác thực quyền tài khoản qua gRPC Identity Service**.
2. **API 2 - Webhook IPN Server-to-Server (`VNPay IPN Callback`):** Tiếp nhận callback tự động từ máy chủ VNPay, áp dụng **5 Lớp Xác minh Thép** (chữ ký số HMAC-SHA512, đối soát số tiền x100, kiểm tra trạng thái Idempotency, ghi sự kiện Outbox nguyên tử).
3. **API 3 - Điều hướng Trình duyệt (`VNPay Return URL`):** Đón trình duyệt của khách hàng quay về sau khi thanh toán trên cổng VNPay, chỉ đọc kết quả để hiển thị giao diện, không ghi Database.
4. **API 4 - Xác nhận Tiền mặt tại Bốt (`Confirm Cash Payment`):** Nhân viên bốt trực xác nhận thu tiền mặt, **bắt buộc kiểm tra quyền bốt trực qua gRPC Identity Service (`Facility-Scoped RBAC - BR-01`)**, ghi nhận `UserId` nhân viên thu (`collected_by`).
5. **API 5 - Xuất Hóa đơn Điện tử (`Get E-Receipt`):** Cung cấp mã giao dịch và xuất biên lai điện tử (E-Receipt) sau khi thanh toán thành công (dù là VNPay hay Tiền mặt), kèm mã xác thực số để nhân viên bốt hoặc hệ thống barrier đối soát cho xe xuất bãi.

---

## 2. Đặc Tả Kỹ Thuật Chi Tiết Các API Endpoints

### 2.1. API 1: Sinh mã VNPay-QR động cho đơn gửi xe
- **HTTP Method:** `POST`
- **URL Endpoint:** `/api/v1/payments/vnpay/create-qr`
- **Permission:** Customer / Guest
- **Xác thực qua gRPC Identity:** Gọi `identity.CheckAccessAsync(UserId, Capability = "USER")`. *(Cơ chế Graceful Fallback: nếu gRPC Identity offline cục bộ, đọc an toàn từ JWT Claims)*.
- **Header:** `Idempotency-Key` (bắt buộc, chuỗi ngẫu nhiên tối đa 128 ký tự để chống bấm đúp 2 lần)

#### Request Body Sample:
```json
{
  "bookingId": "c9a01234-5678-90ab-cdef-1234567890ab"
}
```

#### Response Body Sample (`200 OK` - Bọc trong `ApiResponse<PaymentQrResultDto>`):
```json
{
  "result": {
    "paymentId": "f1e2d3c4-b5a6-7890-1234-567890abcdef",
    "bookingId": "c9a01234-5678-90ab-cdef-1234567890ab",
    "amount": 45000,
    "currency": "VND",
    "merchantTxnRef": "a1b2c3d4e5f678901234567890abcdef",
    "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=4500000&vnp_Command=pay&vnp_CreateDate=20261027110000&vnp_CurrCode=VND&vnp_ExpireDate=20261027110500&vnp_IpAddr=127.0.0.1&vnp_Locale=vn&vnp_OrderInfo=Thanh+toan+giu+cho&vnp_OrderType=other&vnp_ReturnUrl=https%3A%2F%2Fdomain%2Freturn&vnp_TmnCode=LDWHY5M9&vnp_TxnRef=a1b2c3d4e5f678901234567890abcdef&vnp_Version=2.1.0&vnp_SecureHash=7a8b9c...",
    "qrPayload": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=4500000...",
    "expiresAt": "2026-10-27T11:05:00Z"
  },
  "isSuccess": true,
  "statusCode": 200,
  "message": "Dynamic VNPay-QR generated successfully. Valid for 5 minutes."
}
```

---

### 2.2. API 2: Tiếp nhận Webhook IPN từ VNPay (Server-to-Server)
- **HTTP Method:** `GET`
- **URL Endpoint:** `/api/v1/payments/vnpay/ipn`
- **Permission:** Anonymous / Public (Máy chủ ngân hàng VNPay gọi trực tiếp, không mang JWT Token)
- **Cơ chế xác thực:** Băm mật mã học `HMAC-SHA512` kiểm tra `vnp_SecureHash`

#### Response Định Dạng Chuẩn VNPay (Bắt buộc theo chuẩn cổng thanh toán):
```json
{
  "RspCode": "00",
  "Message": "Confirm Success"
}
```
*(Các mã lỗi trả về cho VNPay: `01` - Order not found; `02` - Order already confirmed; `04` - Invalid amount; `97` - Invalid signature).*

---

### 2.3. API 3: Trang điều hướng người dùng (Return URL)
- **HTTP Method:** `GET`
- **URL Endpoint:** `/api/v1/payments/vnpay/return`
- **Permission:** Public
- **Cơ chế:** Kiểm tra chữ ký số HMAC-SHA512, giải mã kết quả giao dịch và trả về cho giao diện Frontend hiển thị:

```json
{
  "result": {
    "isSuccess": true,
    "txnRef": "a1b2c3d4e5f678901234567890abcdef",
    "amount": 45000,
    "bankCode": "NCB",
    "transactionNo": "14567890",
    "responseCode": "00"
  },
  "isSuccess": true,
  "statusCode": 200,
  "message": "Payment completed successfully. Parking spot confirmed."
}
```

---

### 2.4. API 4: Nhân viên Bốt Trực Xác Nhận Thu Tiền Mặt (CASH)
- **HTTP Method:** `POST`
- **URL Endpoint:** `/api/v1/payments/cash/confirm`
- **Permission:** `PARKING_STAFF` hoặc `PARKING_MANAGER`
- **Xác thực qua gRPC Identity (Bắt buộc):** Gọi `identity.CheckAccessAsync(StaffId, LotId, Capability = "CASH")`. Nếu nhân viên không thuộc bãi đỗ xe này -> Quăng lỗi **`403 Forbidden`** (Wrong-lot RBAC theo `BR-01`).

#### Request Body Sample:
```json
{
  "bookingId": "c9a01234-5678-90ab-cdef-1234567890ab",
  "staffReason": "Khách thanh toán tiền mặt tại bốt barrier cổng OUT",
  "version": 1
}
```

#### Response Body Sample (`200 OK` - Bọc trong `ApiResponse<ConfirmCashPaymentResultDto>`):
```json
{
  "result": {
    "paymentId": "f1e2d3c4-b5a6-7890-1234-567890abcdef",
    "status": "Success",
    "confirmedBy": "staff_01",
    "confirmedAt": "2026-10-27T11:02:15Z"
  },
  "isSuccess": true,
  "statusCode": 200,
  "message": "CASH payment confirmed. Receipt is being generated."
}
```

---

### 2.5. API 5: Tra cứu Hóa đơn Điện tử (E-Receipt)
- **HTTP Method:** `GET`
- **URL Endpoint:** `/api/v1/payments/{paymentId}/receipt`
- **Permission:** Customer (chủ xe) hoặc `PARKING_STAFF` / `PARKING_MANAGER`

#### Response Body Sample (`200 OK` - Bọc trong `ApiResponse<EReceiptDto>`):
```json
{
  "result": {
    "receiptNumber": "REC-20261027-8F9A",
    "paymentId": "f1e2d3c4-b5a6-7890-1234-567890abcdef",
    "bookingId": "c9a01234-5678-90ab-cdef-1234567890ab",
    "lotName": "Bãi đỗ xe Trung tâm Quận 1",
    "plateNumber": "30H-888.88",
    "paymentMethod": "VNPAY",
    "totalAmount": 45000,
    "currency": "VND",
    "paidAt": "2026-10-27T11:02:15Z",
    "collectedByStaff": null,
    "bankTransactionNo": "14567890",
    "verificationHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  },
  "isSuccess": true,
  "statusCode": 200,
  "message": "Electronic receipt retrieved successfully."
}
```

---

## 3. Danh Mục Mã Lỗi Chuẩn Hóa (Validation & Error Codes)

| HTTP Status | Nguyên nhân lỗi | Thông điệp trả về (`ApiResponse.Message`) |
| :---: | :--- | :--- |
| **400** | Thiếu Idempotency-Key hoặc BookingId rỗng | `Booking ID and Idempotency-Key header are required.` |
| **403** | Tài khoản không hợp lệ hoặc Nhân viên thu tiền nhầm bãi (Wrong-lot RBAC qua gRPC Identity) | `Forbidden. Staff is not assigned to this parking facility or user account unavailable.` |
| **404** | Không tìm thấy đơn thanh toán hoặc đơn đặt chỗ | `Payment record or booking not found.` |
| **409** | Xung đột Idempotency hoặc đơn đã thanh toán trước đó | `Payment already confirmed or idempotency key reused with different parameters.` |
| **422** | Xung đột phiên bản dữ liệu Concurrency | `Concurrency version mismatch. Please reload transaction state.` |
| **503** | Mất kết nối Database hoặc cổng VNPay không phản hồi | `Service temporarily unavailable. Please retry shortly.` |

---

## 4. Sơ Đồ Thiết Kế Trực Quan (Diagrams)

### 4.1. Activity Diagram: Luồng Tạo QR / Thu Tiền Mặt ➔ Xác Thực Identity ➔ IPN ➔ E-Receipt
```mermaid
flowchart TD
    Start([Khách tới cổng ra / bấm thanh toán]) --> ChooseMethod{Khách chọn phương thức?}
    
    ChooseMethod -- VNPay-QR --> ReqQR[Gửi POST /api/v1/payments/vnpay/create-qr]
    ReqQR --> CheckUserIdentity{gRPC Identity: Tài khoản hợp lệ?}
    CheckUserIdentity -- Không --> Ret403User[Trả 403 Forbidden - Tài khoản bị khóa]
    CheckUserIdentity -- Có --> GetQuote[Payment gọi gRPC Parking lấy Báo Giá Thật]
    GetQuote --> GenHMAC[Tạo chữ ký HMAC-SHA512 + Hạn 5 phút]
    GenHMAC --> SaveAttempt[Lưu payment_attempts trạng thái INITIATED]
    SaveAttempt --> ReturnQR[Trả URL & QrPayload về cho FE hiển thị]
    
    ReturnQR --> ScanPay[Khách quét mã QR trên App Ngân hàng]
    ScanPay --> VNPayIPN[Máy chủ VNPay bắn Webhook IPN sang Backend]
    
    VNPayIPN --> ValSig{Lớp 1: Chữ ký HMAC-SHA512 có hợp lệ?}
    ValSig -- Sai --> Ret97[Trả RspCode: 97 - Invalid Signature]
    ValSig -- Đúng --> FindTxn{Lớp 2: Có tìm thấy giao dịch TxnRef?}
    FindTxn -- Không --> Ret01[Trả RspCode: 01 - Order Not Found]
    FindTxn -- Có --> ValAmount{Lớp 3: Số tiền gửi về khớp với DB?}
    ValAmount -- Không khớp --> Ret04[Trả RspCode: 04 - Invalid Amount]
    ValAmount -- Khớp --> CheckIdem{Lớp 4: Giao dịch đã xử lý trước đó chưa?}
    CheckIdem -- Đã SUCCESS --> Ret02[Trả RspCode: 02 - Order Already Confirmed]
    
    CheckIdem -- Chưa --> BeginTx[Mở Database Transaction]
    BeginTx --> UpdateStatus[Cập nhật payments & attempts = SUCCESS]
    UpdateStatus --> WriteOutbox[Ghi Event PaymentSucceeded.v1 vào Outbox]
    WriteOutbox --> GenReceipt[Tạo bản ghi E-Receipt]
    GenReceipt --> CommitTx[Commit Transaction]
    CommitTx --> Ret00[Trả RspCode: 00 cho VNPay]
    
    ChooseMethod -- Tiền mặt (CASH) --> StaffConfirm[Nhân viên bấm POST /payments/cash/confirm]
    StaffConfirm --> CheckStaffIdentity{gRPC Identity: Staff có quyền CASH tại Lot?}
    CheckStaffIdentity -- Không có quyền --> Ret403Staff[Trả lỗi 403 Forbidden - Sai Bãi]
    CheckStaffIdentity -- Hợp lệ --> BeginCashTx[Mở Database Transaction]
    BeginCashTx --> UpdateCashStatus[Cập nhật Status=SUCCESS, collected_by=StaffId]
    UpdateCashStatus --> WriteOutbox
    
    CommitTx --> OutboxSend[OutboxWorker bắn gRPC xác nhận sang Parking]
    OutboxSend --> OpenBarrier([Parking mở barrier cổng ra & Giải phóng xe])
```

---

### 4.2. Sequence Diagram: Tương tác Tuần tự Bao Gồm Cả Identity Service (gRPC)
```mermaid
sequenceDiagram
    autonumber
    actor Customer as Khách hàng
    actor Staff as Nhân viên Bốt Trực
    participant Ctrl as PaymentsController
    participant MediatR as MediatR Pipeline
    participant Svc as PaymentService
    participant Identity as Identity Service (gRPC)
    participant Parking as Parking Service (gRPC)
    participant VNPaySvc as VnPayService (Crypto)
    participant DB as PostgreSQL 17

    %% Luồng 1: Tạo VNPay-QR
    Note over Customer, Parking: LUỒNG 1: SINH MÃ VNPAY-QR ĐỘNG
    Customer->>Ctrl: POST /api/v1/payments/vnpay/create-qr (bookingId)
    activate Ctrl
    Ctrl->>MediatR: Send(CreatePaymentQrCommand)
    activate MediatR
    MediatR->>Svc: CreatePaymentQrAsync()
    activate Svc

    Svc->>Identity: gRPC CheckAccessAsync(UserId, Capability="USER")
    activate Identity
    Identity-->>Svc: AccessReply(Allowed=true)
    deactivate Identity

    Svc->>Parking: gRPC GetQuoteAsync(bookingId)
    activate Parking
    Parking-->>Svc: QuoteResult(amount, lotId, currency)
    deactivate Parking

    Svc->>VNPaySvc: CreatePaymentUrl(txnRef, amount, expire5m)
    activate VNPaySvc
    VNPaySvc-->>Svc: paymentUrl kèm HMAC-SHA512
    deactivate VNPaySvc

    Svc->>DB: INSERT payments (PENDING) & payment_attempts (INITIATED)
    Svc-->>MediatR: PaymentQrResultDto
    deactivate Svc
    MediatR-->>Ctrl: Result
    deactivate MediatR
    Ctrl-->>Customer: 200 OK (ApiResponse<PaymentQrResultDto>)
    deactivate Ctrl

    %% Luồng 2: Xác nhận Tiền mặt (CASH) tại Bốt
    Note over Staff, Identity: LUỒNG 2: XÁC NHẬN TIỀN MẶT BỐT TRỰC (FACILITY-SCOPED RBAC)
    Staff->>Ctrl: POST /api/v1/payments/cash/confirm (bookingId, reason, version)
    activate Ctrl
    Ctrl->>MediatR: Send(ConfirmCashPaymentCommand)
    activate MediatR
    MediatR->>Svc: ConfirmCashAsync(staffId, lotId)
    activate Svc

    Svc->>Identity: gRPC CheckAccessAsync(StaffId, LotId, Capability="CASH")
    activate Identity
    alt Staff không được gán quyền bãi này
        Identity-->>Svc: AccessReply(Allowed=false)
        Svc-->>MediatR: Throw ForbiddenException(403)
        MediatR-->>Ctrl: 403 Forbidden (Wrong-lot RBAC)
        Ctrl-->>Staff: 403 Forbidden (Không có quyền tại bãi này)
    else Hợp lệ
        Identity-->>Svc: AccessReply(Allowed=true)
        deactivate Identity
        Svc->>DB: UPDATE payments SET status='SUCCESS', collected_by=StaffId
        Svc->>DB: INSERT INTO integration_outbox (PaymentSucceeded.v1)
        Svc-->>MediatR: ConfirmCashPaymentResultDto
        MediatR-->>Ctrl: Result
        Ctrl-->>Staff: 200 OK (ApiResponse<ConfirmCashPaymentResultDto>)
    end
    deactivate Svc
    deactivate MediatR
    deactivate Ctrl

    %% Luồng 3: Webhook IPN từ VNPay
    Note over Customer, VNPaySvc: LUỒNG 3: TIẾP NHẬN WEBHOOK IPN TỪ VNPAY
    participant VNPayServer as VNPay Cloud Server
    VNPayServer->>Ctrl: GET /api/v1/payments/vnpay/ipn (params, vnp_SecureHash)
    activate Ctrl
    Ctrl->>Svc: HandleVnPayIpnAsync(queryParams)
    activate Svc

    Svc->>VNPaySvc: ValidateSignature(queryParams, hash)
    VNPaySvc-->>Svc: true (Chữ ký hợp lệ)

    Svc->>DB: BEGIN TRANSACTION (Advisory Lock)
    Svc->>DB: UPDATE payments = SUCCESS, payment_attempts = SUCCESS
    Svc->>DB: INSERT INTO integration_outbox (PaymentSucceeded.v1)
    Svc->>DB: COMMIT TRANSACTION

    Svc-->>Ctrl: VnPayIpnResult("00", "Confirm Success")
    deactivate Svc
    Ctrl-->>VNPayServer: 200 OK ({"RspCode":"00","Message":"Confirm Success"})
    deactivate Ctrl

    %% Luồng 4: Tra cứu E-Receipt
    Note over Customer, DB: LUỒNG 4: XUẤT HÓA ĐƠN ĐIỆN TỬ E-RECEIPT
    Customer->>Ctrl: GET /api/v1/payments/{paymentId}/receipt
    activate Ctrl
    Ctrl->>MediatR: Send(GetPaymentReceiptQuery)
    activate MediatR
    MediatR->>DB: SELECT invoice details + audit
    DB-->>MediatR: Receipt Data
    MediatR-->>Ctrl: EReceiptDto
    deactivate MediatR
    Ctrl-->>Customer: 200 OK (ApiResponse<EReceiptDto>)
    deactivate Ctrl
```
