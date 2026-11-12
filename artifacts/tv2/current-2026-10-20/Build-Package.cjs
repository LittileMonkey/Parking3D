const fs=require('fs'),path=require('path');
const out=__dirname, root=path.resolve(out,'../../..');
const cases=JSON.parse(fs.readFileSync(path.join(root,'artifacts/tv2/worktree-tests/docs/tv2/TEST-CASES.json'),'utf8').replace(/^\uFEFF/,''));
const evidence={
RBAC01:'SOURCE_REVIEW: legacy ConfirmCashAsync checks CASH; controller mới thiếu scope. Chưa test Staff success.',
RBAC02:'SOURCE_REVIEW: TV2-20-02; chưa chạy cross-lot HTTP.',
RBAC03:'SOURCE_REVIEW: TV2-20-02; chưa chạy Customer HTTP.',
RBAC04:'Test Identity DB dừng tại LOOKUP trước assertion revoke; revoke chưa chạy.',
RBAC05:'Chưa chạy assignment boundary.',
RBAC06:'Chưa chạy Manager không Staff.',
RBAC07:'Identity LOOKUP FAIL ở repo; chưa test non-owner HTTP.',
RBAC08:'HTTP-01/02/03 FAIL anonymous CASH/status (404/400 thay401); HTTP-04 PASS create-payment401. Booking anonymous chưa chạy.',
CASH01:'Chưa kiểm chứng amount/actor qua HTTP với booking hợp lệ.',
CASH02:'Chưa chạy tạo payment retry qua Payment API.',
CASH03:'Chưa chạy đổi booking với cùng payment key.',
CASH04:'HTTP-03 xác nhận validator trả400 cho blank reason/version0; đây là anonymous request, thiếu auth. >500 và DB assertions chưa chạy.',
CASH05:'SOURCE_REVIEW: controller422 khác legacy409; chưa runtime financial mutation.',
CASH06:'SOURCE_REVIEW: controller SUCCESS409 khác legacy đọc lại; chưa DB retest.',
CASH07:'Domain PaymentDoesNotOverwriteInvalidReservation PASS; chưa full event/database late payment.',
CASH08:'Parking handler test ConfirmAndIssue hỗ trợ inbox; chưa Payment outbox→real Identity→Parking end-to-end.',
HOLD01:'DB PASS PendingBookingCannotIssueQrAndHoldExpiryReleasesOnlyReservation với fixture5; chưa toàn bộ before/at/after default15.',
HOLD02:'DB PASS HoldExpiryNeverReleasesPhysicalOccupancyEvenForAnotherExpiredHold; expiry retry có test riêng.',
LOOKUP01:'Identity repo FAIL LOOKUP Staff; owner/cross-owner/Gateway chưa acceptance.',
QR01:'DB PASS pending không cấp QR; chưa unpaid HTTP check-in.',
QR02:'Unit token bind lot PASS; chưa consume wrong-lot HTTP.',
QR03:'DB PASS ReissueRevokesOldQrAndWrongPlateOrGateDoesNotConsumeNewQr; chưa manual-review/UI.',
QR04:'Unit expiry + DB expiry recheck PASS; chưa HTTP.',
QR05:'DB PASS retry/replay, count session/consume/audit; chưa HTTP.',
QR06:'DB PASS 10 Task.WhenAll scans một effect; chưa barrier timing/load và HTTP authorization.',
QR07:'DB PASS TooEarly/ArrivalDeadline/DatabaseExpiry; chưa đủ mọi boundary at equality.',
AUDIT01:'DB PASS check-in audit/rollback; CASH audit và toàn privacy chưa chạy.',
PRIV01:'Password hashing test PASS; source không còn log hash; chưa capture logger với assertion đầy đủ.',
PRICE01:'Domain block/cap/local day PASS subset; chưa 30/31/all search service/cache oracle.',
SEARCH01:'SOURCE_REVIEW: DB-backed Search đã có; chưa search HTTP/alter fixture acceptance.',
OUTAGE01:'Chưa test outage/recovery Identity trong CASH.',
UI01:'SOURCE_REVIEW FAIL: localStorage check-in, CASH catch trả COMPLETED; chưa browser/network retest.'
};
const rows=cases.map(c=>({...c,status:c.id==='RBAC08'?'PARTIAL_FAIL':c.id==='UI01'?'REVIEW_FINDING':'NOT_RUN',actual:evidence[c.id]||'',evidence:'results/tv2-isolated-pg18.trx; HTTP-EVIDENCE.json; BUG_REGISTER.md',fixCommit:'',retestRun:'',commit:'11e5652',scope:'Acceptance API/UI; supporting unit/repository evidence does not imply acceptance PASS'}));
fs.writeFileSync(path.join(out,'TEST-CASES.json'),JSON.stringify(rows,null,2));
const cols=['id','issue','rule','owner','preconditions','steps','expected','status','actual','evidence','fixCommit','retestRun','commit','scope'];
const quote=s=>'"'+String(s??'').replaceAll('"','""')+'"';
fs.writeFileSync(path.join(out,'TEST-CASES.csv'),'\uFEFF'+[cols,...rows.map(r=>cols.map(k=>r[k]))].map(row=>row.map(quote).join(',')).join('\r\n'));
// Keep shared tokens empty; placeholders are supplied locally by the tester.
const items=[];
function request(name,method,url,token,body,status){items.push({name,request:{method,header:[{key:'Content-Type',value:'application/json'},...(token?[{key:'Authorization',value:'Bearer {{'+token+'}}'}]:[]),...(method==='POST'?[{key:'Idempotency-Key',value:'{{$guid}}'}]:[])],url, ...(body?{body:{mode:'raw',raw:JSON.stringify(body,null,2),options:{raw:{language:'json'}}}}:{})},event:[{listen:'test',script:{type:'text/javascript',exec:[`pm.test('Expected HTTP ${status}',()=>pm.response.to.have.status(${status}));`,"pm.test('Standard envelope',()=>{const b=pm.response.json();['result','isSuccess','statusCode','message'].forEach(k=>pm.expect(b).to.have.property(k));pm.expect(b.statusCode).to.eql(pm.response.code);});"]}}]});}
request('01 Ready — full dependencies required','GET','{{baseUrl}}/health/ready',null,null,200);
request('02 Public lots','GET','{{baseUrl}}/api/v1/parking-lots',null,null,200);
request('03 Guest create CASH denied','POST','{{baseUrl}}/api/v1/payments',null,{bookingId:'{{bookingId}}',method:'CASH'},401);
request('04 Guest status denied — known failing','GET','{{baseUrl}}/api/v1/payments/{{bookingId}}/status',null,null,401);
request('05 Guest new CASH denied — known failing','POST','{{baseUrl}}/api/v1/payments/cash/confirm',null,{bookingId:'{{bookingId}}',staffReason:'TV2 synthetic check',version:1},401);
request('06 Customer confirm legacy denied','POST','{{baseUrl}}/api/v1/parking-lots/{{lotId}}/payments/{{paymentId}}/cash-confirmation','customerToken',{version:1,reason:'TV2 synthetic check'},403);
request('07 Staff B confirm legacy denied','POST','{{baseUrl}}/api/v1/parking-lots/{{lotId}}/payments/{{paymentId}}/cash-confirmation','staffBToken',{version:1,reason:'TV2 synthetic check'},403);
request('08 Revoked Staff confirm legacy denied','POST','{{baseUrl}}/api/v1/parking-lots/{{lotId}}/payments/{{paymentId}}/cash-confirmation','revokedStaffToken',{version:1,reason:'TV2 synthetic check'},403);
request('09 Owner booking','GET','{{baseUrl}}/api/v1/bookings/{{bookingId}}','customerToken',null,200);
request('10 Staff booking — capability blocker','GET','{{baseUrl}}/api/v1/bookings/{{bookingId}}','staffAToken',null,200);
request('11 Issue QR — paid confirmed test booking only','POST','{{baseUrl}}/api/v1/bookings/{{bookingId}}/qr','customerToken',{},200);
request('12 Check-in — route/capability blocker','POST','{{baseUrl}}/api/v1/check-in','staffAToken',{lotId:'{{lotId}}',gateId:'{{gateId}}',qrPayload:'{{qrPayload}}',detectedPlate:'{{syntheticPlate}}'},200);
const collection={info:{name:'TV2 20-10-2026 — acceptance preparation, known blockers',schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',description:'Use only isolated Development. Collection NOT executed as a suite. Existing TRX and HTTP-EVIDENCE are separate evidence. Configure tokens/fixture locally; request11/12 changes test state. DB idempotency/concurrency require harness; Runner is sequential. Do not use group/production DB.'},item:items};
fs.writeFileSync(path.join(out,'TV2-RUNTIME.postman_collection.json'),JSON.stringify(collection,null,2));
const values={baseUrl:'http://localhost:8080',lotId:'',bookingId:'',paymentId:'',gateId:'',qrPayload:'',syntheticPlate:'51A12345',customerToken:'',staffAToken:'',staffBToken:'',revokedStaffToken:''};
fs.writeFileSync(path.join(out,'TV2-LOCAL.postman_environment.json'),JSON.stringify({name:'TV2 isolated — fill locally',values:Object.entries(values).map(([key,value])=>({key,value,enabled:true,type:key.includes('Token')||key==='qrPayload'?'secret':'default'})),_postman_variable_scope:'environment'},null,2));
const trx=fs.readFileSync(path.join(out,'results/tv2-isolated-pg18.trx'),'utf8');
const counters=trx.match(/<Counters\s[^>]+/)[0];
const http=JSON.parse(fs.readFileSync(path.join(out,'HTTP-EVIDENCE.json'),'utf8'));
fs.writeFileSync(path.join(out,'SUMMARY.json'),JSON.stringify({commit:'11e5652',generatedUtc:new Date().toISOString(),automated:{passed:50,failed:1,skipped:1,total:52,trxCounters:counters},http:{passed:1,failed:3,observed:1,total:5,standardEnvelopeFailures:['HTTP-02','HTTP-03']},acceptance:{total:rows.length,pass:0,partialFail:1,sourceReviewFinding:1,notRun:30},limitations:['PostgreSQL18.4 supplemental, PostgreSQL17 not verified','No full HTTP Identity/Payment/Staff UI acceptance','Existing team tests rerun, not all authored by TV2','No Jira/GitHub/GitLab update'],httpEvidenceUtc:http.utc},null,2));
console.log('Prepared '+rows.length+' acceptance cases, '+items.length+' Postman requests and SUMMARY.json');
