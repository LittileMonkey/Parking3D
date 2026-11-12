import fs from 'node:fs/promises';
import path from 'node:path';
const out=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
await fs.mkdir(out,{recursive:true});
const sources=[
 ['S01','Models README','backend_parking_system/database-work/ParkingSystem/Models/README.md','main 2ac3f62','Trả trước đủ; early exit không hoàn phần chưa dùng; OTP/assignment và policy nullable.'],
 ['S02','Policy và Assignment','Models/Parking/ParkingPolicy.cs; Models/Identity/FacilityStaffAssignment.cs','main 2ac3f62','Hold 15; min30/max1440 mặc định; scope [from,to), RevokedAt; delegation riêng.'],
 ['S03','Booking Session QR và Finance','Models/Bookings; Models/Payments; Data/ParkingDbContext.Bookings.cs; Data/ParkingDbContext.Finance.cs','main 2ac3f62','Enums, active session, Version, XOR payment owner, unique provider/idempotency, Cash actor.'],
 ['S04','Baseline và API mẫu','docs/02-BUSINESS-RULES.md; docs/05-API.md; docs/APIDesignTemplate.md','main 2ac3f62','Multi-lot, envelope, advisory locks, physical exit. API mẫu có chỗ cần sửa theo S01.'],
 ['S05','AI Design','update103/11-AI-EXTENSION.md; Parking_Database_V4.dbml','features/Design_AIExtension fa872f0','OCR review, không phạt tự động; forecast aggregate; assistant chỉ public.'],
 ['S06','Frontend','frontend_parking_system/README.md và src','duc df0a5a5','UI có; README ghi auth backend chưa có.'],
 ['S07','Nhánh tích hợp','git tree dev','dev 30c402f, 06/10/2026','Commit mới chủ yếu dist/node_modules; không thấy src/services/api.ts hay frontend README.'],
 ['S08','Phân công nhóm','PHAN_CONG_TASK_NHOM_8_NGUOI.md người dùng cung cấp','02/10/2026','TV2 sở hữu BA/test vận hành và tài chính; BE owner code/contracts.']
];
const policies=[
 ['P01','Manager bao hàm Staff và quyền Admin tại gate','Mở','Không tự cho Manager/Admin xác nhận Cash hoặc check-in; default deny khi chưa có policy.','TV8/TV5/TV2','D2 08/10','AUTH-02 GATE-01 PAY-06'],
 ['P02','Manager gán Manager/ủy quyền delegation','Mở','CanManageStaffAssignments chỉ cho Manager được ủy quyền; phạm vi gán Manager phải duyệt.','TV8/TV5/TV2','D2 08/10','AUTH-07'],
 ['P03','Early/Late arrival và no-show','Mở','EarlyArrivalMinutes/LateArrivalMinutes null = chưa cấu hình; không dùng ví dụ baseline làm policy đã chốt.','TV8/TV6/TV2','D2 08/10','GATE-06 GATE-07'],
 ['P04','QR expiry/revoke/rotate','Mở','QrLifetimeMinutes null; một lần, signed token; expiry boundary đề xuất now>=ExpiresAt từ chối.','TV6/TV8/TV2','Trước QR','GATE-03 GATE-04'],
 ['P05','Exit grace và phí phát sinh sau trả tiền','Mở','ExitGraceMinutes null; re-evaluate FeeCalculatedThrough trước exit theo policy, không miễn phí ngầm.','TV6/TV7/TV8','Trước exit','EXIT-03 EXIT-04'],
 ['P06','Callback muộn khi hold expired','Mở','Không Confirmed/mở cổng nếu reservation đã mất. Phải chốt đối soát/refund/manual resolution.','TV6/TV7/TV8','Trước payment','PAY-05'],
 ['P07','Hủy trước đến và hoàn tiền','Mở','Cutoff/Percent null; không suy ra miễn phí hoặc hoàn toàn bộ.','TV7/TV8/TV1/TV2','Trước cancel/refund','PAY-10'],
 ['P08','Walk-in thanh toán trước hay khi ra','Mở','Không áp prepayment của booking cho walk-in khi chưa chốt.','TV6/TV7/TV8','Trước walk-in','GATE-10'],
 ['P09','Overstay gặp booking tiếp theo','Mở','Không giải phóng slot vật lý hay hủy silent; Staff reallocate cùng bãi và audit, thuật toán chờ duyệt.','TV6/TV8/TV2','Trước overtime','EXIT-07'],
 ['P10','Định nghĩa biên block/cap/peak','Mở một phần','15 phút là default; order peak/cap, timezone ngày và rounding phải ghi trong snapshot; fixture oracle là đề xuất test.','TV7/TV8/TV2','D2 08/10','PRICE-02 PRICE-05'],
 ['P11','Assignment chồng nhau và revoke ngay','Mở một phần','Model định nghĩa hiệu lực; overlap policy và JWT revocation/caching SLA cần chốt. Không tin assignment cũ trong token.','TV5/TV8/TV2','D2 08/10','AUTH-04 AUTH-08'],
 ['P12','Audit đọc/export và PII masking','Mở một phần','Không public; Manager report theo bãi, quyền Staff đọc audit/export mặc định deny đến khi duyệt.','TV5/TV8/TV2','Trước audit/report','AUDIT-03'],
 ['P13','Revenue và refunds định nghĩa','Mở','Tách gross receipts, refunds và net; chọn PaidAt/VerifiedAt/report timezone. Không cộng Payment với Transactions trùng.','TV7/TV8/TV2','Trước reporting','AUDIT-05'],
 ['P14','Error contract và existence masking','Đề xuất','401 unauth; 403 scope trước lookup; 404 sau scope; 409 state/version/policy missing; verify với BE.','TV5–TV8/TV2','D2 08/10','AUTH-01 AUTH-03'],
 ['P15','Hold và booking duration','Default model','15m, min30/max1440; policy seed explicit trước test, không dùng prototype 5m.','TV6/TV8','D2 08/10','STRUCT-07'],
 ['P16','Prepayment early exit overtime','Đã chốt S01','Booking trả trước đủ; về sớm không hoàn phần chưa dùng; quá giờ tính theo snapshot và bù trừ.','TV6/TV7','D2 xác nhận contract','PRICE-06 PRICE-07'],
 ['P17','AI provider/retention/threshold','Design đề xuất','Theo S05: private ảnh, review bắt buộc, nguồn forecast/FAQ; TTL/provider chưa xác nhận triển khai.','TV8/TV6/TV7/TV2','Trước AI','AI-01 AI-05'],
 ['P18','Schema và nhánh đích','Mở','V4 47 bảng snake_case khác EF 28 bảng; main/duc/dev khác tree. TV8 chốt trước test integration.','TV8/TV5–TV7','D1 07/10','STRUCT-01']
];
const rbac=[
 ['R01','Xem danh mục bãi công khai','Cho phép','Cho phép','Cho phép public','Cho phép public','Cho phép','S04','Không có PII.'],
 ['R02','Xem booking/session vận hành','Cấm','Chỉ tài nguyên của mình qua API Customer','Scope bãi','Scope bãi theo policy','Toàn hệ thống theo policy','S01/S04 P01','Không gán quyền từ knowing ID.'],
 ['R03','Check-in QR/Staff','Cấm','Cấm gọi API Staff','Scope bãi','Chờ P01','Chờ P01','S01/S04','Nhân viên phải active; policy missing -> deny.'],
 ['R04','Tính phí/checkout vận hành','Cấm','Xem giá của mình qua API riêng','Scope bãi','Chờ P01','Chờ P01','S01/S04','Không nhận FinalFee từ client.'],
 ['R05','Cash confirmation','Cấm','Cấm','Scope bãi','Chờ P01','Chờ P01','S01/S03','Actor server-side; FK actor không thay quyền.'],
 ['R06','Xác nhận xe rời','Cấm','Cấm','Scope bãi','Chờ P01','Chờ P01','S04','Cần physical evidence; không chỉ payment success.'],
 ['R07','Sửa giá/publish plan','Cấm','Cấm','Cấm','Scope bãi','Toàn hệ thống','S04','Version/effective period/audit; snapshot cũ bất biến.'],
 ['R08','Sửa cấu trúc/maintenance','Cấm','Cấm','Chờ policy giới hạn','Scope bãi','Toàn hệ thống','S04 P09','Không ảnh hưởng silent Confirmed booking.'],
 ['R09','Quản lý assignments','Cấm','Cấm','Cấm','Scope + delegation; gán Manager chờ P02','Toàn hệ thống','S01/S02','Không sửa PlatformRole/Admin qua assignment DTO.'],
 ['R10','Grant Admin/platform roles','Cấm','Cấm','Cấm','Cấm','Admin theo contract bảo vệ','S01','Không self-grant từ register/body; policy revoke-last-admin chưa chốt.'],
 ['R11','Đọc revenue reports','Cấm','Cấm','Chờ P12','Scope bãi','Toàn hệ thống','S04 P13','Các lot trong query phải đều được phép.'],
 ['R12','Đọc/export AuditLog','Cấm','Cấm','Chờ P12','Chờ P12, nếu duyệt chỉ scope','Admin theo contract bảo vệ','S04','Không mặc định Manager có toàn bộ audit/PII.'],
 ['R13','Sửa/xóa AuditLog','Cấm','Cấm','Cấm','Cấm','Cấm','S03/S04','Append-only ở DB/ORM.'],
 ['R14','Refund/cancel override','Cấm','Luồng của mình theo policy','Chờ P07','Chờ P07','Chờ P07','S01 P07','Không tự cấp tiền hoàn chưa duyệt.'],
 ['R15','OCR ảnh private','Cấm','Ngoài MVP S05','Scope bãi','Scope bãi','Theo S05 toàn hệ thống','S05','Không tự check-in/open gate hoặc phạt.'],
 ['R16','Forecast/assistant public','Public','Public','Public','Public','Public','S05','Aggregate/FAQ đã duyệt; không trả PII.']
];
const fixture={
 label:'ĐỀ XUẤT TEST DEVELOPMENT, không phải seed đã chạy hay policy production',
 lotA:'11111111-1111-4111-8111-111111111111',lotB:'22222222-2222-4222-8222-222222222222',lotC:'33333333-3333-4333-8333-333333333333',
 slotA:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slotB:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 bookingA:'44444444-4444-4444-8444-444444444444',sessionA:'55555555-5555-4555-8555-555555555555',paymentA:'66666666-6666-4666-8666-666666666666',gateA:'77777777-7777-4777-8777-777777777777',exitGateA:'78787878-7878-4878-8878-787878787878',userStaff:'88888888-8888-4888-8888-888888888888',planA:'99999999-9999-4999-8999-999999999999',
 clock:'2026-10-08T02:00:00Z', timezone:'Asia/Ho_Chi_Minh',
 pricing:{currency:'VND',blockMinutes:15,ratePerBlock:7500,dailyCap:120000,peakMultiplier:1,bookingMinutes:120,quoted:60000,netPrepaid:60000},
 identities:['U_ADMIN Active','U_CUSTOMER_A Active own vehicle','U_STAFF_A Active assignment lotA [T0-1d,T0+1d)','U_STAFF_B lotB','U_MANAGER_A lotA delegated false','U_MANAGER_A_DELEGATED lotA delegated true','U_EXPIRED_A ActiveTo=T0','U_REVOKED_A RevokedAt=T0','U_LOCKED_A assignment valid but User not Active','GUEST no user']
};
const oracle=[
 ['F01',15,7500,0,7500,'Estimate, 1 block'],['F02',16,15000,0,15000,'Estimate, ceil block; proposal P10'],['F03',60,30000,0,30000,'Estimate, 4 blocks'],['F04',120,60000,0,60000,'Booking quote, 8 blocks'],
 ['F05',240,120000,0,120000,'16 blocks đạt cap'],['F06',300,120000,0,120000,'20 blocks 150000 bị cap 120000; cùng một ngày local'],
 ['F07',60,60000,60000,0,'FinalFee floor quote vì về sớm; không hoàn unused'],['F08',120,60000,60000,0,'Đúng giờ, không thu lần nữa'],['F09',150,75000,60000,15000,'10 blocks theo snapshot, thu chênh lệch'],
 ['F10',150,75000,75000,0,'Đã trả top-up 15000, retry không thu thêm']
];
let cases=[];
function group(prefix,req,rows){rows.forEach((r,i)=>cases.push({id:`${prefix}-${String(i+1).padStart(2,'0')}`,requirement:req,title:r[0],priority:r[1]||'P1',precondition:r[2],steps:r[3],expected:r[4],policy:r[5]||'—',source:r[6]||'S01/S03/S04',owner:prefix==='AI'?'TV2 + AI owner':'TV2',status:'Not run',actual:'',evidence:'',bug:''}));}
group('AUTH','REQ-01',[
 ['Không có token','P0','API protected sẵn','Gọi không Authorization','401 envelope; không read/write dữ liệu.','P14'],
 ['Staff A đúng scope','P0','U_STAFF_A và tài nguyên A','Gọi read/action hợp lệ A','Được phép nếu business preconditions đạt; không dùng quyền global.'],
 ['Staff A truy cập bãi B','P0','U_STAFF_A; B tồn tại','Đổi lotId/resource ID/body sang B','403 theo proposal; không lộ bản ghi B; không side effect.','P14'],
 ['Assignment hết hạn/thu hồi','P0','Token còn hạn; ActiveTo=T0 hoặc RevokedAt=T0','Gọi action tại T0','Từ chối theo assignment hiện tại; không tin claim cũ.','P11'],
 ['Tài khoản inactive','P0','Assignment hợp lệ, user Locked/Inactive','Gọi protected action','Từ chối, không mutate; exact 401/403 theo contract.','P14'],
 ['Customer giả Staff/Admin','P0','U_CUSTOMER_A','Thêm role/Admin/UserId vào body hoặc sửa token unsigned','Không tự nâng quyền; invalid token401 hoặc action403; dữ liệu không đổi.'],
 ['Manager delegation và grant Admin','P0','Manager A có/không delegation','Thử tạo assignment Staff; thử gán Manager/Admin','Không delegation deny; có delegation chỉ thao tác được phép; grant Admin cấm. Gán Manager chờ P02.','P02'],
 ['Biên ActiveFrom/ActiveTo','P1','Clock kiểm soát, assignment [T0,T1)','Thử T0-1ms,T0,T1-1ms,T1','Before start deny; at start allowed; at end deny. Check user/revoke riêng.','P11']]);
