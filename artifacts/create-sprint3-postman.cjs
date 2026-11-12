const fs=require('node:fs');
const root='postman/sprint-3';
const items=[];
function add(name,method,url,body,bearer,key,extra=''){
 const header=[{key:'Content-Type',value:'application/json'}];if(bearer)header.push({key:'Authorization',value:'Bearer {{'+bearer+'}}'});if(key)header.push({key:'Idempotency-Key',value:'{{'+key+'}}'});
 const request={method,header,url:'{{baseUrl}}'+url};if(body!==undefined)request.body={mode:'raw',raw:JSON.stringify(body,null,2),options:{raw:{language:'json'}}};
 items.push({name,request,event:[{listen:'test',script:{type:'text/javascript',exec:["pm.test('HTTP status matches expectedStatus', () => pm.expect(pm.response.code).to.eql(Number(pm.variables.get('expectedStatus') || 200)));","const payload = pm.response.json();","pm.test('Standard API envelope', () => { for (const key of ['result','isSuccess','statusCode','message']) pm.expect(payload).to.have.property(key); });",extra].filter(Boolean)}}]});
}
add('01 Gateway readiness','GET','/health/ready');
add('02 Login Customer','POST','/api/v1/auth/login',{email:'{{ownerEmail}}',password:'{{password}}'},null,null,"if (pm.response.code === 200) pm.environment.set('ownerToken', payload.result.accessToken);");
add('03 Login Staff','POST','/api/v1/auth/login',{email:'{{staffEmail}}',password:'{{password}}'},null,null,"if (pm.response.code === 200) pm.environment.set('staffToken', payload.result.accessToken);");
add('04 List public lots','GET','/api/v1/parking-lots');
add('05 Search actual quote','GET','/api/v1/parking-lots/search?vehicleType=CAR&expectedDuration=60&sortBy=CHEAPEST&startTime={{startsAt}}');
add('06 Availability','GET','/api/v1/parking-lots/{{lotId}}/availability?startTime={{startsAt}}&endTime={{endsAt}}&vehicleType=CAR');
add('07 Create booking','POST','/api/v1/bookings',{lotId:'{{lotId}}',slotId:'{{slotId}}',vehicleId:'{{vehicleId}}',startsAt:'{{startsAt}}',endsAt:'{{endsAt}}'},'ownerToken','bookingKey',"if (pm.response.code === 200) pm.environment.set('bookingId', payload.result.id);");
add('08 Booking detail','GET','/api/v1/bookings/{{bookingId}}',undefined,'ownerToken');
add('09 Create CASH','POST','/api/v1/payments',{bookingId:'{{bookingId}}',method:'CASH'},'ownerToken','paymentKey',"if (pm.response.code === 200) { pm.environment.set('paymentId', payload.result.id); pm.environment.set('paymentVersion', payload.result.version); }");
add('10 Scoped Staff CASH confirmation','POST','/api/v1/parking-lots/{{lotId}}/payments/{{paymentId}}/cash-confirmation',{version:'{{paymentVersion}}',reason:'Synthetic QA cash collection'},'staffToken');
// version must be a JSON number after Postman substitution.
items.at(-1).request.body.raw=items.at(-1).request.body.raw.replace('"{{paymentVersion}}"','{{paymentVersion}}');
add('11 Issue QR after CONFIRMED','POST','/api/v1/bookings/{{bookingId}}/qr',{},'ownerToken',null,"if (pm.response.code === 200) pm.environment.set('qrPayload', payload.result.qrPayload);");
add('12 Staff check-in through Gateway','POST','/api/v1/check-in',{lotId:'{{lotId}}',gateId:'{{gateId}}',qrPayload:'{{qrPayload}}',detectedPlate:'{{detectedPlate}}'},'staffToken','checkinKey');
add('13 Payment status','GET','/api/v1/payments/{{bookingId}}/status',undefined,'ownerToken');
const collection={info:{name:'SCRUM-77 TV2 Sprint 3 — acceptance preparation',schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',description:'Prepared collection, not executed as a suite. Use only isolated synthetic fixtures. Wait for booking CONFIRMED before QR; request 11 can reissue/revoke QR, request12 consumes it. DB assertions and parallel harness are required. No checkout endpoint is invented. Set expectedStatus for a negative case; reset afterward. Never export populated tokens/password/QR.'},item:items};
const values={baseUrl:'http://127.0.0.1:50500',ownerEmail:'customer@qa.example.test',staffEmail:'staff@qa.example.test',password:'',ownerToken:'',staffToken:'',qrPayload:'',lotId:'',slotId:'',vehicleId:'',gateId:'',bookingId:'',paymentId:'',paymentVersion:1,startsAt:'',endsAt:'',bookingKey:'',paymentKey:'',checkinKey:'',detectedPlate:'',expectedStatus:200};
const env={name:'Sprint3-Isolated-Local-EMPTY-SECRETS',values:Object.entries(values).map(([key,value])=>({key,value,type:/password|token|qrPayload|detectedPlate/i.test(key)?'secret':'default',enabled:true})),_postman_variable_scope:'environment'};
fs.mkdirSync(root,{recursive:true});fs.writeFileSync(root+'/Parking-Sprint3.postman_collection.json',JSON.stringify(collection,null,2)+'\n');fs.writeFileSync(root+'/Local.postman_environment.json',JSON.stringify(env,null,2)+'\n');console.log(items.length+' Postman requests generated; secret fields blank');
