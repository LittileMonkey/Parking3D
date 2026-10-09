# Mandatory Pre-Execution Rule Check (Quy tắc Duyệt MD trước khi thực thi)

Mọi hành động thực thi, sinh mã hoặc chạy lệnh đều phải tuân thủ nghiêm ngặt quy trình 3 bước sau:

1. **Duyệt qua các file `.md` liên quan trước:**
   - Tra cứu thư mục `docs/` (`00-PROJECT-OVERVIEW.md` đến `10-DESIGN.md`, `APIDesignTemplate.md`, `GitlabGuide.md`, `06-CODING-STANDARDS.md`).
   - Tra cứu thư mục `update103/` (`11-AI-EXTENSION.md`, `Parking_Database_V4.dbml`).
   - Đọc `AGENTS.md` tại thư mục gốc.

2. **Rà soát xung đột (Cross-check & Conflict Detection):**
   - Đảm bảo quy tắc đặt tên: DB dùng `snake_case`, C# dùng `PascalCase`, URL dùng `kebab-case`.
   - Đảm bảo phiên bản công nghệ: C# 13, .NET 10, PostgreSQL 17.
   - Đảm bảo khung phản hồi: Bắt buộc chuẩn hóa theo `ApiResponse<T>`.
   - Đảm bảo quy tắc phân nhánh Git: `features/Design_<Story>` và `features/Implementation_<Story>`, không merge bừa bãi.

3. **Áp dụng rule lên từng Syntax và Folder:**
   - Chỉ khi đã đối chiếu và xác nhận không có bất kỳ mâu thuẫn nào giữa các rule mới được phép viết file hoặc chạy lệnh terminal.
