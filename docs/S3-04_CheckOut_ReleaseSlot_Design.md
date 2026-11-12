# SCRUM-70 — Check-out và giải phóng slot

Cập nhật 01/11/2026. Owner Hàn; phối hợp Sơn (Payment), Phát (OCR), Tiến (Staff UI), A.Đức (map). Thiết kế này thay luồng hai bước cũ bằng **quote → authorize-exit → xác nhận xe thực sự rời bãi**.

## 1. Quy tắc bắt buộc

- JWT + Identity kiểm tra Staff/Manager hoạt động, không khóa, có quyền GATE đúng bãi; lấy bãi từ session trong database. Identity lỗi thì dừng với 503.
- Cổng EXIT/BOTH đúng bãi. Session ACTIVE, đúng xe/slot, biển số quan sát phải khớp. Sai biển số được trả incidentCode/ghi audit, không cấp quote/permit để xuất bãi.
- QR check-in PARK1 không dùng làm QR xuất bãi. EXIT1 chỉ giúp xác định session; vẫn cần biển số quan sát trước khi cho xe ra.
- Quote ký HMAC, gắn actor/session/bãi/cổng/slot/xe/snapshot/biển số/giờ/số tiền. Quote và permit có hạn 5 phút; không cho client tự sửa nội dung.
- Thuật toán tính phí dùng chung do Sơn (Payment) phụ trách tại Building Block `Parking.PricingEngine`. Booking tính phụ thu từ expectedExitAt, walk-in tính toàn bộ từ entryAt. CheckOutFee chỉ chuyển snapshot/mốc thời gian sang Building Block: walk-in gọi `PricingEngine.Calculate`, booking gọi `PricingEngine.CalculateOvertime`. Parking không tự tính block, giá cao điểm, trần ngày hoặc giảm giá hội viên.
- `CalculateOvertime(bookedStart, expectedExitTime, exitTime, policy, isGoldStarMember, timeZone)` trả phụ thu VND kiểu long. Booked window phải có thời lượng dương; ra trước/đúng hạn trả 0. Block phụ thu neo tại expectedExitTime, làm tròn theo thời gian thật, không thu lại block đầu; bù trừ trần ngày đã dùng và chênh lệch số tiền sau làm tròn giảm giá hội viên. Phân tách theo nửa đêm địa phương của từng bãi. Hàm `Calculate` hiện có mà Payment sử dụng giữ nguyên contract và hành vi.
- Trước thu phí và khi hoàn tất phải kiểm tra lại block phí. Sang block mới trả 409 lấy quote mới; không tự miễn thêm 5 phút. Tiền đã thu ở session là credit, không thu trùng.
- Payment sở hữu ledger/biên nhận. CASH cần Staff xác nhận đã thu tiền, số tiền đủ, ghi actor/audit/outbox. VNPAY_QR cần Payment ID SUCCESS của đúng session/bãi/VND và provider attempt thành công. PREPAID không phải cách bỏ qua phụ thu.
- Authorize-exit xác nhận đủ điều kiện tài chính nhưng giữ slot OCCUPIED. Staff thao tác cổng, quan sát xe ra rồi Confirm với staffObservedExit=true. API không trả giả barrier OPEN.
- Trước khi cập nhật: request lock → VEHICLE → SLOT → khóa dòng và đọc lại. Session COMPLETED, assignment vacated_at, booking, reservation, audit, inbox và realtime outbox cùng transaction.
- Retry cùng actor/key/body trả outcome cũ sau khi kiểm tra quyền hiện tại. Body khác với key cũ trả 409. Sau commit worker gửi SlotStatusChanged; delivery có thể lặp nên không tuyên bố exactly-once.

## 2. Các endpoint

Tất cả REST trả envelope result/isSuccess/statusCode/message. Các endpoint Parking dưới đây yêu cầu Bearer Staff/Manager đúng bãi.

### POST /api/v1/check-out/quote

Request: {"lotId":"UUID","gateId":"UUID","sessionId":"UUID","detectedPlate":"78A-99999"}. Có thể truyền qrPayload EXIT1 thay sessionId. QR-only xác định được session nhưng trả PLATE_OBSERVATION_REQUIRED và không có quoteToken.

