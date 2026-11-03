# BẢNG MÔ TẢ CHI TIẾT NHIỆM VỤ JIRA (JIRA TASK DESCRIPTIONS)
> **Dự án:** Smart 3D Parking Management System (ParkMatrix - Baseline V4)  
> **Áp dụng cho:** Các nhiệm vụ từ SCRUM Sprint 3 đến SCRUM Sprint 6 trên Jira Board `HCM26_CPL_NET_06_Group2` (`SCRUM`)  
> **Quy chuẩn định dạng:** Tuân thủ 100% cấu trúc 4 phần chuẩn mực của nhóm (Ownership, Phase Breakdown, Acceptance Criteria, Dependencies & Schedule).

---

## 📌 SCRUM SPRINT 3: VẬN HÀNH CHECK-IN/OUT, AI ANPR CAMERA & THANH TOÁN THỰC TẾ

### 1. SCRUM-67: [S3-01][TV8 Nhat][P0] YARP Gateway dinh tuyen 4 microservices, Rate Limiting & Swagger UI
**Mô tả nhiệm vụ:**
```markdown
1. Phân công & Phối hợp (Ownership & Collaboration):
   - Owner chính: TV8 Nhật (DevOps / Infrastructure)
   - Phối hợp: TV5 N.Đức (Identity), TV6 Hàn (Parking), TV7 Sơn (Payment), TV1 Phát (AI)

2. Lộ trình triển khai (Phase Breakdown):
   - D1–D2: Cấu hình YARP Reverse Proxy reverse routes cho 4 microservices (Identity: 5001, Parking: 5002, Payment: 5003, AI: 5004).
   - D3–D4: Thiết lập Rate Limiting (Token Bucket 100 req/min/IP), cấu hình CORS cho Web và 3D clients.
   - D5: Tích hợp Swagger Aggregator tổng hợp OpenAPI specs của 4 service vào 1 cổng duy nhất.

3. Tiêu chí nghiệm thu & Quy tắc nghiệp vụ (Acceptance Criteria & Business Invariants):
   - Đảm bảo tính minh bạch: Client chỉ tương tác qua Gateway cổng 5000 mà không cần gọi trực tiếp port nội bộ.
   - Trả lỗi 429 Too Many Requests khi vượt ngưỡng rate limit.
   - Aggregated Swagger UI `/swagger` hiển thị đầy đủ tài liệu API của cả 4 services.

4. Phụ thuộc & Mốc thời gian (Dependencies & Schedule):
   - Phụ thuộc: Hoàn thành cấu hình launchSettings của 4 microservices.
   - Mốc bàn giao: Ngày D5 của Sprint 3.
```

---

### 2. SCRUM-68: [S3-02][TV5 N.Duc][P0] Identity: Quan ly danh muc xe ca nhan & phan hang thanh vien Gold Star
**Mô tả nhiệm vụ:**
```markdown
1. Phân công & Phối hợp (Ownership & Collaboration):
   - Owner chính: TV5 N.Đức (Identity & Security)
   - Phối hợp: TV4 Tiến (Customer Frontend), TV6 Hàn (Parking Core)

2. Lộ trình triển khai (Phase Breakdown):
   - D1–D2: Thiết kế DDL / Migration cho bảng `UserVehicles` (UserId, LicensePlate, VehicleType: Car/EV/Bike, IsDefault).
   - D3–D4: Triển khai CRUD API quản lý xe người dùng kèm validation format biển số xe cơ giới Việt Nam.
   - D5: Xây dựng cơ chế phân hạng thành viên (Standard, Silver, Gold Star) và cấp claim trong JWT.

3. Tiêu chí nghiệm thu & Quy tắc nghiệp vụ (Acceptance Criteria & Business Invariants):
   - Một tài khoản được quản lý tối đa 5 phương tiện; 1 phương tiện có thể set làm mặc định.
   - Chuẩn hóa biển số trước khi lưu (VD: "51A-123.45" hoặc "51A12345" -> "51A-123.45").
   - Trả envelope chuẩn: `{ result, isSuccess: true, statusCode: 200, message }`.

4. Phụ thuộc & Mốc thời gian (Dependencies & Schedule):
   - Phụ thuộc: Module Identity Auth (Sprint 1/2).
   - Mốc bàn giao: Ngày D5 của Sprint 3.
```

