import fs from 'node:fs/promises';
import path from 'node:path';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const out=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const w=Workbook.create();
function sheet(name,headers,rows,widths){
 const s=w.worksheets.add(name); s.showGridLines=false;
 s.getRange('A1:F1').values=[headers];
 s.getRange(`A2:F${rows.length+1}`).values=rows;
 const r=s.getRange(`A1:F${rows.length+1}`);
 r.format.font.name='Calibri';r.format.font.size=11;r.format.wrapText=true;r.format.verticalAlignment='center';
 r.format.borders={preset:'all',style:'thin',color:'#D9E2F3'};
 s.getRange('A1:F1').format.fill='#17365D';s.getRange('A1:F1').format.font.color='#FFFFFF';s.getRange('A1:F1').format.font.bold=true;s.getRange('A1:F1').format.rowHeight=32;
 for(let i=0;i<6;i++)s.getRange(`${String.fromCharCode(65+i)}:${String.fromCharCode(65+i)}`).format.columnWidth=widths[i];
 s.getRange(`A2:F${rows.length+1}`).format.rowHeight=96;
 s.freezePanes.freezeRows(1);
 return s;
}
sheet('Retro hien tai',['Chủ đề','Điểm tích cực có căn cứ','Vấn đề hoặc rủi ro','Cải thiện đề xuất','Owner','Bằng chứng và trạng thái'],[
 ['Phạm vi','Nhóm đã chọn giữ database V4 và 3 AI demo.','Chưa đồng nghĩa mọi bảng/chức năng đã triển khai.','Giữ scope; chia triển khai theo sprint, ưu tiên core.','TV8 + TV1/TV2','Trao đổi nhóm; dự thảo retro, chưa có đồng thuận cuộc họp.'],
 ['Frontend','Nhánh duc có Homepage/Login/Register và API client.','README tại thời điểm đọc ghi backend auth chưa có; UI chưa nghiệm thu end-to-end.','TV3 nối auth thật TV5; BA test cả lỗi và token expiry.','TV3 + TV5 + TV1','GitLab duc df0a5a5, 05/10/2026; cập nhật tại kickoff.'],
 ['Database','Có DBML V4 và model/EF để đối chiếu.','DBML snake_case và EF hiện tại chưa thống nhất; không chạy SQL chéo schema.','Chốt schema, mapping matrix và migration test trong D1–D2.','TV8 + TV5–TV7','Design V4 và model README; chưa đánh giá production migration.'],
 ['AI','Design 3 AI đã được đẩy trong update103.','Design không phải OCR/assistant/forecast runtime; forecast cần dữ liệu.','Soạn FAQ, ảnh có nhãn và snapshot contract; ghi rõ nguồn mô phỏng.','TV1/TV2 + TV6/TV7/TV8','GitLab features/Design_AIExtension fa872f0; chưa kết luận runtime đạt.'],
 ['Tích hợp','Phân công có owner từng module TV1–TV8.','Nếu chờ cuối sprint mới nối sẽ dồn lỗi; đây là rủi ro, chưa phải lỗi cá nhân đã xảy ra.','Chốt DTO D2, nối API từng ngày, review contract khi thay đổi.','Toàn nhóm; TV8 điều phối','Kế hoạch 07–20/10; đề xuất cần nhóm xác nhận.'],
 ['Workflow','Có hướng dẫn Design/Implementation và review.','GitLab dùng dev còn tài liệu ghi develop; thiếu quyết định nhánh tích hợp chung.','Ghi quyết định branch/remote, không merge main trực tiếp.','TV8','Danh sách remote đã kiểm tra; cần xác nhận tại kickoff.'],
 ['Kết quả sprint','Chưa có dữ liệu review của sprint 07–20/10.','Không được chuyển Planned thành Done hoặc tự chấm hiệu suất.','Cuối sprint điền MR/test/demo, carry-over và nguyên nhân thật.','TV1/TV2 + toàn nhóm','Dự thảo trước sprint, cập nhật 20/10/2026.']
],[20,43,48,48,24,48]);
const roles=['BA và Tester Customer','BA và Tester vận hành','Frontend Customer','Frontend vận hành','Backend Identity và Parking','Backend Booking và Session','Backend Search Pricing Payment','Full stack Leader'];
const actions=['Đặc tả/test Customer; bộ câu hỏi assistant có nguồn.','Ma trận quyền/test payment; regression và ảnh OCR có nhãn.','Nối UI duc với API thật; test loading/error/hold.','Portal chọn bãi; cấu trúc và check-in khi API sẵn.','Auth/scope/xe/seed 3 bãi và test ownership.','Availability/ExactSlot/hold; test concurrency PostgreSQL.','Estimate/nearest/cheapest; sandbox idempotency khi sẵn.','Schema/contracts/CI/migration chung; review và bản tích hợp.'];
sheet('TV1 TV8',['Tên','Vai trò','Ưu điểm','Hạn chế','Cần chỉnh sửa','Ghi chú'],roles.map((r,i)=>[`TV${i+1}`,r,'Chưa đánh giá. TV bổ sung bằng chứng sau sprint.','Chưa đánh giá; không suy diễn từ phân công.',actions[i],'Hành động là kế hoạch; nhận xét cá nhân chờ retro. Chưa có mapping tên thật.']),[12,32,42,42,54,43]);
const a=sheet('Hanh dong',['ID và hành động','Owner','Hạn đề xuất','Tiêu chí xác nhận','Trạng thái','Dependency và nguồn'],[
 ['A01 Chốt schema và nhánh tích hợp','TV8 + TV5–TV7','08/10/2026','Có mapping/decision log, không chạy nhầm schema.','Đề xuất','Foundation; leader xác nhận tại planning.'],
 ['A02 Khóa contract và policy','BE owner + TV1/TV2 + FE','08/10/2026','DTO/envelope, quyền, lỗi, policy và diagrams được review.','Đề xuất','Trước implementation phụ thuộc; policy null không thành 0.'],
 ['A03 Migration test và seed','TV8 + TV5–TV7','09/10/2026','Database test mới, 3 bãi và health ready PASS.','Đề xuất','Phụ thuộc A01; mỗi module có owner migration.'],
 ['A04 Nối auth và cấu trúc','TV5 + TV3/TV4','12/10/2026','API thật, FE tích hợp; owner/scope tests có bằng chứng.','Đề xuất','Phụ thuộc A02/A03; TV1/TV2 test.'],
 ['A05 Gate nền tảng','TV8; TV1/TV2 nghiệm thu','13/10/2026','Auth, quote, ExactSlot/hold và concurrency/scope PASS.','Đề xuất','Nếu chưa đạt, ưu tiên core thay payment/map/AI runtime.'],
 ['A06 Tích hợp search và booking','TV3 + TV6/TV7','14/10/2026','Giá/availability thật, lỗi 409 và hold hiển thị đúng.','Đề xuất','Contract và API thật; mock không tính Done.'],
 ['A07 Payment QR Staff có điều kiện','TV6/TV7 + TV3/TV4','16/10/2026','Xác minh backend đủ tiền, callback/QR replay tests, check-in đúng bãi.','Có điều kiện','Chỉ nhận khi A05 đạt; simulator phải ghi Development.'],
 ['A08 Chuẩn bị ba AI','TV1/TV2 + TV6/TV7/TV8','16/10/2026','FAQ có nguồn, ảnh có nhãn, snapshot/mapping contract.','Đề xuất','Chuẩn bị, chưa cam kết 3 runtime; không bịa ACTUAL data.'],
 ['A09 Regression và demo','TV1/TV2 + toàn nhóm','20/10/2026','Report PASS/FAIL, MR/CI/demo, carry-over và lý do thật.','Đề xuất','D9–D10; đánh giá cá nhân chỉ sau thu thập evidence.']
],[37,28,17,55,20,52]);
a.getRange('E2:E10').dataValidation={rule:{type:'list',values:['Đề xuất','Planned','In progress','Blocked','Done','Có điều kiện']}};
w.recalculate();
await (await SpreadsheetFile.exportXlsx(w)).save(path.join(out,'Team_Retrospective_Parking.xlsx'));
for (const name of ['Retro hien tai','TV1 TV8','Hanh dong']) {
 const blob=await w.render({sheetName:name,range:name==='TV1 TV8'?'A1:F9':name==='Hanh dong'?'A1:F10':'A1:F8',scale:1,format:'png'});
 await fs.writeFile(path.join(out,'qa',name.replaceAll(' ','_')+'.png'),new Uint8Array(await blob.arrayBuffer()));
}
console.log('Workbook exported and all three sheets rendered.');