group('STRUCT','REQ-02',[
 ['Schema chính thức và 3 bãi','P0','Schema/seed test được TV8 chốt','Tạo DB mới migrate; kiểm health/3 lots','Health ready; 3 cấu trúc khác; FK đúng schema; không coi prototype 3 tầng là multi-lot.','P18'],
 ['Cross-lot level zone slot','P0','LotA/lotB seeded','Gửi zone/slot B trong A; gọi DB test riêng','Backend reject và composite FK guard; không tạo quan hệ sai bãi.'],
 ['Slot maintenance','P0','SlotA có booking Confirmed tương lai','Manager yêu cầu maintenance','Không silent cancel/ghi đè; xử lý reallocation/Staff theo policy, audit; loại khỏi allocation mới.','P09'],
 ['Version stale update','P1','Slot Version n','2 request update cùng version','Một update thành công; stale409; không lost update; audit khớp.'],
 ['Giờ đóng và overnight','P1','OperatingHours được seed explicit','Thử đóng ngày; interval 22h–06h ClosesNextDay','Reject khi đóng; overnight đúng timezone bãi, không UTC hour cố định.','P10'],
 ['Available vs reserved vs occupied','P0','Booking tương lai + session active riêng','Đọc availability/occupancy hiện tại','Không count booking tương lai như occupied; maintenance/disabled loại khỏi usable capacity.'],
 ['Hold policy và expiry','P0','Hold15 explicit clock; reservation held','Thử trước/đúng expiry; chạy sweeper','Không confirm ở expiry; release hold idempotent; không giải phóng xe vật lý đang đỗ.','P15'],
 ['GiST overlap và adjacent','P0','DB test PostgreSQL, 2 request song song','Cùng slot [09,10) rồi [09:30,10:30); thử [10,11)','Overlap chỉ một held/confirmed theo rule; adjacent được; xe guard riêng, có locks.']]);
