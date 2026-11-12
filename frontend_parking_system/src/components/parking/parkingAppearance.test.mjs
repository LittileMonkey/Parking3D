import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createParkingArea } from "./parking.js";

const levels = [
  {
    levelId: "level-b2",
    levelCode: "B2",
    levelName: "Basement 2",
    slots: [
      { slotId: "slot-a1", slotCode: "A1", zoneCode: "A", status: "AVAILABLE" },
      { slotId: "slot-b1", slotCode: "B1", zoneCode: "B", status: "OCCUPIED" },
    ],
  },
  {
    levelId: "level-b1",
    levelCode: "B1",
    levelName: "Basement 1",
    slots: [
      { slotId: "slot-a2", slotCode: "A2", zoneCode: "A", status: "HELD" },
    ],
  },
];

test("builds a separate instanced floor for every API level and zone", () => {
  const { levelGroups, slotMeshes } = createParkingArea(levels);

  assert.deepEqual(levelGroups.map(level => level.levelCode), ["B2", "B1"]);
  assert.deepEqual(slotMeshes.map(mesh => mesh.count), [2, 1]);
  assert.deepEqual(slotMeshes[0].userData.slots.map(slot => slot.slotId), ["slot-a1", "slot-b1"]);
  assert.ok(levelGroups[1].group.position.y > levelGroups[0].group.position.y);

  const firstZone = new THREE.Vector3();
  const secondZone = new THREE.Vector3();
  const firstMatrix = new THREE.Matrix4();
  const secondMatrix = new THREE.Matrix4();
  slotMeshes[0].getMatrixAt(0, firstMatrix);
  slotMeshes[0].getMatrixAt(1, secondMatrix);
  firstZone.setFromMatrixPosition(firstMatrix);
  secondZone.setFromMatrixPosition(secondMatrix);
  assert.notEqual(firstZone.x, secondZone.x);
});

test("uses backend map-object transforms for matching slots", () => {
  const mapObjects = [{
    levelId: "level-b2",
    objectType: "PARKING_SLOT",
    refEntityId: "slot-a1",
    positionX: 12,
    positionY: 0.4,
    positionZ: -8,
    rotationY: Math.PI / 2,
    scaleX: 1.5,
    scaleY: 1,
    scaleZ: 2,
  }];
  const { slotMeshes } = createParkingArea(levels, mapObjects);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  slotMeshes[0].getMatrixAt(0, matrix);
  matrix.decompose(position, rotation, scale);

  assert.ok(position.distanceTo(new THREE.Vector3(12, 0.4, -8)) < 0.000001);
  assert.ok(rotation.angleTo(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0))) < 0.000001);
  assert.ok(scale.distanceTo(new THREE.Vector3(1.5, 1, 2)) < 0.000001);
  assert.equal(slotMeshes[0].userData.slots[0].slotId, "slot-a1");
});

test("renders non-slot map objects on the matching level", () => {
  const { levelGroups } = createParkingArea(levels, [{
    levelId: "level-b2",
    objectType: "WALL",
    positionX: -5,
    positionY: 1.5,
    positionZ: 2,
  }]);
  const wall = levelGroups[0].group.children.find(object => object.name === "WALL B2");
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  wall.getMatrixAt(0, matrix);
  position.setFromMatrixPosition(matrix);

  assert.ok(wall instanceof THREE.InstancedMesh);
  assert.deepEqual(position.toArray(), [-5, 1.5, 2]);
  assert.equal(levelGroups[1].group.children.some(object => object.name === "WALL B1"), false);
});

test("releases scene resources when a multi-level map is disposed", () => {
  const { scene, dispose } = createParkingArea(levels);
  const disposed = [];
  scene.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      object.geometry.addEventListener("dispose", () => disposed.push(object.geometry));
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        material.addEventListener("dispose", () => disposed.push(material));
      }
    }
  });

  dispose();

  assert.ok(disposed.length > 0);
  assert.equal(new Set(disposed).size, disposed.length);
});

test("uses spatial position and elevation from 3D layout API when mapObjects are absent", () => {
  const spatialLevels = [
    {
      levelId: "lvl-1",
      levelCode: "G",
      levelName: "Ground",
      elevationM: 4.5,
      slots: [
        {
          slotId: "s-1",
          slotCode: "A01",
          zoneCode: "A",
          status: "AVAILABLE",
          position: { x: 10, y: 0.2, z: -6 },
          rotationY: Math.PI / 4,
          widthM: 4.1,
          lengthM: 6.1,
        },
      ],
    },
  ];
  const { levelGroups, slotMeshes } = createParkingArea(spatialLevels);
  assert.equal(levelGroups[0].group.position.y, 4.5);

  const matrix = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const rot = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  slotMeshes[0].getMatrixAt(0, matrix);
  matrix.decompose(pos, rot, scale);
  assert.ok(pos.distanceTo(new THREE.Vector3(10, 0.2, -6)) < 0.000001);
  assert.ok(rot.angleTo(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 4, 0))) < 0.000001);
});