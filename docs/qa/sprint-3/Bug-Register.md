# Bug/retest register — Sprint 3

Base source review:be3b5f6. Severity/priority là đề xuất, không tự thay Jira. SOURCE_REVIEW khác lỗi đã tái hiện HTTP. Quang không sửa backend thay owner trong gói này.

| ID | Finding | Bằng chứng / trạng thái | Owner | Điều kiện đóng |
|---|---|---|---|---|
| QA-S3-01 | Testhost Identity thiếu SeedAdmin config | Test suite95PASS/1FAIL, lỗi startup được tái hiện | N.Đức/Nhật | Testhost cấu hình đúng, ca HTTP chạy thực sự và cóTRX |
| QA-S3-02 | Gateway check-in trước đây thiếu route | 577064b:404; be3b5f6 retest API200 và DB đúng1session/assignment; CLOSED_AT_API_BOUNDARY | Nhật/Tiến/Quang | Đã PASS API; vẫn cần full Staff UI E2E, không suy ra toàn hệ thống Done |
| QA-S3-03 | Staff CASH lỗi vẫn tạo COMPLETED/paymentId/actor giả | SOURCE_REVIEW staffApi.ts, OPEN, P0 đề xuất | Tiến/Sơn | Outage/timeout không success giả; status query và retry không doubleeffect |
| QA-S3-04 | Staff check-in lỗi vẫn operational fallback | SOURCE_REVIEW staffApi.ts, OPEN | Tiến/Hàn | API lỗi không tạo local session thành công hoặc hiển thị đã vào |
| QA-S3-05 | Checkout thay đổi localStorage, chưa thấy checkout/physical-exit API trêndev | SOURCE_REVIEW, dependency blocker của full lifecycle | Hàn/Sơn/Tiến | SessionDB/assignment quyết toán đúng; paid-but-present không vacate |
| QA-S3-06 | FE có /hubs/parking client, chưa thấy backend AddSignalR/MapHub | SOURCE_REVIEW, integration pending | Hàn/Nhật/A.Đức | Event sau commit, scope theo bãi, reconnect tải snapshot; UI+DB evidence |
| QA-S3-07 | Payment controller actor có header/default ID; một số đường không Authorize | SOURCE_REVIEW; không suy rộng sang CASH scoped endpoint cũ | Sơn/N.Đức | Guest401/customer403/crosslot403, actorJWT/current assignment, no writes |
| QA-S3-08 | Payment authorization timeout có fail-open với UUID khác rỗng | SOURCE_REVIEW PaymentService.cs | Sơn/N.Đức | Identity outage từ chối/503 phù hợp, không cho qua chỉ vì cóUUID |
| QA-S3-09 | FE đăng ký và cấpQR cần đồng bộ contract | SOURCE_REVIEW Register/api.ts, backend register/QR | A.Đức/N.Đức/Hàn | Register đúng DTO/validation; Confirmed lấy serverQR thật; tokenkhôngrò |

Mỗi retest bổ sung fix commit, runID, fixture/policy revision, steps, expected/actual, sanitized evidence và outcome. Chỉ đóng finding khi đã xác minh đúng boundary yêu cầu; source thay đổi chỉ là fixed-awaiting-retest.

