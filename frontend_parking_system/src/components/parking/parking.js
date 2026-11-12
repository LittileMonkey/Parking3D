import * as THREE from "three";

const slotColors = {
  AVAILABLE: 0x14b8a6,
  HELD: 0xfbbf24,
  RESERVED: 0xfbbf24,
  OCCUPIED: 0xf87171,
  MAINTENANCE: 0x94a3b8
};

const levelSpacing = 8;
const slotWidth = 4.1;
const slotDepth = 6.1;
const slotGap = 0.4;
const zoneGap = 3;
const mapObjectTypes = {
  1: "ROAD",
  2: "WALL",
  3: "ENTRANCE",
  4: "EXIT",
  5: "RAMP",
  6: "ELEVATOR",
  7: "STAIR",
  8: "CHARGER",
  9: "LABEL",
  10: "OTHER"
};
const mapObjectStyles = {
  ROAD: { color: 0x334155, size: [6, 0.08, 3] },
  WALL: { color: 0x64748b, size: [4, 3, 0.25] },
  ENTRANCE: { color: 0x22c55e, size: [2, 1, 2] },
  EXIT: { color: 0xef4444, size: [2, 1, 2] },
  RAMP: { color: 0xf59e0b, size: [6, 0.2, 8] },
  ELEVATOR: { color: 0x38bdf8, size: [2.5, 2.5, 2.5] },
  STAIR: { color: 0xa78bfa, size: [2, 1, 4] },
  CHARGER: { color: 0x22d3ee, size: [0.6, 1.4, 0.6] },
  LABEL: { color: 0xffffff, size: [1, 0.08, 0.4] },
  OTHER: { color: 0x94a3b8, size: [1, 1, 1] }
};

function mapValue(object, camelName, pascalName) {
  return object?.[camelName] ?? object?.[pascalName];
}

function getMapObjectKey(object) {
  const type = mapValue(object, "objectType", "ObjectType");
  if (type !== undefined && type !== null
    && type !== 0 && type !== "0"
    && !["PARKING_SLOT", "PARKINGSLOT"].includes(String(type).toUpperCase())) return null;
  return mapValue(object, "refEntityId", "RefEntityId")
    ?? mapValue(object, "slotId", "SlotId");
}

function getMapObjectType(object) {
  const type = mapValue(object, "objectType", "ObjectType");
  if (typeof type === "number" || /^\d+$/.test(String(type))) {
    return mapObjectTypes[Number(type)] ?? "OTHER";
  }
  const normalized = String(type ?? "OTHER").replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (normalized === "PARKINGSLOT") return null;
  return mapObjectStyles[normalized] ? normalized : "OTHER";
}

function getTransform(mapObject, fallbackPosition, slot) {
  if (!mapObject) {
    if (slot?.position && typeof slot.position.x === "number" && typeof slot.position.z === "number") {
      const y = typeof slot.position.y === "number" ? slot.position.y : fallbackPosition.y;
      const rotY = typeof slot.rotationY === "number" ? slot.rotationY : 0;
      const sx = typeof slot.size?.x === "number" ? slot.size.x / slotWidth : typeof slot.widthM === "number" ? slot.widthM / slotWidth : 1;
      const sz = typeof slot.size?.z === "number" ? slot.size.z / slotDepth : typeof slot.lengthM === "number" ? slot.lengthM / slotDepth : 1;
      const sy = typeof slot.size?.y === "number" ? slot.size.y / 0.12 : 1;
      return {
        position: new THREE.Vector3(slot.position.x, y, slot.position.z),
        rotation: new THREE.Euler(0, rotY, 0),
        scale: new THREE.Vector3(sx, sy, sz)
      };
    }
    return {
      position: fallbackPosition,
      rotation: new THREE.Euler(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1)
    };
  }

  const positionX = mapValue(mapObject, "positionX", "PositionX");
  const positionY = mapValue(mapObject, "positionY", "PositionY");
  const positionZ = mapValue(mapObject, "positionZ", "PositionZ");
  const rotationX = mapValue(mapObject, "rotationX", "RotationX");
  const rotationY = mapValue(mapObject, "rotationY", "RotationY");
  const rotationZ = mapValue(mapObject, "rotationZ", "RotationZ");
  const scaleX = mapValue(mapObject, "scaleX", "ScaleX");
  const scaleY = mapValue(mapObject, "scaleY", "ScaleY");
  const scaleZ = mapValue(mapObject, "scaleZ", "ScaleZ");
  const values = [positionX, positionY, positionZ, rotationX, rotationY, rotationZ, scaleX, scaleY, scaleZ]
    .filter(value => value !== undefined && value !== null);
  if (values.some(value => typeof value !== "number" || !Number.isFinite(value))) {
    throw new TypeError("Parking map object transforms must contain finite numeric values.");
  }

  return {
    position: new THREE.Vector3(
      positionX ?? fallbackPosition.x,
      positionY ?? fallbackPosition.y,
      positionZ ?? fallbackPosition.z
    ),
    rotation: new THREE.Euler(
      rotationX ?? 0,
      rotationY ?? 0,
      rotationZ ?? 0
    ),
    scale: new THREE.Vector3(scaleX ?? 1, scaleY ?? 1, scaleZ ?? 1)
  };
}

