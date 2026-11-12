from pathlib import Path
import hashlib
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent
src=ROOT/'Project Team - Sprint x Planning.docx'
assert hashlib.sha256(src.read_bytes()).hexdigest()=='22d877560a84b935c80116757a5430b660e650e57aa26ebaf1fa48b1c6935816'
d=Document(src); table_style=d.tables[0].style
for e in list(d._element.body):
    if e.tag!=qn('w:sectPr'): d._element.body.remove(e)
for name in ['Normal','Title','Heading 1','Subtitle']:
    s=d.styles[name];s.font.name='Calibri';s.font.color.rgb=RGBColor(0,0,0)
    for b in list(s.element.xpath('./w:pPr/w:pBdr')):b.getparent().remove(b)
d.styles['Normal'].font.size=Pt(11)
d.styles['Normal'].paragraph_format.space_after=Pt(6)
d.styles['Normal'].paragraph_format.line_spacing=1.08
d.styles['Title'].font.size=Pt(22)
d.styles['Heading 1'].font.size=Pt(15)

def p(text,style=None):return d.add_paragraph(text,style)
def h(text):return p(text,'Heading 1')
def table(headers,rows,widths):
    t=d.add_table(rows=1,cols=len(headers));t.style=table_style;t.autofit=False
    for c,w in zip(t.columns,widths):c.width=Inches(w)
    for c,text in zip(t.rows[0].cells,headers):
        c.text=text
        for r in c.paragraphs[0].runs:r.bold=True
        shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'E8EEF4');c._tc.get_or_add_tcPr().append(shade)
    header=OxmlElement('w:tblHeader');t.rows[0]._tr.get_or_add_trPr().append(header)
    for vals in rows:
        for c,text in zip(t.add_row().cells,vals):c.text=str(text)
    for row in t.rows:
        row._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
        for c,w in zip(row.cells,widths):
            c.width=Inches(w)
            for par in c.paragraphs:
                par.paragraph_format.space_after=Pt(4)
                for run in par.runs:run.font.size=Pt(10)
    return t
def link(label,url):
    par=d.add_paragraph();hyper=OxmlElement('w:hyperlink')
    rel=d.part.relate_to(url,'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',is_external=True)
    hyper.set(qn('r:id'),rel);run=OxmlElement('w:r');prop=OxmlElement('w:rPr')
    color=OxmlElement('w:color');color.set(qn('w:val'),'174A7E');prop.append(color)
    run.append(prop);txt=OxmlElement('w:t');txt.text=label;run.append(txt);hyper.append(run);par._p.append(hyper)

