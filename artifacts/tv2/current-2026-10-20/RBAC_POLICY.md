# SCRUM-55 — Matrix và policy TV2, revision 20/10/2026

Owner QA: Quang. Commit:11e5652. Đây là expected behavior để owner review, không phải toàn bộ đã PASS hoặc đã được mentor phê duyệt.

| Hành động bãi A | Guest | Customer owner | Customer khác | Staff A active | Staff B | Manager A không Staff | Admin |
|---|---|---|---|---|---|---|---|
| Đọc public lots | DTO không PII | Cho phép | Cho phép | Cho phép | Cho phép | Cho phép | Cho phép |
| Đọc booking |401|Cho phép|Từ chối, không lộ PII|LOOKUP cần contract đồng bộ|Từ chối|Chờ chốt capability|Chờ chốt capability|
| Tạo CASH |401|Quote server, verified owner|Từ chối|Theo delegation đã duyệt|Từ chối|Không tự cấp quyền|Không tự suy diễn bypass|
| Confirm CASH |401|403|403|Cho phép đúng lot/reason/version|403|403 nếu không Staff|Không tự bypass Staff|
| Cấp QR |401|Chỉ booking hợp lệ CONFIRMED|Từ chối|Theo owner/LOOKUP contract|Từ chối|Chờ owner review|Chờ owner review|
| Consume/check-in |401|Không tự vận hành gate|Từ chối|CHECK_IN đúng lot/gate/vehicle|403|Chờ owner review|Chờ owner review|

Tài khoản ACTIVE và assignment phải được kiểm tra hiện tại: valid_from <= now < valid_until; revoked assignment bị từ chối kể cả dùng JWT cũ. Test FAIL hiện tại dừng ở LOOKUP nên chưa chứng minh các biến thể này.

## Policy cần review

| ID | Oracle | Hiện trạng / quyết định còn mở |
|---|---|---|
|P01|Default hold15 phút theo AGENTS; policy riêng có revision được duyệt|Fixture/test hiện dùng5 phút. PASS fixture5 không xác nhận default15; TV6/TV8/mentor chốt|
|P02|Giá từ server, theo bãi/xe/toàn thời lượng; không nhận amount/actor client|Search có DB-backed service; cần test hiệu lực biểu giá/cache và dữ liệu thực|
|P03|FLAT_BLOCK15p,7500/block,cap120000, multiplier1, timezone HCM (fixture)|30p15000;31p22500;120p60000;300p120000. Qua nửa đêm chia ngày. Chưa chạy đủ acceptance oracle này; domain tests chỉ hỗ trợ một số biến thể|
|P04|CASH cần Staff hiện tại đúng lot, reason1..500,version>=1|Endpoint legacy có gRPC CASH; controller mới thiếu authorization/scope qua source review|
|P05|Conflict version trả409; retry không thêm payment/event/audit|Legacy có409 và đọc lại SUCCESS; controller mới dùng422 và duplicate SUCCESS409. TV7 cần chốt contract thống nhất|
|P06|Payment SUCCESS qua outbox/inbox mới xác nhận booking hợp lệ|Chưa chạy full chain Payment→Parking với Identity thật; handler tests không thay thế|
|P07|QR bind booking/lot/vehicle,expiry,nonce; chỉ một session/check-in effect|Repository/unit có PASS; HTTP/Gateway/Identity/UI còn blocker|
|P08|Arrival window/QR TTL theo snapshot/fixture, kiểm tra trước và dưới transaction|Có tests một số biến thể; không tuyên bố đầy đủ before/at/after mọi boundary|
|P09|Thanh toán/hold expiry không giải phóng slot có xe vật lý|Repository test PASS về giữ occupancy; chưa nghiệm thu physical exit/barrier|
|P10|Audit actor/lot/action/entity/reason atomic, không lộ credential/PII|Check-in rollback/audit có PASS; privacy log capture và toàn CASH audit còn chưa chạy|
|P11|Không coi localStorage/fallback success là effect DB|Staff UI còn vi phạm; TV4 phối hợp sửa và retest lỗi401/403/409/503|

Review đề xuất: TV5 N.Đức (scope/JWT), TV6 Hàn (hold/QR/session), TV7 Sơn (tiền/version/retry), TV4 Tiến (Staff UI), TV8 Nhật (tích hợp). Chưa có chữ ký/approval mới trong phiên này.
