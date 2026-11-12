# Báo cáo TV2 Quang — dùng cho cuộc họp 16/10/2026

Ngày lập: 15/10/2026. Phạm vi: SCRUM-55 (RBAC/policy/test vận hành), SCRUM-52 (regression/evidence/demo). Mapping theo bản Jira đã xác minh ngày 13/10; chưa đọc lại Jira trực tiếp ngày 15/10. Đây là báo cáo chuẩn bị và source review, không phải biên bản nghiệm thu runtime.

## Kết quả có thể bàn giao

| Đầu ra | Bằng chứng | Trạng thái |
|---|---|---|
| Matrix quyền, 12 policy và oracle tài chính | ../worktree-design/docs/tv2/SCRUM55-RBAC-POLICY.md | Có bản nháp; cần owner review/chốt |
| 32 ca kiểm thử có expected/owner/evidence/retest | ../worktree-tests/docs/tv2/TEST-CASES.json và CSV | Đã chuẩn bị; 32 NOT_RUN |
| Postman 11 request và environment 8 biến | ../worktree-tests/docs/tv2/TV2-RUNTIME.postman_collection.json; TV2-LOCAL.postman_environment.json | JSON đọc được; chưa chứng minh API PASS |
| Báo cáo regression, quy trình bug/retest và demo | ../worktree-tests/docs/tv2/SCRUM52-REGRESSION-REPORT.md | Bản 13/10; cập nhật mới nhất dùng báo cáo này |
| Rà soát GitHub ngày 15/10, phân biệt dev/main, cập nhật findings | EVIDENCE.txt và bảng bên dưới | Đã thực hiện source review |

Không dùng số lượng tài liệu/test case để quy đổi phần trăm hoàn thành story. Chưa có owner approval, runtime evidence, UI acceptance hoặc PR review/merge cho bộ QA này.

## Phiên bản khảo sát

- GitHub dev: d4a37fa8128922d8471e2f07aef5bf07d521d57a.
- GitHub main: b3b788384e26dfc8e043174c096746417a7d3097.
- main có sửa vòng đời dependency HoldExpiryWorker; dev chưa có sửa này. Không dùng kết quả review dev để nói main còn lỗi worker.
- Workspace chính không được pull/merge hoặc sửa backend trong lần báo cáo này; source dev được xuất riêng trong thư mục source để khảo sát.

## Findings cập nhật và việc cần nhóm hỗ trợ

Các nhận xét sau là SOURCE_REVIEW; chưa tái hiện HTTP/DB trên hệ thống chạy.

| ID | Nhận xét và bằng chứng | Trạng thái / owner | Tiêu chí retest |
|---|---|---|---|
| TV2-001 | Build fail trên c28baab là kết quả lịch sử. Dev mới đã sửa handler/reference; lần test 15/10 chưa hoàn tất restore, đã dừng, không có TRX | Chưa xác minh build mới; Nhật/N.Đức | Build + test solution trên commit tích hợp, lưu exit code/TRX |
| TV2-002 | Identity Program.cs chưa thấy AddGrpc/MapGrpcService/health defaults; Parking và Payment vẫn gọi FacilityAuthorization | Còn rủi ro contract; Nhật/N.Đức | Gateway ready, gRPC current assignment, revoked/expired JWT tests |
| TV2-003 | Parking Program.cs đăng ký FakeEstimatedPriceService | Còn mock Search quote; Sơn | Quote đổi theo DB fixture/duration/cap; CHEAPEST đúng tổng phí |
| TV2-004 | Hold default 5/15 phút còn cần decision có phê duyệt | Chờ policy; Nhật/Hàn/mentor | Ghi policy revision, boundary tests đúng giá trị đã duyệt |
| TV2-005 | PasswordHasherService đã bỏ log hash | Đã sửa qua source review; N.Đức | Capture logger bằng dữ liệu synthetic trước khi đóng finding runtime |
| TV2-006 | Chưa tìm thấy API issuance/consume QR hoặc check-in trong source Parking dev | Chờ bàn giao API; Hàn | Wrong lot/vehicle/expired/reused/unpaid, hai check-in đồng thời chỉ một session |
| TV2-007 | AuthenticationController đã dùng api/v1/auth | Đã sửa route qua source review; N.Đức/Nhật | Login qua Gateway, envelope/JWT forwarding đúng |
| TV2-008 | PaymentsController POST api/v1/payments/cash/confirm không có Authorize tại controller/action; fallback actor staff_01. Handler đi thẳng repository giả lập Success; GET status tạo paymentId mới và trả Pending/45000. Không thấy scope/owner/DB effect trong đường gọi này | Critical/P0 đề xuất, cần xác minh runtime; Sơn/Nhật | Guest 401; Customer/cross-lot 403; actor thật; state/receipt/outbox/audit lưu DB; retry không thêm effect; GET phản ánh dữ liệu thật |
| TV2-009 | dev: singleton hosted HoldExpiryWorker nhận trực tiếp scoped IParkingRepository. main đã sửa dùng IServiceScopeFactory trong 64df58e | Dev chưa có fix; Nhật/Hàn | Chốt commit tích hợp có fix, startup scope validation và expiry idempotence PASS |
| TV2-010 | staffApi.ts còn nhánh mock/localStorage/fallback | Chưa đủ UI acceptance; Tiến/Quang | Chạy UI với API thật; dependency outage hiển thị lỗi; không coi dữ liệu giả là effect DB |

