// Local demo only: creates a synthetic incident and resolves it. Never prints credentials.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const env = Object.fromEntries(fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)
  .filter(line => line && !line.startsWith('#') && line.includes('='))
  .map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).replace(/^['"]|['"]$/g, '')]; }));
async function call(route, token, method = 'GET', body, key) {
  const response = await fetch('http://127.0.0.1:8080' + route, {
    method, headers: { 'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json();
  return { status: response.status, data: json.result };
}
async function main() {
  const login = await call('/api/v1/auth/login', null, 'POST', { email: env.DEMO_STAFF_EMAIL, password: env.DEMO_STAFF_PASSWORD });
  assert.equal(login.status, 200, 'Staff demo login');
  const token = login.data.accessToken || login.data.token;
  const assignments = await call('/api/v1/staff-assignments/me', token);
  const lot = assignments.data[0].lotId;
  const route = `/api/v1/parking-lots/${lot}/incidents`;
  const payload = { title: 'QA regression: persistence', type: 'GATE_FAILURE', severity: 'Low',
    description: 'Synthetic test incident; no real gate failure.', detectedAt: new Date().toISOString() };
  const key = crypto.randomUUID();
  const created = await call(route, token, 'POST', payload, key);
  assert.ok([200, 201].includes(created.status), `Create incident HTTP ${created.status}`);
  const id = created.data.incidentId;
  console.log('Synthetic incident:', id);
  const replay = await call(route, token, 'POST', payload, key);
  assert.equal(replay.data.incidentId, id, 'Replay must not create duplicate');
  const updated = await call(`${route}/${id}/status`, token, 'PATCH', { status: 'InProgress', notes: 'QA', expectedVersion: created.data.version });
  assert.equal(updated.status, 200);
  const stale = await call(`${route}/${id}/status`, token, 'PATCH', { status: 'Resolved', notes: 'Stale', expectedVersion: created.data.version });
  assert.equal(stale.status, 409, 'Stale version must be rejected');
  const resolved = await call(`${route}/${id}/status`, token, 'PATCH', { status: 'Resolved', notes: 'QA completed', expectedVersion: updated.data.version });
  assert.equal(resolved.status, 200);
  const read = await call(`${route}/${id}`, token);
  assert.equal(read.data.status, 'Resolved', 'Status must persist on reread');
  const customer = await call('/api/v1/auth/login', null, 'POST', { email: env.DEMO_CUSTOMER_EMAIL, password: env.DEMO_CUSTOMER_PASSWORD });
  assert.equal(customer.status, 200);
  assert.equal((await call(route, customer.data.accessToken || customer.data.token)).status, 403);
  const otherLot = await call(`/api/v1/parking-lots/${crypto.randomUUID()}/incidents`, token);
  assert.equal(otherLot.status, 403, 'Staff cannot read an unassigned lot');
  console.log('PASS: persisted lifecycle, idempotency, stale version, customer denied, unassigned lot denied.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
