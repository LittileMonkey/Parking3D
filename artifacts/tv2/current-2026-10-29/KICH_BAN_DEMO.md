# KỊCH BẢN DEMO QUANG — 29/10/2026

Thời lượng đề xuất6–8 phút. Mục tiêu: chứng minh phần đã chạy và cho nhóm thấy blocker; không trình bày sản phẩm đã hoàn tất xe vào–ra.

## 1. Mở đầu — 30 giây
“Em kiểm tra GitHub dev 577064b. Backend build0lỗi/0 warning, frontend build được. Em demo luồng API thật đến check-in trực tiếp và báo phần chưa thể nghiệm thu.”

## 2. Giao diện — 1 phút
Tại repo mở PowerShell:

```powershell
cd D:\OJT26_PARK_AUUA\PROJECT_OJT\parking-system-group2\frontend_parking_system
npm run dev -- --host 127.0.0.1 --port 5178 --strictPort
```

Mở http://127.0.0.1:5178/booking. Trình bày form xe/giờ/thời lượng/giá; /search được redirect về cùng luồng. Chuyển mobile xem layout. Có thể mở /staff để giới thiệu bố cục nhưng nói rõ dữ liệu Staff có demo/localStorage. Chưa chọn bãi thì chưa chứng minh viewer3D nhận data thật. Nếu backend chưa nối, không bấm tìm rồi gọi lỗi mạng là search nghiệp vụ FAIL.

Screenshot/video sẵn trong browser/. Video này không phải video full E2E.

## 3. Chạy luồng API thật — 2–3 phút
Dừng server/process khác nếu đang dùng các port test. Không tắt process không rõ owner.
Mở PowerShell thứ hai tại repo:

```powershell
cd D:\OJT26_PARK_AUUA\PROJECT_OJT\parking-system-group2
node artifacts/tv2/current-2026-10-29/Run-RealApi-Demo.cjs
```

Điều kiện: backend vừa build, PostgreSQL ở D:/postGREDB/bin, Node pg dependency QA có sẵn artifacts/local-runtime/node_modules/pg. Script cần quyền chạy PostgreSQL; dùng terminal phù hợp máy local nếu bị chặn. Không chạy vào DB nhóm. Script tự tạo cluster mới, tài khoản synthetic và dữ liệu hai bãi; tự dừng host/cluster sau chạy. Có kiểm tra port trống trước khi bắt đầu.

Kết quả đã xác minh:
1. Register synthetic Customer →200.
2. Login Customer và Staff →200.
3. Gateway ready →200.
4. List actual lots và Search actual price →200.
5. Create booking →200, giữ chỗ theo backend.
6. Create actual CASH payment →200.
7. Scoped Staff confirms CASH →200; chờ outbox/inbox làm booking CONFIRMED.
8. Issue actual QR →200.
9. Gateway check-in →404 (lỗi cần trình bày, không gọi PASS).
10. Direct Parking check-in →200, đường bypass Gateway được nói rõ.
11. Mở DEMO_API_EVIDENCE.json: CHECKED_IN; active_sessions1; occupied_assignments1.

QR, token và password không hiển thị trong evidence. Không gọi provider giả hoặc bơm PaymentSucceeded trong luồng demo này; CASH/outbox/inbox là code service thật. Staff là dữ liệu synthetic được gán bãi bằng fixture của test environment.

## 4. Kết quả kiểm thử — 1 phút
Mở BAO_CAO_QUANG.md và results/tv2-isolated.trx:
-95 PASS,1 FAIL, tổng96; không cộng9testFE thành backend104.
- FAIL là testhost Identity thiếu seed config; không nói95 PASS nghĩa là hệ thống hoàn chỉnh.
- FE test realtime4 PASS, countdown5 PASS, nhưng chưa có chứng cứ realtime backend Hub.

Lệnh tái chạy suite (tự tạo database riêng):
```powershell
powershell -ExecutionPolicy Bypass -File artifacts/tv2/current-2026-10-29/Run-IsolatedTests.ps1 -IncludeIdentityHttp
```
Lệnh này dự kiến vẫn exit1 nếu owner chưa sửa testhost/config. Không xóa FAIL hoặc bỏ chọn test để nói toàn bộ xanh.

## 5. Kết luận và yêu cầu nhóm — 1 phút
“Em đã có scenario, báo cáo, evidence API đến direct check-in và bug/retest. SCRUM-77 chưa đủ Done vì thiếu route Gateway check-in, checkout/physical exit và backend SignalR; Staff còn CASH fallback. Em cần các owner bàn giao bản tích hợp để test full UI và quay video xe vào–ra.”

- Nhật: Gateway/config tích hợp và sửa testhost phối hợp N.Đức.
- Hàn: checkout/exit và phối hợp Hub/status theo phân công nhóm; giữ occupied đến xác nhận xe ra.
- Tiến: bỏ CASH success giả và checkout localStorage trong đường nghiệm thu.
- A.Đức: nối3D realtime với Hub và API hợp lệ sau backend bàn giao.
- Sơn/N.Đức: retest quyền payment/contract; chốt policy và token/config thống nhất.

Không trình diễn nút checkout mô phỏng như bằng chứng xe đã ra và slot DB đã Available.