Endpoint CASH cũ có RequireAuthorization và gọi PaymentService vẫn tồn tại. Finding TV2-008 áp dụng đường controller mới, không kết luận mọi đường thanh toán đều mock hoặc thiếu auth. Cần xác minh Gateway và chính sách authorization toàn cục khi tái hiện.

## Trạng thái hai task để báo cáo

- SCRUM-55: đã chuẩn bị matrix/policy/oracle/cases; đang chờ review policy và runtime RBAC/CASH/QR. Chưa đủ Done.
- SCRUM-52: đã chuẩn bị regression package, cập nhật findings và kế hoạch retest; 32 ca NOT_RUN, chưa có acceptance PASS. Chưa đủ Done.
- Những việc phụ thuộc API/môi trường được ghi Blocked theo từng ca khi thực thi; không tự chuyển trạng thái Jira hoặc giao việc cho người khác trên hệ thống.

## Đề nghị trong cuộc họp 16/10

1. Nhật chốt một commit tích hợp và cung cấp Gateway/test DB riêng, seed ba bãi, build/test/ready evidence; bảo đảm có fix worker của main.
2. N.Đức xác minh gRPC current authorization; Sơn nối CASH controller vào luồng persistence/authorization thật và bỏ mock status/quote trong đường nghiệm thu.
3. Hàn bàn giao contract và fixture QR/check-in; owner chốt hold, QR TTL, arrival window và response owner/scope.
4. Quang chạy negative RBAC trước, sau đó CASH thành công/retry/late + DB assertions, rồi QR/session/concurrency và Staff UI. Phát cung cấp evidence Customer để tổng hợp regression.

## Nội dung nói ngắn trong cuộc họp

“Phần của em là SCRUM-55 và SCRUM-52. Em đã chuẩn bị matrix quyền, policy/oracle tài chính, 32 test case, Postman và khung regression/bug/retest. Em đã rà lại GitHub ngày 15/10: route auth và log password hash đã được sửa qua code review; main có fix hold worker nhưng dev chưa có. Em thấy CASH controller mới vẫn dùng repository giả lập, Search còn giá giả, Identity cần xác minh gRPC và QR/check-in chưa thấy API. Vì vậy em chưa ghi PASS hoặc Done. Em cần nhóm chốt bản tích hợp chạy được và fixture để thực thi RBAC/CASH/QR, lưu bằng chứng DB rồi retest và tổng hợp báo cáo.”

## Giới hạn xác minh

Không xác minh Jira trực tiếp, CI hiện tại, API/DB/UI runtime, quyền phê duyệt policy hoặc PR acceptance trong lần này. Test 15/10 bị dừng trước khi có kết quả; không kế thừa build FAIL 13/10 thành kết luận build FAIL hiện tại. Các tài liệu 13/10 được giữ làm lịch sử; báo cáo này thay phần kết luận hiện tại.
