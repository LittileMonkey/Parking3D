# Hoàn thiện OTP, MFA, hoàn tiền, grace và thông báo — 12/11/2026

Trạng thái: đã triển khai mã nguồn; chưa build, chạy migration, chạy Docker, thử SMTP/VNPay hoặc nghiệm thu giao diện trong đợt sửa này, theo yêu cầu chỉ rà soát/sửa source. Kết quả kiểm thử cũ không chứng minh các thay đổi mới hoạt động.

## Phạm vi và quyết định nghiệp vụ

- Guest OTP xác minh email rồi tạo/đăng nhập tài khoản CUSTOMER, dùng luồng đặt chỗ có chủ sở hữu hiện hành. Không tạo booking vô danh. Tài khoản nhân viên phải dùng đăng nhập nhân viên. OTP hiệu lực 5 phút, gửi lại sau 60 giây, sai 3 lần khóa 15 phút. SMTP lỗi sẽ không trả thành công giả.
- MFA TOTP tùy chọn: setup cần mật khẩu hiện tại, xác nhận mã trước khi bật, áp dụng trước khi cấp token đăng nhập thường/Google/guest. Khóa bí mật mã hóa AES-GCM bằng MFA_ENCRYPTION_KEY riêng, chống dùng lại mã. Bật/tắt thu hồi refresh token; access token cũ còn hiệu lực đến hết hạn. Chưa có recovery codes hoặc quy trình phục hồi MFA mất thiết bị. Tài khoản OTP/Google chưa có mật khẩu dùng quên mật khẩu trước khi cấu hình MFA.
- Hoàn tiền: booking CANCELLED đủ điều kiện theo journal hoặc EXPIRED đã thu tiền; kiểm tra owner/manager qua gRPC. Số tiền yêu cầu cộng các yêu cầu đang chờ không vượt tiền đã thu. Idempotency key gắn actor và nội dung. CASH chỉ hoàn tất khi manager đúng bãi ghi nhận chứng từ thực trả.
- VNPay: lưu payload ký trước khi gửi; chỉ ghi SUCCESS khi chữ ký và trường giao dịch khớp. Timeout, mất phản hồi hoặc thiếu metadata chuyển RECONCILIATION_REQUIRED, giữ số tiền đang chờ và không tự gửi lại. Manager có thể nộp phản hồi hoàn tiền gốc có chữ ký để đối soát. Chưa có tự động querydr, cơ chế tự kết luận thất bại hay tự retry tiền thật. Giao dịch cũ thiếu ngày tạo/reference cần đối soát thủ công.
- Grace mặc định 15 phút, tối đa một lần/người/ngày Việt Nam xuyên bãi; lưu snapshot và claim trong DB. Booking dùng ngày bắt đầu, hủy/hết hạn/no-show trước check-in giải phóng claim. Walk-in chỉ áp dụng khi xe liên kết duy nhất một người đã xác minh. Booking/session có trước migration giữ grace=0. Không áp dụng miễn phí cho xe không xác định được người dùng.
- Thông báo trong web được lưu DB: trạng thái booking, đổi slot, hoàn tiền và nhắc trước giờ bắt đầu/kết thúc 15 phút; chuông tải lại định kỳ. Chưa có push điện thoại hoặc SMS thật; SMTP hiện phục vụ OTP/reset password, không phải gửi mọi thông báo booking qua email.

VNPay implementation reference: [tài liệu query/refund chính thức](https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr%26refund.html).

## API contracts

Tất cả HTTP response dùng envelope: {"result": <payload bên dưới>, "isSuccess": true, "statusCode": 200, "message": "..."}. ID ví dụ là UUID thật của tài khoản đang đăng nhập. GET không có body. JWT Bearer bắt buộc trừ hai endpoint guest; mọi lệnh manager phải có assignment còn hiệu lực đúng lot. Lỗi validation 400, chưa đăng nhập 401, không có quyền 403, không tồn tại 404, xung đột 409, phụ thuộc lỗi 503; Identity dùng error mapping hiện hành cho OTP/credentials.

