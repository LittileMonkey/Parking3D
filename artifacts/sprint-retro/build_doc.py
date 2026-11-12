from pathlib import Path
from copy import deepcopy
import hashlib
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent
src=ROOT/'Project Team - Sprint x Planning.docx'
assert hashlib.sha256(src.read_bytes()).hexdigest()=='22d877560a84b935c80116757a5430b660e650e57aa26ebaf1fa48b1c6935816'
d=Document(src)
table_style=d.tables[0].style
for e in list(d._element.body):
    if e.tag!=qn('w:sectPr'): d._element.body.remove(e)
normal=d.styles['Normal']; normal.font.name='Calibri'; normal.font.size=Pt(11)
normal.paragraph_format.space_after=Pt(6)
normal.paragraph_format.line_spacing=1.08
for name in ['Title','Heading 1','Heading 2']:
    d.styles[name].font.color.rgb=RGBColor(0,0,0)
    d.styles[name].font.name='Calibri'
    for b in list(d.styles[name].element.xpath('./w:pPr/w:pBdr')): b.getparent().remove(b)
d.styles['Title'].font.size=Pt(22)
d.styles['Heading 1'].font.size=Pt(15)

def p(text,style=None): return d.add_paragraph(text,style)
def h(text): return d.add_paragraph(text,'Heading 1')
def table(headers,rows,widths=None):
    t=d.add_table(rows=1, cols=len(headers)); t.style=table_style; t.autofit=False
    if widths:
        for col,width in zip(t.columns,widths): col.width=Inches(width)
    for c,txt in zip(t.rows[0].cells,headers):
        c.text=txt
        for r in c.paragraphs[0].runs: r.bold=True
        shade=OxmlElement('w:shd'); shade.set(qn('w:fill'),'E8EEF4'); c._tc.get_or_add_tcPr().append(shade)
    head=OxmlElement('w:tblHeader'); t.rows[0]._tr.get_or_add_trPr().append(head)
    for vals in rows:
        for c,txt in zip(t.add_row().cells,vals): c.text=str(txt)
    for row in t.rows:
        pr=row._tr.get_or_add_trPr(); pr.append(OxmlElement('w:cantSplit'))
        for i,c in enumerate(row.cells):
            if widths: c.width=Inches(widths[i])
            for par in c.paragraphs:
                par.paragraph_format.space_after=Pt(4)
                for run in par.runs: run.font.size=Pt(10)
    return t

