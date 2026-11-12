from pathlib import Path
import json,hashlib
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
ROOT=Path(__file__).resolve().parents[2];OUT=Path(__file__).resolve().parent
data=json.loads((OUT/'tv2-data.json').read_text(encoding='utf-8'))
src=ROOT/'Project Team - Sprint x Planning.docx';d=Document(src);sty=d.tables[0].style
for e in list(d._element.body):
 if e.tag!=qn('w:sectPr'):d._element.body.remove(e)
for name in ['Normal','Title','Heading 1','Subtitle']:
 s=d.styles[name];s.font.name='Calibri';s.font.color.rgb=RGBColor(0,0,0)
 for b in list(s.element.xpath('./w:pPr/w:pBdr')):b.getparent().remove(b)
d.styles['Normal'].font.size=Pt(11);d.styles['Normal'].paragraph_format.space_after=Pt(6)
d.styles['Normal'].paragraph_format.line_spacing=1.05;d.styles['Title'].font.size=Pt(22);d.styles['Heading 1'].font.size=Pt(15)
def p(t,s=None):return d.add_paragraph(t,s)
def h(t):return p(t,'Heading 1')
def table(head,rows,widths):
 t=d.add_table(rows=1,cols=len(head));t.style=sty;t.autofit=False
 for c,w in zip(t.columns,widths):c.width=Inches(w)
 for c,txt in zip(t.rows[0].cells,head):
  c.text=str(txt)
  for r in c.paragraphs[0].runs:r.bold=True
  shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'E8EEF4');c._tc.get_or_add_tcPr().append(shade)
 t.rows[0]._tr.get_or_add_trPr().append(OxmlElement('w:tblHeader'))
 for vals in rows:
  for c,txt in zip(t.add_row().cells,vals):c.text=str(txt)
 for row in t.rows:
  row._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
  for c,w in zip(row.cells,widths):
   c.width=Inches(w)
   for par in c.paragraphs:
    par.paragraph_format.space_after=Pt(4)
    for r in par.runs:r.font.size=Pt(10)
 return t
def page():d.add_page_break()
p('Bộ bàn giao TV2 Parking System','Title')
p('Đặc tả vận hành tài chính và kiểm thử','Subtitle')
p('Ngày 06/10/2026. TV2 là BA và Tester phụ trách Staff/Manager/Admin, vận hành và tài chính. Bộ này chuẩn bị đầy đủ phần tài liệu và thiết kế kiểm thử có thể làm ngay; không thay thế code, policy approval hoặc kết quả chạy trên backend.')
h('Kết luận và phạm vi bàn giao')
p('Đã chuẩn bị 16 dòng quyền, 18 policy cần xác nhận, 64 test case và 10 oracle tiền mẫu. Tất cả case Not run. Có 8 API draft với request/response, validation và activity/sequence diagrams trong file Markdown; collection Postman chỉ là proposal, chưa chạy.')
p('Các nguồn đã đối chiếu: Baseline V4, model/EF main, API mẫu, AI design, frontend duc và nhánh dev mới. Model xác nhận prepayment, early exit không hoàn unused và scope assignment; các policy nullable vẫn phải chốt. Nhánh dev 30c402f mới có assets/dependencies nhưng không đủ source/backend tích hợp để nghiệm thu.')
h('Dùng bộ tài liệu theo thứ tự')
for text in ['Đọc guide này rồi mở TV2_WORKBOOK.xlsx: quyền và policy trước, test case sau.','Review policy/gap với TV5–TV8; điền người duyệt, ngày và revision. Không tự duyệt ô mở.','BE xác nhận schema, route/DTO và môi trường Development, seed/reset fixture.','Chạy case từng phần khi API sẵn, lưu evidence sanitized, tạo bug nếu đã xác nhận contract và reproducible failure.','Regression và retest cuối sprint; không chuyển Planned/Not run thành Pass chỉ vì code được push.']:
 p('• '+text)
