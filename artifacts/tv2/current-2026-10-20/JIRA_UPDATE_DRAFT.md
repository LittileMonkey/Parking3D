# Nội dung cập nhật Jira — bản nháp để Quang tự gửi

Chưa đăng Jira, chưa thay trạng thái ticket. Mapping theo hồ sơ đã xác minh trước đây; cần xem lại ticket hiện tại trước khi gửi.

## SCRUM-55

Đã cập nhật matrix phân quyền theo bãi, policy/oracle vận hành–tài chính và bộ 32 acceptance case theo GitHub dev11e5652. Đã rà soát các boundary Gateway/Identity/Parking/Payment/Staff UI và chạy bổ sung test trên cluster PostgreSQL18.4 riêng.

Bằng chứng: test Staff đúng bãi LOOKUP FAIL tại ParkingWorkflowTests.cs:280; Identity chưa nhận LOOKUP/CHECK_IN. Probe anonymous HTTP xác nhận CASH/status mới đi vào nghiệp vụ mà chưa challenge401; CASH error thiếu ApiResponse. Gateway check-in trả404 fallback. Các vấn đề JWT/bootstrap/health và UI localStorage/fallback được ghi SOURCE_REVIEW.

Đã chuẩn bị BUG_REGISTER.md, RBAC_POLICY.md, TEST-CASES.json/CSV, Postman và TRX. Cần TV5/TV7/TV8/TV4 xử lý và phối hợp TV6 retest. Policy hold default15 so với fixture5 còn chờ review. Chưa đề nghị Done vì chưa hoàn tất acceptance RBAC/CASH/QR qua Gateway và PostgreSQL17.

## SCRUM-52

Đã chạy lại bộ test của nhóm trên11e5652, tổng52: **50PASS,1FAIL,1SKIP**; 12 database tests về hold/QR/check-in/concurrency/rollback PASS. Không cộng dồn kết quả38 test của lượt trước. HTTP probes riêng:1PASS,3FAIL về authorization status,1 observed missing route; thêm2 response lỗi envelope.

Parking API, Payment API và Gateway build0warnings/0errors. Test project có warnings Identity; chưa khẳng định toàn solution/CI sạch. PostgreSQL18.4 là bổ sung, baseline17 chưa kiểm chứng; HTTP full Identity workflow SKIP, Staff UI/provider E2E chưa nghiệm thu.

Đã có regression report, bug register, acceptance matrix, sanitized evidence và kịch bản trình bày/demo. Đề nghị review deliverables; giữ gate acceptance mở cho đến khi có fix commit và retest. Không đánh dấu32 acceptance case PASS từ số50 automated tests.