---

### 3. SCRUM-69: [S3-03][TV6 Han][P0] Parking: Luong Check-in tu dong (QR/bien so) & vang lai, tao ParkingSession
**Mô tả nhiệm vụ:**
```markdown
1. Phân công & Phối hợp (Ownership & Collaboration):
   - Owner chính: TV6 Hàn (Parking Core)
   - Phối hợp: TV1 Phát (AI OCR), TV4 Tiến (Staff Gate Monitor UI), TV3 A.Đức (3D Map)

2. Lộ trình triển khai (Phase Breakdown):
   - D1–D2: Thiết kế DDL bảng `ParkingSessions` (Id, LotId, SlotId, TicketId, CheckInTime, CheckOutTime, Status, InPlate, OutPlate).
   - D3–D4: Triển khai Check-in logic: Đối soát vé QR / ảnh biển số vào, cập nhật trạng thái slot sang `Occupied`.
   - D5: Tích hợp phát sự kiện SignalR thông báo phiên đỗ xe mới và mở barrier cổng vào.

3. Tiêu chí nghiệm thu & Quy tắc nghiệp vụ (Acceptance Criteria & Business Invariants):
   - Nếu là khách đặt trước: Biển số xe thực tế phải khớp biển số trên đơn đặt chỗ (hoặc có xác nhận thủ công của Staff).
   - Nếu là khách vãng lai: Tự động cấp phiên đỗ mới và gán slot còn trống gần nhất.
   - Phát sự kiện SignalR `SlotStatusChanged` ngay khi check-in thành công.

4. Phụ thuộc & Mốc thời gian (Dependencies & Schedule):
   - Phụ thuộc: S2-04, S2-05, AI OCR API (S3-07).
   - Mốc bàn giao: Ngày D5 của Sprint 3.
```

---

### 4. SCRUM-70: [S3-04][TV6 Han][P0] Parking: Luong Check-out doi soat bien so, chot cuoc & giai phong slot Available
**Mô tả nhiệm vụ:**
```markdown
1. Phân công & Phối hợp (Ownership & Collaboration):
   - Owner chính: TV6 Hàn (Parking Core)
   - Phối hợp: TV7 Sơn (Payment), TV1 Phát (AI Matching), TV3 A.Đức (3D Map)

2. Lộ trình triển khai (Phase Breakdown):
   - D1–D2: Xây dựng endpoint Check-out: Nhận ảnh biển số ra hoặc mã vé QR, truy xuất `ParkingSession` đang mở.
   - D3–D4: Đối soát biển số vào và biển số ra; gọi Payment Service tính tổng cước thực tế.
   - D5: Nhận callback xác nhận thanh toán thành công, chốt `CheckOutTime`, giải phóng slot về `Available` và gửi SignalR.

3. Tiêu chí nghiệm thu & Quy tắc nghiệp vụ (Acceptance Criteria & Business Invariants):
   - Chặn Check-out và kích hoạt cảnh báo nếu biển số ra khác biệt hoàn toàn với biển số vào.
   - Slot CHỈ được giải phóng về `Available` khi thanh toán đã hoàn tất thành công.
   - Thời gian đáp ứng của luồng check-out < 1.2s để tránh ùn tắc cổng.

4. Phụ thuộc & Mốc thời gian (Dependencies & Schedule):
   - Phụ thuộc: S3-03, S3-05, S3-06.
   - Mốc bàn giao: Ngày D5 của Sprint 3.
```

---