h('Các file kèm theo')
table(['File','Mục đích'],[['TV2_WORKBOOK.xlsx','Quyền, policy, test cases, oracle, data, source/gap và bug log.'],['TV2_SPEC_API_TEST_PLAN.md','Spec đầy đủ và 8 cặp activity/sequence diagrams cho BE/FE review.'],['TV2_API_DRAFT.postman_collection.json','Import Postman sau BE chốt contract, không phải API đã có.'],['TV2_DEV.postman_environment.json','Default localhost port0, token trống; thay bằng môi trường test được chỉ định.'],['TEST_FIXTURES_DRAFT.json','UUID/clock/giá/identity giả lập cần seed trước dùng.']],[2.8,3.45])
page();h('Phân quyền và quyền chưa được duyệt')
p('User Active; assignment [ActiveFrom,ActiveTo), RevokedAt null. Staff/Manager theo bãi, không là role global cho mọi bãi. Quyền trên backend không phụ thuộc menu FE. Chờ duyệt đồng nghĩa default deny capability đó, không tự cấp để demo nhanh.')
rows=[]
for r in data['rbac']:
 rows.append([r[0],r[1],r[4],r[5],r[6]])
table(['ID','Chức năng','Staff','Manager','Admin'],rows,[.4,1.7,1.15,1.6,1.4])
p('Guest/Customer và các ghi chú có đầy đủ trong sheet Quyen. Customer có thể đọc tài nguyên của mình qua API riêng, không được gọi Staff action chỉ vì biết ID/plate. Manager/Admin Cash và gate chờ P01; delegation gán Manager chờ P02; đọc audit/export chờ P12. Không ai sửa/xóa AuditLog.')
page();h('Luồng check in và checkout')
h('Check in booking')
for t in ['1. Xác thực token/user Active và assignment; resolve booking/gate/slot về cùng bãi.','2. Verify QR signature/expiry/revoke, plate/vehicle, Confirmed và tiền đã verified đủ; arrival policy đã cấu hình.','3. Transaction + advisory lock/row lock thích hợp; re-read version/state, reservation và active sessions.','4. Consume QR và chuyển CheckedIn, tạo đúng một Active session, ghi AuditLog atomic. Lỗi rollback tất cả.','5. Commit trước realtime/gate command; adapter timeout retry idempotent, không giả barrier success.']:
 p(t)
h('Checkout khác với xe ra')
for t in ['1. Staff cùng bãi yêu cầu tính phí; load snapshot và receipts verified, server time. Policy bắt buộc null -> báo chưa cấu hình.','2. Tính FinalFee/netPaid/remainingDue, ghi FeeCalculatedThrough và ExitPending; ExitedAt vẫn null, slot vẫn occupied.','3. Thu phần thiếu qua VNPay đã xác minh hoặc Pending Cash + Staff confirmation; actor lấy từ principal, không từ body.','4. Có xác nhận physical exit; recheck tiền/grace và state/version dưới transaction/locks. Không lấy payment success làm physical evidence.','5. Completed/ExitedAt và release physical assignment đúng một lần; giữ lịch sử, không giải phóng reservation tương lai của khách khác; audit/commit/event.']:
 p(t)