group('GATE','REQ-03',[
 ['Check-in hợp lệ','P0','Confirmed đủ tiền; QR valid; arrival policy; StaffA','POST check-in một lần','Booking CheckedIn; một Active session; QR consumed atomic; không tự complete exit; audit/event sau commit.','P01/P03/P04'],
 ['Booking chưa trả đủ','P0','PendingPayment, unpaid/partial','Gọi QR/check-in','Reject; không QR quyền vào/không session/không gate OPEN.'],
 ['QR tamper/expired/revoked','P0','3 QR fixture riêng; expiry P04 duyệt','Thử payload sửa, expiresAt=T0, revoked','Reject mỗi ca; không consume QR valid khác/không tạo session.','P04'],
 ['Replay/concurrent QR','P0','QR chưa consume; 2 request đồng thời','Gọi check-in song song rồi replay','Tối đa một session/consume; duplicate cùng idempotency trả same result, replay key khác conflict.','P04'],
 ['Sai bãi/gate/plate','P0','BookingA; gate B hoặc gate exit/plate khác','Từng ca một biến sai','Reject cross-lot/vehicle mismatch; không session/OPEN; manual override không tự bật.'],
 ['Đến sớm','P1','P03 duyệt; early minutes E','Thử StartAt-E-1ms và StartAt-E','Theo biên policy duyệt; ca outside deny; không tự dùng 15m ví dụ baseline.','P03'],
 ['Đến trễ/no-show','P1','P03 duyệt; late minutes L','Thử StartAt+L và +L+1ms; NoShow booking','Áp exact boundary đã duyệt; NoShow không đi luồng normal check-in.','P03'],
 ['Một xe hai active sessions','P0','Xe có Active/ExitPending ở A','Check-in cùng xe ở B hoặc slot khác','Không session active thứ hai toàn hệ thống; lock/unique plate guard.'],
 ['Manual override và rollback','P0','Override contract được duyệt; reason required','Thử thiếu reason, sai scope, gây lỗi save','Thiếu reason reject; sai scope deny; rollback session/QR/audit đồng bộ.','P01'],
 ['Walk-in và Guest','P1','P08/OTP policy/API chưa duyệt','Chuẩn bị walkthrough, không dùng booking QR giả','Blocked policy/API đến khi walk-in/OTP contract được duyệt; plate không chứng minh ownership.','P08']]);
