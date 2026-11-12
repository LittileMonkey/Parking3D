// Static design verification only. Does not connect to any database.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8').replace(/^\uFEFF/, '');
const core = read('database-v3/Parking_Database_V3_MVP.dbml');
const extension = read('database-v4/ai-extension.dbml');
const full = read('database-v4/Parking_Database_V4_AI.dbml');
const sql = read('database-v4/001_ai_extension.sql');

function blocks(text, kind) {
  const result = new Map();
  const start = new RegExp(`^${kind} (\\w+) \\{`, 'gm');
  for (const match of text.matchAll(start)) {
    let depth = 1, i = match.index + match[0].length;
    const from = i;
    // Current design uses no braces in quoted notes.
    while (depth && i < text.length) {
      if (text[i] === '{') depth++;
      if (text[i] === '}') depth--;
      i++;
    }
    assert.equal(depth, 0, `Unclosed ${kind} ${match[1]}`);
    assert(!result.has(match[1]), `Duplicate ${kind} ${match[1]}`);
    result.set(match[1], text.slice(from, i - 1));
  }
  return result;
}

const coreTables = blocks(core, 'Table');
const extraTables = blocks(extension, 'Table');
const tables = blocks(full, 'Table');
assert.equal(coreTables.size, 42);
assert.equal(extraTables.size, 5);
assert.equal(tables.size, 47);
for (const [name, body] of coreTables) assert.equal(tables.get(name), body, `Core changed: ${name}`);
for (const [name, body] of extraTables) assert.equal(tables.get(name), body, `Extension drift: ${name}`);

const columns = new Map([...tables].map(([name, body]) => [name,
  new Map([...body.matchAll(/^  (\w+) (\w+(?:\([^\n]*?\))?)(?: \[|\s*$)/gm)]
    .map((m) => [m[1], m[2]]))]));
function endpoint(input) {
  const m = input.trim().match(/^(\w+)\.(?:\(([^)]+)\)|(\w+))$/);
  assert(m, `Invalid Ref: ${input}`);
  const names = (m[2] || m[3]).split(',').map((x) => x.trim());
  assert(columns.has(m[1]), `Missing Ref table ${m[1]}`);
  for (const c of names) assert(columns.get(m[1]).has(c), `Missing Ref column ${m[1]}.${c}`);
  return { table: m[1], names };
}
const refs = [...full.matchAll(/^Ref: (.+?) > (.+?)\s*$/gm)];
assert.equal(refs.length, 90);
for (const [, source, target] of refs) {
  const a = endpoint(source), b = endpoint(target);
  assert.equal(a.names.length, b.names.length, `FK arity mismatch ${source}`);
  a.names.forEach((c, i) => assert.equal(columns.get(a.table).get(c),
    columns.get(b.table).get(b.names[i]), `FK type mismatch ${source} > ${target}`));
}
const groups = blocks(full, 'TableGroup');
assert.equal(groups.size, 6);
const memberships = new Map();
for (const [, body] of groups) {
  for (const name of body.trim().split(/\s+/)) {
    assert(tables.has(name), `Unknown grouped table ${name}`);
    memberships.set(name, (memberships.get(name) || 0) + 1);
  }
}
for (const name of tables.keys()) assert.equal(memberships.get(name), 1, `Group count for ${name}`);

const sqlTables = new Map([...sql.matchAll(/CREATE TABLE public\.(\w+) \(([\s\S]*?)\n\);/g)]
  .map((m) => [m[1], m[2]]));
assert.equal(sqlTables.size, 5);
for (const [name] of extraTables) {
  assert(sqlTables.has(name), `SQL missing table ${name}`);
  const sqlColumns = new Map([...sqlTables.get(name).matchAll(/^    (\w+) (uuid|varchar\(\d+\)|numeric\(\d+,\d+\)|text|int|timestamptz)(?=\s|,)/gm)]
    .map((m) => [m[1], m[2]]));
  assert.deepEqual([...sqlColumns.keys()].sort(), [...columns.get(name).keys()].sort(), `SQL column drift ${name}`);
  for (const [column, type] of columns.get(name)) {
    assert.equal(sqlColumns.get(column), type, `SQL type drift ${name}.${column}`);
  }
}
for (const [, source, target] of extension.matchAll(/^Ref: (.+?) > (.+?)\s*$/gm)) {
  const a = endpoint(source), b = endpoint(target), body = sqlTables.get(a.table);
  if (a.names.length === 1) {
    const c = a.names[0];
    assert(new RegExp(`^    ${c} [^\\n]*REFERENCES public\\.${b.table}\\(${b.names[0]}\\)`, 'm').test(body), `SQL FK missing ${source}`);
  } else {
    assert(body.includes(`FOREIGN KEY (${a.names.join(', ')}) REFERENCES public.${b.table}(${b.names.join(', ')})`), `SQL FK missing ${source}`);
  }
}
assert(sql.includes('UNIQUE NULLS NOT DISTINCT (lot_id, document_key, revision)'));
assert(!/\b(?:DROP|ALTER)\s+TABLE\b/i.test(sql), 'Unexpected core schema mutation');
assert(!/\bCREATE\s+TRIGGER\b/i.test(sql), 'Unexpected AI mutation trigger');
const spec = read('docs/11-AI-EXTENSION.md');
assert.equal((spec.match(/flowchart TD/g) || []).length, 3);
assert.equal((spec.match(/sequenceDiagram/g) || []).length, 3);
for (const endpointName of ['plate-recognitions', 'occupancy-forecast', 'assistant/answers']) {
  assert(spec.includes(endpointName));
}
console.log('PASS: 47 tables, 90 valid typed Refs, 6 groups; V3 core unchanged.');
console.log('PASS: 5 AI DBML/SQL column sets and FKs match; 3 API activity/sequence pairs.');
console.log('Static verification only: DBML parser and PostgreSQL execution are not confirmed.');