### 5. SCRUM-71: [S3-05][TV7 Son][P0] Payment: Dong co tinh cuoc theo Block 15p, Peak Multiplier va Daily Cap
**Mô tả nhiệm vụ:**
```markdown
1. Phân công & Phối hợp (Ownership & Collaboration):
   - Owner chính: TV7 Sơn (Payment & Pricing)
   - Phối hợp: TV6 Hàn (Parking Check-out), TV2 Quang (QA)

2. Lộ trình triển khai (Phase Breakdown):
   - D1–D2: Thiết kế `PricingEngine` tính phí: Block khởi đầu (60 phút), các block tiếp theo (15 phút).
   - D3–D4: Triển khai logic tính hệ số giờ cao điểm (`PeakMultiplier`: 1.2x khung 11:30–13:00 và 17:30–19:00).
   - D5: Áp dụng trần giá tối đa trong ngày (`DailyCap`) và giảm giá hội viên Gold Star (10%).

3. Tiêu chí nghiệm thu & Quy tắc nghiệp vụ (Acceptance Criteria & Business Invariants):
   - Thời gian đỗ làm tròn lên block 15 phút (VD: 68 phút tính thành 60p + 15p = 75p).
   - Không vượt quá `DailyCap` của bãi đỗ dù đỗ qua đêm.
   - Unit tests đạt độ bao phủ 100% cho mọi tổ hợp block thời gian.

4. Phụ thuộc & Mốc thời gian (Dependencies & Schedule):
   - Phụ thuộc: Cấu hình `PricingPlan` của từng bãi đỗ.
   - Mốc bàn giao: Ngày D5 của Sprint 3.
```

---

### 6. SCRUM-72: [S3-06][TV7 Son][P0] Payment: Tich hop VNPay-QR quet tra tai cong & luong thu tien mat bot truc
**Mô tả nhiệm vụ:**
```markdown
1. Phân công & Phối hợp (Ownership & Collaboration):
   - Owner chính: TV7 Sơn (Payment & Pricing)
   - Phối hợp: TV4 Tiến (Staff UI), TV6 Hàn (Check-out)

2. Lộ trình triển khai (Phase Breakdown):
   - D1–D2: Tích hợp luồng sinh mã VNPay-QR động theo đơn gửi xe (chứa số tiền, mã giao dịch, thời hạn quét 5 phút).
   - D3–D4: Triển khai tiếp nhận Webhook IPN từ VNPay và đối soát chữ ký số HMAC-SHA512.
   - D5: Xây dựng API xác nhận thanh toán tiền mặt (CASH) tại bốt trực có ghi nhận UserId của nhân viên thu.

3. Tiêu chí nghiệm thu & Quy tắc nghiệp vụ (Acceptance Criteria & Business Invariants):
   - Xử lý Idempotency: Không cộng tiền hoặc xác nhận trùng 2 lần cho cùng 1 giao dịch.
   - Cung cấp mã giao dịch và sinh hóa đơn điện tử (E-Receipt) sau khi hoàn tất.
   - Xác thực chữ ký VNPay chuẩn mật mã, từ chối mọi callback giả mạo.

4. Phụ thuộc & Mốc thời gian (Dependencies & Schedule):
   - Phụ thuộc: S3-05.
   - Mốc bàn giao: Ngày D5 của Sprint 3.
```

---

### 7. SCRUM-73: [S3-07][TV1 Phat][P0] AI: Nhan dien bien so ANPR tu anh camera cong (do tre <1.5s, do chinh xac >98%)
**Mô tả nhiệm vụ:**
```markdown
1. Phân công & Phối hợp (Ownership & Collaboration):
   - Owner chính: TV1 Phát (AI & Computer Vision)
   - Phối hợp: TV8 Nhật (DevOps / GPU container), TV6 Hàn (Parking Check-in/out)

2. Lộ trình triển khai (Phase Breakdown):
   - D1–D2: Tối ưu hóa pipeline xử lý ảnh trong Python FastAPI service (YOLOv8 Plate Detection + EasyOCR/CRNN).
   - D3–D4: Bổ sung bộ lọc tiền xử lý: Tăng tương phản ảnh, xoay chỉnh góc nghiêng (perspective transform).
   - D5: Đóng gói Docker và tích hợp với client C# .NET qua HTTP / gRPC.

3. Tiêu chí nghiệm thu & Quy tắc nghiệp vụ (Acceptance Criteria & Business Invariants):
   - Độ chính xác nhận diện đạt > 98% trên tập test ảnh biển số ban ngày và ban đêm.
   - Thời gian xử lý trung bình < 1.5 giây cho 1 ảnh.
   - Trả về cấu trúc: `normalizedPlate`, `confidence`, `plateType`, `croppedPlateBase64`.

4. Phụ thuộc & Mốc thời gian (Dependencies & Schedule):
   - Phụ thuộc: S2-08, Python FastAPI service.
   - Mốc bàn giao: Ngày D5 của Sprint 3.
```