| Method / đường dẫn | Request mẫu | result mẫu | Luồng |
|---|---|---|---|
| POST /api/v1/auth/guest/request-otp | {"email":"customer@example.com"} | {"message":"Nếu yêu cầu hợp lệ, mã đã được gửi..."} | A |
| POST /api/v1/auth/guest/verify | {"email":"customer@example.com","code":"123456","mfaCode":null} | {"accessToken":"...","refreshToken":"..."} | A |
| GET /api/v1/auth/mfa | — | {"enabled":false} | B |
| POST /api/v1/auth/mfa/setup | {"password":"current password"} | {"secret":"BASE32...","uri":"otpauth://totp/..."} | B |
| POST /api/v1/auth/mfa/enable | {"password":"current password","code":"123456"} | {"enabled":true} | B |
| POST /api/v1/auth/mfa/disable | {"password":"current password","code":"123456"} | {"enabled":false} | B |
| GET /api/v1/notifications | — | {"unreadCount":1,"items":[{"id":"uuid","bookingId":"uuid","kind":"BOOKING_STATUS","message":"...","createdAt":"ISO8601","readAt":null}]} | C |
| POST /api/v1/notifications/{id}/read | {} | {"id":"uuid"} | C |
| POST /api/v1/notifications/read-all | {} | {"read":true} | C |
| GET /api/v1/payments/bookings/{bookingId}/refundable-payments | — | {"eligible":true,"payments":[{"id":"uuid","amount":50000,"remaining":50000,"method":"VNPAY","status":"SUCCESS"}]} | D |
| GET /api/v1/payments/bookings/{bookingId}/refunds | — | [{"id":"uuid","paymentId":"uuid","amount":50000,"status":"PENDING_PROVIDER","reason":"Hủy đặt chỗ","providerReference":null,"createdAt":"ISO8601","succeededAt":null}] | D |
| POST /api/v1/payments/{paymentId}/refunds | {"amount":50000,"reason":"Hủy đặt chỗ","idempotencyKey":"client-uuid"} | {"id":"refund-uuid"} | D |
| GET /api/v1/payments/refunds/lots/{lotId} | — | [{"id":"uuid","paymentId":"uuid","bookingId":"uuid","amount":50000,"status":"AWAITING_CASH","reason":"...","lastError":null,"method":"CASH"}] | D |
| POST /api/v1/payments/refunds/lots/{lotId}/{id}/cash-confirmation | {"reference":"actual-receipt-number"} | {"id":"uuid","status":"SUCCESS"} | D |
| POST /api/v1/payments/refunds/lots/{lotId}/{id}/reconcile | {"responseJson":"original signed VNPay refund JSON"} | {"id":"uuid","status":"SUCCESS"} | D |

## Activity diagrams

Các endpoint trong bảng tham chiếu một trong bốn luồng; nhánh read chỉ truy vấn dữ liệu được phân quyền, nhánh write mới thay đổi DB.

~~~mermaid
flowchart TD
 A[Guest request/verify] --> A1{Thao tác}
 A1 -->|request| A2[Validate email và cooldown / lưu hash]
 A2 --> A3[SMTP gửi OTP hoặc báo lỗi]
 A1 -->|verify| A4[Khóa challenge / kiểm tra hạn và OTP]
 A4 --> A5{Đúng mã và được phép?}
 A5 -->|Không| A6[Ghi lần sai / từ chối]
 A5 -->|Có| A7[Kiểm tra MFA / tạo hoặc lấy CUSTOMER]
 A7 --> A8[Consume challenge / cấp token]
~~~
~~~mermaid
flowchart TD
 B[JWT / MFA endpoint] --> B1{Thao tác}
 B1 -->|status| B2[Đọc trạng thái của chính mình]
 B1 -->|setup| B3[Xác minh mật khẩu / lưu secret mã hóa]
 B1 -->|enable hoặc disable| B4[Mật khẩu / khóa MFA row / kiểm tra TOTP]
 B4 --> B5{Mã hợp lệ?}
 B5 -->|Không| B6[Tăng failures / khóa nếu cần]
 B5 -->|Có| B7[Đổi trạng thái / thu hồi refresh token / commit]
