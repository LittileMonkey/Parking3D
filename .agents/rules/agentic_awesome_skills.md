# BỘ QUY TẮC BẮT BUỘC TỪ AGENTIC AWESOME SKILLS (AAS RULES)

Tài liệu này tích hợp các chuẩn mực kỹ thuật và quy trình từ thư viện **Agentic Awesome Skills (AAS)** vào hệ thống Antigravity AI Assistant. Quy tắc này **BẮT BUỘC ÁP DỤNG CHO MỌI CÂU PROMPT, MỌI THAO TÁC SỬA LỖI (BUG FIX), PHÁT TRIỂN VÀ REVIEW CODE**.

---

## 1. NGUYÊN TẮC BẤT BIẾN: THE IRON LAW OF SYSTEMATIC DEBUGGING
```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
(TUYỆT ĐỐI KHÔNG SỬA CODE KHI CHƯA ĐIỀU TRA RÕ NGUYÊN NHÂN GỐC RỄ)
```
- **Không đoán mò (No guessing):** Cấm áp dụng các bản vá vội (quick patch) để che đậy lỗi tạm thời.
- **Quy trình 4 pha bắt buộc khi fix bug:**
  1. **Phase 1 - Root Cause Investigation:** Đọc toàn bộ stack trace, xác định chính xác dòng code, bảng CSDL, API contract, hoặc logic gây lỗi.
  2. **Phase 2 - Hypothesis & Verification:** Đưa ra giả thuyết nguyên nhân và kiểm chứng dựa trên code thực tế và schema.
  3. **Phase 3 - Minimal & Clean Repair:** Sửa lỗi đúng bản chất, bảo toàn các ràng buộc CSDL (check constraints, unique indexes), không gây tác dụng phụ (side effects).
  4. **Phase 4 - Verification:** Chạy kiểm thử tự động (`dotnet build`, unit/integration test) để chứng minh lỗi đã được giải quyết triệt để.

---

## 2. NGUYÊN TẮC TEST-DRIVEN & CONTRACT TESTING
- **API Contract Verification:**
  - Mọi phản hồi API REST bắt buộc tuân thủ đúng định dạng chuẩn `ApiResponse<T>`:
    `{ "result": ..., "isSuccess": true/false, "statusCode": ..., "message": "..." }`.
  - Mã lỗi HTTP phải phản ánh đúng bản chất: `400 Bad Request` cho dữ liệu đầu vào sai, `401 Unauthorized` khi thiếu token, `403 Forbidden` khi sai quyền, `404 Not Found` khi không tìm thấy tài nguyên, `409 Conflict` khi vi phạm version/concurrency/state.
  - Tuyệt đối không trả về `HTTP 200 OK` kèm cờ `Failed` cho các lỗi client request.
- **Kiểm thử đa tầng:**
  - Viết hoặc cập nhật test cases kiểm thử các edge cases (chuỗi rỗng, null, định dạng sai, concurrent requests).

---

## 3. NGUYÊN TẮC CONCISE PLANNING & TRÌNH BÀY
- Trước khi thực hiện các tác vụ phức tạp hoặc sửa lỗi lớn:
  - Lập kế hoạch ngắn gọn, có cấu trúc rõ ràng (Concise Planning).
  - Nêu rõ: Nguyên nhân gốc rễ -> Giải pháp sửa đổi -> Các file bị tác động -> Tiêu chí nghiệm thu (Acceptance Criteria).

---

## 4. AN TOÀN HỆ THỐNG & CODE REVIEW CHECKLIST
- **Không rò rỉ bộ nhớ (Memory Hygiene):**
  - Không lưu trữ trạng thái người dùng/phiên chat trong RAM server không giới hạn (`ConcurrentDictionary` không có TTL). Bắt buộc phải có TTL, eviction policy hoặc lưu trữ persistent/cache phân tán (Redis/DB).
  - Đảm bảo an toàn luồng (thread safety) cho các cấu trúc dữ liệu dùng chung.
- **Bảo mật & Giới hạn tài nguyên:**
  - Validate nghiêm ngặt magic bytes và kích thước file upload.
  - Phân quyền theo cơ sở (Facility-Scoped RBAC) và bảo vệ phiên người dùng.
  - Thêm Rate Limiting / Guardrails khi gọi các dịch vụ tốn phí (Gemini API, OCR model).

---

## 5. THỰC THI TRÊN MỌI PROMPT
- Với mỗi yêu cầu tiếp theo từ người dùng:
  - Tự động kích hoạt mindset và quy trình của Agentic Awesome Skills.
  - Kiểm tra đối chiếu với tài liệu `docs/` và CSDL trước khi code.
  - Xác minh build và test thành công trước khi báo cáo hoàn thành.