---

### 8. SCRUM-74: [S3-08][TV1 Phat & Quang][P0] AI & Parking: Thuat toan so khop bien so xe vao/ra & canh bao su co #0482
**Mô tả nhiệm vụ:**
```markdown
1. Phân công & Phối hợp (Ownership & Collaboration):
   - Owner chính: TV1 Phát & TV2 Quang (AI & QA)
   - Phối hợp: TV6 Hàn (Parking), TV4 Tiến (Staff Dashboard)

2. Lộ trình triển khai (Phase Breakdown):
   - D1–D2: Xây dựng thuật toán tính khoảng cách chỉnh sửa Levenshtein Distance giữa biển số lúc vào và lúc ra.
   - D3–D4: Cơ chế ngưỡng tin cậy: Nếu khoảng cách > 1 ký tự hoặc Confidence < 0.85, sinh cảnh báo sự cố #0482.
   - D5: Đẩy thông báo sự cố đỏ/vàng lên Queue sự cố của màn hình Staff Dashboard.

3. Tiêu chí nghiệm thu & Quy tắc nghiệp vụ (Acceptance Criteria & Business Invariants):
   - Phát hiện chính xác các trường hợp tráo biển hoặc biển số bị che khuất.
   - Ghi nhật ký vào bảng IncidentLog kèm ảnh chụp lúc vào và ảnh chụp lúc ra để bảo vệ đối soát.
   - Barrier chỉ mở khi Staff bấm duyệt thủ công (Manual Approve) sau khi kiểm tra.

4. Phụ thuộc & Mốc thời gian (Dependencies & Schedule):
   - Phụ thuộc: S3-03, S3-04, S3-07.
   - Mốc bàn giao: Ngày D5 của Sprint 3.
```

---

### 9. SCRUM-75: [S3-09][TV4 Tien][P0] Frontend: Man hinh Giam sat Tram Cong (Gate Station Monitor) & dieu khien barrier
**Mô tả nhiệm vụ:**
```markdown
1. Phân công & Phối hợp (Ownership & Collaboration):
   - Owner chính: TV4 Tiến (Frontend Web)
   - Phối hợp: TV1 Phát (AI ANPR), TV6 Hàn (Check-in/out), TV3 A.Đức (3D)

2. Lộ trình triển khai (Phase Breakdown):
   - D1–D2: Thiết kế giao diện Gate Station Monitor theo Stitch Prototype (Gate 01, Gate 02, Gate 03).
   - D3–D4: Hiển thị stream/ảnh camera cổng vào & ra, kết quả OCR biển số, độ tin cậy và thông tin vé.
   - D5: Nút thao tác nhanh cho Staff: Mở barrier thủ công, Đổi biển số khi AI đọc sai, Xác nhận thu tiền mặt.

3. Tiêu chí nghiệm thu & Quy tắc nghiệp vụ (Acceptance Criteria & Business Invariants):
   - Layout chuẩn phong cách Stitch: Nền Dark Navy, thẻ KPI viễn trắc hiển thị độ trễ kết nối (Latency: 18ms).
   - Hiển thị badge xanh `ANPR Verified ✓` hoặc cảnh báo vàng khi cần xác minh.
   - Phím tắt bàn phím (Space để mở barrier, Enter để duyệt) tăng tốc xử lý cho Staff.

4. Phụ thuộc & Mốc thời gian (Dependencies & Schedule):
   - Phụ thuộc: S3-03, S3-04, S3-08.
   - Mốc bàn giao: Ngày D5 của Sprint 3.
```

---

