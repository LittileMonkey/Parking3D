# Quang TV2 — làm gì tiếp theo

**Cập nhật theo yêu cầu của Quang:** đã xóa hai nhánh remote GitHub vừa đẩy. Bản local vẫn giữ để đọc/review. Các dòng mô tả push và link nhánh bên dưới là lịch sử, không còn trạng thái hiện tại. Chưa tạo PR hoặc push GitLab. Chỉ đẩy lại khi Quang yêu cầu sau khi đọc.

Đã xác minh Jira trực tiếp và fetch hai remote ngày 13/10/2026.

| Task của vonhatquang817 | Phần việc | Trạng thái hiện tại | Hạn |
|---|---|---|---|
| [SCRUM-55](https://tn27062005.atlassian.net/browse/SCRUM-55) | RBAC/policy tài chính + test Staff/CASH/QR/check-in | Đang Xem | 20/10 |
| [SCRUM-52](https://tn27062005.atlassian.net/browse/SCRUM-52) | Regression/report/evidence/demo | Đang Xem | 20/10 |

TV2 là BA/tester: review quyền/policy, thiết kế và chạy test, báo bug/retest, tổng hợp evidence. BE/FE còn thuộc owner hiện tại. Mapping trong tài liệu phân công local cũ bị đảo 52/55; Jira trực tiếp có tiêu đề và description xác nhận bảng trên.

## Đã làm cho bạn

- Matrix quyền, 12 policy decisions, oracle tài chính, acceptance và lịch 13–20/10: `worktree-design/docs/tv2/SCRUM55-RBAC-POLICY.md`.
- 32 test case có requirement/owner/preconditions/steps/expected/evidence/retest: `worktree-tests/docs/tv2/TEST-CASES.csv` và JSON. Mọi case NOT_RUN.
- Collection Postman 11 request và environment token rỗng: `worktree-tests/docs/tv2/TV2-RUNTIME.postman_collection.json`, `TV2-LOCAL.postman_environment.json`; README chỉ cách dùng và điều kiện fixture.
- Báo cáo 7 findings, gate, bug/retest và demo script: `worktree-tests/docs/tv2/SCRUM52-REGRESSION-REPORT.md`.
- Chạy dotnet test thật trên GitHub dev c28baab: restore chạy, build fail, chưa execute test. Log trong `worktree-tests/docs/tv2/BUILD-EVIDENCE.txt`. Validate JSON/cases/script thành công, không đồng nghĩa runtime PASS.
- Commit và push nhánh QA lên GitHub; không sửa code/đổi trạng thái task người khác, không merge hoặc ký acceptance. Workspace chính và bộ TV2 cũ được giữ nguyên.

## Việc tiếp theo đúng thứ tự

1. Review matrix/policy với N.Đức (quyền/Identity), Hàn (hold/QR/session), Sơn (giá/CASH), Tiến (Staff UI), Nhật (tích hợp). Default hold 15 theo AGENTS khác GitHub dev đổi 5; cần approval/revision rõ. TV2 không tự chốt thay mentor.
2. Nhật/N.Đức thống nhất nhánh tích hợp: GitHub dev c28baab fail build nullable và host Identity thiếu grpc/health/route theo contract; GitLab dev c7d1f52 giữ microservice Identity cũ. Không coi lỗi GitHub là lỗi GitLab. Xử lý hash logging trong Identity mới. Chưa chạy full runtime khi còn các blocker này.
3. Sau build/ready đạt, chạy scope/CASH cases qua Gateway và kiểm DB effect trong test environment riêng. Sơn thay mock Search (bãi hardcoded, mọi giá 50.000) trước nghiệm thu search/quote; phối hợp Phát evidence Customer.
4. 16/10 nhận QR/check-in từ Hàn; chạy wrong-lot/vehicle/expired/reused/unpaid và concurrency một active session. Chưa có API thì Blocked API, không tự ghi FAIL/PASS.
5. 19/10 tổng hợp regression; 20/10 retest/demo/review. Chưa Done khi còn bug chặn P0 hoặc thiếu evidence. OCR/VNPay/forecast P1 chỉ nhận khi đủ điều kiện, không thay cam kết P0.

## Bàn giao GitHub

- [Nhánh design SCRUM-55](https://github.com/LittileMonkey/Parking3D/tree/features/Design_SCRUM55_TV2)
- [Nhánh QA SCRUM-52](https://github.com/LittileMonkey/Parking3D/tree/features/Implementation_SCRUM52_TV2)
- [Tạo PR design vào dev](https://github.com/LittileMonkey/Parking3D/compare/dev...features/Design_SCRUM55_TV2?expand=1)
- [Tạo PR QA vào dev](https://github.com/LittileMonkey/Parking3D/compare/dev...features/Implementation_SCRUM52_TV2?expand=1)

PR chưa tạo: GitHub browser chưa đăng nhập, API auth từ phiên Git không khả dụng dù git push hoạt động. Dùng draft PR, chưa tick review/runtime/CI thành công. Không push GitLab Implementation khi tests fail: AGENTS yêu cầu fetch/rebase nhánh tích hợp + toàn tests đạt trước nộp. Nhánh thực tế hai remote là dev, không thấy develop. Không có thông báo/comment Jira gửi thay bạn.

Mẫu title design: `[Docs][SCRUM-55] TV2 RBAC acceptance and policy decision log`. Mẫu title QA: `[Test][SCRUM-52] TV2 regression preparation and current build blockers`.

Mẫu body: mô tả deliverables và link Jira, ghi commit khảo sát c28baab, đính report/log; DoD/Review Checklist: tài liệu/cases đã chuẩn bị, owner review/policy approval/runtime manual test/CI còn chưa đạt. Test Coverage: 32 NOT_RUN cases, 11 prepared Postman requests, dotnet test build fail; không có runtime coverage mới. Nhánh QA liên kết nhánh matrix design.
