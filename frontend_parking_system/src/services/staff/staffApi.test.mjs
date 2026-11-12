import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';

function adapter(api) {
  const source = fs.readFileSync(new URL('./staffApi.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: () => ({ api }), crypto: webcrypto, console,
    localStorage: { getItem: () => null, setItem: () => { throw new Error('Unexpected local write'); } } });
  return exports.staffApi;
}

test('cash confirmation propagates failure without fabricated success', async () => {
  const failure = new Error('403 forbidden');
  const service = adapter({ confirmCashPayment: async () => { throw failure; } });
  await assert.rejects(service.confirmCashPayment('booking'), error => error === failure);
});

test('staff catalog never falls back to all lots when assignments are empty or unavailable', async () => {
  const empty = adapter({ getParkingLots: async () => [{ id: 'private-lot' }], getStaffAssignmentsMe: async () => [] });
  assert.equal((await empty.getParkingLots()).length, 0);
  const failure = new Error('Authorization unavailable');
  const unavailable = adapter({ getParkingLots: async () => [{ id: 'private-lot' }], getStaffAssignmentsMe: async () => { throw failure; } });
  await assert.rejects(unavailable.getParkingLots(), error => error === failure);
});

test('incident API failure never reads or writes local fallback', async () => {
  const failure = new Error('503 unavailable');
  const reject = async () => { throw failure; };
  const service = adapter({ getIncidents: reject, createIncident: reject, updateIncidentStatus: reject });
  await assert.rejects(service.getIncidents('lot'), error => error === failure);
  await assert.rejects(service.createIncident({ title: 'Gate', detectedAt: new Date().toISOString() }, 'lot'), error => error === failure);
  await assert.rejects(service.updateIncidentStatus('incident', 'Resolved', 'fixed', 'lot', 4), error => error === failure);
});

test('incident update sends displayed version and selected lot and returns server state', async () => {
  let request;
  const service = adapter({ updateIncidentStatus: async (...args) => {
    request = args;
    return { incidentId: 'incident', status: 'Resolved', version: 5, updatedAt: 'server-time', reportedByUserId: 'real-user' };
  } });
  const result = await service.updateIncidentStatus('incident', 'Resolved', 'fixed', 'assigned-lot', 4);
  assert.equal(request[0], 'assigned-lot');
  assert.equal(request[2].expectedVersion, 4);
  assert.equal(result.version, 5);
  assert.equal(result.updatedAt, 'server-time');
  assert.equal(result.reportedBy, 'real-user');
});