p('Parking System Team 02','Title')
p('Sprint kế tiếp Planning','Subtitle')
p('Bản dự thảo cho nhóm 8 người. Giữ phạm vi database V4 và ưu tiên một bản tích hợp chạy được; chưa ghi nhận kết quả nghiệm thu hay quyết định retrospective của cả nhóm.')
h('I Sprint Duration')
p('2 tuần từ 07/10/2026 đến 20/10/2026, dự kiến 10 ngày làm việc, nghỉ thứ Bảy và Chủ Nhật. Lịch là đề xuất; nhóm xác nhận khi sprint planning. D1–D10 nghĩa là ngày làm việc thứ 1 đến thứ 10.')
h('II Sprint Goals')
p('Cuối sprint, nhóm tạo được database test với 3 bãi khác cấu trúc, đăng nhập thật, phân quyền theo bãi, tìm gần nhất/rẻ nhất và đặt ExactSlot ở trạng thái PendingPayment an toàn. Hai request tranh cùng slot chỉ một request giữ chỗ thành công.')
p('Payment sandbox → Confirmed → QR → Staff check-in và map 3D/SignalR là mục tiêu nối tiếp khi nền tảng đạt mốc D5. Chuẩn bị dữ liệu và contract cho 3 AI; chưa cam kết hoàn thành cả 3 runtime trong sprint này.')
h('III Sprint Backlog')
p('Story Points để TBD cho nhóm estimate cùng nhau. Planned là kế hoạch, không phải đã hoàn thành. Owner chính được liệt kê trước; BA nghiệm thu theo phạm vi.')
backlog=[
['1','Schema và seed 3 bãi','TBD','High','TV8, TV5–TV7','Planned'],
['2','Auth và quyền theo bãi','TBD','High','TV5, TV3/TV4','Planned'],
['3','Nearest và cheapest','TBD','High','TV7, TV3','Planned'],
['4','ExactSlot và hold an toàn','TBD','High','TV6, TV3','Planned'],
['5','Sandbox và xác nhận booking','TBD','Conditional','TV7, TV6','Planned'],
['6','QR và Staff check-in','TBD','Conditional','TV6, TV4','Planned'],
['7','Map đơn giản và realtime','TBD','Conditional','TV8, TV3/TV4','Planned'],
['8','Regression và chuẩn bị AI','TBD','High','TV1/TV2, TV8','Planned']]
table(['No','User Story','Points','Priority','Assignee','Status'],backlog,[.45,1.85,.65,.9,1.2,1.2])
d.add_page_break()
h('IV Task Breakdown')
p('Các thành viên làm song song theo API/DTO đã chốt D2. FE dùng mock đúng contract trong lúc chờ BE; mock không được tính là nghiệm thu tích hợp. BE/FE nối từng API ngay khi sẵn sàng, không chờ cuối sprint.')
tasks=[
['TV1','BA và Tester Customer','Tuần 1: đặc tả auth/search/booking, dữ liệu test, Postman.\nTuần 2: test UI/API, overlap/hold, retest; soạn câu hỏi và đáp án assistant có nguồn.','Test report và traceability; phối hợp TV3/TV5/TV6/TV7.'],
['TV2','BA và Tester vận hành','Tuần 1: ma trận quyền, policy, test pricing/payment.\nTuần 2: scope/replay QR/check-in nếu sẵn, regression; bộ ảnh OCR có nhãn.','RBAC matrix, regression và kịch bản demo; phối hợp TV4/TV5–TV8.'],
['TV3','Frontend Customer','Tuần 1: review UI nhánh duc, nối auth, dựng search/detail.\nTuần 2: API thật search/quote/availability/booking; payment/QR nếu đạt gate.','Luồng Customer thật; lỗi 401/409/hold/empty; phối hợp TV1/TV5–TV8.'],
['TV4','Frontend vận hành','Tuần 1: layout và bộ chọn bãi, cấu trúc lot/level/zone/slot.\nTuần 2: nối cấu trúc và tra cứu booking; Staff check-in khi API sẵn; wireframe OCR.','Portal đúng scope, trạng thái từ backend; phối hợp TV2/TV5/TV6/TV8.'],
['TV5','Backend Identity và Parking','Tuần 1: mapping, auth, owner/scope, seed 3 bãi, API xe/cấu trúc.\nTuần 2: tests quyền, tích hợp FE; contract OTP guest.','API và tests cross-lot/ownership; migration điều phối với TV8.'],
['TV6','Backend Booking và Session','Tuần 1: availability, ExactSlot/reservation, advisory lock/GiST tests.\nTuần 2: hold expiry, confirmation với TV7; QR/check-in nếu đạt gate.','PostgreSQL concurrency PASS, không Confirmed khi chưa xác minh đủ tiền.'],
['TV7','Backend Search Pricing Payment','Tuần 1: estimate/snapshot, Haversine/cheapest; kiểm tra sandbox.\nTuần 2: API search thật, callback chữ ký/amount/idempotency; occupancy contract.','Test oracle giá/khoảng cách; payment chỉ báo đạt khi thực sự kiểm chứng.'],
['TV8','Full stack Leader','Tuần 1: schema/solution/contracts, CI, migration/audit chung.\nTuần 2: tích hợp, map/realtime nếu đủ budget, review và release demo.','Một bản tích hợp; owner AI được chốt, không dồn cả 3 AI vào leader.']]
table(['TV','Vai trò','Công việc','Bàn giao và phối hợp'],tasks,[.5,1.0,2.85,1.9])
d.add_page_break()
h('Lịch tích hợp')
milestones=[
['D1–D2','07–08/10','TV8 + BA + BE/FE chốt schema, solution, DTO, nhánh tích hợp và policy.'],
['D3–D4','09 và 12/10','Migration/seed test, auth/list lot API; FE nối thật, pricing/concurrency test.'],
['D5','13/10','Gate: 3 bãi, auth, scope 403, quote và ExactSlot PendingPayment an toàn.'],
['D6–D8','14–16/10','Nối search/booking; payment/QR/check-in/map nếu D5 đạt. Đóng scope D8.'],
['D9–D10','19–20/10','Regression, sửa bug chặn luồng, retest và demo clean database.']]
table(['Ngày','Lịch','Mốc bàn giao'],milestones,[.65,1.0,4.6])
p('Nếu D5 chưa đạt, D6–D8 ưu tiên sửa foundation; không nhận thêm tính năng để bù tiến độ trên giấy. TV8 điều phối migration; mỗi module có một owner. TV5–TV7 và FE phải chủ động nối phần mình.')
p('Nhánh tích hợp phải được nhóm xác nhận: GitLab hiện dùng dev, tài liệu quy định develop. Story có nhánh Design và Implementation; PR/MR review, build/test và BA retest trước nghiệm thu. Không push thẳng main. Theo quy trình nhóm, đồng bộ GitHub trước và GitLab sau khi cập nhật nhánh tích hợp.')
h('V Definition of Done')
for text in [
'Contract/API/DTO đúng mẫu; request/response, activity/sequence và mã lỗi được cập nhật.',
'Migration chạy trên database test mới; seed 3 bãi, health ready thành công; không phá GiST guards.',
'Backend kiểm tra owner/quyền theo bãi; FE menu không thay thế authorization.',
'Tests nghiệp vụ quan trọng PASS: overlap/hold, scope, estimate; callback/QR tests nếu chức năng nằm trong demo.',
'FE nối API thật, build thành công; bug chặn acceptance được sửa và BA retest.',
'MR được review và tích hợp; không commit secrets; phân biệt phần thật, mock, pending và chưa kiểm chứng.']:
    p('• '+text)
