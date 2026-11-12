import test from 'node:test';
import assert from 'node:assert/strict';
import { createParkingArea } from '../src/components/parking/parking.js';
import { readFileSync } from 'node:fs';

test('layout data drives slot identity, position and state without a browser', () => {
  const layout = { width: 30, depth: 28, slots: [
    { slotId: 'TEST-01', floor: 2, type: 'Car', status: 'RESERVED', width: 2.7, length: 5.4, positionX: 3, positionZ: -7 },
  ] };
  const { slotMeshes } = createParkingArea(layout);
  assert.equal(slotMeshes.length, 1);
  assert.equal(slotMeshes[0].userData.slotId, 'TEST-01');
  assert.equal(slotMeshes[0].userData.status, 'RESERVED');
  assert.equal(slotMeshes[0].position.x, 3);
});

test('preview vehicles appear only in occupied bays and every slot is identifiable', () => {
  const layout = JSON.parse(readFileSync(new URL('../src/components/parking/preview-layout.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
  const { scene, slotMeshes } = createParkingArea(layout);
  const vehicles = [];
  scene.traverse(object => { if (object.name.startsWith('Vehicle ')) vehicles.push(object.name.slice(8)); });
  assert.deepEqual(vehicles.sort(), layout.slots.filter(slot => slot.status === 'OCCUPIED').map(slot => slot.slotId).sort());
  assert.equal(new Set(slotMeshes.map(mesh => mesh.userData.slotId)).size, layout.slots.length);
  assert.deepEqual(new Set(slotMeshes.map(mesh => mesh.userData.status)), new Set(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE']));
});

test('expanded preview has over 50 non-overlapping bays within the site', () => {
  const layout = JSON.parse(readFileSync(new URL('../src/components/parking/preview-layout.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
  assert.ok(layout.slots.length > 50);
  for (const slot of layout.slots) {
    assert.ok(Math.abs(slot.positionX) + slot.width / 2 < layout.width / 2);
    assert.ok(Math.abs(slot.positionZ) + slot.length / 2 < layout.depth / 2);
    for (const other of layout.slots) {
      if (other === slot) continue;
      assert.ok(Math.abs(slot.positionX - other.positionX) >= (slot.width + other.width) / 2 - 0.001 || Math.abs(slot.positionZ - other.positionZ) >= (slot.length + other.length) / 2 - 0.001);
    }
  }
});
