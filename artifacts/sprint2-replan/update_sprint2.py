from pathlib import Path
from copy import deepcopy
from docx import Document
from docx.oxml import OxmlElement
from docx.shared import Inches

root=Path(__file__).resolve().parents[2]
doc=Document(root/'artifacts/sprint2-replan/Sprint2_before_replan.docx')
def put(p,text):
    fmt=deepcopy(p.runs[0]._r.rPr) if p.runs and p.runs[0]._r.rPr is not None else None
    p.clear();r=p.add_run(text)
    if fmt is not None:r._r.insert(0,fmt)

replacements={
0:'Sprint 2 Parking System Team 02',
1:'Phân công phát triển microservices',
2:'Sprint này nối nền tảng Identity, Parking, Payment và AI thành luồng Customer đặt chỗ, Staff xác nhận tiền mặt và QR check-in. Mỗi service có database riêng; cả nhóm làm song song theo contract và kiểm thử từng phần ngay khi API sẵn.',
4:'Dự kiến 07/10/2026 đến 20/10/2026, 10 ngày làm việc, nghỉ thứ Bảy và Chủ Nhật. D1–D10 là ngày làm việc thứ 1–10. Ngày công và Story Points được nhóm xác nhận tại kickoff.',
6:'P0 bắt buộc: bốn service và bốn database chạy qua Gateway; seed ba bãi; Customer đăng nhập, chọn xe, tìm NEAREST/CHEAPEST, đặt ExactSlot và CASH. Staff đúng bãi xác nhận tiền, booking CONFIRMED phát QR, check-in tạo đúng một session. FE nối API thật, BA có evidence.',
7:'P1 có điều kiện: VNPay sandbox, OCR provider thật, đánh giá forecast baseline và map 3D chỉ đọc. D5 chỉ nhận P1 khi P0 đạt và đủ provider/hạ tầng. FAQ công khai đã duyệt dùng adapter hiện có. Không cam kết full check-out, OTP, reports hoặc production trong sprint này.',
9:'Nền tảng đã có code trên MR !2/!3: auth, quyền bãi, ExactSlot, CASH, gRPC/outbox/inbox; 15 unit và 8 nhóm tích hợp đã đạt trước sprint. Database đã tách schema, chưa cutover dữ liệu. Docker/CI nhóm và FE source cần xác minh. Story mới để Planned; Points TBD, không coi kết quả nền tảng là nghiệm thu sprint.',
12:'Tên theo thứ tự TV1–TV8: Phát, Quang, A.Đức, Tiến, N.Đức, Hàn, Sơn, Nhật. Mỗi người dự trù 6 ngày đầu việc chính, 2 ngày tích hợp/review và 2 ngày regression/fix/demo. P1 dùng thời gian còn lại sau P0, không cộng thêm vào 10 ngày.',
15:'D1–D2 khóa route/DTO/errors/policy. FE dựng mock đúng contract, BA viết tests, BE triển khai song song. Một endpoint sẵn thì nối FE/BA ngay. D5 chưa đạt thì D6–D8 sửa P0, không nhận thêm P1. D8 đóng scope, D9 regression, D10 retest/demo.',
16:'Nhật điều phối review MR nền tảng và tích hợp vào dev. Mỗi story có nhánh Design/Implementation, cập nhật dev và chạy checks trước MR; không push main. GitHub remote team chưa cấu hình, Nhật ghi quyết định đồng bộ. Database mỗi service chỉ do owner truy cập; giao tiếp qua gRPC/event.',
18:'• Contract có request/response, scope, errors, activity/sequence; đổi DTO báo FE/BA trước.',
19:'• Bốn schema tạo mới được, seed ba bãi, Gateway ready và CI build/unit/schema xanh; không xóa dữ liệu cũ hoặc phá guards.',
20:'• Backend kiểm tra quyền bãi/owner; assignment thu hồi có hiệu lực; không lộ hash/PII công khai.',
21:'• Tests overlap/hold/concurrency, CASH replay, QR expiry/replay, check-in/single session PASS; P1 có report riêng nếu nhận.',
22:'• UI dùng API thật, build đạt, BA retest, không còn bug chặn acceptance. Mock không tính Done.',
23:'• MR được review/tích hợp dev; docs cập nhật; không secrets. QR/AI không tự mở barrier; chưa có physical exit thì không giải phóng slot đang occupied.',
26:'Review ngày 20/10: demo P0 từ login/search/booking đến CASH/Confirmed/QR/check-in. Chạy thêm wrong-lot, overlap, payment/QR replay và hold expiry. Demo FAQ có nguồn và fallback. Kết quả sprint được điền sau khi thực thi.',
27:'VNPay, OCR thật, forecast và map chỉ tính đạt khi có bằng chứng chạy riêng. Không Confirmed từ return URL; không coi test double OCR là độ chính xác thật. Check-out/physical exit hoàn chỉnh thuộc sprint sau, không tạo nút giải phóng slot giả.',
29:'Quang tổng hợp retro ngày D10; Phát cung cấp Customer evidence, cả nhóm bổ sung kết quả MR/test và nguyên nhân pending. Dùng tên thật tương ứng TV1–TV8. Không ghi đánh giá cá nhân hoặc kết luận họp trước khi họp.',
30:'Phần chưa xong ghi issue, owner, nguyên nhân và bước tiếp theo; chọn hành động cải thiện có người phụ trách và ngày xác nhận. Giữ phân biệt Planned, In progress, Ready for test, Done và Blocked.',
31:'Chi tiết từng ngày, dependency, ownership và tiêu chí nằm trong docs/SPRINT_2_PHAN_CONG_MICROSERVICES.md. Quang sở hữu regression report chung; Phát sở hữu Customer test report. Nhật kiểm soát phạm vi và release candidate.',
32:'Căn cứ: phân công 8 người và tên do nhóm cung cấp, Baseline V4, business rules/API/Git guide, IMPLEMENTATION-STATUS và VALIDATION của microservices. Lịch 07–20/10 được giữ từ kế hoạch trước và cần nhóm xác nhận.'
}
for i,text in replacements.items():put(doc.paragraphs[i],text)

