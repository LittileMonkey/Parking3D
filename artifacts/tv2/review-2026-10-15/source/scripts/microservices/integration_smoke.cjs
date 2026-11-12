// Runs 5 real .NET processes and 4 isolated PostgreSQL WASM databases on loopback.
// node .../integration_smoke.cjs <pglite-package> <pglite-socket-package>
// Test doubles are used ONLY for OCR provider; this is not an OCR accuracy evaluation.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http');
const {spawn}=require('node:child_process');const assert=require('node:assert/strict');
const {PGlite}=require(path.resolve(process.argv[2],'dist/index.cjs'));
const {btree_gist}=require(path.resolve(process.argv[2],'dist/contrib/btree_gist.cjs'));
const {PGLiteSocketServer}=require(path.resolve(process.argv[3],'dist/index.cjs'));
const root=path.resolve(__dirname,'../..');const qa=path.join(root,'artifacts/microservices/integration');fs.mkdirSync(qa,{recursive:true});
const processes=[],servers=[],databases={};const results=[];
let native;
const record=results.push.bind(results);results.push=(...items)=>{for(const item of items)console.log('PASS: '+item);return record(...items);};
const secret=crypto.randomBytes(32).toString('hex');const password='Test-'+crypto.randomBytes(12).toString('hex');
const env={...process.env,ASPNETCORE_ENVIRONMENT:'Development',DOTNET_ROLL_FORWARD:'Major',Jwt__Key:secret,Grpc__ServiceKey:secret,Logging__LogLevel__Default:'Warning',
 Services__IdentityGrpc:'http://127.0.0.1:50512',Services__ParkingGrpc:'http://127.0.0.1:50522',Services__AIGrpc:'http://127.0.0.1:50542'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function child(dll,name,extra={}){
 const p=spawn('dotnet',[dll],{cwd:path.dirname(dll),env:{...env,...extra},windowsHide:true});
 const log=fs.createWriteStream(path.join(qa,name+'.log'));p.stdout.pipe(log);p.stderr.pipe(log);processes.push(p);return p;
}
async function call(url,method='GET',body,token,key,status=200){
 const response=await fetch(url,{method,headers:{'content-type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(key?{'Idempotency-Key':key}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const text=await response.text();let json;try{json=JSON.parse(text);}catch{throw new Error('Not an envelope: '+response.status+' '+text.slice(0,200));}
 assert.equal(response.status,status,JSON.stringify(json));assert.equal(json.statusCode,status);assert.equal(json.isSuccess,status<400);
 return json.result;
}
async function wait(url){for(let i=0;i<60;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(1000)});if(r.ok)return;}catch{}await sleep(250);}throw new Error('Host did not start '+url);}
async function fixture(db,table,values){
 const cols=(await db.query("SELECT column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",[table])).rows;
 const row={...values};for(const c of cols){if(c.column_name in row||c.is_nullable==='YES'||c.column_default!==null)continue;
 if(c.data_type==='uuid')throw new Error('Missing fixture FK '+table+'.'+c.column_name);
 row[c.column_name]=c.data_type==='USER-DEFINED'?(await db.query('SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid=enumtypid WHERE typname=$1 ORDER BY enumsortorder LIMIT 1',[c.udt_name])).rows[0].enumlabel
 :c.data_type.includes('timestamp')?new Date().toISOString():c.data_type==='boolean'?true:c.data_type==='jsonb'?{}:['numeric','integer','smallint','bigint','double precision'].includes(c.data_type)?1:'TEST';}
 const keys=Object.keys(row);await db.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(row));
}
async function probe(user,lot,allow){
 await new Promise((resolve,reject)=>{const p=spawn('dotnet',[path.join(root,'tests/Parking.Grpc.Probe/bin/Debug/net9.0/Parking.Grpc.Probe.dll'),'http://127.0.0.1:50512',user,lot,allow?'allow':'deny'],{env,windowsHide:true});let output='';p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b);p.on('exit',code=>code===0?resolve():reject(new Error(output)));});
}
(async()=>{
 let provider;
 try{
  provider=http.createServer((req,res)=>{let body='';req.on('data',b=>body+=b);req.on('end',()=>{JSON.parse(body);res.setHeader('content-type','application/json');res.end(JSON.stringify({plate:'51A12345',confidence:0.95,modelVersion:'TEST_DOUBLE'}));});});
  await new Promise(r=>provider.listen(50590,'127.0.0.1',r));
  if(process.env.PARKING_PG_BIN){native=await require('./native_test_database.cjs').startNative(process.env.PARKING_PG_BIN);servers.push(native.server);}
  for(const [i,service]of ['identity','parking','payment','ai'].entries()){
   const db=native?await native.database(service):new PGlite({extensions:{btree_gist}});databases[service]=db;
   await db.exec(fs.readFileSync(path.join(root,'database/services',service,'001_schema.sql'),'utf8'));
   if(!native){const server=new PGLiteSocketServer({db,host:'127.0.0.1',port:50471+i,maxConnections:1});await server.start();servers.push(server);}
   const name=service==='ai'?'AI':service[0].toUpperCase()+service.slice(1);const httpPort=50511+i*10;
   child(path.join(root,`src/Services/${name}/Parking.${name}.Api/bin/Debug/net9.0/Parking.${name}.Api.dll`),service,{
    ConnectionStrings__Service:db.connectionString??`Host=127.0.0.1;Port=${50471+i};Username=postgres;Database=postgres;SSL Mode=Disable;Maximum Pool Size=1;Timeout=5;Command Timeout=10`,
    Ports__Http:String(httpPort),Ports__Grpc:String(httpPort+1),
    ...(service==='identity'?{Bootstrap__Email:'admin@example.test',Bootstrap__Password:password}:{}),
    ...(service==='ai'?{AI__OcrEndpoint:'http://127.0.0.1:50590'}:{})});
  }
  const gatewayEnv={ASPNETCORE_URLS:'http://127.0.0.1:50500',RateLimit__PermitLimit:'1000'}; // Harness makes many calls from one loopback IP.
  for(const [i,s]of ['identity','parking','payment','ai'].entries()){
   const url=`http://127.0.0.1:${50511+i*10}`;gatewayEnv[`ReverseProxy__Clusters__${s}__Destinations__main__Address`]=url+'/';gatewayEnv[`Services__${s}Http`]=url;
  }
  child(path.join(root,'src/Gateway/Parking.Gateway/bin/Debug/net9.0/Parking.Gateway.dll'),'gateway',gatewayEnv);
  const base='http://127.0.0.1:50500';await wait(base+'/health/live');for(const [i]of ['identity','parking','payment','ai'].entries())await wait(`http://127.0.0.1:${50511+i*10}/health/ready`);
  await call(base+'/health/ready');results.push('5 hosts + 4 databases ready through Gateway');
  const customer=await call(base+'/api/v1/auth/register','POST',{email:'customer@example.test',password,fullName:'Test customer'});
  const staff=await call(base+'/api/v1/auth/register','POST',{email:'staff@example.test',password,fullName:'Test staff'});
  const customerToken=(await call(base+'/api/v1/auth/login','POST',{email:'customer@example.test',password})).accessToken;
  const staffToken=(await call(base+'/api/v1/auth/login','POST',{email:'staff@example.test',password})).accessToken;
  const adminToken=(await call(base+'/api/v1/auth/login','POST',{email:'admin@example.test',password})).accessToken;
  results.push('Registration/login through Identity; hashed passwords and JWT');
  const lot=crypto.randomUUID(),lotB=crypto.randomUUID(),level=crypto.randomUUID(),zone=crypto.randomUUID(),slot=crypto.randomUUID(),vehicle=crypto.randomUUID(),plan=crypto.randomUUID();
  const parking=databases.parking;
  await fixture(parking,'vehicle_types',{code:'CAR'});await fixture(parking,'vehicles',{id:vehicle,vehicle_type:'CAR',plate_country:'VN',plate_normalized:'51A12345'});
  await fixture(parking,'user_vehicle_access',{user_id:customer.userId,vehicle_id:vehicle,verified_at:new Date().toISOString()});
  for(const [id,code]of [[lot,'A'],[lotB,'B']])await fixture(parking,'parking_lots',{id,code,name:'Test Lot '+code,status:'ACTIVE',timezone:'Asia/Ho_Chi_Minh'});
  await fixture(parking,'lot_vehicle_policies',{lot_id:lot,vehicle_type:'CAR',hold_minutes:15,min_booking_minutes:30,max_booking_minutes:1440,early_arrival_minutes:15,late_arrival_minutes:30});
  await fixture(parking,'lot_opening_intervals',{lot_id:lot,start_minute:0,end_minute:10080});
  await fixture(parking,'parking_levels',{id:level,lot_id:lot});await fixture(parking,'zones',{id:zone,lot_id:lot,level_id:level});
  await fixture(parking,'parking_slots',{id:slot,lot_id:lot,level_id:level,zone_id:zone});await fixture(parking,'slot_vehicle_types',{slot_id:slot,lot_id:lot,vehicle_type:'CAR'});
  await fixture(parking,'pricing_plans',{id:plan,lot_id:lot,vehicle_type:'CAR',created_by:customer.userId,currency:'VND',status:'PUBLISHED',effective_from:'2026-01-01T00:00:00Z'});
  await fixture(parking,'pricing_rules',{plan_id:plan,lot_id:lot,rule_type:'FLAT_BLOCK',parameters:{blockMinutes:15,rateVnd:7500,dailyCapVnd:120000,multiplier:1}});
  await call(base+'/api/v1/staff-assignments','POST',{lotId:lot,userId:staff.userId,role:'PARKING_STAFF',activeFrom:new Date(Date.now()-60000).toISOString()},adminToken);
  await probe(staff.userId,lot,true);await probe(staff.userId,lotB,false);results.push('gRPC requires service key; live Staff lot scope A allowed / B denied');
  const imageBase64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZAAAAABJRU5ErkJggg==';
  const ocr={imageBase64,contentType:'image/png'};
  await call(base+`/api/v1/parking-lots/${lot}/plate-recognitions`,'POST',ocr,undefined,'ocr-1',401);
  await call(base+`/api/v1/parking-lots/${lotB}/plate-recognitions`,'POST',ocr,staffToken,'ocr-b',403);
  const recognition=await call(base+`/api/v1/parking-lots/${lot}/plate-recognitions`,'POST',ocr,staffToken,'ocr-1');
  const replay=await call(base+`/api/v1/parking-lots/${lot}/plate-recognitions`,'POST',ocr,staffToken,'ocr-1');assert.equal(recognition.id,replay.id);
  await call(base+`/api/v1/parking-lots/${lot}/plate-recognitions/${recognition.id}/review`,'POST',{plate:'51A12345',version:2,reason:'Test manual review'},staffToken);
  results.push('REST → Parking → Identity/AI gRPC → AI DB; OCR test double; idempotent replay and Staff review');
  const start=new Date(Date.now()+3600000).toISOString(),end=new Date(Date.now()+10800000).toISOString();
  const bookingRequest={lotId:lot,slotId:slot,vehicleId:vehicle,startsAt:start,endsAt:end};
  const booking=await call(base+'/api/v1/bookings','POST',bookingRequest,customerToken,'booking-1');assert.equal(booking.status,'PENDING_PAYMENT');assert.equal(booking.estimatedAmount,60000);
  assert.equal((await call(base+'/api/v1/bookings','POST',bookingRequest,customerToken,'booking-1')).id,booking.id);
  await call(base+'/api/v1/bookings','POST',bookingRequest,customerToken,'booking-other',409);
  results.push('Booking snapshot quote + policy + advisory/GiST; duplicate key replay; overlap rejected');
  const payment=await call(base+'/api/v1/payments','POST',{bookingId:booking.id,method:'CASH'},customerToken,'payment-1');
  await call(base+`/api/v1/parking-lots/${lot}/payments/${payment.id}/cash-confirmation`,'POST',{version:1,reason:'Test cash collected'},customerToken,undefined,403);
  const paid=await call(base+`/api/v1/parking-lots/${lot}/payments/${payment.id}/cash-confirmation`,'POST',{version:1,reason:'Test cash collected'},staffToken);assert.equal(paid.status,'SUCCESS');
  for(let i=0;i<30;i++){
   const state=(await parking.query('SELECT status::text AS state FROM bookings WHERE id=$1',[booking.id])).rows[0].state;
   if(state==='CONFIRMED')break;await sleep(500);if(i===29)throw new Error('Outbox did not confirm booking');
  }
  await call(base+`/api/v1/parking-lots/${lot}/payments/${payment.id}/cash-confirmation`,'POST',{version:1,reason:'Retry'},staffToken);
  assert.equal((await call(base+'/api/v1/payments','POST',{bookingId:booking.id,method:'CASH'},customerToken,'payment-1')).id,payment.id);
  assert.equal((await parking.query('SELECT count(*)::int AS n FROM payment_receipts')).rows[0].n,1);
  assert.equal((await databases.payment.query('SELECT count(*)::int AS n FROM integration_outbox')).rows[0].n,1);
  results.push('Staff Cash confirmation → atomic payment/outbox → gRPC → Parking inbox/receipt/CONFIRMED; retries do not double collect');
  if(native){
   const vehicles=[];
   for(let i=0;i<8;i++){const v=crypto.randomUUID();vehicles.push(v);await fixture(parking,'vehicles',{id:v,vehicle_type:'CAR',plate_country:'VN',plate_normalized:'51B'+String(i).padStart(5,'0')});await fixture(parking,'user_vehicle_access',{user_id:customer.userId,vehicle_id:v,verified_at:new Date().toISOString()});}
   const concurrent=await Promise.all(vehicles.map(async(v,i)=>{
    const response=await fetch(base+'/api/v1/bookings',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+customerToken,'Idempotency-Key':'race-'+i},body:JSON.stringify({lotId:lot,slotId:slot,vehicleId:v,startsAt:new Date(Date.now()+14400000).toISOString(),endsAt:new Date(Date.now()+18000000).toISOString()}),signal:AbortSignal.timeout(20000)});
    const body=await response.json();assert.equal(body.statusCode,response.status);return response.status;
   }));
   assert.equal(concurrent.filter(s=>s===200).length,1);assert.equal(concurrent.filter(s=>s===409).length,7);
   results.push('Native PG17: 8 simultaneous users/vehicles competing for one slot → exactly one booking accepted');
  }
  await call(base+'/api/v1/payments','POST',{bookingId:booking.id,method:'VNPAY'},customerToken,'vnpay',503);
  await databases.identity.exec(`UPDATE lot_staff_assignments SET revoked_at=now() WHERE user_id='${staff.userId}'`);
  await probe(staff.userId,lot,false);results.push('Revoked assignment denied with existing JWT; VNPay unavailable is explicit');
  fs.writeFileSync(path.join(qa,'results.json'),JSON.stringify({engine:native?.engine??'PostgreSQL WASM',passed:results.length,checks:results,limitations:[...(native?[]:['PostgreSQL WASM serialized connections; native PG17 concurrent load pending']),'OCR provider is a test double, not recognition accuracy evidence','No production deployment']},null,2));
  console.log(JSON.stringify({passed:results.length,checks:results},null,2));
 }finally{
  for(const p of processes){
   if(p.exitCode!==null)continue;
   if(process.platform==='win32')await new Promise(resolve=>{const stop=spawn('taskkill.exe',['/PID',String(p.pid),'/T','/F'],{windowsHide:true});stop.on('exit',resolve);stop.on('error',resolve);});
   else p.kill();
  }
  await sleep(500);
  for(const s of servers)await Promise.race([s.stop(),sleep(3000)]);for(const d of Object.values(databases))await Promise.race([d.close(),sleep(3000)]);if(provider)provider.close();
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
