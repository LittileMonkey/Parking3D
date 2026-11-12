// node scripts/microservices/validate_databases.cjs <pglite-package-directory>
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const base=path.resolve(process.argv[2]);const {PGlite}=require(path.join(base,'dist/index.cjs'));
const {btree_gist}=require(path.join(base,'dist/contrib/btree_gist.cjs'));
(async()=>{
 const root=path.resolve(__dirname,'../..');const manifest=JSON.parse(fs.readFileSync(path.join(root,'database/services/ownership.json'),'utf8'));
 assert.equal(Object.keys(manifest.owners).length,47);
 const results=[];
 for(const service of ['identity','parking','payment','ai']){
  const db=new PGlite({extensions:{btree_gist}});
  await db.exec(fs.readFileSync(path.join(root,'database/services',service,'001_schema.sql'),'utf8'));
  const rows=(await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")).rows;
  const actual=new Set(rows.map(r=>r.table_name));
  for(const [table,owner]of Object.entries(manifest.owners)) if(owner===service)assert.ok(actual.has(table),service+':'+table);
  for(const [table,owner]of Object.entries(manifest.owners))if(owner!==service&&table!=='audit_logs')assert.ok(!actual.has(table),'Wrong owner '+service+':'+table);
  assert.equal((await db.query('SELECT version FROM service_schema_versions')).rows[0].version,1);
  results.push({service,tables:actual.size,independentSchemaApplied:true});await db.close();
 }
 console.log(JSON.stringify({engine:'PGlite PostgreSQL 18.3; native PG17 pending',results},null,2));
})().catch(e=>{console.error(e.message,e.code||'');process.exitCode=1;});