backlog=[
['S2-01','Review nền tảng, 4 DB, CI, seed 3 bãi','TBD','P0','Nhật + N.Đức/Hàn/Sơn','Planned'],
['S2-02','Quyền, xe Customer và cấu trúc bãi read APIs','TBD','P0','N.Đức','Planned'],
['S2-03','NEAREST/CHEAPEST và quote toàn duration','TBD','P0','Sơn + Hàn','Planned'],
['S2-04','Availability, lookup và hold expiry','TBD','P0','Hàn','Planned'],
['S2-05','CASH → Confirmed → QR → check-in/session','TBD','P0','Hàn + Sơn','Planned'],
['S2-06','Customer UI Gateway thật','TBD','P0','A.Đức + Phát','Planned'],
['S2-07','Staff UI CASH/QR/check-in','TBD','P0','Tiến + Quang','Planned'],
['S2-08','Regression, evidence và demo','TBD','P0','Quang + Phát','Planned'],
['S2-09','FAQ nguồn duyệt và fallback','TBD','P0','Phát + Nhật/A.Đức','Planned'],
['S2-10','VNPay sandbox verified callbacks','TBD','P1','Sơn + Hàn/Quang','Planned'],
['S2-11','OCR provider thật, privacy, review','TBD','P1','N.Đức + Tiến/Quang','Planned'],
['S2-12','Forecast evaluation / map read-only','TBD','P1','Sơn forecast; Nhật map','Planned'],
]
members=[
['TV1 Phát','BA Tester Customer','D1–D2: acceptance, dữ liệu search/giá/time và tests.\nD3–D5: API owner/search/booking/hold, bug report.\nD6–D8: Customer UI/QR, 15 câu FAQ có nguồn.\nD9–D10: regression và retest.','Traceability, Postman, Customer report. Nối A.Đức, N.Đức, Hàn, Sơn; Nhật duyệt FAQ.'],
['TV2 Quang','BA Tester vận hành và tài chính','D1–D2: RBAC, policy, oracle giá.\nD3–D5: scope, revoke, CASH/version/replay/late payment.\nD6–D8: QR/check-in/session/audit; bộ ảnh OCR.\nD9–D10: regression chung và demo.','Matrix, bug/retest, report chung. Nối Tiến và BE; không đợi toàn bộ BE xong.'],
['TV3 A.Đức','Frontend Customer','D1–D2: source FE/API client/types với Tiến.\nD3–D5: auth/xe/search/quote/booking.\nD6–D8: hold, payment status, QR, FAQ.\nD9–D10: build/fix/retest.','UI qua Gateway, 401/403/409/503 đúng; Phát test. Không xác nhận paid từ trình duyệt.'],
['TV4 Tiến','Frontend vận hành','D1–D2: layout, chọn bãi, contract.\nD3–D5: cấu trúc read, lookup, CASH.\nD6–D8: QR/check-in/session, OCR review nếu sẵn.\nD9–D10: build/fix/retest.','Staff portal đúng scope; refetch sau thao tác; Quang test. Full dashboard/report để sau.'],
['TV5 N.Đức','Backend Identity và catalogue','D1–D2: quyền/profile/assigned lots/revoke/xe.\nD3–D5: lot/level/zone/slot read, xe owner, seed 3 bãi.\nD6–D8: FE/tests; OCR provider/storage P1.\nD9–D10: fix/retest.','Identity và Parking catalogue DTO/tests; không client tự verified xe. OTP/refresh/full CRUD để sau.'],
['TV6 Hàn','Backend Booking Session','D1–D2: availability/lookup/QR/check-in design.\nD3–D5: read APIs, hold worker, guards/concurrency.\nD6–D8: QR sau Confirmed, check-in/session/assignment/audit.\nD9–D10: fix/retest.','Transaction, one active session, replay-safe. Nối Sơn, Tiến/A.Đức, BA; check-out/exit để sau.'],
['TV7 Sơn','Backend Search Pricing Payment','D1–D2: DTO/oracle, VNPay go/no-go.\nD3–D5: search/quote + availability, payment status/tests.\nD6–D8: VNPay P1; nếu blocked ưu tiên CASH/forecast baseline.\nD9–D10: fix/retest.','Search/pricing ở Parking; finance ở Payment; forecast ở AI. Test giá, callback/replay; không fake SUCCESS.'],
['TV8 Nhật','Leader hạ tầng và tích hợp','D1–D2: review MR !2/!3, dev, Docker/CI/ownership.\nD3–D5: 4 DB, health/gRPC/seed, review hằng ngày.\nD6–D8: nối QR/AI/FAQ; map read-only P1 nếu đủ.\nD9–D10: regression/release candidate/demo.','Môi trường tái chạy, checklist và MR review. Không ôm 3 AI; Production, cutover và SignalR đầy đủ để sau.'],
]
schedule=[
['D1–D2','07–08/10','Review nền tảng, source FE, lock DTO/policy/ownership; BA test draft; VNPay/OCR go/no-go.'],
['D3–D4','09 và 12/10','4 DB/CI/seed, auth/xe/lot read và search → booking → CASH nối FE.'],
['D5','13/10','Gate: 3 bãi, auth/search/booking/CASH thật; scope/hold/concurrency đạt. Thiếu thì ưu tiên sửa P0.'],
['D6–D8','14–16/10','QR/check-in/session; FAQ duyệt. P1 chỉ khi đủ điều kiện; D8 đóng scope.'],
['D9–D10','19–20/10','Regression/fix/retest; demo có evidence; review/retro và chuyển backlog.'],
]
review=[
['Môi trường và dữ liệu','4 DB/hosts/Gateway, pipeline và seed 3 bãi','Chờ thực thi'],
['Customer và CASH','UI/API thật; scope/giá/concurrency/hold/replay report','Chờ thực thi'],
['QR check-in và FAQ','QR/session tests, wrong-lot/replay; nguồn FAQ/fallback','Chờ thực thi'],
['P1 và phần chưa xong','VNPay/OCR/forecast/map evidence hoặc owner/blocker/next step','Có điều kiện'],
]
def fill(table,rows):
    template=deepcopy(table.rows[1]._tr)
    while len(table.rows)>1:table._tbl.remove(table.rows[-1]._tr)
    for values in rows:
        table._tbl.append(deepcopy(template))
        for cell,value in zip(table.rows[-1].cells,values):
            for p in list(cell.paragraphs)[1:]:cell._tc.remove(p._p)
            put(cell.paragraphs[0],value)
    for row in table.rows:
        if row._tr.trPr is None:row._tr.insert(0,OxmlElement('w:trPr'))
        if row._tr.trPr.find('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}cantSplit') is None:row._tr.trPr.append(OxmlElement('w:cantSplit'))
