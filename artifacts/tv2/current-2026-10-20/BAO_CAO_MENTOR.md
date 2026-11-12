# Báo cáo TV2 — Võ Nhật Quang / vonhatquang817

Ngày: 20/10/2026 (UTC+7). Phạm vi theo hồ sơ Jira đã đối chiếu trước đây: SCRUM-55 (RBAC/policy/test vận hành, tài chính), SCRUM-52 (regression/evidence/demo). Chưa đọc hoặc cập nhật Jira trực tiếp trong lần làm này.

## Nội dung có thể trình bày trong 60–90 giây

“Phần của em là ma trận quyền và policy vận hành/tài chính, kiểm thử Staff/CASH/QR và tổng hợp regression. Em đã cập nhật bộ 32 acceptance case theo bản GitHub dev 11e5652, đối chiếu hợp đồng giữa Gateway, Identity, Parking, Payment và giao diện Staff.

Em đã chạy lại bộ test có sẵn của nhóm trên DB tạm riêng. Kết quả là 50 pass, 1 fail và 1 skip. Trong đó 12 test database về hold, QR, check-in, rollback và quét đồng thời đã pass. Test quyền Staff fail ngay tại bước LOOKUP vì Identity chưa hỗ trợ capability mà Parking yêu cầu. Test HTTP tích hợp đầy đủ còn skip do chưa cấu hình hai host trong lượt chạy đó.

Em cũng chạy probe HTTP: CASH/status mới không token trả404/400 thay401; lỗi CASH thiếu envelope chuẩn; Gateway chưa route check-in. Em đã lập bug có owner và điều kiện retest. Các điểm còn cần xử lý gồm quyền LOOKUP/CHECK_IN, JWT/Identity và giao diện Staff còn dùng localStorage/fallback.

Em đã có report, TRX, test case và checklist retest. Em chưa xác nhận Done toàn bộ hai ticket vì còn blocker tích hợp. PostgreSQL đang kiểm thử bổ sung là 18.4; baseline 17 vẫn cần chạy lại.”

## Khi mentor hỏi sâu

| Câu hỏi | Trả lời có căn cứ |
|---|---|
| Em đã làm gì cụ thể? | Rà soát matrix/policy; cập nhật 32 acceptance case; chạy lại test của nhóm; kiểm chứng DB tạm; lập bug/retest và tổng hợp evidence. Không nhận là tự viết toàn bộ 52 test. |
| Pass 50 nghĩa là xong 50 acceptance case? | Không. Đây là 50 automated test invocation của bộ test chung. Có 32 acceptance case TV2 riêng; nhiều case còn chưa chạy API/UI thật hoặc mới có bằng chứng tầng repository/domain. |
| Concurrent check-in được kiểm thế nào? | Test chạy 10 tác vụ cùng lúc bằng Task.WhenAll và assert chỉ một thành công/một session. Chưa phải load test hoặc harness có barrier start được đo thời điểm. |
| Đã thanh toán thật chưa? | Chưa nghiệm thu luồng CASH qua Identity thật tới outbox/inbox và UI. Test Parking dùng event/handler test, không chứng minh provider hay nhân viên đã thu tiền thật. |
| Vì sao RBAC fail? | Staff có assignment trong Identity DB nhưng CheckAccessAsync trả false cho LOOKUP; test dừng tại assertion đó, chưa chạy tới các assertion revoke phía sau. |
| Có làm hỏng DB nhóm không? | Không. Chạy PostgreSQL cluster mới tại localhost, test tạo/xóa database scrum49_it_* riêng rồi dừng cluster. |
| Có thể Done chưa? | Có deliverables để review; chưa đủ acceptance Done. Cần fix/retest các blocker, review policy và xác nhận môi trường PostgreSQL17. |
| Cần nhóm hỗ trợ gì? | TV5 N.Đức: Identity/JWT/capability. TV7 Sơn: CASH authorization và contract. TV8 Nhật: Gateway/Compose. TV4 Tiến: Staff UI. TV6 Hàn: QR/hold phối hợp retest. |

## Mở file khi báo cáo

1. `REGRESSION_REPORT.md`: kết quả, phạm vi, giới hạn.
2. `results/tv2-isolated-pg18.trx`: bằng chứng 50 pass / 1 fail / 1 skip.
3. `HTTP-EVIDENCE.json`: kết quả probe HTTP độc lập, nếu đã sinh thành công.
4. `BUG_REGISTER.md`: bug, owner đề xuất, cách retest.
5. `TEST-CASES.csv`: 32 acceptance case với trạng thái và bằng chứng hỗ trợ.
6. `RBAC_POLICY.md`: matrix và quyết định cần review.

Nội dung này là bản chuẩn bị để người dùng tự báo cáo. Chưa gửi mentor, Jira, GitHub hoặc GitLab.