group('PRICE','REQ-04',[
 ['Giá riêng từng bãi','P0','A7500/block; B rate khác; snapshot','Estimate cùng duration ở A và B','Khác đúng rate từng bãi; không hourly cố định toàn hệ thống.'],
 ['Biên block 15 và 16 phút','P0','Oracle F01/F02 P10 được duyệt','Gọi estimate 15/16min','7500/15000 theo fixture; lưu formula/rounding, không nhận tiền từ client.','P10'],
 ['Cheapest toàn duration','P1','Bảng giá cross-lot đủ','So quote 60/120/300min với oracle','Sort tổng dự kiến đúng, không sort giá giờ đầu.'],
 ['Snapshot bất biến','P0','Booking quote60000 snapshotv1; publish v2','Tính session theo v1 sau thay đổi giá','Dùng snapshot committed, không áp giá mới vào booking/session cũ.'],
 ['Daily cap và peak','P1','P10 duyệt, FX cap120000, separate peak oracle','Check F05/F06; bổ sung peak cases sau duyệt order','Cap120000 đúng fixture; peak order chưa duyệt -> Blocked, không đoán.','P10'],
 ['Về sớm không hoàn unused','P0','Quote120m60000; prepaid60000; actual60m','Calculate checkout','FinalFee60000/remaining0; không tạo refund unused; booking cancel policy tách riêng.'],
 ['Overtime và bù trừ','P0','F09/F10, snapshotv1','Checkout150m; pay15000; requote','FinalFee75000; before topup due15000; after due0; không thu75000 lại.','P05/P10'],
 ['Policy null/currency/money','P0','Required policy null hoặc currency mismatch','Thử mở luồng pricing/exit; gửi negative/invalid money','Không ngầm miễn phí/vô hạn; reject currency mismatch/negative; không mutate snapshot.','P10/P14']]);