d.add_page_break()
h('VI Sprint Review')
p('Mục này chuẩn bị cho review ngày 20/10/2026. Chưa có dữ liệu hoàn thành của sprint tương lai, nên chưa đánh dấu Done hoặc ghi tỷ lệ hoàn thành.')
table(['Nội dung review','Bằng chứng cần có','Trạng thái hiện tại'],[
['Auth và 3-lot core','MR, CI và demo database mới','Chờ review'],
['Search và booking an toàn','API/UI thật, test giá/khoảng cách/concurrency/hold','Chờ review'],
['Payment QR Staff map','Demo và tests từng chức năng; nêu rõ sandbox/simulator','Có điều kiện, chờ review'],
['Chưa hoàn thành','Story ID, nguyên nhân, owner, hướng xử lý và sprint tiếp','Điền sau review']],[1.55,3.1,1.6])
p('Quy tắc demo: booking trả trước đầy đủ theo quyết định model, Confirmed chỉ sau backend xác minh và re-check tài nguyên. Không tạo QR hợp lệ từ query payment của trình duyệt. Xe chưa thực tế rời thì không giải phóng slot; check-out đầy đủ thuộc backlog tiếp theo nếu chưa triển khai.')
h('VII Sprint Retrospective')
p('Workbook đi kèm: Team_Retrospective_Parking.xlsx. Các cột của mẫu được giữ: Tên, Vai trò, Ưu điểm, Hạn chế, Cần chỉnh sửa, Ghi chú. Dùng TV1–TV8, không kế thừa tên hoặc đánh giá từ nhóm cũ.')
p('Retro hiện tại là dự thảo chuẩn bị họp, dựa trên các bằng chứng đã kiểm tra: UI nhánh duc đã có; README nêu API auth chưa có tại thời điểm kiểm tra; design AI đã đẩy; schema/model còn cần thống nhất. Đây không phải đánh giá cá nhân hay kết luận cuộc họp.')
p('Tại retro cuối sprint, từng TV bổ sung việc làm tốt, điểm cần cải thiện và bằng chứng MR/test. Cả nhóm chọn hành động cải thiện có owner, ngày hẹn và tiêu chí xác nhận. Không tự nhận consensus hoặc chấm hiệu suất khi chưa có dữ liệu.')
p('Nguồn: mẫu Word và Excel trong repo; PHAN_CONG_TASK_NHOM_8_NGUOI.md do người dùng cung cấp; kế hoạch 07–20/10/2026; GitLab main/duc/features Design AI đã đọc trong phiên. Trạng thái GitLab là ảnh chụp lúc kiểm tra, cần cập nhật tại kickoff.')
OUT.mkdir(parents=True,exist_ok=True)
dest=OUT/'Sprint_Planning_Parking.docx'; d.save(dest)
print(dest)