for table,rows in zip(doc.tables,[backlog,members,schedule,review]):fill(table,rows)
# The updated backlog flows over pages; remove obsolete manual breaks that
# otherwise leave a nearly blank continuation page after each long table.
for i in [10,13,24]:doc.paragraphs[i].clear()
widths=[[.65,2.10,.65,.65,1.5,.7],[.8,1.15,2.65,1.65]]
for table,colwidths in zip(doc.tables,widths):
    table.autofit=False
    for col,width in zip(table.columns,colwidths):col.width=Inches(width)
    for row in table.rows:
        for cell,width in zip(row.cells,colwidths):cell.width=Inches(width)
shortroles=['BA Tester\nCustomer','BA Tester\nVận hành','FE Customer','FE Vận hành','BE Identity\nCatalogue','BE Booking\nSession','BE Search\nPayment','Leader\nTích hợp']
for row,role in zip(list(doc.tables[1].rows)[1:],shortroles):
    put(row.cells[0].paragraphs[0],row.cells[0].text.replace(' ', '\n',1))
    put(row.cells[1].paragraphs[0],role)
doc.core_properties.title='Sprint 2 Parking System Team 02'
doc.core_properties.subject='Phân công microservices cho nhóm tám người'
doc.save(root/'Sprint_Planning_Parking_Sprint2.docx')
# Update the earlier plan location as well, so the team has no contradictory schedule.
plan=root/'docs/SPRINT_2_PHAN_CONG_MICROSERVICES.md'
(root/'docs/KE_HOACH_2_TUAN_2026-10-07_2026-10-20.md').write_text(plan.read_text(encoding='utf-8'),encoding='utf-8')
print('Updated Sprint 2 Word and both planning Markdown locations')
