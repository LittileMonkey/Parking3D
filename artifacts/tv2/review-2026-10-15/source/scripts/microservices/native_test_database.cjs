// Test-only adapter around official PostgreSQL binaries. No production connection.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');const {spawn}=require('node:child_process');
function run(bin,args){return new Promise((resolve,reject)=>{const p=spawn(bin,args,{windowsHide:true,env:{...process.env,PGCLIENTENCODING:'UTF8'}});let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.on('error',reject);p.on('exit',c=>c===0?resolve(out):reject(new Error(err)));});}
function literal(v){if(v===null||v===undefined)return 'NULL';if(typeof v==='boolean')return v?'TRUE':'FALSE';if(typeof v==='number'){if(!Number.isFinite(v))throw new Error('Invalid numeric test parameter');return String(v);}return "'"+(typeof v==='object'?JSON.stringify(v):String(v)).replaceAll("'","''")+"'";}
async function startNative(bin){
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'parking-tests-pg17-'));
 await run(path.join(bin,'initdb.exe'),['-D',data,'-A','trust','-U','postgres','--encoding=UTF8','--no-locale']);
 await run(path.join(bin,'pg_ctl.exe'),['start','-D',data,'-l',path.join(data,'postgres.log'),'-o','-p 50471 -h 127.0.0.1','-w']);
 const server={stop:()=>run(path.join(bin,'pg_ctl.exe'),['stop','-D',data,'-m','fast','-w'])};
 async function database(service){
  const name='parking_test_'+service;
  await run(path.join(bin,'createdb.exe'),['-h','127.0.0.1','-p','50471','-U','postgres',name]);
  const psql=(sql)=>run(path.join(bin,'psql.exe'),['-X','-h','127.0.0.1','-p','50471','-U','postgres','-d',name,'-v','ON_ERROR_STOP=1','-A','-t','-c',sql]);
  return {
   connectionString:`Host=127.0.0.1;Port=50471;Username=postgres;Database=${name};SSL Mode=Disable;Maximum Pool Size=10;Timeout=5;Command Timeout=10`,
   exec:sql=>psql(sql),close:async()=>{},
   query:async(sql,params=[])=>{
    const rendered=sql.replace(/\$(\d+)/g,(_,n)=>literal(params[Number(n)-1]));
    if(!/^\s*SELECT\b/i.test(rendered)){await psql(rendered);return {rows:[]};}
    const output=await psql('SELECT coalesce(json_agg(t),\'[]\'::json) FROM ('+rendered.replace(/;\s*$/,'')+') t');
    return {rows:JSON.parse(output.trim())};
   }
  };
 }
 return {server,database,engine:'native PostgreSQL 17.6'};
}
module.exports={startNative};
