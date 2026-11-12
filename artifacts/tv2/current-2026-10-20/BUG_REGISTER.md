# TV2 — Bug register và retest, 20/10/2026

Commit phát hiện:11e5652. Owner và severity dưới đây là đề xuất để team triage, chưa gửi hoặc gán trên Jira. Tất cả còn OPEN; không sửa service của owner trong lượt QA. `SOURCE_REVIEW` chưa tương đương tái hiện runtime.

## TV2-20-01 — Staff hợp lệ bị từ chối LOOKUP/CHECK_IN

- Mức ảnh hưởng: Blocker; owner TV5 N.Đức, phối hợp TV6 Hàn.
- Evidence: **REPRODUCED repository + PostgreSQL18.4**, TRX test StaffScopeCustomerDeniedAndRevokedAssignmentAreCheckedAgainstIdentityDatabase FAIL tại ParkingWorkflowTests.cs:280. Staff có active assignment đúng lot, expected LOOKUP true, actual false.
- Source: AssignedLotRepository.cs:86 chỉ nhận USER/ADMIN/OCR/GATE/CASH/REPORT; Parking handlers gọi LOOKUP/CHECK_IN.
- Retest: Staff A LOOKUP/CHECK_IN được phép; Customer/Staff B/revoked/expired bị chặn; JWT cũ không bypass. Test hiện tại dừng assertion đầu, chưa xác minh các bước phía sau.

## TV2-20-02 — CASH/status controller mới không yêu cầu đăng nhập/quyền theo bãi

- Mức ảnh hưởng: Critical/P0 đề xuất; owner TV7 Sơn, phối hợp TV5.
- Evidence: **REPRODUCED anonymous HTTP** HTTP-01/02/03. GET payment status UUID không tồn tại trả404; POST cash/confirm hợp lệ tới lookup DB trả404; body không hợp lệ trả400. Expected401 trước khi vào nghiệp vụ. Control HTTP-04 POST /payments trả401 đúng.
- Source: PaymentsController thiếu Authorize; actor fallback staff_01. Handler mới không gọi FacilityAuthorization; repository dùng actor UUID fallback.
- Giới hạn: chưa thử cập nhật một payment có thật và chưa chứng minh rò rỉ dữ liệu payment tồn tại. Không khẳng định đã tái hiện thu tiền trái phép thành công.
- Retest: Guest401; Customer/Staff B/expired/revoked403; Staff A hợp lệ200; actor server thật; không effect DB cho denial. Bao gồm GET owner/scope và actor/name claim.

## TV2-20-03 — Gateway không route check-in

- Mức ảnh hưởng: Blocker; owner TV8 Nhật, phối hợp TV6/TV4.
- Evidence: **REPRODUCED HTTP fallback** HTTP-05 POST /api/v1/check-in trả404 với message Endpoint not found; appsettings Gateway thiếu route tới endpoint controller CheckInController.
- Retest: request được chuyển tới Parking; anonymous được Parking challenge401; Staff hợp lệ check-in đúng; sai lot/replay bị chặn. Không coi việc đổi404 thành502 khi upstream chưa chạy là acceptance pass.

## TV2-20-04 — JWT/configuration/health Identity chưa đồng bộ

- Mức ảnh hưởng: Blocker; owner TV5 N.Đức/TV8 Nhật.
- Evidence: **SOURCE_REVIEW**. Identity appsettings issuer Parking_Lot/audience Parking_Client, token generator đọc chúng; shared defaults Parking/Payment dùng issuer parking-identity/audience parking-api. Compose không override issuer/audience.
- Compose truyền ConnectionStrings__Service/Bootstrap__Email/Password; Identity persistence đọc DefaultConnectionString, initializer đọc SeedAdmin/SeedStaff. Identity Program chưa map health/live/ready mà Docker/Gateway yêu cầu.
- Retest: cấu hình synthetic local; bootstrap thành công; login qua Gateway; JWT được Parking/Payment chấp nhận; ready cả4 service200. Không dùng secrets thật trong evidence.

## TV2-20-05 — Staff UI tạo check-in local và CASH fallback thành công

- Mức ảnh hưởng: Major/P0 đề xuất; owner TV4 Tiến.
- Evidence: **SOURCE_REVIEW** staffApi.ts:537 tạo session và slot giả trong localStorage, không gọi check-in API; dòng826 trở đi catch lỗi CASH trả COMPLETED. VehicleOperations.tsx gọi adapter này.
- Retest: Network chứng minh gọi endpoint thật; success có session/payment trong DB; outage/401/403/409/503 hiển thị lỗi, không session/settlement giả; reload refetch server.

## TV2-20-06 — CASH error response không theo ApiResponse

- Mức ảnh hưởng: Major; owner TV7 Sơn.
- Evidence: **REPRODUCED HTTP** HTTP-02/03 trả {Message,ErrorDetails}, thiếu result/isSuccess/statusCode/message chuẩn. HTTP-01/04 có envelope chuẩn, lỗi áp dụng đường controller/middleware mới.
- Retest: lỗi400/401/403/404/409/503 cùng envelope theo APIDesignTemplate; HTTP status trùng statusCode; client parser nhận lỗi đúng.

## TV2-20-07 — Hai đường CASH khác contract version/retry

- Mức ảnh hưởng: Major cần contract review; owner TV7 Sơn/TV2.
- Evidence: **SOURCE_REVIEW** PaymentRepository mới version sai422 và SUCCESS retry409; PaymentService legacy version conflict409 và SUCCESS trả lại kết quả. TV2 oracle yêu cầu conflict409/retry không thêm effect.
- Retest: chốt API public duy nhất hoặc contract từng version; ghi test duplicate/version với payment/audit/outbox count trước/sau. Chưa chạy case financial mutation này.

## TV2-20-08 — Hold default15 / fixture5 cần decision

- Loại: Policy decision OPEN, chưa tự gán là lỗi nghiệp vụ; owner TV6/TV8/mentor.
- Evidence: AGENTS default15; fixture002 dùng5, test xác minh khoảng4.8–5.1 phút.
- Retest: chốt revision approved; test default và override riêng, before/at/after expiry; giữ physical occupancy. Không thay expected để làm xanh.

## Thứ tự retest

1. TV5/TV8 đồng bộ cấu hình/JWT/health và capability; Gateway route.
2. TV7 khóa authorization CASH/status và envelope; chốt version/retry.
3. TV4 nối UI thật, bỏ success fallback.
4. Chạy PostgreSQL17 trên commit fix; full test và scope/expiry/revoke/CASH/outbox/QR qua Gateway.
5. Lưu fix commit/run/evidence; đóng riêng từng bug sau retest, cập nhật report và đề nghị review SCRUM-55/52.