group('PAY','REQ-05',[
 ['Success đủ tiền và xác thực','P0','PendingPayment giữ chỗ; callback adapter sẵn','Gửi sandbox hợp lệ full quote','Success xác minh -> recheck reservation -> Confirmed một lần; amount/currency match; audit.'],
 ['Sai chữ ký','P0','Sandbox signed fixture từ BE','Sửa một trường sau ký','Không success/confirm; ghi kết quả reject safe; gateway ACK theo adapter, không áp envelope public bừa.'],
 ['Sai amount/currency/provider ref','P0','Known payment expected60000VND','Gửi signed fixture sai amount/ref','Không confirm dù signature valid; đối soát mismatch, không nhầm đơn.'],
 ['Duplicate callback/retry','P0','Callback hợp lệ + idem unique','Gửi 2 lần/đồng thời và timeout retry','Một payment effect/confirmation; 1 logical receipt, không tăng total paid 2 lần.'],
 ['Callback sau expiry','P0','Hold expired/reallocated','Gửi callback có tiền xác minh','Không chiếm slot đã cấp khác; không Confirmed tự động; ghi tiền thực tế/exception rồi xử lý P06.','P06'],
 ['Cash actor đúng scope','P0','Pending CashA; StaffA và StaffB','Confirm A bằng từng actor; spoof CashConfirmedByUserId','StaffA theo permission được; StaffB403; actor server-derived không spoof.','P01'],
 ['Cash retry/idempotency payload mismatch','P0','Pending Cash; idemKey K','Confirm K 2 lần; K với input khác','Same input same result; khác input409; không cash receipt/audit mutation duplicate.'],
 ['Browser return và thất bại','P0','Pending payment','Sửa return URL status=success; callback Failed','Client không confirm; thất bại không tăng paid/booking Confirmed.'],
 ['XOR owner và non-success paid','P1','DB test module','Payment both BookingId/SessionId; count Pending/Failed','XOR rejects both/neither; chỉ verified Success tính paid, refund tính đúng không 2 lần.'],
 ['Refund/cancel','P1','P07 chưa duyệt','Chuẩn bị cases partial/full/overrefund','Blocked policy; sau duyệt net receipts đúng, refund không vượt capture, snapshot không đổi.','P07']]);
