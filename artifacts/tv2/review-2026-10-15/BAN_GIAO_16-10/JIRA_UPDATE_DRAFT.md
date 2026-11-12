# Nội dung cập nhật Jira — bản nháp, chưa gửi

## SCRUM-55
Đã chuẩn bị matrix RBAC, 12 policy/oracle và test cases cho Staff/CASH/QR/check-in. Đã review GitHub dev d4a37fa và main b3b7883 ngày 15/10. Route auth và log password hash đã sửa qua source review. Còn chờ chốt policy, xác minh Identity gRPC/current assignment, CASH controller persistence/scope, QR/check-in API và fixture. 32 ca trong bộ QA chưa thực thi; chưa có runtime PASS. Đề nghị giữ In Progress, ghi rõ dependency/owner theo workflow của nhóm; chưa Done. Evidence: BAO_CAO_16-10.md và EVIDENCE.txt.

## SCRUM-52
Đã chuẩn bị 32 test case, 11 Postman request, quy trình bug/retest và demo; kiểm tra cấu trúc artifacts đạt. Đã cập nhật regression findings 15/10, bổ sung đường CASH controller giả lập và khác biệt fix worker giữa main/dev. Lần dotnet test mới chưa hoàn tất restore và đã dừng; chưa có kết quả build/test hiện tại. Chờ commit tích hợp, môi trường/fixture và API QR để thực thi regression, đối chiếu DB effect, phối hợp Phát tổng hợp Customer evidence. Chưa có cơ sở ký acceptance hoặc chuyển Done.