### 10. SCRUM-76: [S3-10][TV3 A.Duc][P0] Frontend 3D: Dong bo SignalR real-time doi mau slot (Available, Occupied, Reserved)
**Mô tả nhiệm vụ:**
```markdown
1. Phân công & Phối hợp (Ownership & Collaboration):
   - Owner chính: TV3 A.Đức (Frontend 3D Digital Twin)
   - Phối hợp: TV6 Hàn (SignalR Hub), TV4 Tiến (Operations Hub)

2. Lộ trình triển khai (Phase Breakdown):
   - D1–D2: Kết nối Client Three.js với SignalR Hub `ParkingHub` lắng nghe sự kiện `SlotStatusChanged`.
   - D3–D4: Cập nhật vật liệu và màu mesh 3D: Available (Xanh ngọc 🟢), Occupied (Đỏ san hô 🔴), Reserved (Vàng hổ phách 🟡), Maintenance (Xám ⚪).
   - D5: Bổ sung hiệu ứng chuyển màu mượt mà (Fade transition / Pulse animation) khi slot vừa thay đổi trạng thái.

3. Tiêu chí nghiệm thu & Quy tắc nghiệp vụ (Acceptance Criteria & Business Invariants):
   - Thời gian phản hồi từ khi xe check-in đến khi mô hình 3D đổi màu < 300ms.
   - Không bị lag hay tụt FPS khi nhận hàng loạt sự kiện đồng thời.
   - Modal chi tiết ô đỗ tự động cập nhật lại thông tin phiên đỗ nếu đang mở.

4. Phụ thuộc & Mốc thời gian (Dependencies & Schedule):
   - Phụ thuộc: S2-11, SignalR Hub phía Backend.
   - Mốc bàn giao: Ngày D5 của Sprint 3.
```

---

### 11. SCRUM-77: [S3-11][TV2 Quang][P0] QA: Kich ban E2E: Xe vao cong -> Check-in -> Chiem slot 3D -> Check-out -> Tra slot
**Mô tả nhiệm vụ:**
```markdown
1. Phân công & Phối hợp (Ownership & Collaboration):
   - Owner chính: TV2 Quang (QA & Automation Testing)
   - Phối hợp: TV1 Phát (AI), TV6 Hàn (Parking), TV7 Sơn (Payment)

2. Lộ trình triển khai (Phase Breakdown):
   - D1–D2: Soạn thảo Test Scenario chi tiết cho toàn bộ chu trình sống của một lượt đỗ xe (Parking Lifecycle E2E).
   - D3–D4: Viết kịch bản tự động (Playwright / Postman Runner) mô phỏng: Xe vào -> Check-in -> Slot Occupied -> Check-out -> Thanh toán -> Slot Available.
   - D5: Lập báo cáo kết quả kiểm thử và nghiệm thu các trường hợp biên (xe ra trước hạn, xe đỗ quá giờ, mất vé).

3. Tiêu chí nghiệm thu & Quy tắc nghiệp vụ (Acceptance Criteria & Business Invariants):
   - 100% bước trong chu trình E2E thực thi trơn tru không phát sinh lỗi 500.
   - Tính toàn vẹn trạng thái slot: Không bao giờ bị kẹt ở trạng thái `Occupied` sau khi đã thanh toán ra bãi.
   - Tài liệu Test Run đính kèm video và log minh chứng nộp cho Mentor.

4. Phụ thuộc & Mốc thời gian (Dependencies & Schedule):
   - Phụ thuộc: Hoàn thiện S3-03, S3-04, S3-06, S3-10.
   - Mốc bàn giao: Ngày D5 của Sprint 3.
```

---

### 12. SCRUM-78: [S3-12][TV1 Quang][P1] QA & AI: Bo test dataset 100 anh bien so xe may & o to Viet Nam kiem dinh ANPR
**Mô tả nhiệm vụ:**
```markdown
1. Phân công & Phối hợp (Ownership & Collaboration):
   - Owner chính: TV1 Phát (AI & Computer Vision)
   - Phối hợp: TV2 Quang (QA)

2. Lộ trình triển khai (Phase Breakdown):
   - D1–D2: Thu thập và gán nhãn ground-truth cho bộ dataset gồm 100 ảnh biển số xe thực tế (biển trắng, biển vàng, biển xanh, biển 2 dòng).
   - D3–D4: Chạy script đánh giá benchmark tự động: Tính độ chính xác Character Accuracy và Plate Accuracy.
   - D5: Xuất báo cáo ma trận nhầm lẫn (Confusion Matrix) và tinh chỉnh các ký tự dễ nhầm lẫn (8 vs B, 0 vs D, 1 vs I).

3. Tiêu chí nghiệm thu & Quy tắc nghiệp vụ (Acceptance Criteria & Business Invariants):
   - Tập dữ liệu bao gồm cả các điều kiện thử thách: Chụp ban đêm, góc nghiêng 30 độ, ảnh mờ nhẹ do xe đang di chuyển.
   - Tỷ lệ nhận diện đúng toàn bộ chuỗi ký tự đạt tối thiểu 95%.
   - Dataset được lưu trữ trong thư mục bảo mật nội bộ phục vụ nghiệm thu đồ án.

4. Phụ thuộc & Mốc thời gian (Dependencies & Schedule):
   - Phụ thuộc: S3-07.
   - Mốc bàn giao: Ngày D5 của Sprint 3.
```

