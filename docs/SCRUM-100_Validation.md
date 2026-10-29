# SCRUM-100 — Báo cáo triển khai và kiểm thử

- Ngày: 29/10/2026.
- Người phụ trách: Hàn.
- Jira: [SCRUM-100](https://tn27062005.atlassian.net/browse/SCRUM-100).
- Nhánh: `features/Implementation_SCRUM-100_Hold5Minutes`.
- Trạng thái: implementation và kiểm thử tự động hoàn tất; sẵn sàng review/UAT. Việc merge, CI và xác nhận UAT được theo dõi riêng; báo cáo này không thay cho xác nhận của reviewer hoặc trạng thái Jira.

## 1. Kết quả thực hiện

| Phần | Kết quả |
|---|---|
| Mặc định policy | `hold_minutes NOT NULL DEFAULT 5`; runtime vẫn đọc cấu hình theo bãi/loại xe |
| Schema nguồn | DBML, generator, SQL đầy đủ và SQL Parking cùng mặc định 5; tái sinh trong thư mục tạm cho kết quả khớp |
| Database cũ | Migration `002_hold_default_5_minutes.sql` có transaction, chạy lại được và giữ policy tùy chỉnh |
| Database Development | Đã áp dụng lên `Parking_3D`: hai policy 5 phút, default 5, schema versions 1 và 2 |
| Nguồn thời gian | Tạo booking, worker, quote và xử lý payment dùng `TimeProvider` backend |
| Expiry | So sánh bao gồm thời điểm đúng hạn; đọc lại trạng thái/thời gian dưới khóa, giữ transaction và GiST |
| Thanh toán | Đúng/sau hạn không xác nhận hold, kể cả worker chưa chạy; replay không tạo thêm receipt/audit |
| Physical occupancy | Test tích hợp xác nhận worker không giải phóng chỗ đang có xe |
| Frontend | Dùng hạn backend; sửa làm tròn xuống gây báo hết hạn sớm trong giây cuối |
| Tài liệu và câu trả lời mẫu | Đồng bộ hold chờ thanh toán 5 phút, tách biệt thời hạn đến bãi và block tính phí |

Hai test Hàn viết ban đầu được giữ nguyên. Các kiểm thử và phần còn thiếu được bổ sung trong những file test riêng.

## 2. Bằng chứng kiểm thử

| Kiểm tra đã chạy | Kết quả |
|---|---|
| `dotnet build Parking.Microservices.slnx --no-restore --nologo -m:1` | Thành công, **0 lỗi, 0 cảnh báo** |
| Bộ `Parking.Microservices.Tests` với PostgreSQL localhost và Parking API DLL mới build | **91 test: 90 đạt, 1 bỏ qua, 0 thất bại** |
| `scripts/Test-ParkingHoldPolicy.ps1 -Offline` trước đồng bộ GitHub dev | **20 test hold: 20 đạt, 0 bỏ qua**; build các project liên quan 0 lỗi/0 cảnh báo |
| Build/chạy lại sau đồng bộ GitHub dev | Build Parking và test project **0 lỗi/0 cảnh báo**; Windows Application Control chặn tải test DLL (`0x800711C7`), chưa chạy được test trên bản sau đồng bộ |
| `npm run test:hold` | **5/5 đạt** |
| `npm run test:realtime` | **4/4 đạt** |
| `npm run build` | TypeScript và Vite build thành công; còn cảnh báo thư viện/chunk được ghi ở mục giới hạn |
| Tái sinh schema bằng hai generator trong thư mục tạm | Khớp SQL đầy đủ và SQL Parking trong repository |
| Migration Development | Đã commit DB và đọc lại default/policy/schema version; không ghi đè deadline booking |

TRX cục bộ nằm trong thư mục được Git bỏ qua:

- `artifacts/microservices/scrum100/scrum100-red.trx`: 7 test ban đầu, 5 thất bại do thiếu default và chưa sử dụng đồng hồ được inject cho các luồng cần kiểm chứng.
- `artifacts/microservices/scrum100/scrum100-regression.trx`: 91 test, 90 đạt/1 bỏ qua.
- Lượt script ban đầu báo 20/20 đạt; `scrum100.trx` sau đó đã bị ghi đè bởi lần thử lại bị Windows chặn. Không dùng file hiện tại để chứng minh 20 test đạt. Có thể đối chiếu các test hold đạt trong `scrum100-regression.trx` của lượt trước đồng bộ.
- `artifacts/microservices/scrum100/scrum100-preship.trx`: lần thử lại sau đồng bộ; bị Application Control chặn nạp DLL, không phải kết quả test nghiệp vụ đạt/thất bại.

Không dùng các file TRX có tên `focused` hoặc `green` của lượt điều tra trung gian để kết luận nghiệm thu; chúng chứa các lần phát hiện vấn đề trước khi sửa hoàn tất.

### Các tình huống đã kiểm chứng

| Tình huống | Test/bằng chứng |
|---|---|
| Booking mới hold 5 phút và deadline lưu nhất quán | `NewBookingUsesFiveMinuteHoldAndPersistsItsDeadline` |
| Chưa đến hạn | `HoldExpiryDoesNotExpireBookingBeforeDeadline` |
| Default schema thực sự là 5 | `HoldPolicyDefaultsToFiveMinutesInFreshSchema` |
| Trước/đúng/sau hạn 1 micro giây; version/audit không lặp | `HoldExpiryUsesInclusiveDeadlineAndIsIdempotent` — 3 ca |
| Payment trước/đúng/sau hạn, worker chưa chạy, delivery replay | `HoldPaymentUsesSameInclusiveDeadlineBeforeWorkerRuns` — 3 ca |
| Quote ngừng cho thanh toán từ đúng hạn | `HoldPaymentQuoteStopsAtTheSameDeadline` — 3 ca |
| Policy tùy chỉnh, đổi policy, replay không kéo dài booking cũ | `HoldPolicyChangeAndBookingReplayNeverExtendExistingDeadline` |
| Migration chạy lại, giữ policy riêng và deadline booking cũ | `HoldMigrationIsRepeatableAndPreservesCustomPoliciesAndExistingBookings` |
| Booking CONFIRMED được giữ nguyên | `HoldExpiryNeverChangesConfirmedBookingEvenAfterItsOldHoldDeadline` |
| Xe vật lý đang đỗ được bảo vệ | `HoldExpiryNeverReleasesPhysicalOccupancyEvenForAnotherExpiredHold` |
| Đặt lại đồng thời sau khi hold cũ hết hạn | `HoldExpiryAndConcurrentRebookingKeepExactlyOneReservation` |
| API tạo/GET/replay cùng deadline, envelope, JWT và readiness | `HoldHttpCreateReadAndReplayExposeTheSameFiveMinuteDeadline` |
| FAQ fallback dùng 5 phút chờ thanh toán | `HoldAssistantExplainsFiveMinutePaymentWindowWithoutCancellingConfirmedBookings` |
| Countdown theo hạn backend; đúng hạn, giây cuối, timezone, dữ liệu thiếu/sai | `bookingHold.test.mjs` — 5 ca; tải lại trình duyệt thực tế vẫn thuộc UAT |

## 3. Chạy lại

Từ thư mục gốc repository, trên máy có .NET SDK phù hợp và PostgreSQL localhost:

```powershell
./scripts/Test-ParkingHoldPolicy.ps1 -Offline
```

Script đọc cấu hình hiện có, không in mật khẩu. Tài khoản PostgreSQL cần quyền tạo database tạm. `-Offline` tận dụng package đã có và bỏ qua nguồn NuGet không truy cập được, không có nghĩa mọi dependency đều được đóng gói trong repository.

Frontend:

```powershell
cd frontend_parking_system
npm ci --ignore-scripts --no-audit --no-fund
npm run test:hold
npm run test:realtime
npm run build
```

Môi trường xác minh dùng Node 24.21.0; test hold import TypeScript trực tiếp bằng Node. Máy khác cần Node hỗ trợ cách chạy này. Dependency cài trong `node_modules` và output build không được commit.

Áp dụng migration ở môi trường khác theo hướng dẫn `database/services/README.md`. Không chạy lại schema tạo mới trên database đã tồn tại.

## 4. Giới hạn cần biết

- Test HTTP SCRUM-100 dùng **Parking API, JWT validation, gRPC transport và PostgreSQL thật**, nhưng Identity authorization là test double. Nó không chứng minh toàn bộ quy trình login/seed của Identity.
- Test cũ `RealHttpJwtGrpcScopePaymentAndSingleUseQrWorkflow` bị bỏ qua trong lượt hồi quy vì chưa cấp `PARKING_TEST_IDENTITY_DLL`; không báo test đó là đã đạt. Kiểm thử phân quyền trực tiếp trên Identity database vẫn chạy và đạt.
- Chưa thực hiện UAT trình duyệt với A.Đức/Quang, Docker deployment, CI hoặc thiết bị IoT thật.
- Countdown hiển thị dựa trên đồng hồ máy khách; client sai giờ vẫn có thể hiển thị lệch. Backend luôn quyết định hạn khi thanh toán và xử lý expiry. Chưa bổ sung giao thức đồng bộ đồng hồ frontend/server trong task này.
- Vite còn cảnh báo chú thích PURE trong SignalR và chunk lớn hơn 500 kB. Không tắt kiểm tra/cảnh báo để che kết quả.
- Build frontend ban đầu gặp 6 lỗi có sẵn về import/state không dùng trong màn hình Manager. Đã bỏ các binding không dùng để TypeScript build được; không thay đổi quy tắc nghiệp vụ Manager.
- Database Development không có booking tại thời điểm áp dụng migration (snapshot 0 dòng). Việc bảo toàn booking đã tồn tại được chứng minh bằng test tích hợp có dữ liệu, không suy ra từ database rỗng.
- Không gọi Gemini/VNPay thật để kiểm chứng các thay đổi mô tả/hold; không kết luận về sandbox thanh toán hay chất lượng AI từ các test này.

## 5. Bàn giao UAT

1. A.Đức mở booking mới, kiểm tra countdown theo `holdExpiresAt`, tải lại trang và kiểm tra giây cuối.
2. Nhật xác nhận đúng Parking database và áp dụng migration có phạm vi rõ ràng ở môi trường chung.
3. Quang thử chưa thanh toán/hết hạn/thanh toán trễ, đối chiếu trạng thái backend và kiểm tra chỗ có xe vẫn occupied.
4. Review thay đổi, chốt bằng chứng UAT và đưa lên GitHub/GitLab theo quy trình nhóm trước khi đóng Jira.

Đây là hướng dẫn bàn giao; chưa gửi tin nhắn cho các thành viên hoặc xác nhận thay họ.

## 6. Chuẩn bị đưa lên GitHub

- Đã fetch `github/dev`, đồng bộ thay đổi `fe84c54` về dung sai `startsAt` 5 phút, đồng thời giữ `TimeProvider` trong SCRUM-100.
- Lịch sử nhánh Design đã được tích hợp vào Implementation để giữ hai giai đoạn và tránh xung đột add/add tài liệu.
- Đã thử chạy lại script kiểm thử hold sau khi đồng bộ và thử lại đúng DLL một lần: cả hai bị Windows Application Control chặn nạp test DLL (`0x800711C7`). Build vẫn 0 lỗi/0 cảnh báo. PR cần chạy lại test trên môi trường được phép/CI trước khi merge; chưa xác minh test trên bản sau đồng bộ.
- Chỉ đưa source, schema/migration, test/script và tài liệu vào Git. Secrets, `node_modules`, build output và TRX/log cục bộ được loại trừ.