group('EXIT','REQ-06',[
 ['Checkout khác physical exit','P0','Active session trả đủ','POST check-out chỉ tính phí','ExitPending, ExitedAt null; slot vẫn chiếm; không Completed vì payment.','P05'],
 ['Unpaid physical exit','P0','Remaining15000','Gọi confirm-exit','Reject; không barrier exit authorization/ExitedAt/release slot.'],
 ['Physical exit valid','P0','ExitPending, due0, evidence verified','Staff cùng bãi confirm tại exit gate','Completed/ExitedAt một lần; release current assignment và state coherently; reservation history giữ.','P01/P05'],
 ['Ra sau FeeCalculatedThrough/grace','P0','Đã trả quote; now qua grace','Confirm exit với quote cũ','Recheck/requote theo P05; không cho nợ phát sinh bị bỏ qua.','P05'],
 ['Replay/concurrent exit','P0','Valid session exit; 2 requests','Confirm same idem hoặc different key đồng thời','Tối đa một logical exit; same idem same result; không audit/event/receipt duplicate sai.'],
 ['Wrong session/gate/lot actor','P0','SessionA; StaffB/gateB','Giả ID/query/body khác bãi','Deny/conflict theo contract; không release tài nguyên B.'],
 ['Overstay gặp booking kế tiếp','P0','SessionA still physical; next Confirmed reservation','Đến giờ booking kế tiếp','Không giả physical exit; giữ cam kết và reallocation/Staff audit theo P09.','P09'],
 ['Rollback lỗi commit','P0','Inject failure DB test','Fail giữa session completion/release/audit','Rollback toàn bộ; chưa có realtime success/barrier command xuất trước commit.']]);
group('AUDIT','REQ-07',[
 ['Audit thay giá/cash/manual','P0','Manager/Staff authorized actions','Đổi giá, cash confirm, manual reason','Actor/time/lot/entity/action/reason/requestId đúng; không secrets/tokens/PII dư.'],
 ['Append-only','P0','Audit row test','Thử UPDATE/DELETE qua ORM và DB role test','Reject ngay cả Admin nghiệp vụ; không sửa/xóa audit lịch sử.'],
 ['Audit/report scope và public PII','P0','StaffA/ManagerA/Guest','Query B hoặc multi-lot list/filter/export; Guest audit','Không bypass qua filter/export; Guest không phone/full plate/audit; permission mở chờ P12.','P12'],
 ['Realtime group/reconnect','P1','SignalR adapter sẵn','Subscribe B trái quyền; reconnect sau change','Group private scope đúng; reconnect REST snapshot; event after commit; không leak PII public.'],
 ['Revenue không double count','P1','Known receipts100000 refund10000, timezone test','Report và đối chiếu ledger','Gross100000 refund10000 net90000 theo fixture P13; không cộng Payment+Transactions.','P13'],
 ['Bug/regression evidence','P1','API build/version/env được ghi','Chạy suite; fail tạo bug; retest','Report có run timestamp/build/request IDs và status thật; Not run không tính PASS.']]);