---

## 📌 SCRUM SPRINT 4: TÌM KIẾM THÔNG MINH, TRỢ LÝ ẢO AI & CỔNG KHÁCH HÀNG

### 13. SCRUM-79: [S4-01][TV2 Phát][P0] Database: Design DDL, Advisory Locks, tstzrange overlap guard & migration script
```markdown
1. Phân công & Phối hợp (Ownership & Collaboration):
   - Owner chính: TV2 Quang & TV6 Hàn (Database & Core)
   - Phối hợp: TV8 Nhật (DevOps)
2. Lộ trình triển khai (Phase Breakdown):
   - D1–D2: Thiết kế DDL nâng cao cho Multi-Lot: Partitioning bảng AuditLogs theo ParkingLotId và tháng.
   - D3–D5: Viết migration script kiểm tra ràng buộc GiST exclusion constraints (`tstzrange` overlap).
3. Tiêu chí nghiệm thu & Quy tắc nghiệp vụ:
   - Cơ sở dữ liệu tự động từ chối mọi insert trùng dải thời gian ở cấp độ engine CSDL.
   - Chạy migration tự động thành công trên môi trường CI/CD không mất dữ liệu cũ.
4. Phụ thuộc & Mốc thời gian: Phụ thuộc Sprint 3; Hoàn thành Ngày D5.
```

### 14. SCRUM-80: [S4-02][TV2 Quang][P0] Backend: Refactor Multi-Parking Core APIs (ParkingLot, Level, Zone, Slot)
```markdown
1. Phân công & Phối hợp: Owner TV6 Hàn / TV2 Quang; Phối hợp TV5 N.Đức (RBAC).
2. Lộ trình triển khai:
   - D1–D3: Tối ưu hóa các API lấy thông tin cấu trúc bãi đỗ xe theo chuẩn Clean Architecture.
   - D4–D5: Tích hợp Redis Caching cho cấu trúc tĩnh của bãi xe (Level, Zone, Slot coordinate) với TTL 12h.
3. Tiêu chí nghiệm thu:
   - Thời gian phản hồi API cấu trúc bãi đỗ < 20ms khi có cache.
   - Hỗ trợ đầy đủ các trường tọa độ 3D (x, y, z, rotation) cho Digital Twin.
4. Phụ thuộc & Mốc thời gian: Hoàn thành Ngày D5.
```

### 15. SCRUM-81: [S4-03][TV4 Tien][P0] Frontend: Multi-Parking Management UI & Floor Plan Configuration
```markdown
1. Phân công & Phối hợp: Owner TV4 Tiến; Phối hợp TV3 A.Đức.
2. Lộ trình triển khai:
   - D1–D3: Xây dựng giao diện Web cho Manager chuyển đổi linh hoạt giữa các bãi đỗ trong chuỗi.
   - D4–D5: Form cấu hình thông tin bãi: Giờ hoạt động, số hotline, định vị GPS trên bản đồ vệ tinh.
3. Tiêu chí nghiệm thu:
   - Giao diện đồng bộ phong cách Dark Navy / Cyan Gradient của Stitch Prototype.
   - Validate đầy đủ tọa độ vĩ độ/kinh độ hợp lệ tại Việt Nam.
4. Phụ thuộc & Mốc thời gian: Hoàn thành Ngày D5.
```

