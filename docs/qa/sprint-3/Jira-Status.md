# Đề xuất trạng thái Jira cho Quang — 29/10/2026

Đây là đề xuất, chưa sửa Jira live. Các key lấy từ tài liệu nhóm; task feedback bổ sung cần đối chiếu key thực tế trước khi dùng.

| Đầu việc | Trạng thái hợp lý | Lý do |
|---|---|---|
| SCRUM-77 full lifecycle E2E | **Đang Làm / In Progress**; ghi blocker trong mô tả hoặc cờFlagged | Có scenario, runners và report; chưa đạt checkout/exit/UI/realtime acceptance |
| Subtask test plan/12cases/traceability | **Đang Xem / In Review** sau khi gửi link nhánh | Đầu ra đã có, cần reviewer chấp nhận; không tự đánhDone chỉ vì push |
| Subtask QA script/report/evidence | **Đang Xem / In Review** | Có kết quả thật, nêu rõ1FAIL và giới hạn; chờ review góiQA |
| Task hồi quy feedback mentor (key chưa xác minh) | **Đang Làm** | Có checklist và evidence từng phần; còn caNOT_RUN/Blocked và bug đang mở |
| SCRUM-78 nếu thực sự gánQuang | **Chưa Làm** nếu chưa bắt đầu dataset; **Đang Làm** nếu có đầu ra kiểm nhãn/benchmark | Không có evidence100ảnh/accuracy trong gói này; không tự đổiowner hoặc Done |

Nếu board có trạng thái Blocked, chỉ chuyển khi workflow/nhóm dùng nó. Nếu không, giữ Đang Làm, Flagged và ghi rõ dependency+owner. Quang chịu QA, không nhận trách nhiệm sửa BE/FE thay các owner.

## Nội dung để Quang copy vào SCRUM-77

Đã bàn giao hai nhánh Design/Implementation SCRUM77_QA, gồm test plan,12scenario,mentor traceability,Postman13requests,runner database/API/browser,regression và bug/retest. Basebe3b5f6 buildBE0warning/0error,FEbuildPASS; suiteDB riêng95PASS/1FAIL,tổng96. CaFAIL là Identity testhost thiếu seed config. Không dùng kết quả test tầng thấp thay acceptanceUI. Đã retest Gateway check-in200 với CASH/outbox/QR thật và DB đúng1session/assignment; không còn blocker404 ở boundaryAPI này. Full checkout/physical-exit/realtime và fallbackStaff vẫn chưa đạt; đề nghị giữ SCRUM-77 Đang Làm. Các đầu ra test-design/report có thể chuyển Đang Xem để review riêng. Chưa đề nghị Done toàn story.

Không coi số lượng testcase/report là phần trăm hoàn thành chức năng. Chỉ ký Done khi acceptance bắt buộc PASS, có video/logđúngphiênbản và reviewer chấp nhận.