Response result chính: sessionId, entryPlate, exitPlate, isPlateMatched, quoteAt, totalAmountDue, paymentRequired, checkoutCredit, quoteToken, validUntil. Biển số không khớp: isPlateMatched=false, incidentCode=INCIDENT_0482_PLATE_MISMATCH, quoteToken=null; không cấp quyền xuất bãi.

### POST /api/v1/check-out/authorize-exit

Header Idempotency-Key. Request:

~~~json
{"sessionId":"UUID","gateId":"UUID","detectedPlate":"78A-99999","quoteToken":"CHECKOUT1...","paymentMethod":"CASH","cashReceived":7500,"staffNotes":"Đã thu đủ tiền"}
~~~

Response result: {"sessionId":"UUID","exitPermitToken":"EXITPERMIT1...","validUntil":"ISO8601","amountPaid":7500,"paymentId":"UUID","barrierStatus":"MANUAL_OPEN_AUTHORIZED","slotStatus":"OCCUPIED"}.

NONE chỉ được chấp nhận khi không còn phí. VNPay dùng paymentMethod=VNPAY_QR và paymentReference là Payment ID thật. Mạng lỗi sau khi Payment đã commit: retry/quote mới vẫn dùng số tiền đã ghi nhận; không hoàn tác giả giao dịch tiền bằng rollback Parking.

### POST /api/v1/check-out

Header Idempotency-Key. Gửi cùng thông tin nhận diện/quote, thêm exitPermitToken và staffObservedExit=true. Staff chỉ xác nhận sau khi quan sát xe đã ra. Backend xác minh lại quyền, token, biển số, phí, trạng thái và số tiền còn hiệu lực.

Response result: sessionId, bookingId, lotId, slotId, slotCode, exitedAt, finalAmountPaid, paymentMethod, paymentId, barrierStatus=STAFF_CONFIRMED_EXIT, slotStatus=AVAILABLE. finalAmountPaid là khoản phụ thu/walk-in đã ghi nhận cho session, không cộng lại khoản booking trả trước.

### POST /api/v1/check-out/{sessionId}/qr

Không có Body. Staff đúng bãi nhận {"qrPayload":"EXIT1...","expiresAt":"ISO8601"}. QR này dùng để tra session; không tự mở cổng hoặc giải phóng chỗ.

### POST /api/v1/payments/checkout/vnpay

Bearer Staff đúng bãi. Request {"quoteToken":"CHECKOUT1..."}. Payment gọi Parking xác minh quote, tạo khoản PENDING theo session, trả paymentId/amount/status/paymentUrl. Retry quote cũ trả cùng khoản pending. Khi đã có khoản pending phải giải quyết trạng thái trước khi tạo khoản khác.

IPN dùng GET /api/v1/payments/vnpay/ipn; merchant ref CO... đi vào checkout handler. Chỉ chữ ký hợp lệ + số tiền chính xác + ResponseCode=00 + TransactionStatus=00 mới cập nhật SUCCESS, audit/outbox cùng transaction. Return URL không xác nhận thanh toán. Callback không kết thúc session hoặc giải phóng slot.

### SignalR /hubs/parking

Event SlotStatusChanged gồm eventId, parkingLotId, slotId, status, observedAt. Chỉ dữ liệu trạng thái công khai; không chứa biển số/người dùng/session. Worker gửi sau commit. Client reconnect phải lấy lại snapshot availability; không coi sự kiện đã gửi là bằng chứng mọi client đã nhận.

## 3. Mã lỗi

400: thiếu trường, chưa xác nhận physical exit, UUID/tiền sai, cổng ENTRY ở quote. 401: JWT sai/hết hạn. 403: không có quyền bãi. 404: không có session. 409: token/biển số/giá/trạng thái/key xung đột hoặc chưa thanh toán. 503: Identity/Payment/database/snapshot không sẵn sàng; không cho qua.

## 4. Activity