### 16. SCRUM-82: [S4-04][TV3 A.Duc][P0] Frontend 3D: Dynamic Multi-Level & Multi-Zone Rendering Engine
```markdown
1. Phân công & Phối hợp: Owner TV3 A.Đức; Phối hợp TV4 Tiến.
2. Lộ trình triển khai:
   - D1–D3: Xây dựng bộ nạp bản đồ động Three.js dựa trên dữ liệu JSON trả về từ API backend.
   - D4–D5: Hiển thị bộ chuyển tầng mượt mà (Level Selector: B1, B2, B3) với hiệu ứng cắt lớp (Cross-section view).
3. Tiêu chí nghiệm thu:
   - Không bị rò rỉ bộ nhớ (Memory leak) khi chuyển đổi liên tục giữa các tầng hầm.
   - FPS duy trì ổn định > 50 FPS trên trình duyệt phổ thông.
4. Phụ thuộc & Mốc thời gian: Hoàn thành Ngày D5.
```

### 17. SCRUM-83: [S4-05][TV1 Phat][P1] QA: Integration test Advisory Locks & concurrency benchmark for 50 concurrent check-ins
```markdown
1. Phân công & Phối hợp: Owner TV1 Phát & TV2 Quang.
2. Lộ trình triển khai:
   - D1–D3: Xây dựng script JMeter giả lập 50 xe cùng gửi request check-in tại các cổng vào khác nhau.
   - D4–D5: Đo đếm tài nguyên CPU/RAM, xác minh không xảy ra Deadlock trên PostgreSQL.
3. Tiêu chí nghiệm thu:
   - Tỷ lệ lỗi 5xx là 0%. Advisory lock tự giải phóng ngay khi transaction commit/rollback.
   - Có biểu đồ latency phản hồi kèm trong Test Report.
4. Phụ thuộc & Mốc thời gian: Hoàn thành Ngày D5.
```

---

## 📌 SCRUM SPRINT 5: QUẢN TRỊ NỀN TẢNG, BIỂU PHÍ ĐỘNG & ĐẶT CHỖ THỜI GIAN THỰC

### 18. SCRUM-84: [S5-01][TV2 Quang][P0] Backend: Hold Slot 15m Engine with Advisory Locks & Time-Window Overlap Guard

> Tiêu đề trên giữ tên task lịch sử. Chính sách hold hiện hành đã đổi thành mặc định 5 phút theo mentor/SCRUM-100.
```markdown
1. Phân công: Owner TV6 Hàn & TV2 Quang.
2. Triển khai: Giữ chỗ chờ thanh toán mặc định 5 phút; worker quét mỗi 10 giây, chỉ release hold đủ điều kiện và bảo vệ physical occupancy.
3. Tiêu chí:
   - Frontend đếm ngược theo HoldExpiresAt do backend trả về; mặc định 5 phút, cấu hình theo policy.
   - Bảo vệ tuyệt đối bằng pg_advisory_xact_lock(slot_id).
4. Mốc bàn giao: Ngày D5.
```

### 19. SCRUM-85: [S5-02][TV2 Quang][P0] Backend: Dynamic Pricing Engine (Haversine Nearest, Block 15m, Daily Cap, Peak Multiplier)
```markdown
1. Phân công: Owner TV7 Sơn & TV2 Quang.
2. Triển khai: Động cơ tính giá ước tính toàn thời lượng phục vụ tìm kiếm CHEAPEST và tính cước thực tế khi xe ra bãi.
3. Tiêu chí:
   - Áp dụng chuẩn công thức Haversine tính khoảng cách GPS.
   - Phụ phí giờ cao điểm tự động kích hoạt theo khung giờ quy định.
4. Mốc bàn giao: Ngày D5.
```

### 20. SCRUM-86: [S5-03][TV4 Tien][P0] Frontend: Real-time Slot Reservation UI & Hold Countdown Timer
```markdown
1. Phân công: Owner TV4 Tiến; Phối hợp TV3 A.Đức.
2. Triển khai: Giao diện đặt chỗ cho khách hàng kèm đồng hồ đếm ngược theo HoldExpiresAt của backend, mặc định 5 phút (SCRUM-100).
3. Tiêu chí:
   - Đồng hồ đếm ngược thời gian thực; khi về 0 hiển thị hết hạn và tải lại trạng thái. Backend quyết định expiry trong transaction; frontend không tự hủy booking.
4. Mốc bàn giao: Ngày D5.
```