~~~
~~~mermaid
flowchart TD
 C[JWT / notifications] --> C1[Xác nhận tài khoản ACTIVE]
 C1 --> C2{GET hay POST?}
 C2 -->|GET| C3[Đọc 100 bản ghi mới nhất và unread count của owner]
 C2 -->|POST| C4[Đánh dấu đọc theo owner và id hoặc tất cả]
 C4 --> C5[Trả kết quả / 404 nếu id không thuộc owner]
~~~
~~~mermaid
flowchart TD
 D[JWT / refund endpoint] --> D1[Owner hoặc manager đúng lot / eligibility]
 D1 --> D2{Thao tác}
 D2 -->|GET| D3[Đọc ledger và số dư khả dụng]
 D2 -->|request| D4[Idempotency / khóa payment / giữ số tiền hoàn]
 D4 --> D5{Phương thức}
 D5 -->|CASH| D6[Chờ manager xác nhận thực trả]
 D5 -->|VNPAY| D7[Persist request / dispatch một lần]
 D7 --> D8{Phản hồi xác thực thành công?}
 D8 -->|Không rõ| D9[Giữ tiền chờ / cần đối soát]
 D2 -->|reconcile| D10[Xác minh chữ ký và đối chiếu payload đã gửi]
 D2 -->|cash-confirmation| D6
 D8 -->|Có| D11[Ledger / audit / outbox cùng transaction]
 D10 --> D11
 D6 --> D11
~~~

## Sequence diagrams

~~~mermaid
sequenceDiagram
 participant UI
 participant Identity
 participant DB
 participant SMTP
 UI->>Identity: A request-otp(email)
 Identity->>DB: Atomic cooldown + hash challenge
 Identity->>SMTP: OTP (không log mã)
 Identity-->>UI: Generic delivery message hoặc lỗi
 UI->>Identity: A verify(email, code, mfaCode)
 Identity->>DB: Lock challenge; check role, MFA; consume; account/token
 Identity-->>UI: Access + refresh token
 UI->>Identity: B status/setup/enable/disable (Bearer)
 Identity->>DB: Read own status OR password/TOTP guarded mutation
 Identity-->>UI: Status hoặc secret setup chỉ cho chính user
~~~
~~~mermaid
sequenceDiagram
 participant UI
 participant Parking
 participant Identity
 participant DB
 UI->>Parking: C list/read/read-all (Bearer)
 Parking->>Identity: Require ACTIVE user
 Parking->>DB: Query/update WHERE user_id = subject
 DB-->>Parking: Scoped result
 Parking-->>UI: Envelope / not found
~~~
~~~mermaid
sequenceDiagram
 participant UI
 participant Payment
 participant ParkingIdentity as Parking / Identity
 participant DB
 participant VNPay
 UI->>Payment: D read/request/cash-confirm/reconcile
 Payment->>ParkingIdentity: Owner/manager + refund eligibility
 Payment->>DB: Read ledger OR lock + reserve/confirm refund
 Payment-->>UI: Envelope (pending không phải đã hoàn)
 Payment->>DB: Worker stores signed payload, IN_FLIGHT
 Payment->>VNPay: HTTPS refund request
 VNPay-->>Payment: Signed result hoặc timeout
 alt Verified matching success
 Payment->>DB: SUCCESS + payment totals + audit + outbox
 Payment->>ParkingIdentity: RefundSucceeded (service-key gRPC)
 ParkingIdentity->>DB: Deduplicated user notification
 else Ambiguous
 Payment->>DB: RECONCILIATION_REQUIRED (no automatic resend)
 end
~~~

## Migration và nguồn dữ liệu

Identity 002_mfa + 003_guest_otp; Parking 007_notifications + 008_daily_grace; Payment 003_refund_workflow. Base 001 cũng chứa schema mới cho volume mới. Launcher dev/production áp dụng migration cho volume hiện có. Không xóa volume để cập nhật schema. Payment refunds là ledger authoritative; journal cancellation cũ chỉ ghi điều kiện hủy, không phải xác nhận tiền đã trả.

Xem [PRODUCTION_RUNBOOK.md](PRODUCTION_RUNBOOK.md) để cấu hình và chạy. Chỉ coi sẵn sàng release sau khi các luồng mới được kiểm tra trên môi trường thật/sandbox phù hợp.