p('Parking System Team 02','Title')
p('Sprint trước Báo cáo tổng hợp','Subtitle')
p('Kỳ báo cáo 23/09/2026 đến 06/10/2026. Nhóm đã đưa lên GitLab nền tảng tài liệu và dữ liệu, demo API, thiết kế AI và giao diện ban đầu. Chưa có bằng chứng nghiệm thu luồng đa bãi từ đăng nhập đến thanh toán và xe ra.')
h('I Sprint Duration')
p('Hai tuần, từ 23/09 đến 06/10/2026, theo giờ Việt Nam. Báo cáo lập ngày 06/10/2026, nối với sprint đề xuất 07–20/10. Đây là tổng hợp hồi cứu theo GitLab, không khẳng định nhóm đã họp planning hoặc cam kết backlog này từ đầu kỳ.')
p('Phạm vi nguồn: các nhánh remote đã fetch, nội dung commit, README và test artifacts trong repo. Thời điểm commit là thời điểm được ghi trong Git, không chứng minh ngày toàn bộ công việc được thực hiện hay ngày push. Không có tổng effort/story points đã được nhóm xác nhận.')
h('II Sprint Goals')
p('Mục tiêu tổng hợp từ đầu ra thực tế: xây nền tảng Multi-Parking Baseline V4; chuẩn bị model, EF mapping và database guards; minh họa Clean Architecture; thiết kế 3 AI; dựng UI Customer ban đầu. Các mục tiêu này được tái lập để báo cáo, không phải sprint goal được phê duyệt trước kỳ.')
h('III Sprint Backlog tổng hợp')
p('Trạng thái “Có đầu ra” chỉ xác nhận file/code đã có trên GitLab. “Có báo cáo test” cần đọc phạm vi test; không tương đương nghiệm thu toàn bộ tính năng. Không gán TV theo tác giả commit khi chưa có mapping tên thật.')
table(['No','Đầu ra','SP','Ưu tiên','Owner báo cáo','Trạng thái'],[
['1','Khởi tạo repo và quy trình','—','Nền tảng','TV8','Có đầu ra'],
['2','Baseline V4 và tài liệu docs','—','Nền tảng','TV1/TV2/TV8','Có tài liệu'],
['3','Models EF migrations và guards','—','Nền tảng','TV5–TV8','Có báo cáo test'],
['4','Prototype slots và guest booking','—','Demo','TV6/TV8','Có code prototype'],
['5','Demo Clean Architecture API','—','Demo','TV8','Có báo cáo test'],
['6','Thiết kế 3 AI và DBML V4','—','Thiết kế','TV8 + owner module','Design only'],
['7','UI Home Login Register Logout','—','Giao diện','TV3','Có code UI'],
['8','Tích hợp core end-to-end','—','Tiếp theo','Toàn nhóm','Chưa đủ bằng chứng']],[.4,2.05,.5,.7,1.2,1.4])
d.add_page_break()
h('IV Task Breakdown theo đầu ra đã có')
p('Bảng dưới giao TV tiếp nhận/review/báo cáo theo phân công, không xác nhận từng TV là người đã viết các commit trước đây. Báo cáo không dùng số file hoặc số dòng code để chấm hiệu suất cá nhân.')
table(['TV','Phần tổng hợp và bàn giao','Giới hạn cần nêu'],[
['TV1','Baseline/requirements/API liên quan Customer; UI nhánh duc và backlog auth/search/booking.','Chưa có UAT Customer end-to-end hoặc kết quả cá nhân.'],
['TV2','Business rules, quyền theo bãi, pricing/payment/session và bằng chứng kiểm tra schema.','Constraint tests không chứng minh service authorization/payment hoạt động.'],
['TV3','UI Home/Login/Register, AuthContext, API client, cấu hình React TypeScript Vite.','README ghi API auth chưa có; chưa nghiệm thu đăng nhập thật.'],
['TV4','Mô hình Staff/Manager, assignment và cấu trúc bãi để chuẩn bị portal.','Chưa thấy bằng chứng UI vận hành hoàn chỉnh trong các commit kiểm tra.'],
['TV5','Models Identity/Parking và mapping theo bãi trong database-work.','Models/schema không thay thế Auth/OTP/authorization API.'],
['TV6','Bookings/Sessions/QR/Reservations schema; prototype booking/hold.','Prototype còn rule cũ, cần đối chiếu V4 trước tái sử dụng.'],
['TV7','Pricing/Payment entities và guards; thiết kế giá/search/payment của baseline.','Chưa có bằng chứng gateway VNPay và search/pricing end-to-end.'],
['TV8','Repo/docs, demo Clean Architecture, nền tảng database, AI design và tích hợp nhánh.','Demo InMemory khác PostgreSQL; .NET demo và core khác phiên bản.']],[.5,3.35,2.4])
h('Các mốc có commit trên GitLab')
table(['Ngày VN','Commit và nhánh','Nội dung'],[
['29/09','7995d66 · dev và nhánh khởi tạo','Initial commit README.'],
['01/10','00d9286 · demo/prototype','API demo Clean Architecture, Postman/Newman và báo cáo test.'],
['02/10','2ac3f62 · main','Baseline V4, 184 file, models/migrations, guards và prototype.'],
['03/10','73bd002 · demo/prototype','Commit adding AI chỉ thêm update10.3/.gitkeep.'],
['03/10','fa872f0 · features/Design_AIExtension','3 file update103: spec AI, DBML V4, SQL bổ sung.'],
['05/10','df0a5a5 · duc','18 file thay đổi: UI Customer và cấu hình frontend.']],[.65,2.25,3.35])
p('Không thấy commit trong các remote đã đọc cho 23–28/09; điều này không chứng minh nhóm không làm việc ngoài GitLab. Tên migration có ngày 28/09 nhưng được đưa vào commit 02/10; không dùng tên file thay ngày ghi nhận commit.')
d.add_page_break()
h('V Definition of Done và bằng chứng kiểm thử')
table(['Phần','Bằng chứng trong repo','Kết luận cho kỳ báo cáo'],[
['Demo API','TEST-RESULTS.md: build 0 warnings/errors; Newman 8 requests, 32 assertions, 0 failures. Có collection và JSON report.','Test được báo cáo cho GET parking lot bằng repository mock/InMemory; không database. Không chạy lại trong lần lập báo cáo.'],
['Database EF','Data/README.md ghi 28 bảng nghiệp vụ + migration history; 2 migrations, 19 kiểm tra PostgreSQL đạt, dữ liệu thử rollback.','Có bằng chứng kiểm tra nền tảng schema theo tài liệu. Chưa phải load test/luồng booking-payment hoàn chỉnh; không kiểm tra lại DB hiện tại.'],
['AI design','Spec 3 API/diagrams, ERD 47 bảng và SQL thêm 5 bảng, nằm trong update103.','Đã có design artifacts, chưa có AI runtime/migration trên database thật được xác nhận.'],
['Frontend','Code React/Vite, auth state, API client và README mô tả cách nối API.','Có UI source. README nói auth backend chưa có; không ghi đã login/register thành công hoặc build PASS nếu chưa có report.']],[.8,2.85,2.6])
p('Nguồn database EF dùng 28 bảng nghiệp vụ, còn DBML AI V4 có 47 bảng trên core V3. Đây là hai mô hình cần đối chiếu và mapping, không báo cáo như một schema chung đã chạy. Demo Clean Architecture dùng .NET 10, prototype ParkingProject và chuẩn baseline cần được leader chốt khi tích hợp.')
h('Những giới hạn phát hiện khi đọc source')
for text in [
'Prototype README ghi hold 5 phút, khóa khi occupancy >90%, seed cố định F01/F02/F03 và unique active slot/xe. Các rule này không đạt baseline V4 hold 15 phút, multi-lot và time-window semantics; không gọi prototype là booking V4 hoàn chỉnh.',
'Schema EF có GiST/exclusion/FK/audit guards nhưng README nêu chưa có API nghiệp vụ, authorization, OTP hoặc payment gateway đầy đủ.',
'UI duc chưa được merge vào main theo history đã đọc; design AI ở nhánh riêng từ dev. Các nhánh chưa tạo thành bản tích hợp end-to-end.',
'Commit adding AI chỉ tạo thư mục rỗng; không tính là đã triển khai nhận diện biển số, dự báo hay chatbot.'
]:p('• '+text)
d.add_page_break()
h('VI Sprint Review')
p('Đầu ra ghi nhận: bộ tài liệu Baseline V4; entities/mapping/migrations và guards; prototype slots/booking; demo Clean Architecture có test artifacts; thiết kế AI; UI Customer ban đầu. Đây là hoàn thành các đầu ra cụ thể, chưa đồng nghĩa các User Story sản phẩm đã đạt DoD.')
p('Chưa có đủ bằng chứng nghiệm thu: auth/RBAC thực thi ở backend; 3 bãi được seed và vận hành trên schema thống nhất; nearest/cheapest thật; booking trả trước an toàn; QR/check-in/session/check-out; VNPay; map 3D/SignalR tích hợp; 3 AI runtime có kiểm chứng. Không khẳng định chưa từng làm ngoài các nhánh/tài liệu đã đọc.')
p('Kết luận: kỳ vừa qua tạo được nền tảng và các phần demo/design riêng. Sprint 07–20/10 cần tập trung schema/API thống nhất và core tích hợp; không tính số bảng hay UI đã có làm tỷ lệ hoàn thành toàn dự án.')
h('VII Sprint Retrospective tổng hợp')
table(['Điểm tích cực','Điểm cần cải thiện','Hành động đề xuất'],[
['Có tài liệu, model và test artifacts để đối chiếu.','Prototype, EF schema và DBML V4 còn khác nhau.','TV8 + TV5–TV7 chốt solution/schema, mapping và migration test D1–D2.'],
['UI đã có API client; AI có spec/diagrams.','UI chưa nối auth thật; design AI chưa phải runtime.','TV5/TV3 nối auth; BA test. Chuẩn bị data/FAQ AI, không ghi Done runtime.'],
['Có phân công module và workflow review.','Nhánh dev khác tên develop trong tài liệu; các đầu ra còn ở nhánh riêng.','TV8 chốt nhánh/remote; tích hợp từng API hằng ngày, review và BA retest.']],[1.9,2.05,2.3])
p('Retro này là nhận xét tổng hợp từ evidence, chưa phải biên bản cuộc họp hoặc đánh giá cá nhân TV1–TV8. Nhóm xác nhận bổ sung nguyên nhân, effort, bug và action owner trước khi dùng làm báo cáo chính thức.')
h('Nguồn GitLab')
base='https://git.fsoft-academy.edu.vn/hcm26_cpl_net_06/team-02/parking-system-group2'
for label,part in [
('Baseline và backend foundation · 2ac3f62','/-/commit/2ac3f629baab155f68b78a5d714b0b36e2933bf3'),
('Demo Clean Architecture và TEST RESULTS','/-/blob/demo/prototype/Parking.CleanArchitecture.Demo/docs/TEST-RESULTS.md'),
('Database EF và 19 kiểm tra được ghi nhận','/-/blob/main/backend_parking_system/database-work/ParkingSystem/Data/README.md'),
('Prototype và các giới hạn nghiệp vụ','/-/blob/main/backend_parking_system/README.md'),
('AI design update103','/-/tree/features/Design_AIExtension/update103'),
('Frontend và giới hạn auth integration','/-/blob/duc/frontend_parking_system/README.md')]:link(label,base+part)
p('Phương pháp: fetch origin ngày 06/10/2026; đọc commits có thời điểm trong kỳ trên các remote. Không chạy lại build/DB/Newman, không truy cập CI/MR approvals hoặc suy đoán người thực hiện theo TV. Hai file mẫu và báo cáo sprint kế tiếp được giữ nguyên.')
OUT.mkdir(parents=True,exist_ok=True)
dest=OUT/'Sprint_Report_Parking_2026-09-23_2026-10-06.docx';d.save(dest)
print(dest)