### 21. SCRUM-87: [S5-04][TV3 A.Duc][P0] Frontend 3D: Interactive Slot Click-to-Reserve & Live Occupation State
```markdown
1. Phân công: Owner TV3 A.Đức; Phối hợp TV4 Tiến.
2. Triển khai: Cho phép người dùng click trực tiếp vào ô đỗ trên mô hình 3D để xem thông tin và bấm đặt chỗ.
3. Tiêu chí: Raycaster nhận diện chính xác ô đỗ được click; ô chuyển sang trạng thái highlight vàng khi chọn.
4. Mốc bàn giao: Ngày D5.
```

### 22. SCRUM-88: [S5-05][TV1 Phat][P1] QA: Automated test suite for time-window overlap prevention & overbooking edge cases
```markdown
1. Phân công: Owner TV1 Phát & TV2 Quang.
2. Triển khai: Viết bộ automated test suites kiểm thử 30 ca kiểm thử biên về trùng dải thời gian đặt chỗ.
3. Tiêu chí: 100% ca kiểm thử pass; có minh chứng log ngăn chặn trùng lặp.
4. Mốc bàn giao: Ngày D5.
```

---

## 📌 SCRUM SPRINT 6: THANH TOÁN TRỰC TUYẾN, PHÂN QUYỀN RBAC & TỔNG NGHIỆM THU

### 23. SCRUM-89: [S6-01][TV2 Quang][P0] Backend: MoMo/VNPAY Payment Gateway Integration & Automatic Physical Slot Release Engine
```markdown
1. Phân công: Owner TV7 Sơn & TV2 Quang.
2. Triển khai: Hoàn tất tích hợp VNPay Sandbox (luồng Checkout URL và VNPay-QR), xử lý Webhook IPN an toàn.
3. Tiêu chí: Kiểm tra chữ ký HMAC SHA-512, cập nhật trạng thái đơn hàng tự động và xuất hóa đơn điện tử.
4. Mốc bàn giao: Ngày D5.
```

### 24. SCRUM-90: [S6-02][TV2 Quang][P0] Backend: Facility-Scoped RBAC & Staff Active Parking Assignment APIs
```markdown
1. Phân công: Owner TV5 N.Đức & TV2 Quang.
2. Triển khai: Kiểm tra phân quyền phạm vi cơ sở; Staff và Manager chỉ được quyền thao tác trên bãi đỗ được phân công.
3. Tiêu chí: Trả 403 Forbidden kèm thông báo rõ ràng khi truy cập ngoài phạm vi được phân công.
4. Mốc bàn giao: Ngày D5.
```

### 25. SCRUM-91: [S6-03][TV4 Tien][P0] Frontend: Checkout Payment Flow & Staff Facility Management Dashboard
```markdown
1. Phân công: Owner TV4 Tiến.
2. Triển khai: Giao diện chuyển hướng thanh toán VNPay, màn hình thành công và trang quản trị phân công nhân viên bãi.
3. Tiêu chí: Trải nghiệm mượt mà, thông báo trạng thái rõ ràng, hỗ trợ đầy đủ thiết bị Desktop và Mobile.
4. Mốc bàn giao: Ngày D5.
```

### 26. SCRUM-92: [S6-04][TV3 A.Duc][P0] Frontend 3D: Multi-Lot Switcher & Vehicle Entry/Exit Barrier Animation
```markdown
1. Phân công: Owner TV3 A.Đức.
2. Triển khai: Bổ sung hiệu ứng hoạt họa barrier mở khi xe check-in thành công và xe 3D di chuyển vào vị trí.
3. Tiêu chí: Hiệu ứng hoạt họa nhẹ nhàng, không gây giật khung hình; tăng tính trực quan cho Digital Twin.
4. Mốc bàn giao: Ngày D5.
```

### 27. SCRUM-93: [S6-05][TV1 Phat][P0] QA: End-to-End System Polish, Load Testing & Mentor Demo Verification
```markdown
1. Phân công: Owner TV1 Phát & Toàn thể nhóm.
2. Triển khai: Chạy kiểm thử tổng thể toàn bộ hệ thống, kiểm tra tải k6, đóng gói video demo và hồ sơ nghiệm thu đồ án.
3. Tiêu chí: Hệ thống sẵn sàng 100% cho buổi bảo vệ nghiệm thu trước Mentor và Hội đồng FPT Academy.
4. Mốc bàn giao: Ngày D5.
```
