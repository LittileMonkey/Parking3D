// Usage: node database/validate_schema.cjs <path-to-installed-pglite-package>
// Test database is in memory; never connects to the team's database.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.argv[2];
if (!base) throw new Error('Provide the installed @electric-sql/pglite package directory');
const {PGlite} = require(path.resolve(base,'dist/index.cjs'));
const {btree_gist} = require(path.resolve(base,'dist/contrib/btree_gist.cjs'));
(async()=>{
  const db = new PGlite({extensions:{btree_gist}});
  await db.exec(fs.readFileSync(path.join(__dirname,'Parking_Database_V4.sql'),'utf8'));
  const version = (await db.query('SELECT version() AS version')).rows[0].version;
  assert.equal((await db.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")).rows[0].n,47);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_constraint WHERE contype='x'")).rows[0].n,5);
  let tests = 2;
  async function fails(sql,code){
    let error;
    try {await db.exec(sql);}catch(e){error=e;}
    assert.ok(error, 'Expected SQL rejection');
    if(code) assert.equal(error.code,code);
    tests++;
  }
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  async function insert(table,values){
    const cols=(await db.query('SELECT column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema=\'public\' AND table_name=$1 ORDER BY ordinal_position',[table])).rows;
    const result={...values};
    for(const c of cols){
      if(c.column_name in result || c.is_nullable==='YES' || c.column_default!==null) continue;
      let v;
      if(c.data_type==='USER-DEFINED') v=(await db.query('SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid=enumtypid WHERE typname=$1 ORDER BY enumsortorder LIMIT 1',[c.udt_name])).rows[0].enumlabel;
      else if(c.data_type==='uuid') throw new Error('Missing FK '+table+'.'+c.column_name);
      else if(c.data_type.includes('timestamp')) v='2026-10-08T02:00:00Z';
      else if(c.data_type==='boolean') v=true;
      else if(c.data_type==='jsonb') v={};
      else if(['numeric','integer','smallint','bigint','double precision'].includes(c.data_type)) v=1;
      else v='TEST';
      result[c.column_name]=v;
    }
    const keys=Object.keys(result);
    await db.query(`INSERT INTO public.${table} (${keys.join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(result));
  }
  await insert('app_users',{id:id(1),status:'ACTIVE'});
  await insert('vehicle_types',{code:'CAR'});
  await insert('vehicles',{id:id(2),vehicle_type:'CAR',plate_country:'VN',plate_normalized:'51A12345'});
  await insert('parking_lots',{id:id(3),timezone:'Asia/Ho_Chi_Minh',code:'TEST-A'});
  await insert('lot_vehicle_policies',{lot_id:id(3),vehicle_type:'CAR',hold_minutes:15,min_booking_minutes:30,max_booking_minutes:1440});
  await insert('parking_levels',{id:id(4),lot_id:id(3)});
  await insert('zones',{id:id(5),lot_id:id(3),level_id:id(4)});
  await insert('parking_slots',{id:id(6),lot_id:id(3),level_id:id(4),zone_id:id(5)});
  await insert('slot_vehicle_types',{slot_id:id(6),lot_id:id(3),vehicle_type:'CAR'});
  await insert('pricing_plans',{id:id(7),lot_id:id(3),vehicle_type:'CAR',created_by:id(1),currency:'VND'});
  await insert('pricing_snapshots',{id:id(8),lot_id:id(3),vehicle_type:'CAR',plan_id:id(7),currency:'VND'});
  const booking={lot_id:id(3),vehicle_id:id(2),vehicle_type:'CAR',customer_id:id(1),pricing_snapshot_id:id(8),status:'CONFIRMED',starts_at:'2026-10-08T02:00:00Z',ends_at:'2026-10-08T04:00:00Z'};
  await insert('bookings',{...booking,id:id(9),code:'BOOK-A'});
  await fails(`INSERT INTO bookings SELECT '${id(10)}'::uuid,'BOOK-B',lot_id,vehicle_id,vehicle_type,customer_id,guest_contact,plate_snapshot,mode,starts_at,ends_at,hold_expires_at,arrival_deadline,status,pricing_snapshot_id,estimated_amount,created_at,cancelled_at,cancellation_reason FROM bookings WHERE id='${id(9)}'`,'23P01');
  await insert('bookings',{...booking,id:id(10),code:'BOOK-B',starts_at:'2026-10-08T04:00:00Z',ends_at:'2026-10-08T06:00:00Z'});
  tests++; // Adjacent ranges accepted.
  await insert('slot_reservations',{id:id(11),booking_id:id(9),lot_id:id(3),slot_id:id(6),vehicle_type:'CAR',starts_at:booking.starts_at,ends_at:booking.ends_at,status:'CONFIRMED'});
  await fails(`INSERT INTO slot_reservations SELECT '${id(12)}'::uuid,booking_id,lot_id,slot_id,vehicle_type,starts_at,ends_at,status,created_at,released_at,release_reason FROM slot_reservations WHERE id='${id(11)}'`);
  await db.exec('BEGIN');
  await insert('parking_sessions',{id:id(13),lot_id:id(3),vehicle_id:id(2),vehicle_type:'CAR',booking_id:id(9),pricing_snapshot_id:id(8),status:'ACTIVE',entry_at:booking.starts_at,expected_exit_at:booking.ends_at});
  await insert('session_slot_assignments',{id:id(14),session_id:id(13),lot_id:id(3),slot_id:id(6),vehicle_type:'CAR',occupied_from:booking.starts_at});
  await db.exec('COMMIT'); tests++;
  await fails(`UPDATE parking_sessions SET status='COMPLETED',exit_at='2026-10-08T03:00:00Z' WHERE id='${id(13)}'`,'23514');
  await db.exec(`BEGIN; UPDATE parking_sessions SET status='COMPLETED',exit_at='2026-10-08T03:00:00Z' WHERE id='${id(13)}'; UPDATE session_slot_assignments SET vacated_at='2026-10-08T03:00:00Z' WHERE id='${id(14)}'; COMMIT;`); tests++;
  await insert('audit_logs',{id:id(15)});
  await fails(`DELETE FROM audit_logs WHERE id='${id(15)}'`,'23514');
  await fails('TRUNCATE audit_logs','23514');
  await fails(`UPDATE pricing_snapshots SET currency='USD' WHERE id='${id(8)}'`,'23514');
  await fails(`INSERT INTO occupancy_snapshots(id,lot_id,vehicle_type,observed_at,usable_capacity,occupied_count,reserved_count,data_source) VALUES ('${id(16)}','${id(3)}','CAR',now(),10,9,2,'SIMULATED')`,'23514');
  await fails(`INSERT INTO assistant_documents(lot_id,document_key,revision,title,status,source_reference,effective_from) VALUES ('${id(3)}','faq',1,'FAQ','PUBLISHED','TEST',now())`,'23514');
  await insert('assistant_documents',{id:id(17),document_key:'faq-global',revision:1,title:'FAQ',status:'DRAFT',language:'vi',visibility:'PUBLIC',source_reference:'TEST',effective_from:'2026-10-08T02:00:00Z'});
  await fails(`INSERT INTO assistant_documents(document_key,revision,title,status,source_reference,effective_from) VALUES ('faq-global',1,'FAQ','DRAFT','TEST',now())`,'23505');
  await db.exec(`BEGIN; SELECT lock_parking_resource('VEHICLE','${id(2)}'); SELECT lock_parking_resource('SLOT','${id(6)}'); COMMIT;`); tests++;
  console.log(JSON.stringify({engine:version,checksPassed:tests,tables:47,exclusionConstraints:5,note:'In-memory PostgreSQL WASM; no production database or multi-connection concurrency testing.'},null,2));
  await db.close();
})().catch(e=>{console.error(e.message,e.code || '');process.exitCode=1;});
