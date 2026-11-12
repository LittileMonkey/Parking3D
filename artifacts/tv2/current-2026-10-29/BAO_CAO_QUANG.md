# KẾT QUẢ KIỂM TRA — QUANG TV2, 29/10/2026

## Kết luận
Dự án build được, giao diện mở được và có luồng API thật đến check-in trực tiếp. Chưa hoàn chỉnh E2E xe vào–ra qua UI/Gateway; SCRUM-77 chưa đủ điều kiện Done theo mô tả trong tài liệu nhóm.

Code: GitHub dev 577064b. Không sửa source sản phẩm, không push và không cập nhật Jira. Năm file 3D local cùng preview/tests cũ được cất trong stash `local-3d-before-github-dev-sync-2026-10-29` và sao lưu tại artifacts/local-backup-before-sync-2026-10-29; không trộn với FE mới để tránh conflict. File/báo cáo khác giữ nguyên.

## Đã thực thi
| Kiểm tra | Kết quả | Giới hạn |
|---|---|---|
| Restore backend, npm ci | Thành công | Không phải dependency security audit |
| Build toàn solution | PASS, 0 warning / 0 error | SDK10 chạy target net9; không chứng minh runtime E2E |
| Build frontend | PASS | Có cảnh báo bundle >500kB; không phải lỗi build |
| FE realtime tests | 4 PASS | Parse/batch state; chưa có backend Hub thật |
| FE countdown tests | 5 PASS | Code hiện tại hold5; không đồng nhất countdown với block tính tiền15 |
| Bộ test trên PostgreSQL18.4 riêng | 95 PASS / 1 FAIL / 0 SKIP, tổng96 | Có test mock/stub và repository; không quy đổi thành coverage/acceptance toàn hệ thống |
| Browser smoke không backend | Home, booking và Staff render; search redirect booking; không pageerror | Staff có dữ liệu demo; không phải UI dùng API thật |
| Mobile booking/search | scrollWidth390 = viewport390 trong lần đo | Không thay accessibility audit toàn bộ |
| Chuỗi API thật với cấu hình riêng | Đăng ký/login, Gateway ready, list/search, booking, CASH, QR đều200 | Dữ liệu synthetic, hai bãi fixture; không gọi VNPay/OCR provider |
| Check-in qua Gateway | 404 | Route chưa có trong cấu hình dev |
| Check-in trực tiếp Parking API | 200; DB CHECKED_IN, 1 active session, 1 occupied assignment | Bypass Gateway được ghi rõ; chưa phải đường FE thật |

Ca FAIL hiện tại: RealHttpJwtGrpcScopePaymentAndSingleUseQrWorkflow. Test host Identity dừng vì thiếu SeedAdmin config; wrapper cũ truyền SeedAccounts__Enabled=false nhưng startup không dùng cờ đó. Ngoài ra test host dùng port ngẫu nhiên và emailNormalized trong khi Identity hiện hard-code5041/5042/7023 và login dùng email. Hai điểm sau là đối chiếu source, chưa phải assertion tiếp theo đã thực thi. Không sửa test để che lỗi. Khi dựng cấu hình synthetic đúng ở Run-RealApi-Demo.cjs, Identity thật đăng ký/login thành công.

## Phần chưa chạy được hoặc chưa được nghiệm thu
- /api/v1/check-in chưa được Gateway route; đã tái hiện404.
- Chưa tìm thấy checkout/physical-exit API ở Parking dev. Staff checkOutVehicle đổi trạng thái trong localStorage, không chứng minh session DB đã hoàn tất.
- FE có client /hubs/parking nhưng chưa thấy AddSignalR/MapHub phía backend; không chứng nhận realtime xuyên hệ thống.
- Staff confirmCashPayment vẫn bắt API lỗi rồi tự tạo COMPLETED/paymentId/actor; cần sửa và test outage.
- PaymentsController chưa có Authorize và còn actor fallback từ header/seed ID; đây là source review, cần tái hiện quyền trên test DB trước nghiệm thu. Không suy rộng sang endpoint CASH scoped cũ vốn có RequireAuthorization.
- Chưa nghiệm thu VNPay sandbox/chữ ký/callback thật, OCR/provider, dataset100 ảnh, mất vé, overtime/checkout hoặc barrier thật.
- PostgreSQL17 baseline chưa xác minh; lần này dùng binary18.4 có sẵn.
- Hold hiện tại trong dev đã đổi5 phút; tài liệu/AGENTS người dùng cung cấp trước đó yêu cầu15. Báo cáo ghi hành vi thực tế5; nhóm cần chốt policy trước acceptance, không tự sửa giá trị trong lần review này.

## Quang có thể hoàn thành gì?
1. Hoàn thành bộ scenario/test design, traceability và dữ liệu test cho SCRUM-77.
2. Hoàn thành báo cáo test từng phần:95 PASS/1 FAIL, FE9PASS, screenshot/video rendering, API thật CASH→QR→direct check-in.
3. Hoàn thành bug register và criteria retest cho Gateway, checkout/physical exit, SignalR, CASH fallback và testhost config.
4. Chuẩn bị Postman/demo và trình bày luồng đã chạy; ghi rõ phần bypass/mô phỏng.
5. Retest sau owner fix; chỉ đề nghị Done SCRUM-77 khi có UI/Gateway E2E, trạng thái DB/slot đúng sau exit và video/log tương ứng.
6. Nếu SCRUM-78 đang gán Quang: có thể chuẩn bị/kiểm nhãn dataset và giao thức benchmark; chưa có bằng chứng đủ100 ảnh/provider accuracy trong lần này.

Không xác minh Jira live ngày 29/10; mapping SCRUM-77 lấy docs/12-JIRA-TASK-DESCRIPTIONS.md. Chưa biết mã issue mentor bổ sung hiện tại; không tự tạo hoặc chuyển trạng thái Jira.

## Evidence
- backend-build.log, frontend-build.log, frontend-realtime.log, frontend-hold.log.
- results/tv2-isolated.trx và isolated-run.log.
- DEMO_API_EVIDENCE.json (token/QR/secret được che), demo-api-run.log.
- browser/results.json, PNG desktop/mobile; browser/video/*.webm chỉ quay rendering UI.
- KICH_BAN_DEMO.md: các bước trình bày và lệnh chạy lại.