~~~mermaid
flowchart TD
 A[Staff gửi session hoặc EXIT1 QR] --> B[Kiểm tra quyền và cổng]
 B --> C[Đối chiếu biển số và tạo quote có chữ ký]
 C --> D{Khớp biển số?}
 D -- Không --> X[Ghi audit và chặn xuất bãi]
 D -- Có --> E[Authorize-exit xác minh phí qua Payment]
 E --> F{Đã đủ tiền?}
 F -- Không --> Y[Giữ slot OCCUPIED]
 F -- Có --> G[Cấp permit cho Staff thao tác cổng]
 G --> H[Staff quan sát xe ra và gửi Confirm]
 H --> I[Kiểm tra lại và transaction VEHICLE → SLOT]
 I --> J[Commit session COMPLETED và outbox]
 J --> K[Worker phát SlotStatusChanged]
~~~

## 5. Sequence

~~~mermaid
sequenceDiagram
 actor Staff
 participant P as Parking API
 participant I as Identity
 participant M as Payment
 participant DB as Parking DB
 participant H as SignalR
 Staff->>P: Issue exit QR (tùy chọn)
 P->>I: GATE tại bãi của session
 P-->>Staff: EXIT1 QR có hạn
 Staff->>P: Quote session/QR và biển số quan sát
 P->>I: Kiểm tra quyền hiện tại
 P->>DB: Đọc session + snapshot
 P-->>Staff: CHECKOUT1 quote có chữ ký
 opt Thanh toán VNPay
 Staff->>M: Prepare VNPay bằng quoteToken
 M->>P: gRPC xác minh quote/actor
 M-->>Staff: PENDING và paymentUrl
 Note over M: IPN có chữ ký mới ghi SUCCESS + outbox
 end
 Staff->>P: Authorize-exit
 P->>M: Thu CASH hoặc xác minh payment/credit
 M-->>P: Biên nhận thật
 P-->>Staff: Permit; slot vẫn OCCUPIED
 Note over Staff: Thao tác cổng và quan sát xe thực sự rời bãi
 Staff->>P: Confirm + permit + staffObservedExit
 P->>I: Kiểm tra lại GATE
 P->>M: Kiểm tra credit nếu có phụ thu
 P->>DB: Transaction, khóa theo thứ tự, đọc lại và cập nhật
 DB-->>P: Commit
 P-->>Staff: STAFF_CONFIRMED_EXIT / AVAILABLE
 DB->>H: Worker đọc outbox và phát sau commit
~~~

## 6. Chạy local và giới hạn

Parking cấu hình Services:PaymentGrpc=http://127.0.0.1:8085 trong Development; Payment cần Services:ParkingGrpc=http://127.0.0.1:8081. Dùng cùng service key, giữ credential trong secrets/env. Không thêm bảng mới cho checkout: tận dụng billing_accounts/session, billing_lines, payments, audit/inbox/outbox hiện có. Không tự chạy SQL trên database demo.

Đây là **chế độ Staff vận hành cổng và xác nhận physical exit**. Chưa có contract/thiết bị IoT được cung cấp nên chưa kết nối barrier/camera thật. VNPay được kiểm thử bằng callback có chữ ký giả lập; không tuyên bố đã giao dịch ngân hàng thật. Thời gian mẫu local không thay cho kiểm thử tải/SLA <1.2 giây. Màn hình FE Staff chưa được nghiệm thu theo contract mới. Bộ Postman demo cá nhân chỉ lưu local; request mẫu và sơ đồ tích hợp chính thức nằm trong tài liệu này.

Build bằng `dotnet build Parking.Microservices.slnx --no-restore`. Chạy kiểm thử bằng `dotnet test tests/Parking.Microservices.Tests/Parking.Microservices.Tests.csproj --no-restore`; các test PostgreSQL cần `PARKING_TEST_ADMIN_CONNECTION` trỏ tới PostgreSQL localhost có quyền tạo database tạm. Không dùng connection string production cho kiểm thử. Kết quả phải phân biệt test đạt và test bị bỏ qua do thiếu cấu hình host/database.