p('Manual override phải có permission riêng, reason và audit; không bypass khoản nợ ngầm. Walk-in, no-show, arrival biên và overstay gặp booking kế tiếp chưa có policy duyệt thì test Blocked policy. Không tự áp booking prepayment vào walk-in.')
page();h('Giá thanh toán và oracle mẫu')
p('Fixture đề xuất Development: VND, rate 7.500 mỗi block 15 phút, daily cap 120.000, multiplier 1, cùng một ngày local. Booking120 phút quote60.000, prepaid60.000. Đây không là biểu giá thực tế của bãi; BE/BA duyệt P10 và seed trước test.')
p('Estimate = min(ceil(minutes/15) × 7.500, 120.000). Fixture FinalFee = max(quote, actualCharge), vì early exit không hoàn unused. NetPaid = captures verified − refunds đã xác minh; remainingDue = max(0, FinalFee − NetPaid). Dư tiền cần reconciliation, không tự hoàn khi policy chưa duyệt.')
table(['ID','Phút','Fee VND','NetPaid','Due VND'],[[r[0],r[1],f'{r[2]:,}',f'{r[3]:,}',f'{r[4]:,}'] for r in data['oracle']],[.5,.6,1.7,1.7,1.75])
p('F01–F06 là estimate; F07–F10 là settlement. F07 về sớm vẫn FinalFee60.000; F09 gửi150 phút FinalFee75.000, còn15.000; F10 đã top-up nên due0. Workbook tính bằng công thức, thay rate/status đã kiểm tra propagation và phục hồi về fixture.')
h('Callback và Cash')
p('TV7 cung cấp signed sandbox fixture. Verify signature, provider reference, amount/currency và transaction status; unique event/reference/idempotency chống double effect. Browser return URL không xác nhận Success. Callback có tiền nhưng hold expired phải ghi ledger/exception và P06, không Confirmed vào slot đã cấp người khác.')
p('Cash đúng một Booking hoặc Session owner; Pending Cash amount hợp lệ từ backend. Staff cùng bãi xác nhận; CashConfirmedByUserId server-derived. Duplicate retry không thêm receipt lần nữa. Gateway ACK phụ thuộc VNPay contract, không áp REST envelope tùy ý. Không có secret/chữ ký thật trong bộ tài liệu.')
page();h('Policy và khác biệt cần xử lý')
table(['ID','Quyết định cần xác nhận','Owner'],[[r[0],r[1],r[4]] for r in data['policies']],[.45,3.75,2.05])
p('Sheet Policy có rule khi chưa duyệt, deadline đề xuất, test liên quan và ô quyết định/người duyệt. P15 là default model phải seed explicit; P16 đã có quyết định model. Các ô Mở/Đề xuất không phải requirement đã duyệt.')
h('Gap quan trọng')
p('G01 API mẫu cấp QR ở PendingPayment chưa khớp prepayment model; đề xuất QR quyền vào chỉ sau Confirmed. G02 gateCode/qrSignature/sessionId mẫu cần contract UUID/payload rõ. G03 prototype hold5m/90%/fixed floors không là oracle V4. G04 DBML47 bảng khác EF28 bảng. G05 dev/main/duc chưa cùng integration tree. G06 Manager/Admin Cash/gate chờ permission.')
page();h('Thực thi kiểm thử và bàn giao')
p('64 ca: AUTH8, STRUCT8, GATE10, PRICE8, PAY10, EXIT8, AUDIT6, AI6. Workbook có Expected, Policy, Source, Status, Actual, Evidence/run/build, Bug link và Owner. Status ban đầu Not run; không phải tất cả điều kiện đã sẵn sàng.')
h('Quy trình cho mỗi case')
for t in ['1. Xác nhận contract revision, policy readiness, branch/commit, schema, clock, role/scope và fixture reset.','2. API chưa có -> Blocked API khi chạy; policy mở -> Blocked policy. 404 từ API chưa tồn tại không tự kết luận bug business.','3. Case nhiều biến thể phải lưu evidence từng biến thể, tất cả đạt mới Pass. Concurrent cases cần parallel harness/barrier start và DB asserts, Runner tuần tự không đủ.','4. Lưu sanitized request/response, correlationId, ảnh UI và read-only DB before/after/ledger/audit/event counts. Không lưu secret/JWT/full PII.','5. Fail hợp lệ tạo bug, gán BE owner; fix commit -> retest run -> Closed hoặc Reopened. Not run/Blocked không tính Pass.']:
 p(t)
h('Bug và regression')
p('Bug cần summary, severity theo ảnh hưởng, priority riêng, test/requirement ID, build/env, role/bãi, steps, expected/actual và evidence. Không tự bịa root cause. Sheet Bug Log để trống vì chưa có defect đã tái hiện. Smoke auth/scope/lot/quote trước, sau đó P0 money/concurrency/physical exit/audit, rồi P1/AI khi runtime sẵn.')
p('UAT01 bãi/giá đúng scope; UAT02 trả trước → QR → check-in; UAT03 overtime top-up → physical exit; UAT04 wrong-lot/replay/retry; UAT05 AI hỗ trợ không vượt quyền. Còn blocker policy/API thì chưa ký nghiệm thu toàn luồng.')
h('TV2 phối hợp với ai')
p('TV5 quyền/assignment; TV6 QR/gate/session; TV7 giá/callback/report; TV4 UI vận hành; TV8 schema/policy/integration. TV1 cùng duy trì requirement→API→test→result. D1–D2 review policy/contract; D4–D5 test phần có; D9–D10 regression/retest. Chưa gửi/push cho người khác trong tác vụ này.')
p('Mức xác minh: nguồn GitLab fetch 06/10/2026; bộ tài liệu/công thức/JSON được kiểm tra, không chạy backend/DB/VNPay/AI suite. Tên nguồn và revision nằm trong workbook Nguon va Gap và Markdown. Tài liệu hoàn chỉnh trong scope chuẩn bị BA/test; policy approval và kết quả execution vẫn thuộc nhóm.')
d.save(OUT/'TV2_GUIDE.docx');print(OUT/'TV2_GUIDE.docx')