export function createParkingArea(levels, mapObjects = []) {
  if (!Array.isArray(levels) || !Array.isArray(mapObjects)) {
    throw new TypeError("Parking levels and map objects must be arrays.");
  }

  const scene = new THREE.Scene();
  scene.name = "Parking Lot Availability";
  scene.background = new THREE.Color(0xcfe8ff);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 2));
  const sunlight = new THREE.DirectionalLight(0xffffff, 2.5);
  sunlight.position.set(12, 24, 16);
  scene.add(sunlight);

  const mapObjectsByLevelAndSlot = new Map();
  const staticObjectsByLevel = new Map();
  for (const object of mapObjects) {
    const levelId = mapValue(object, "levelId", "LevelId");
    if (!levelId) continue;
    const slotId = getMapObjectKey(object);
    if (slotId) {
      mapObjectsByLevelAndSlot.set(`${levelId}:${slotId}`, object);
      continue;
    }
    const type = getMapObjectType(object);
    if (!type) continue;
    const key = `${levelId}:${type}`;
    if (!staticObjectsByLevel.has(key)) staticObjectsByLevel.set(key, []);
    staticObjectsByLevel.get(key).push(object);
  }

  const levelGroups = [];
  const slotMeshes = [];

  levels.forEach((level, levelIndex) => {
    const zones = new Map();
    for (const slot of level.slots ?? []) {
      const zoneCode = slot.zoneCode || "UNASSIGNED";
      if (!zones.has(zoneCode)) zones.set(zoneCode, []);
      zones.get(zoneCode).push(slot);
    }

    const orderedZones = [...zones.entries()]
      .sort(([zoneA], [zoneB]) => zoneA.localeCompare(zoneB));
    const zoneLayouts = orderedZones.map(([zoneCode, slots]) => {
      const columns = Math.min(8, Math.max(1, Math.ceil(Math.sqrt(slots.length))));
      const rows = Math.ceil(slots.length / columns);
      return {
        zoneCode,
        slots,
        columns,
        width: columns * (slotWidth + slotGap),
        depth: rows * (slotDepth + slotGap)
      };
    });

    const width = zoneLayouts.reduce((total, zone) => total + zone.width, 0)
      + Math.max(0, zoneLayouts.length - 1) * zoneGap;
    const depth = Math.max(1, ...zoneLayouts.map(zone => zone.depth));
    let zoneOffset = -width / 2;
    const slots = [];

    for (const zone of zoneLayouts) {
      const zoneCenter = zoneOffset + zone.width / 2;
      zone.slots.forEach((slot, index) => {
        const column = index % zone.columns;
        const row = Math.floor(index / zone.columns);
        const fallbackPosition = new THREE.Vector3(
          zoneCenter + (column - (zone.columns - 1) / 2) * (slotWidth + slotGap),
          0.12,
          (row - (Math.ceil(zone.slots.length / zone.columns) - 1) / 2) * (slotDepth + slotGap)
        );
        const mapObject = mapObjectsByLevelAndSlot.get(`${level.levelId}:${slot.slotId}`);
        const transform = getTransform(mapObject, fallbackPosition, slot);
        slots.push({ slot, ...transform });
      });
      zoneOffset += zone.width + zoneGap;
    }

    const group = new THREE.Group();
    group.name = `Level ${level.levelCode}`;
    group.position.y = typeof level.elevationM === "number" ? level.elevationM : levelIndex * levelSpacing;
    scene.add(group);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(width, 1) + 4, 0.3, depth + 4),
      new THREE.MeshStandardMaterial({ color: 0x454b52, roughness: 0.85 })
    );
    floor.position.y = -0.15;
    floor.name = `Floor ${level.levelCode}`;
    group.add(floor);

    const slotMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(slotWidth, 0.12, slotDepth),
      new THREE.MeshStandardMaterial({ roughness: 0.8 }),
      slots.length
    );
    slotMesh.name = `Slots ${level.levelCode}`;
    slotMesh.userData.slots = slots.map(item => item.slot);
    slotMesh.userData.levelCode = level.levelCode;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    for (const [instanceId, item] of slots.entries()) {
      quaternion.setFromEuler(item.rotation);
      matrix.compose(item.position, quaternion, item.scale);
      slotMesh.setMatrixAt(instanceId, matrix);
      slotMesh.setColorAt(instanceId, new THREE.Color(
        slotColors[String(item.slot.status).toUpperCase()] ?? 0x64748b
      ));
    }
    slotMesh.instanceMatrix.needsUpdate = true;
    if (slotMesh.instanceColor) slotMesh.instanceColor.needsUpdate = true;
    group.add(slotMesh);

    let outlineOffset = -width / 2;
    for (const zone of zoneLayouts) {
      if (zone.slots.length > 1) {
        const outline = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.PlaneGeometry(zone.width, zone.depth)),
          new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })
        );
        outline.rotation.x = -Math.PI / 2;
        outline.position.set(outlineOffset + zone.width / 2, 0.01, 0);
        group.add(outline);
      }
      outlineOffset += zone.width + zoneGap;
    }

    for (const [key, objects] of staticObjectsByLevel) {
      if (!key.startsWith(`${level.levelId}:`)) continue;
      const type = key.slice(level.levelId.length + 1);
      const style = mapObjectStyles[type];
      const objectMesh = new THREE.InstancedMesh(
        new THREE.BoxGeometry(...style.size),
        new THREE.MeshStandardMaterial({ color: style.color, roughness: 0.8 }),
        objects.length
      );
      objectMesh.name = `${type} ${level.levelCode}`;
      const matrix = new THREE.Matrix4();
      const quaternion = new THREE.Quaternion();
      objects.forEach((object, instanceId) => {
        const transform = getTransform(object, new THREE.Vector3());
        quaternion.setFromEuler(transform.rotation);
        matrix.compose(transform.position, quaternion, transform.scale);
        objectMesh.setMatrixAt(instanceId, matrix);
      });
      objectMesh.instanceMatrix.needsUpdate = true;
      group.add(objectMesh);
    }

    const bounds = new THREE.Box3().setFromObject(group);
    const center = bounds.getCenter(new THREE.Vector3());
    const boundsSize = bounds.getSize(new THREE.Vector3());
    levelGroups.push({
      levelId: level.levelId,
      levelCode: level.levelCode,
      levelName: level.levelName,
      group,
      floor,
      slotMesh,
      center,
      width: Math.max(boundsSize.x, 1),
      depth: Math.max(boundsSize.z, 1)
    });
    slotMeshes.push(slotMesh);
  });

  const dispose = () => {
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => material.dispose());
    });
    scene.clear();
  };

  return { scene, levelGroups, slotMeshes, dispose };
}
