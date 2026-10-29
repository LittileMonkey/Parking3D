# Kịch bản demo QA — 6 đến8 phút

## Chuẩn bị

Đọc Regression-Report.md và Bug-Register.md. Build host, chuẩn bị PostgreSQL riêng theo scripts/qa/sprint-3/README.md. Dùng dữ liệu synthetic, không trình chiếu token/password/QR nonce. Đọc commit trong mỗi snapshot trước khi so với source mới.

## Trình bày

1. **30giây — phạm vi:** “Em kiểm thử bản ghi trong báo cáo. Đây là evidence từng phần, chưa ký nghiệm thu xe vào–ra toàn hệ thống.”
2. **1phút — FE:** mở /booking, cho thấy /search redirect cùng luồng; desktop/mobile. Nói rõ browser smoke không chứng minh dữ liệu API hay realtime; Staff có thể còn dữ liệu demo.
3. **2 đến3phút — API:** chạy `node scripts/qa/sprint-3/run-real-api-demo.cjs`. Đọc từng status: đăng ký/login, Gateway ready, list/search, booking, CASH, Staff confirm, Confirmed, QR và check-in. Nếu Gateway404, báo đúng blocker và đường bypass; không giấu fallback.
4. **1phút — DB:** mở evidence đã che dữ liệu; check booking CHECKED_IN, một active session và một physical assignment. Script dùng CASH/outbox thật trong DB test, không inject PaymentSucceeded.
5. **1phút — tests:** trình bày95PASS/1FAIL và root-cause testhost. Không gọi là95E2E. Nêu rõ PostgreSQL18.4 là môi trường đã thử; baseline17 còn cần kiểm chứng.
6. **1phút — pending:** chỉ ra checkout/physical exit, realtime, CASH/entry fallback và quyền cần owner sửa. Sau fix, Quang chạy full UI/Gateway E2E và quay video nghiệm thu.

## Lệnh nhanh ở root repo

```powershell
npm ci --prefix scripts/qa/sprint-3 --ignore-scripts
$env:PARKING_PG_BIN = 'D:/postGREDB/bin'
node scripts/qa/sprint-3/run-real-api-demo.cjs
powershell -ExecutionPolicy Bypass -File scripts/qa/sprint-3/Run-IsolatedTests.ps1 -IncludeIdentityHttp
```

Không chạy song song hai API runner trên cùng port. Không dừng process không rõ owner để giải phóng port; chọn portQA khác hoặc phối hợp người đang chạy. Runner test suite port55484, API cluster55486; Identity vẫn yêu cầu các port hard-code được ghi README.

Kết quả fail/skip phải được trình bày. Không dùng nút checkout localStorage làm bằng chứng DB đã Completed/Available. Video rendering khác video full lifecycle.
