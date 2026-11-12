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

test('checkInVehicle maps Car/Motorcycle, supports null bookingId & entryMethod, and forwards override + stable idempotencyKey', async () => {
  let captured = [];
  const service = adapter({
    checkIn: async (payload, key) => {
      captured.push({ payload, key });
      return {
        sessionId: 'sess-1',
        bookingId: null,
        lotId: payload.lotId,
        slotId: 'slot-1',
        slotCode: 'M-01',
        vehicleType: 'MOTORBIKE',
        entryMethod: 'AUTO_SLOT',
        status: 'ACTIVE',
        entryAt: '2026-11-12T10:00:00Z',
      };
    },
  });

  const walkIn = await service.checkInVehicle({
    lotId: 'lot-1',
    gateId: 'gate-1',
    licensePlate: '59p1-12345',
    vehicleType: 'Motorcycle',
    idempotencyKey: 'fixed-key-1',
  });
  assert.equal(captured[0].payload.vehicleType, 'MOTORBIKE');
  assert.equal(captured[0].key, 'fixed-key-1');
  assert.equal(walkIn.bookingId, null);
  assert.equal(walkIn.entryMethod, 'AUTO_SLOT');
  assert.equal(walkIn.vehicleType, 'Motorcycle');

  await service.checkInVehicle({
    lotId: 'lot-1',
    gateId: 'gate-1',
    licensePlate: '51K-99999',
    vehicleType: 'Car',
    qrToken: 'qr-abc',
    allowMismatchOverride: true,
    overrideReason: 'Verified registration document at gate',
    evidence: [{ kind: 'CAMERA_SNAPSHOT', reference: 'gate-evidence://entry/cam1.jpg' }],
    idempotencyKey: 'fixed-key-2',
  });
  assert.equal(captured[1].payload.vehicleType, 'CAR');
  assert.equal(captured[1].payload.allowMismatchOverride, true);
  assert.equal(captured[1].payload.overrideReason, 'Verified registration document at gate');
  assert.equal(captured[1].payload.evidence[0].reference, 'gate-evidence://entry/cam1.jpg');
  assert.equal(captured[1].key, 'fixed-key-2');
});
