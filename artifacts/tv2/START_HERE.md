# Bộ bàn giao TV2

1. Đọc TV2_GUIDE.docx và TV2_SPEC_API_TEST_PLAN.md.
2. Review 18 policy/gap với owners; không tự chốt ô mở.
3. Dùng TV2_WORKBOOK.xlsx: matrix, policy, 64 cases, oracle, fixture/source/bug log.
4. Postman collection/env là draft 8 endpoints, default localhost port0, token rỗng. BE phải chốt API, seed/reset fixture và cung cấp token trước chạy riêng trên Development. Không chạy trên dữ liệu thật; write request có thể thay đổi DB test. Replay test phải giữ cùng key thay vì {{$guid}} mới.
5. Case partial variants không tính PASS đến khi đủ evidence. Runner tuần tự không là test concurrency. Callback VNPay cần signed fixture/harness TV7; không có chữ ký/secret trong bộ.
6. Tất cả case Not run, không có báo cáo PASS giả. Scope/revenue/arrival/exit/cancel mở phải blocked khi thực thi.
7. Sources snapshot 06/10/2026; dev vừa cập nhật30c402f, không đồng nghĩa backend đã tích hợp. Chưa push/gửi cho người khác.
