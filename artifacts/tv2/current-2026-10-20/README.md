# Bộ bàn giao TV2 Quang — 20/10/2026

**Mở BAO_CAO_MENTOR.md trước để chuẩn bị báo cáo.** Commit11e5652. Đây là deliverables QA thực tế, chưa phải nghiệm thu Done hoặc cập nhật Jira.

## File chính

| File | Dùng để làm gì |
|---|---|
|BAO_CAO_MENTOR.md|Bài nói60–90giây và trả lời câu hỏi mentor|
|REGRESSION_REPORT.md|Kết quả, môi trường, giới hạn, gate nghiệm thu|
|RBAC_POLICY.md|Matrix quyền, oracle và quyết định cần review|
|BUG_REGISTER.md|8 bug/decision, evidence, owner đề xuất, retest|
|TEST-CASES.csv / json|32 acceptance case; phân biệt evidence hỗ trợ và acceptance result|
|JIRA_UPDATE_DRAFT.md|Nội dung để tự cập nhật52/55, chưa gửi|
|SUMMARY.json|Số liệu tóm tắt, nguồn TRX/HTTP|
|results/*.trx|Bằng chứng automated test có thể mở bằng Visual Studio|
|HTTP-EVIDENCE.json|Response anonymous synthetic, không token/password|
|TV2-RUNTIME.postman_collection.json|12 request chuẩn bị cho acceptance, collection chưa chạy toàn bộ|
|TV2-LOCAL.postman_environment.json|Biến token/ID để trống, điền trên máy test riêng|

## Demo cho mentor khoảng3–5phút

1. Nêu phạm vi SCRUM-55/52 và commit; mở REGRESSION_REPORT.md.
2. Mở TRX DB:50PASS/1FAIL/1SKIP. Giải thích12testDB đã chạy, FAIL LOOKUP và SKIP full HTTP.
3. Mở HTTP-EVIDENCE.json: anonymous CASH404/400 thay401; control create-payment401; Gateway check-in404 fallback. Chỉ chứng minh auth boundary/route, chưa successful payment mutation.
4. Mở BUG_REGISTER.md để chỉ owner và điều kiện retest; mở RBAC_POLICY.md cho decision hold15/5.
5. Nêu bước tiếp theo: owner fix tích hợp, chạy PostgreSQL17, retest API/UI thật và xin review. Không demo UI success giả là kết quả DB.

Nếu muốn chạy lại: build đúng commit và dùng Run-IsolatedTests.ps1. Script chỉ dùng binary PostgreSQL đã cài, tạo cluster riêng. Lượt hiện tại dùng PostgreSQL18.4; không ghi là17. Run-Http-Probes.cjs cần Payment/Gateway đã build. Hai runner dừng host/cluster khi xong, giữ thư mục cluster làm evidence local. Không đưa cluster hoặc log host vào file gửi mentor.

Postman: import collection + environment; chọn môi trường test riêng, điền IDs/token từ fixture local. Request11 cấp QR, request12check-in có ghi dữ liệu test; không chạy trên DB nhóm/production. Gán qrPayload từ response11 trên máy, không lưu token/QR vào báo cáo. Collection có case known failing; lỗi không phải lý do sửa expected thành actual. Runner tuần tự không chứng minh concurrency; assertion HTTP không thay DB assertion.

## Trạng thái công việc

- Hoàn thành trong phiên này: cập nhật hồ sơ QA, rerun tests, HTTP probes, evidence, bug/retest và nội dung báo cáo.
- Còn thiếu acceptance: PostgreSQL17, JWT/Identity/Gateway đồng bộ, authenticated scope/CASH chain, Staff UI thật, review policy và fix/retest.
- Không sửa service BE/FE, không commit/push, không gửi mentor/Jira. Số test của team không phải số test tự viết mới của Quang.
