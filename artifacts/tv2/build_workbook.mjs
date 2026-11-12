import fs from 'node:fs/promises';
import path from 'node:path';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const out=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const d=JSON.parse(await fs.readFile(path.join(out,'tv2-data.json'),'utf8'));
await fs.mkdir(path.join(out,'qa'),{recursive:true});
const w=Workbook.create();
function base(name,headers,rows,widths,start=5){
 const s=w.worksheets.add(name);s.showGridLines=false;
 s.getRange('A1').values=[[name==='Test Cases'?'TV2 Kiểm thử vận hành và tài chính':name]];
 s.getRange('A1').format.font={name:'Calibri',size:16,bold:true,color:'#17365D'};
 s.getRange('A2').values=[['Dự thảo 06/10/2026 — test chưa chạy; fixture/policy cần duyệt, không phải nghiệm thu.']];
 s.getRange('A2').format.font={name:'Calibri',size:10,color:'#666666'};
 const last=String.fromCharCode(64+headers.length),end=start+rows.length;
 s.getRange(`A${start}:${last}${start}`).values=[headers];
 if(rows.length)s.getRange(`A${start+1}:${last}${end}`).values=rows;
 const all=s.getRange(`A${start}:${last}${end}`);all.format.font={name:'Calibri',size:11};all.format.wrapText=true;all.format.verticalAlignment='center';all.format.borders={preset:'all',style:'thin',color:'#D9E2F3'};
 const h=s.getRange(`A${start}:${last}${start}`);h.format.fill='#17365D';h.format.font.color='#FFFFFF';h.format.font.bold=true;h.format.rowHeight=36;
 if(rows.length)s.getRange(`A${start+1}:${last}${end}`).format.rowHeight=name==='Test Cases'?110:90;
 widths.forEach((v,i)=>s.getRange(`${String.fromCharCode(65+i)}:${String.fromCharCode(65+i)}`).format.columnWidth=v);
 s.freezePanes.freezeRows(start);return s;
}
const headers=['ID','Yêu cầu','Ca kiểm thử','Priority','Điều kiện trước','Bước thực hiện','Expected','Policy cần','Nguồn','Status','Actual','Evidence / run / build','Bug link','Owner'];
const t=base('Test Cases',headers,d.cases.map(c=>[c.id,c.requirement,c.title,c.priority,c.precondition,c.steps,c.expected,c.policy,c.source,c.status,c.actual,c.evidence,c.bug,c.owner]),[15,15,35,12,43,48,66,19,21,18,48,40,26,22],6);
t.getRange('A3').values=[['Tổng cases']];t.getRange('B3').formulas=[['=ROWS(A7:A70)']];
t.getRange('C3').values=[['Pass']];t.getRange('D3').formulas=[['=COUNTIF(J7:J70,"Pass")']];
t.getRange('E3').values=[['Fail']];t.getRange('F3').formulas=[['=COUNTIF(J7:J70,"Fail")']];
t.getRange('G3').values=[['Blocked']];t.getRange('H3').formulas=[['=COUNTIF(J7:J70,"Blocked")']];
t.getRange('I3').values=[['Not run']];t.getRange('J3').formulas=[['=COUNTIF(J7:J70,"Not run")']];
t.getRange('K3').values=[['Đã chạy / tổng']];t.getRange('L3').formulas=[['=(D3+F3)/B3']];t.getRange('L3').setNumberFormat('0%');
t.getRange('J7:J70').dataValidation={rule:{type:'list',values:['Not run','Pass','Fail','Blocked','Not applicable']}};
base('Quyen', ['ID','Chức năng','Guest','Customer','Staff','Manager','Admin','Nguồn policy','Ghi chú'],d.rbac,[12,32,18,43,25,43,38,25,50]);
base('Policy', ['ID','Vấn đề cần chốt','Tình trạng','Rule khi chưa duyệt','Owner review','Hạn đề xuất','Test IDs','Quyết định đã duyệt','Người duyệt / ngày / revision'],d.policies.map(r=>[...r,'','']),[12,38,24,65,31,25,34,60,35]);
const o=base('Oracle', ['ID','Loại','Phút','Raw charge','Cap charge','NetPaid','Fee expected calc','Due calc','Fee expected','Due expected','So oracle'],d.oracle.map((r,i)=>[r[0],i<6?'Estimate':'Final',r[1],null,null,r[3],null,null,r[2],r[4],null]),[12,15,12,18,18,18,24,20,20,20,18],5);
o.getRange('A2:H2').values=[['Block min',15,'Rate VND',7500,'Cap VND',120000,'Quote VND',60000]];
o.getRange('A3').values=[['Fixture đề xuất: cùng một ngày local, multiplier 1; chưa là giá/policy đã duyệt.']];
for(let r=6;r<=15;r++){
 o.getRange(`D${r}`).formulas=[[`=ROUNDUP(C${r}/$B$2,0)*$D$2`]];
 o.getRange(`E${r}`).formulas=[[`=MIN(D${r},$F$2)`]];
 o.getRange(`G${r}`).formulas=[[`=IF(B${r}="Final",MAX($H$2,E${r}),E${r})`]];
 o.getRange(`H${r}`).formulas=[[`=MAX(0,G${r}-F${r})`]];
 o.getRange(`K${r}`).formulas=[[`=IF(AND(G${r}=I${r},H${r}=J${r}),"MATCH","CHECK")`]];
}
o.getRange('D6:J15').setNumberFormat('#,##0');
const fixtures=Object.entries(d.fixture).filter(([k,v])=>typeof v==='string').map(([k,v])=>[k,v,'Đề xuất Development','Chưa seed; thay bằng fixture thực tế','TV5/TV6/TV7/TV8','Không production/không secret']);
fixtures.push(...d.fixture.identities.map(x=>['identity',x,'Đề xuất','BE seed role/scope và time boundary','TV5','Token không lưu trong workbook']));
base('Du lieu',['Key','Giá trị / mô tả','Loại','Điều kiện sử dụng','Owner','Ghi chú'],fixtures,[22,58,23,58,28,46]);
const sg=base('Nguon va Gap',['ID','Nguồn / hiện trạng','Path / rule','Revision / đề xuất','Ý nghĩa / owner','Tình trạng'],[...d.sources.map(r=>[r[0],r[1],r[2],r[3],r[4],'Đã đọc source, chưa runtime test']),...d.gaps.map(r=>[r[0],r[1],r[2],r[3],r[4],r[5]])],[12,55,62,62,47,28]);
const b=base('Bug Log',['Bug ID','Summary','Severity','Priority','Test ID','Build / environment','Steps / Expected / Actual','Evidence sanitized','BE owner','Status','Fix commit','Retest run','Ngày phát hiện','Ngày đóng'],[['','','','','','','','','','','','','','']],[17,45,17,17,17,40,75,50,24,18,23,24,20,20]);
b.getRange('A2').values=[['Chưa có bug được xác nhận. Điền sau thực thi; không dùng sample bug như defect thật.']];
b.getRange('J6:J105').dataValidation={rule:{type:'list',values:['Open','Assigned','Fixed','Retest','Closed','Reopened']}};
w.recalculate();
if(Number(t.getRange('B3').values[0][0])!==64)throw new Error('case count');
if(Number(t.getRange('J3').values[0][0])!==64)throw new Error('Not run count');
if(o.getRange('K6:K15').values.flat().some(x=>x!=='MATCH'))throw new Error('oracle mismatch');
// Verify editable controls affect the owning calculation; restore before export.
o.getRange('D2').values=[[10000]];t.getRange('J7').values=[['Pass']];w.recalculate();
if(Number(o.getRange('G9').values[0][0])!==80000)throw new Error('rate propagation');
if(Number(t.getRange('D3').values[0][0])!==1||Number(t.getRange('J3').values[0][0])!==63)throw new Error('status propagation');
o.getRange('D2').values=[[7500]];t.getRange('J7').values=[['Not run']];w.recalculate();
await (await SpreadsheetFile.exportXlsx(w)).save(path.join(out,'TV2_WORKBOOK.xlsx'));
const previews=[['Test Cases','A1:G14','cases-a'],['Test Cases','H6:N14','cases-execution'],['Quyen','A5:I13','rbac-a'],['Quyen','A14:I21','rbac-b'],['Policy','A5:I14','policy-a'],['Policy','A15:I23','policy-b'],['Oracle','A1:K15','oracle'],['Du lieu','A5:F15','fixtures'],['Nguon va Gap','A5:F19','sources-gaps'],['Bug Log','A1:N6','bugs']];
for(const [name,range,id] of previews){const blob=await w.render({sheetName:name,range,scale:1,format:'png'});await fs.writeFile(path.join(out,'qa',id+'.png'),new Uint8Array(await blob.arrayBuffer()));}
console.log('Workbook:64 Not run, all 10 oracle math MATCH; control/status edits verified and restored; 7 sheets rendered.');
