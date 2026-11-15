import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function client(respond) {
  const source = fs.readFileSync(new URL('../api.ts', import.meta.url), 'utf8')
    .replace('import.meta.env.VITE_API_BASE_URL', '""');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const registrationSource = fs.readFileSync(new URL('../registration.ts', import.meta.url), 'utf8');
  const registrationExports = {};
  vm.runInNewContext(ts.transpileModule(registrationSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: registrationExports });
  vm.runInNewContext(output, { exports, Headers, FormData, URLSearchParams, crypto, require: name => name === './authStorage' ? { authStorage: { getItem: () => null } } : registrationExports,
    sessionStorage: { getItem: () => null }, fetch: respond });
  return exports;
}

test('Identity middleware MFA challenge preserves PascalCase message and error code', async () => {
  const { api, ApiError } = client(async () => Response.json({ Result: null, IsSuccess: false, StatusCode: 401, Message: 'MFA_REQUIRED: authentication code required', ErrorCode: 'INVALID_CREDENTIALS' }, { status: 401 }));
  await assert.rejects(api.login('test@example.invalid', 'Test-only-password'), e => e instanceof ApiError && e.message.startsWith('MFA_REQUIRED:') && e.errorCode === 'INVALID_CREDENTIALS');
});

test('handover history preserves server action, actor, receiver and pagination count', async () => {
  const record = { id: 'log-1', handoverId: 'handover-1', lotId: 'assigned-lot', action: 'RECEIVER_REASSIGNED',
    performedByUserId: 'manager-1', oldReceiverUserId: 'staff-a', newReceiverUserId: 'staff-b',
    reason: 'Người nhận cũ vắng mặt', performedAt: '2026-11-14T03:00:00Z' };
  let requested;
  const { api } = client(async url => {
    requested = new URL(url, 'http://localhost');
    return Response.json({ result: { items: [record], totalCount: 12 }, isSuccess: true, statusCode: 200 });
  });
  const result = await api.getShiftHandoverHistory('assigned-lot', 'handover-1', 2, 10);
  assert.equal(requested.searchParams.get('page'), '2');
  assert.equal(requested.searchParams.get('pageSize'), '10');
  assert.equal(result.totalCount, 12);
  assert.deepEqual(JSON.parse(JSON.stringify(result.items[0])), record);
});

test('handover history surfaces facility permission failure without an empty successful history', async () => {
  const { api, ApiError } = client(async () => Response.json({ result: null, isSuccess: false, message: 'Không có quyền tại bãi' }, { status: 403 }));
  await assert.rejects(api.getShiftHandoverHistory('other-lot', 'handover-1'), err => err instanceof ApiError && err.status === 403);
});

test('incident pagination keeps totalCount and sends search filters to server', async () => {
  let requested;
  const { api } = client(async url => {
    requested = new URL(url, 'http://localhost');
    return Response.json({ result: { items: [{ incidentId: 'incident-11', status: 'Cancelled', version: 4 }], totalCount: 26 }, isSuccess: true });
  });
  const result = await api.getIncidents('assigned-lot', 'Cancelled', 'High', 'biển số', 2, 10);
  assert.equal(requested.searchParams.get('status'), 'Cancelled');
  assert.equal(requested.searchParams.get('severity'), 'High');
  assert.equal(requested.searchParams.get('query'), 'biển số');
  assert.equal(result.totalCount, 26);
  assert.equal(result.items[0].status, 'Cancelled');
});