group('AI','REQ-08',[
 ['OCR ảnh/no-plate/confidence','P1','Provider/storage API sẵn; ảnh có nhãn','Ảnh rõ/mờ/no plate/corrupt/oversize','Ứng viên/confidence hoặc NO_PLATE đúng contract; ảnh invalid400/413/415; staff review, không OPEN.','P17','S05'],
 ['OCR scope/privacy/review','P0','StaffA, StaffB, Guest; recognitionA','Read/upload/review khác bãi; guest; spoof reviewer','403/401 theo quyền; no public image/full plate; reviewer server actor; TTL rechecked.','P17','S05'],
 ['AI không phạt hay sửa session','P0','Recognition/operational alert','Chỉ upload/alert; malicious prompt muốn phạt','Không payment/penalty/booking/session mutation tự động.','—','S04/S05'],
 ['Forecast capacity/source/stale','P1','Zero capacity hoặc SIMULATED/stale forecast','Query từng fixture','Zero no divide-by-zero; source explicit, STALE/INSUFFICIENT_DATA không 0% giả; không availability authority.','P17','S05'],
 ['Assistant nguồn đúng bãi/no PII','P0','Published docs A/B, draft expired; prompt injection','Hỏi cổng A, PII, đổi role, docs B','Chỉ public published effective đúng bãi/global; citations thật, không tool write/PII/draft.','P17','S05'],
 ['AI lỗi fallback','P1','Timeout provider/storage fail','Gây lỗi OCR/assistant/forecast','QR/Staff/FAQ fallback; không giả AI success; booking/payment tiếp tục độc lập.','P17','S05']]);
const gaps=[
 ['G01','API mẫu tạo booking trả QR ngay PendingPayment','Model S01 yêu cầu trả trước đầy đủ trước Confirmed và quyền check-in.','Đề xuất chỉ cấp QR dùng được sau Confirmed; phân biệt access token tra cứu và QR entry.','TV6/TV7/TV8','Chờ duyệt'],
 ['G02','Check-in mẫu dùng gateCode/qrSignature, sessionId không UUID','Model dùng Guid + QR nonce/signature; sample không là runtime contract.','Chuẩn hóa gateId/qrPayload DTO, exact route/version/error với BE trước FE/test.','TV6/TV8','Chờ duyệt'],
 ['G03','Prototype hold5m/90%/fixed floors/unique active','Baseline/model hold15m, multi-lot, windows và physical state.','Không dùng prototype làm oracle V4; migrate schema/logic có tests.','TV6/TV8','Open'],
 ['G04','V4 47-table snake_case vs EF 28-table PascalCase','Không cùng schema/migration đã chạy.','Mapping matrix + chosen schema test; không chạy SQL lẫn.','TV5–TV8','Open'],
 ['G05','Main/duc/dev có tree khác nhau','Dev mới có dist/node_modules, chưa source/BE như main.','Chốt buildable integration tree; không coi branch có asset build là API readiness.','TV8','Open'],
 ['G06','Manager/Admin quyền Cash/gate chưa contract','Staff được assigned là rule chắc chắn; Manager bao hàm Staff mới đề xuất.','Default deny từng capability mở; chốt P01 trước thực thi.','TV5/TV8/TV2','Open']
];
const data={asOf:'2026-10-06',roles:'TV1–TV8; TV2 sở hữu BA/test, không tự implement BE',sources,policies,rbac,fixture,oracle,cases,gaps};
await fs.writeFile(path.join(out,'tv2-data.json'),JSON.stringify(data,null,2));
console.log(`Prepared ${cases.length} test cases, ${policies.length} policies, ${rbac.length} permissions, ${oracle.length} money oracles.`);
