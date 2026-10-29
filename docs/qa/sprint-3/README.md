# Sprint 3 — QA của Quang (TV2)

Đầu ra kiểm thử cho SCRUM-77 và hồi quy feedback mentor. Đây là tài liệu QA/test; không thay source nghiệp vụ của các thành viên khác và không chứng nhận toàn hệ thống đã Done.

## Hai nhánh bàn giao

- `features/Design_SCRUM77_QA`: kế hoạch, 12 acceptance cases, traceability feedback mentor.
- `features/Implementation_SCRUM77_QA`: báo cáo, bug/retest, Postman, runner và evidence đã che dữ liệu.

Cả hai xuất phát từ GitHub `dev` **be3b5f6**. Lượt kiểm thử ban đầu ngày29/10 chạy trên577064b. Trên nhánh Implementation đã bổ sung lượt retest **be3b5f6**: build, browser, suiteDB95PASS/1FAIL và chuỗi API thật đến Gateway check-in. Xem Regression-Report.md/evidence trên nhánh Implementation; không dùng bằng chứng này để tuyên bố full E2E đãPASS.

## Đọc trước

1. [Test plan](Test-Plan.md): phạm vi, fixture, expected, các gate nghiệm thu.
2. [Test cases](Test-Cases.csv): 12 scenario; NOT_RUN là trạng thái acceptance, không phủ nhận evidence hỗ trợ ở tầng thấp hơn.
3. [Feedback mentor](Mentor-Feedback-Checklist.md): checklist và owner retest.

Trên nhánh Implementation có thêm Regression-Report.md, Bug-Register.md, Demo-Guide.md và Jira-Status.md. Automation mới trong gói này là runner/probe QA; các test C# được chạy lại là test sẵn có của nhóm, không nhận là toàn bộ do Quang viết.

Không đưa .env, token, password, QR payload, database cluster, node_modules hoặc video/log lớn vào Git. Log/TRX/video gốc được giữ local; chỉ snapshot kết quả đã kiểm tra và che dữ liệu được chia sẻ.

