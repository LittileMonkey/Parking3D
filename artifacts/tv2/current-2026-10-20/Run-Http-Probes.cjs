const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const root=path.resolve(__dirname,'../../..'), pg='D:/postGREDB/bin';
const cluster=path.join(__dirname,'pg-http-'+Date.now()), port=55483;
const children=[];
function command(exe,args){return new Promise((resolve,reject)=>{const p=spawn(exe,args,{windowsHide:true});let output='';p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b);p.on('error',reject);p.on('exit',code=>code===0?resolve(output):reject(new Error(path.basename(exe)+' exit '+code+' '+output)));});}
function host(dll,env,name){const log=fs.openSync(path.join(__dirname,name+'.log'),'w');const p=spawn('dotnet',[path.join(root,dll)],{cwd:root,windowsHide:true,env:{...process.env,DOTNET_ROLL_FORWARD:'Major',ASPNETCORE_ENVIRONMENT:'Development',...env},stdio:['ignore',log,log]});children.push(p);return p;}
async function wait(url){for(let i=0;i<60;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(500)});if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw Error('Host did not become live');}
let started=false;
(async()=>{try{
await command(path.join(pg,'initdb.exe'),['-D',cluster,'-A','trust','-U','postgres','--encoding=UTF8','--no-locale']);
await command(path.join(pg,'pg_ctl.exe'),['start','-D',cluster,'-l',path.join(cluster,'server.log'),'-o',`-p ${port} -h 127.0.0.1`,'-w']);started=true;
await command(path.join(pg,'createdb.exe'),['-h','127.0.0.1','-p',String(port),'-U','postgres','tv2_payment']);
await command(path.join(pg,'psql.exe'),['-X','-h','127.0.0.1','-p',String(port),'-U','postgres','-d','tv2_payment','-v','ON_ERROR_STOP=1','-f',path.join(root,'database/services/payment/001_schema.sql')]);
host('src/Services/Payment/Parking.Payment.Api/bin/Debug/net9.0/Parking.Payment.Api.dll',{
Ports__Http:'55581',Ports__Grpc:'55582',Jwt__Key:'t'.repeat(64),Grpc__ServiceKey:'g'.repeat(64),ConnectionStrings__Service:`Host=127.0.0.1;Port=${port};Username=postgres;Database=tv2_payment`,Services__IdentityGrpc:'http://127.0.0.1:55991',Services__ParkingGrpc:'http://127.0.0.1:55992'},'payment-probe-host');
host('src/Gateway/Parking.Gateway/bin/Debug/net9.0/Parking.Gateway.dll',{ASPNETCORE_URLS:'http://127.0.0.1:55580'},'gateway-probe-host');
await wait('http://127.0.0.1:55581/health/live');await wait('http://127.0.0.1:55580/health/live');
const uuid='12345678-1234-4234-8234-123456789099';
const probes=[
['HTTP-01','GET','http://127.0.0.1:55581/api/v1/payments/'+uuid+'/status',null,401],
['HTTP-02','POST','http://127.0.0.1:55581/api/v1/payments/cash/confirm',{bookingId:uuid,staffReason:'Synthetic TV2 test',version:1},401],
['HTTP-03','POST','http://127.0.0.1:55581/api/v1/payments/cash/confirm',{bookingId:uuid,staffReason:'',version:0},401],
['HTTP-04','POST','http://127.0.0.1:55581/api/v1/payments',{bookingId:uuid,method:'CASH'},401],
['HTTP-05','POST','http://127.0.0.1:55580/api/v1/check-in',{},null]
];
const results=[];
for(const[id,method,url,body,expected]of probes){const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(5000)});const text=await r.text();results.push({id,method,path:new URL(url).pathname,host:new URL(url).port,authentication:'none',expectedStatus:expected,actualStatus:r.status,result:expected===null?'OBSERVED':r.status===expected?'PASS':'FAIL',response:JSON.parse(text)});}
const evidence={commit:'11e5652',utc:new Date().toISOString(),scope:'Anonymous HTTP probes against isolated Payment and Gateway; no seeded payment or real user; no successful payment mutation; no live Identity/provider',engine:'PostgreSQL 18.4',results};
fs.writeFileSync(path.join(__dirname,'HTTP-EVIDENCE.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(results.map(({id,actualStatus,result})=>({id,actualStatus,result})),null,2));
}finally{
for(const p of children){if(p.exitCode===null){p.kill();await Promise.race([new Promise(r=>p.once('exit',r)),new Promise(r=>setTimeout(r,5000))]);}}
if(started)await command(path.join(pg,'pg_ctl.exe'),['stop','-D',cluster,'-m','fast','-w']);
}})().catch(e=>{console.error(e.message);process.exitCode=1;});
