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

export const OUTDOOR_SLOT_COLORS = {
  AVAILABLE: 0x16a34a,
  AVAILABLE_EV: 0x0284c7,
  HELD: 0xf59e0b,
  RESERVED: 0xf59e0b,
  OCCUPIED: 0x888e96,
  MAINTENANCE: 0xeab308,
  DISABLED: 0x64748b,
  SELECTED: 0xef4444
};

export function isEvParkingSlot(slot) {
  if (!slot) return false;
  if (slot.isEvSlot === true) return true;
  if (String(slot.vehicleType || "").toUpperCase() === "EV") return true;
  if (
    Array.isArray(slot.features) &&
    slot.features.some((f) => {
      const code = String(f || "").toUpperCase();
      return code === "EV" || code === "EV_CHARGING";
    })
  ) {
    return true;
  }
  const code = String(slot.slotCode || slot.id || "").toUpperCase();
  return code.includes("-EV") || code.startsWith("EV");
}

export function getSlotColorHex(slot, isSelected = false) {
  if (isSelected) return OUTDOOR_SLOT_COLORS.SELECTED;
  const status = String(slot?.status || "AVAILABLE").toUpperCase();
  if (status === "AVAILABLE") {
    return isEvParkingSlot(slot)
      ? OUTDOOR_SLOT_COLORS.AVAILABLE_EV
      : OUTDOOR_SLOT_COLORS.AVAILABLE;
  }
  return OUTDOOR_SLOT_COLORS[status] ?? OUTDOOR_SLOT_COLORS.AVAILABLE;
}

function drawBillboardCanvas(canvas, lines, options = {}) {
  const {
    bgColor = "rgba(15, 23, 42, 0.92)",
    borderColor = "#38bdf8",
    textColor = "#ffffff",
    subTextColor = "#fde047"
  } = options;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const pad = 16;
  const r = 30;
  const w = canvas.width - pad * 2;
  const h = canvas.height - pad * 2;
  const maxTextWidth = w - 64;

  ctx.fillStyle = bgColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 8;

  ctx.beginPath();
  ctx.roundRect(pad, pad, w, h, r);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (lines.length === 1) {
    ctx.fillStyle = textColor;
    ctx.font = "bold 52px Arial";
    ctx.fillText(lines[0], canvas.width / 2, canvas.height / 2, maxTextWidth);
  } else {
    ctx.fillStyle = textColor;
    ctx.font = "bold 44px Arial";
    ctx.fillText(lines[0], canvas.width / 2, canvas.height / 2 - 44, maxTextWidth);

    ctx.fillStyle = subTextColor;
    ctx.font = "bold 46px Arial";
    ctx.fillText(lines[1], canvas.width / 2, canvas.height / 2 + 42, maxTextWidth);
  }
}

function makeBillboardSprite(lines, options = {}) {
  if (typeof document === "undefined") {
    return new THREE.Sprite();
  }
  const { scaleX = 12, scaleY = 3.8, alwaysOnTop = true } = options;
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 280;
  drawBillboardCanvas(canvas, lines, options);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: !alwaysOnTop,
    depthWrite: false
  });

  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(scaleX, scaleY, 1);
  if (alwaysOnTop) {
    sprite.renderOrder = 999;
  }
  sprite.userData.billboard = { canvas, texture, options };
  return sprite;
}

function updateBillboardSprite(sprite, lines) {
  const bb = sprite?.userData?.billboard;
  if (!bb) return;
  drawBillboardCanvas(bb.canvas, lines, bb.options);
  bb.texture.needsUpdate = true;
}

export function createOutdoorParkingArea(inputSlots = [], initialMotoStats = null) {

  const scene = new THREE.Scene();
  scene.name = "Outdoor Parking 3D";
  scene.background = new THREE.Color(0xcfe8ff);

  const parking = new THREE.Group();
  parking.name = "Parking Structure";
  scene.add(parking);

  const mat = (color) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.75
    });

  const asphalt = mat(0x454b52);
  const white = mat(0xffffff);
  const yellow = mat(0xffcc22);
  const concrete = mat(0xb0b8bf);
  const blue = mat(0x2878b8);
  const red = mat(0xe53935);
  const green = mat(0x25965c);
  const orange = mat(0xf39c32);
  const dark = mat(0x303942);

  const glass = new THREE.MeshStandardMaterial({
    color: 0x8dc8e8,
    transparent: true,
    opacity: 0.6,
    metalness: 0.1,
    roughness: 0.15,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  function box(parent, name, w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      material
    );
    mesh.name = name;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  function createSlotLabel(text) {
    if (typeof document === "undefined") {
      return new THREE.Mesh();
    }
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "bold 40px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, canvas.width / 2, canvas.height / 2, 236);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.9),
      material
    );
    label.rotation.x = -Math.PI / 2;
    return label;
  }

  // ========== GROUND ==========
  box(
    parking,
    "Asphalt Ground",
    40, 0.3, 30,
    0, -0.15, 0,
    asphalt
  );

  // ========== PARKING SLOTS ==========
  const slots = new THREE.Group();
  slots.name = "Parking Slots";
  parking.add(slots);

  const slotMeshes = [];

  // Slot nằm ngang: Chiều rộng theo X = 5.8, Chiều sâu theo Z = 3.4
  const SLOT_WIDTH = 5.8;
  const SLOT_DEPTH = 3.4;

  // Bố trí 20 slot, dành chỗ cho lối xe vào/ra.
  const parkingColumns = [
    {
      code: "A",
      x: -14,
      startNumber: 1,
      positionsZ: [-11, -7, -3, 1, 5, 9]
    },
    {
      code: "A",
      x: -8,
      startNumber: 7,
      positionsZ: [-11, -7, -3, 1]
    },
    {
      code: "B",
      x: 14,
      startNumber: 1,
      positionsZ: [-11, -7, -3, 1, 5, 9]
    },
    {
      code: "B",
      x: 8,
      startNumber: 7,
      positionsZ: [-11, -7, -3, 1]
    }
  ];

  const sourceSlots = Array.isArray(inputSlots) ? inputSlots : [];
  const slotByCode = new Map(
    sourceSlots.map((s) => [String(s.slotCode || "").toUpperCase(), s])
  );
  const usedSlotIds = new Set();
  let sequentialIndex = 0;

  for (const column of parkingColumns) {
    column.positionsZ.forEach((z, index) => {
      const x = column.x;
      const number = column.startNumber + index;
      const defaultId = `${column.code}${String(number).padStart(2, "0")}`;

      let matched = slotByCode.get(defaultId);
      if (matched && usedSlotIds.has(matched.slotId)) {
        matched = undefined;
      }
      if (!matched) {
        while (
          sequentialIndex < sourceSlots.length &&
          usedSlotIds.has(sourceSlots[sequentialIndex].slotId)
        ) {
          sequentialIndex++;
        }
        if (sequentialIndex < sourceSlots.length) {
          matched = sourceSlots[sequentialIndex++];
        }
      }
      if (matched) {
        usedSlotIds.add(matched.slotId);
      }

      const displayCode = matched?.slotCode || defaultId;
      const statusKey = String(matched?.status || "AVAILABLE").toUpperCase();

      const group = new THREE.Group();
      group.name = `Slot ${displayCode}`;
      slots.add(group);

      const slotInfo = {
        slotId: matched?.slotId || defaultId,
        slotCode: displayCode,
        floorCode: matched?.floorCode || "G",
        zoneCode: matched?.zoneCode || column.code,
        supportedVehicleTypes: matched?.supportedVehicleTypes || ["Car"],
        features: matched?.features || [],
        floor: 1,
        type: "Car",
        status: statusKey,
        width: SLOT_WIDTH,
        length: SLOT_DEPTH,
        positionX: x,
        positionZ: z
      };

      group.userData = { ...slotInfo };

      // ===== SLOT SURFACE =====
      const slotMaterial = new THREE.MeshStandardMaterial({
        color: OUTDOOR_SLOT_COLORS[statusKey] ?? OUTDOOR_SLOT_COLORS.AVAILABLE,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        side: THREE.DoubleSide,
        roughness: 0.85
      });

      const slotSurface = new THREE.Mesh(
        new THREE.PlaneGeometry(SLOT_WIDTH - 0.12, SLOT_DEPTH - 0.12),
        slotMaterial
      );

      slotSurface.rotation.x = -Math.PI / 2;
      slotSurface.position.set(x, 0.045, z);
      slotSurface.name = `Surface ${displayCode}`;
      slotSurface.userData = {
        ...slotInfo,
        isParkingSlot: true
      };

      group.add(slotSurface);
      slotMeshes.push(slotSurface);

      // ===== WHITE BOUNDARY LINES =====
      box(
        group,
        "Top Line",
        SLOT_WIDTH, 0.025, 0.08,
        x, 0.07,
        z - SLOT_DEPTH / 2,
        white
      );
      box(
        group,
        "Bottom Line",
        SLOT_WIDTH, 0.025, 0.08,
        x, 0.07,
        z + SLOT_DEPTH / 2,
        white
      );
      box(
        group,
        "Left Line",
        0.08, 0.025, SLOT_DEPTH,
        x - SLOT_WIDTH / 2,
        0.07, z,
        white
      );
      box(
        group,
        "Right Line",
        0.08, 0.025, SLOT_DEPTH,
        x + SLOT_WIDTH / 2,
        0.07, z,
        white
      );

      // ===== SLOT ID =====
      const label = createSlotLabel(displayCode);
      label.position.set(x, 0.09, z);
      group.add(label);
    });
  }

  // ========== ROAD MARKINGS ==========
  const road = new THREE.Group();
  road.name = "Road Markings";
  parking.add(road);

  // Vạch vàng giữa đường
  for (let z = -12; z <= 12; z += 3) {
    box(
      road,
      "Yellow Dashed Line",
      0.12, 0.03, 1.6,
      0, 0.035, z,
      yellow
    );
  }

  // ========== ENTRANCE AND EXIT LANES ==========
  for (const [laneName, x] of [
    ["Entrance", -7],
    ["Exit", 7]
  ]) {
    for (const [sideName, dx] of [
      ["Left", -2.7],
      ["Right", 2.7]
    ]) {
      box(
        road,
        `${laneName} ${sideName} Boundary`,
        0.09, 0.03, 10.5,
        x + dx,
        0.04,
        8.2,
        white
      );
    }
  }

  // ========== STOP LINES ==========
  for (const x of [-7, 7]) {
    box(
      road,
      "Stop Line",
      5, 0.035, 0.25,
      x, 0.05, 12.3,
      white
    );
  }

  // ========== DIRECTION ARROWS ==========
  function roadArrow(name, x, z, angle) {
    const arrow = new THREE.Group();
    arrow.name = name;
    arrow.position.set(x, 0.065, z);
    arrow.rotation.y = angle;
    road.add(arrow);

    box(
      arrow,
      "Arrow Shaft",
      0.22, 0.015, 1.5,
      0, 0, 0.25,
      white
    );

    const shape = new THREE.Shape();
    shape.moveTo(0, 0.85);
    shape.lineTo(-0.65, -0.15);
    shape.lineTo(0.65, -0.15);
    shape.closePath();

    const geometry = new THREE.ShapeGeometry(shape);
    const head = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        depthTest: true
      })
    );

    head.name = "Arrow Head";
    head.rotation.x = -Math.PI / 2;
    head.position.set(0, 0.012, -0.45);
    arrow.add(head);
  }

  roadArrow("Entrance Arrow", -7, 8.8, 0);
  roadArrow("Exit Arrow", 7, 8.8, Math.PI);

  // ========== PERIMETER WALLS ==========
  const walls = new THREE.Group();
  walls.name = "Boundary Walls";
  parking.add(walls);

  box(walls, "North Wall", 40, 0.7, 0.3, 0, 0.35, -15, concrete);
  box(walls, "West Wall", 0.3, 0.7, 30, -20, 0.35, 0, concrete);
  box(walls, "East Wall", 0.3, 0.7, 30, 20, 0.35, 0, concrete);
  box(walls, "South Left", 10, 0.7, 0.3, -15, 0.35, 15, concrete);
  box(walls, "South Center", 4, 0.7, 0.3, 0, 0.35, 15, concrete);
  box(walls, "South Right", 10, 0.7, 0.3, 15, 0.35, 15, concrete);

  // ========== SECURITY BOOTH ==========
  const booth = new THREE.Group();
  booth.name = "Security Booth";
  booth.position.set(0, 0, 17.5);
  parking.add(booth);

  box(booth, "Platform", 3.8, 0.2, 3.5, 0, 0.1, 0, concrete);
  box(booth, "Back Wall", 3.2, 2.8, 0.15, 0, 1.6, -1.4, blue);
  box(booth, "Left Wall", 0.15, 2.8, 2.8, -1.6, 1.6, 0, blue);
  box(booth, "Right Wall", 0.15, 2.8, 2.8, 1.6, 1.6, 0, blue);
  box(booth, "Front Left", 0.8, 2.8, 0.15, -1.2, 1.6, 1.4, blue);
  box(booth, "Front Right", 0.8, 2.8, 0.15, 1.2, 1.6, 1.4, blue);
  box(booth, "Door Header", 1.6, 0.5, 0.15, 0, 2.75, 1.4, blue);
  box(booth, "Glass Door", 1.5, 2.25, 0.04, 0, 1.35, 1.48, glass);
  box(booth, "Left Window", 0.04, 1.2, 1.6, -1.7, 1.9, 0, glass);
  box(booth, "Right Window", 0.04, 1.2, 1.6, 1.7, 1.9, 0, glass);
  box(booth, "Flat Roof", 4, 0.3, 3.7, 0, 3.2, 0, dark);

  // ========== BARRIERS ==========
  function createBarrier(name, x, z, isEntrance) {
    const group = new THREE.Group();
    group.name = name;
    group.position.set(x, 0, z);
    parking.add(group);

    const direction = isEntrance ? 1 : -1;
    const pivotX = direction * -2.35;

    box(group, "Barrier Base", 0.75, 1.0, 0.75, pivotX, 0.5, 0, orange);

    const pivot = new THREE.Group();
    pivot.name = "Barrier Arm Pivot";
    pivot.position.set(pivotX, 0.95, 0);
    group.add(pivot);

    box(pivot, "Barrier Arm", 4.6, 0.16, 0.18, direction * 2.3, 0, 0, white);

    for (let i = 0; i < 4; i++) {
      box(
        pivot,
        "Red Stripe",
        0.42, 0.17, 0.19,
        direction * (0.65 + i * 1.05),
        0, 0,
        red
      );
    }

    group.userData.isEntrance = isEntrance;
    group.userData.open = false;

    return { group, pivot, direction, open: false };
  }

  const entranceBarrier = createBarrier("Entrance Barrier", -7, 14, true);
  const exitBarrier = createBarrier("Exit Barrier", 7, 14, false);

  box(parking, "Entrance Green", 5, 0.03, 0.4, -7, 0.04, 14.7, green);
  box(parking, "Exit Orange", 5, 0.03, 0.4, 7, 0.04, 14.7, orange);

  // ========== LIGHT POSTS ==========
  function lamp(x, z, index) {
    const group = new THREE.Group();
    group.name = `Lamp ${index}`;
    group.position.set(x, 0, z);
    parking.add(group);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.13, 5, 12),
      concrete
    );
    pole.position.y = 2.5;
    group.add(pole);

    box(group, "Lamp Head", 1.2, 0.2, 0.6, 0, 5.1, 0, white);
  }

  lamp(-18, -13, 1);
  lamp(18, -13, 2);
  lamp(-18, 13, 3);
  lamp(18, 13, 4);

  // ========== LIGHTING ==========
  scene.add(new THREE.HemisphereLight(0xffffff, 0x808080, 2));

  const sunlight = new THREE.DirectionalLight(0xffffff, 2.5);
  sunlight.position.set(20, 30, 15);
  scene.add(sunlight);

  const isInitialEn = initialMotoStats?.lang === "en";
  const outdoorMotoSprite = makeBillboardSprite(
    isInitialEn
      ? [
          "🏍️ MOTORBIKE PARKING AREA (OUTDOOR)",
          `Parked: ${initialMotoStats?.currentMoto ?? 0} bikes · Available: ${initialMotoStats?.availableMoto ?? 20} / ${initialMotoStats?.maxCapacity ?? 20} slots`
        ]
      : [
          "🏍️ KHU VỰC ĐỖ XE MÁY (NGOÀI TRỜI)",
          `Đang có trong bãi: ${initialMotoStats?.currentMoto ?? 0} xe · Trống: ${initialMotoStats?.availableMoto ?? 20} / ${initialMotoStats?.maxCapacity ?? 20} slots`
        ],
    {
      bgColor: "rgba(13, 148, 136, 0.94)",
      borderColor: "#ffffff",
      textColor: "#ffffff",
      subTextColor: "#fef08a",
      scaleX: 16,
      scaleY: 4.6,
      alwaysOnTop: true
    }
  );
  outdoorMotoSprite.position.set(0, 4.2, 0);
  outdoorMotoSprite.visible = Boolean(initialMotoStats?.showOutdoorBanner);
  parking.add(outdoorMotoSprite);

  const updateMotoStats = (stats) => {
    if (!stats) {
      outdoorMotoSprite.visible = false;
      return;
    }
    const isEn = stats.lang === "en";
    outdoorMotoSprite.visible = Boolean(stats.showOutdoorBanner);
    updateBillboardSprite(
      outdoorMotoSprite,
      isEn
        ? [
            "🏍️ MOTORBIKE PARKING AREA (OUTDOOR)",
            `Parked: ${stats.currentMoto} bikes · Available: ${stats.availableMoto} / ${stats.maxCapacity} slots`
          ]
        : [
            "🏍️ KHU VỰC ĐỖ XE MÁY (NGOÀI TRỜI)",
            `Đang có trong bãi: ${stats.currentMoto} xe · Trống: ${stats.availableMoto} / ${stats.maxCapacity} slots`
          ]
    );
  };

  const dispose = () => {
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Sprite) {
        if (object.geometry) geometries.add(object.geometry);
        const list = Array.isArray(object.material) ? object.material : [object.material];
        list.forEach((m) => {
          if (!m) return;
          materials.add(m);
          if (m.map) textures.add(m.map);
        });
      }
    });
    textures.forEach((t) => t.dispose());
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    scene.clear();
  };

  return {
    scene,
    entranceBarrier,
    exitBarrier,
    slotMeshes,
    updateMotoStats,
    dispose
  };
}

export function createBuildingParkingArea(levels = [], initialMotoStats = null) {

  const scene = new THREE.Scene();
  scene.name = "Parking Building 3D";
  scene.background = new THREE.Color(0xdce9f3);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x7b8794, 2.2));

  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(30, 60, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -120;
  sun.shadow.camera.right = 120;
  sun.shadow.camera.top = 120;
  sun.shadow.camera.bottom = -120;
  scene.add(sun);

  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...extra });

  const concrete = mat(0xaab5c0);
  const columnMat = mat(0x6f7c89);
  const white = mat(0xf8fafc);
  const wallWhite = mat(0xeef2f6, { roughness: 0.65 });
  const yellow = mat(0xfacc15);
  const asphalt = mat(0x48515c);
  const rampRoadMat = mat(0x434c56);
  const signBoardMat = mat(0x0f172a);
  const signPoleMat = mat(0x475569);
  const arrowMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const floors = [];
  const slotMeshes = [];
  const interactables = [];
  const floorColumnGroups = [];
  let motoFloor1CenterSprite = null;
  const floorHeight = 5.2;

  const BW = 72;
  const BD = 60;
  const HBW = BW / 2;
  const HBD = BD / 2;

  const RAMP_INNER_W = 6.5;
  const RAMP_WELL_W = 8.5;
  const RAMP_TOTAL_W = RAMP_INNER_W + RAMP_WELL_W;
  const X_RAMP_SPLIT = -HBW - RAMP_INNER_W;
  const X_RAMP_OUTER = -HBW - RAMP_TOTAL_W;
  const Z_RAMP_START = -11;
  const Z_RAMP_END = 11;

  const MOTO_CAPACITY = initialMotoStats?.maxCapacity ?? 20;
  const MOTO_AVAILABLE = initialMotoStats?.availableMoto ?? MOTO_CAPACITY;
  const MOTO_CURRENT = initialMotoStats?.currentMoto ?? Math.max(0, MOTO_CAPACITY - MOTO_AVAILABLE);
  const initialBuildingEn = initialMotoStats?.lang === "en";
  let gateSignSpriteRef = null;
  let signBoardMeshRef = null;
  const rampSprites = [];


  function box(parent, w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function label(text, width = 256) {
    if (typeof document === "undefined") {
      return new THREE.Mesh();
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = 100;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 44px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, width / 2, 50, width - 16);
    }

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 0.7),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(canvas),
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  function createBillboardSprite(lines, options = {}) {
    return makeBillboardSprite(lines, options);
  }


  function arrow(parent, x, y, z, yaw = 0, material = arrowMat, scale = 1) {
    const shape = new THREE.Shape();
    shape.moveTo(-0.25, -0.8);
    shape.lineTo(0.25, -0.8);
    shape.lineTo(0.25, 0.15);
    shape.lineTo(0.67, 0.15);
    shape.lineTo(0, 1.1);
    shape.lineTo(-0.67, 0.15);
    shape.lineTo(-0.25, 0.15);
    shape.closePath();

    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
    mesh.rotation.x = -Math.PI / 2;

    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    pivot.rotation.y = yaw;
    mesh.scale.setScalar(scale);
    pivot.add(mesh);
    parent.add(pivot);
    return pivot;
  }

  function buildInclinedRampFlight(parentGroup, y0, y1, fromFloor) {
    const dZ = Z_RAMP_END - Z_RAMP_START;
    const dY = y1 - y0;
    const rampLen = Math.hypot(dZ, dY);
    const slopeAngle = Math.atan2(dY, dZ);

    const wellCenterX = (X_RAMP_SPLIT + X_RAMP_OUTER) / 2;
    const midY = (y0 + y1) / 2;
    const midZ = (Z_RAMP_START + Z_RAMP_END) / 2;

    const rampPivot = new THREE.Group();
    rampPivot.position.set(wellCenterX, midY, midZ);
    rampPivot.rotation.x = -slopeAngle;
    parentGroup.add(rampPivot);

    box(rampPivot, RAMP_WELL_W, 0.38, rampLen + 0.35, 0, 0, 0, concrete);
    box(rampPivot, RAMP_WELL_W - 0.15, 0.05, rampLen + 0.3, 0, 0.21, 0, rampRoadMat);

    const halfW = RAMP_WELL_W / 2;
    box(rampPivot, 0.35, 1.05, rampLen + 0.45, -halfW, 0.68, 0, wallWhite);
    box(rampPivot, 0.35, 1.05, rampLen + 0.45, +halfW, 0.68, 0, wallWhite);

    box(rampPivot, 0.18, 0.12, rampLen - 0.6, 0, 0.26, 0, wallWhite);

    const xUpLane = -RAMP_WELL_W / 4;
    const xDownLane = +RAMP_WELL_W / 4;
    for (const zLocal of [-6, 0, 6]) {
      arrow(rampPivot, xUpLane, 0.26, zLocal, Math.PI, arrowMat, 0.72);
      arrow(rampPivot, xDownLane, 0.26, zLocal, 0, arrowMat, 0.72);
    }

    const toFloor = fromFloor + 1;
    const upSprite = createBillboardSprite(
      [initialBuildingEn ? `Up Ramp ↑ (F${fromFloor} → F${toFloor})` : `Lối đi lên ↑ (Tầng ${fromFloor} → ${toFloor})`],
      {
        bgColor: "rgba(22, 101, 52, 0.92)",
        borderColor: "#4ade80",
        textColor: "#ffffff",
        scaleX: 9.5,
        scaleY: 2.5,
        alwaysOnTop: true
      }
    );
    upSprite.position.set(wellCenterX + xUpLane, midY + 1.9, midZ - 2.5);
    parentGroup.add(upSprite);

    const downSprite = createBillboardSprite(
      [initialBuildingEn ? `Down Ramp ↓ (F${toFloor} → F${fromFloor})` : `Lối đi xuống ↓ (Tầng ${toFloor} → ${fromFloor})`],
      {
        bgColor: "rgba(30, 58, 138, 0.92)",
        borderColor: "#60a5fa",
        textColor: "#ffffff",
        scaleX: 9.5,
        scaleY: 2.5,
        alwaysOnTop: true
      }
    );
    downSprite.position.set(wellCenterX + xDownLane, midY + 1.9, midZ + 2.5);
    parentGroup.add(downSprite);
    rampSprites.push({ upSprite, downSprite, fromFloor, toFloor });
  }

  function buildFloorBase(group, y, floorNumber) {
    const slabH = 0.42;
    const asphaltH = 0.045;
    const wallH = 1.05;
    const wallT = 0.35;
    const wallY = y + 0.68;

    const mainPlusInnerW = BW + RAMP_INNER_W;
    const mainPlusInnerX = -RAMP_INNER_W / 2;
    box(group, mainPlusInnerW, slabH, BD, mainPlusInnerX, y, 0, concrete);
    box(group, mainPlusInnerW - 0.2, asphaltH, BD - 0.2, mainPlusInnerX, y + 0.23, 0, asphalt);

    const wellCenterX = (X_RAMP_SPLIT + X_RAMP_OUTER) / 2;
    const backLandLen = Z_RAMP_START - -HBD;
    const backLandZ = (-HBD + Z_RAMP_START) / 2;
    const frontLandLen = HBD - Z_RAMP_END;
    const frontLandZ = (Z_RAMP_END + HBD) / 2;

    box(group, RAMP_WELL_W, slabH, backLandLen, wellCenterX, y, backLandZ, concrete);
    box(group, RAMP_WELL_W - 0.1, asphaltH, backLandLen - 0.1, wellCenterX, y + 0.23, backLandZ, asphalt);

    box(group, RAMP_WELL_W, slabH, frontLandLen, wellCenterX, y, frontLandZ, concrete);
    box(group, RAMP_WELL_W - 0.1, asphaltH, frontLandLen - 0.1, wellCenterX, y + 0.23, frontLandZ, asphalt);

    if (floorNumber === 1) {
      const midLen = Z_RAMP_END - Z_RAMP_START;
      box(group, RAMP_WELL_W, slabH, midLen, wellCenterX, y, 0, concrete);
      box(group, RAMP_WELL_W - 0.1, asphaltH, midLen, wellCenterX, y + 0.23, 0, asphalt);
      box(group, 0.25, 0.32, 8.0, wellCenterX, y + 0.35, Z_RAMP_END + 4.5, wallWhite);
    }

    const colGroup = new THREE.Group();
    colGroup.name = "columns";
    for (const cx of [-HBW + 2, -HBW / 2, 0, HBW / 2, HBW - 2]) {
      for (const cz of [-HBD + 2, HBD - 2]) {
        if (floorNumber === 1 && cx === 0 && cz === HBD - 2) continue;
        box(colGroup, 0.75, floorHeight - 0.4, 0.75, cx, y + floorHeight / 2, cz, columnMat);
      }
    }
    group.add(colGroup);
    floorColumnGroups.push(colGroup);

    const totalW = BW + RAMP_TOTAL_W;
    const totalCenterX = (X_RAMP_OUTER + HBW) / 2;

    box(group, totalW + wallT, wallH, wallT, totalCenterX, wallY, -HBD, wallWhite);
    box(group, wallT, wallH, BD + wallT, HBW, wallY, 0, wallWhite);

    if (floorNumber === 1) {
      const leftFrontLen = -5 - X_RAMP_OUTER;
      box(group, leftFrontLen, wallH, wallT, (X_RAMP_OUTER - 5) / 2, wallY, HBD, wallWhite);
      const rightFrontLen = HBW - 5;
      box(group, rightFrontLen, wallH, wallT, (5 + HBW) / 2, wallY, HBD, wallWhite);
    } else {
      box(group, totalW + wallT, wallH, wallT, totalCenterX, wallY, HBD, wallWhite);
    }

    box(group, wallT, wallH, backLandLen + 0.3, X_RAMP_OUTER, wallY, backLandZ, wallWhite);
    box(group, wallT, wallH, frontLandLen + 0.3, X_RAMP_OUTER, wallY, frontLandZ, wallWhite);

    if (floorNumber >= 2) {
      box(group, RAMP_WELL_W + wallT, wallH, wallT, wellCenterX, wallY, Z_RAMP_START, wallWhite);
      const wellLen = Z_RAMP_END - Z_RAMP_START;
      box(group, wallT, wallH, wellLen + wallT, X_RAMP_SPLIT, wallY, 0, wallWhite);
    }

    if (floorNumber <= 2) {
      buildInclinedRampFlight(group, y, y + floorHeight, floorNumber);
    }
  }

  // ── TẦNG 1 (XE MÁY) ───────────────────────────────────────────────────────
  {
    const f = 1;
    const y = 0;
    const group = new THREE.Group();
    group.name = "Floor 1";

    buildFloorBase(group, y, f);

    const signX = 9.5;
    const signZ = HBD + 5.5;
    const entranceSignGroup = new THREE.Group();
    entranceSignGroup.name = "Entrance Info Board";
    entranceSignGroup.position.set(signX, 0, signZ);
    group.add(entranceSignGroup);

    box(entranceSignGroup, 4.6, 0.3, 1.4, 0, -0.25, 0, concrete);
    box(entranceSignGroup, 0.22, 3.2, 0.22, -1.6, 1.4, 0, signPoleMat);
    box(entranceSignGroup, 0.22, 3.2, 0.22, 1.6, 1.4, 0, signPoleMat);

    const signBoardMesh = box(entranceSignGroup, 4.8, 1.8, 0.35, 0, 2.7, 0, signBoardMat);
    signBoardMesh.userData = {
      id: "BẢNG THÔNG TIN BÃI XE MÁY",
      floor: f,
      isMotoInfo: true,
      currentMoto: MOTO_CURRENT,
      availableMoto: MOTO_AVAILABLE,
      maxCapacity: MOTO_CAPACITY
    };
    signBoardMeshRef = signBoardMesh;
    interactables.push(signBoardMesh);

    const gateSignSprite = createBillboardSprite(
      initialBuildingEn
        ? [
            "🏍️ MOTORBIKE PARKING (FLOOR 1)",
            `Available slots: ${MOTO_AVAILABLE} / ${MOTO_CAPACITY}`
          ]
        : [
            "🏍️ BÃI XE MÁY (TẦNG TRỆT)",
            `Slots trống: ${MOTO_AVAILABLE} / ${MOTO_CAPACITY}`
          ],
      {
        bgColor: "rgba(15, 23, 42, 0.95)",
        borderColor: "#22c55e",
        textColor: "#ffffff",
        subTextColor: "#4ade80",
        scaleX: 13.5,
        scaleY: 4.2,
        alwaysOnTop: true
      }
    );
    gateSignSprite.position.set(0, 4.2, 0);
    gateSignSpriteRef = gateSignSprite;
    entranceSignGroup.add(gateSignSprite);

    motoFloor1CenterSprite = createBillboardSprite(
      initialBuildingEn
        ? [
            "🏍️ MOTORBIKE PARKING ZONE (FLOOR 1)",
            `Parked: ${MOTO_CURRENT} bikes · Available: ${MOTO_AVAILABLE} / ${MOTO_CAPACITY} slots`
          ]
        : [
            "🏍️ KHU VỰC ĐỖ XE MÁY (TẦNG TRỆT)",
            `Đang có trong bãi: ${MOTO_CURRENT} xe · Trống: ${MOTO_AVAILABLE} / ${MOTO_CAPACITY} slots`
          ],
      {
        bgColor: "rgba(13, 148, 136, 0.94)",
        borderColor: "#ffffff",
        textColor: "#ffffff",
        subTextColor: "#fef08a",
        scaleX: 19,
        scaleY: 5.4,
        alwaysOnTop: true
      }
    );

    motoFloor1CenterSprite.position.set(0, y + 2.8, 0);
    motoFloor1CenterSprite.visible = false;
    group.add(motoFloor1CenterSprite);

    scene.add(group);
    floors.push(group);
  }

  // Map API levels to Floor 2 and Floor 3
  const safeLevels = Array.isArray(levels) ? levels : [];
  const findLevelForFloor = (floorNum) => {
    const codeTarget = `F${floorNum}`;
    const byCode = safeLevels.find(
      (l) => String(l.levelCode || "").toUpperCase() === codeTarget
    );
    if (byCode) return byCode;
    if (floorNum === 2) {
      return safeLevels.find((l) => String(l.levelCode || "").toUpperCase() !== "F1" && String(l.levelCode || "").toUpperCase() !== "F3") ?? safeLevels[0] ?? null;
    }
    if (floorNum === 3) {
      return safeLevels[2] ?? (safeLevels.length === 2 ? safeLevels[1] : null);
    }
    return null;
  };

  // ── TẦNG 2 & TẦNG 3 – BÃI ĐỖ XE Ô TÔ (100 SLOTS / TẦNG) ──────────────────
  for (let f = 2; f <= 3; f++) {
    const y = (f - 1) * floorHeight;
    const group = new THREE.Group();
    group.name = `Floor ${f}`;

    buildFloorBase(group, y, f);

    const slotW = 2.5;
    const slotD = 5.0;

    const rowCodes = ["A", "B", "C", "D", "E"];
    const rowZPositions = [-22, -11, 0, 11, 22];
    const N_COL = 20;
    const startX = -((N_COL - 1) * slotW) / 2;

    const aisleZPositions = [-16.5, -5.5, 5.5, 16.5];
    for (const az of aisleZPositions) {
      for (const ax of [-20, -10, 0, 10, 20]) {
        box(group, 3.2, 0.05, 0.12, ax, y + 0.33, az, yellow);
      }
      for (const ax of [-16, 0, 16]) {
        arrow(group, ax, y + 0.36, az - 1.2, Math.PI / 2, arrowMat, 0.55);
        arrow(group, ax, y + 0.36, az + 1.2, -Math.PI / 2, arrowMat, 0.55);
      }
    }

    for (const sideZ of [-11, 11]) {
      arrow(group, -29.5, y + 0.36, sideZ, 0, arrowMat, 0.65);
      arrow(group, 29.5, y + 0.36, sideZ, Math.PI, arrowMat, 0.65);
    }

    const matchedLevel = findLevelForFloor(f);
    const levelSlots = matchedLevel?.slots ?? [];
    const slotByCode = new Map();
    levelSlots.forEach((s) => {
      const code = String(s.slotCode || "").toUpperCase();
      if (code) slotByCode.set(code, s);
    });
    const usedIds = new Set();
    let seqIdx = 0;

    let floorSlotCount = 0;
    rowZPositions.forEach((sz, rowIndex) => {
      const rowCode = rowCodes[rowIndex];

      for (let c = 0; c < N_COL; c++) {
        const sx = startX + c * slotW;
        floorSlotCount++;

        const slotNumberInRow = String(c + 1).padStart(2, "0");
        const defaultId = `F${f}-${rowCode}${slotNumberInRow}`;
        const shortCode = `${rowCode}${slotNumberInRow}`;

        let apiSlot = slotByCode.get(defaultId) ?? slotByCode.get(shortCode);
        if (apiSlot && usedIds.has(apiSlot.slotId)) {
          apiSlot = undefined;
        }
        if (!apiSlot && seqIdx < levelSlots.length) {
          while (seqIdx < levelSlots.length && usedIds.has(levelSlots[seqIdx].slotId)) {
            seqIdx++;
          }
          if (seqIdx < levelSlots.length) {
            apiSlot = levelSlots[seqIdx++];
          }
        }
        if (apiSlot) {
          usedIds.add(apiSlot.slotId);
        }

        const displayCode = apiSlot?.slotCode || defaultId;
        const statusKey = String(apiSlot?.status || "AVAILABLE").toUpperCase();

        const mesh = box(
          group,
          slotW - 0.12, 0.035, slotD - 0.12,
          sx, y + 0.305, sz,
          mat(OUTDOOR_SLOT_COLORS[statusKey] ?? OUTDOOR_SLOT_COLORS.AVAILABLE, {
            transparent: true,
            opacity: 0.78
          })
        );

        const slotInfo = {
          slotId: apiSlot?.slotId || defaultId,
          slotCode: displayCode,
          floorCode: apiSlot?.floorCode || matchedLevel?.levelCode || `F${f}`,
          zoneCode: apiSlot?.zoneCode || rowCode,
          supportedVehicleTypes: apiSlot?.supportedVehicleTypes || ["Car"],
          features: apiSlot?.features || [],
          id: displayCode,
          slotOrder: floorSlotCount,
          floor: f,
          status: statusKey,
          isSlot: true,
          isParkingSlot: true
        };

        mesh.userData = slotInfo;
        slotMeshes.push(mesh);
        interactables.push(mesh);

        for (const dx of [-slotW / 2 + 0.04, slotW / 2 - 0.04]) {
          box(group, 0.07, 0.05, slotD, sx + dx, y + 0.34, sz, white);
        }

        box(group, slotW, 0.05, 0.07, sx, y + 0.34, sz - slotD / 2, white);
        box(group, slotW, 0.05, 0.07, sx, y + 0.34, sz + slotD / 2, white);

        const lbl = label(displayCode);
        lbl.position.set(sx, y + 0.36, sz);
        group.add(lbl);
      }
    });

    scene.add(group);
    floors.push(group);
  }

  // Thảm cỏ / mặt đất bao quanh tòa nhà
  box(scene, 200, 0.35, 150, -10, -0.55, 0, mat(0x7e9b81));

  const dispose = () => {
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Sprite) {
        if (object.geometry) geometries.add(object.geometry);
        const list = Array.isArray(object.material) ? object.material : [object.material];
        list.forEach((m) => {
          if (!m) return;
          materials.add(m);
          if (m.map) textures.add(m.map);
        });
      }
    });
    textures.forEach((t) => t.dispose());
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    scene.clear();
  };

  const updateMotoStats = (stats) => {
    if (!stats) return;
    const isEn = stats.lang === "en";
    const cap = stats.maxCapacity ?? MOTO_CAPACITY;
    const avail = stats.availableMoto ?? cap;
    const curr = stats.currentMoto ?? Math.max(0, cap - avail);
    if (signBoardMeshRef) {
      signBoardMeshRef.userData.id = isEn ? "MOTORBIKE PARKING INFO BOARD" : "BẢNG THÔNG TIN BÃI XE MÁY";
      signBoardMeshRef.userData.availableMoto = avail;
      signBoardMeshRef.userData.maxCapacity = cap;
      signBoardMeshRef.userData.currentMoto = curr;
    }
    if (gateSignSpriteRef) {
      updateBillboardSprite(
        gateSignSpriteRef,
        isEn
          ? [
              "🏍️ MOTORBIKE PARKING (FLOOR 1)",
              `Available slots: ${avail} / ${cap}`
            ]
          : [
              "🏍️ BÃI XE MÁY (TẦNG TRỆT)",
              `Slots trống: ${avail} / ${cap}`
            ]
      );
    }
    if (motoFloor1CenterSprite) {
      updateBillboardSprite(
        motoFloor1CenterSprite,
        isEn
          ? [
              "🏍️ MOTORBIKE PARKING ZONE (FLOOR 1)",
              `Parked: ${curr} bikes · Available: ${avail} / ${cap} slots`
            ]
          : [
              "🏍️ KHU VỰC ĐỖ XE MÁY (TẦNG TRỆT)",
              `Đang có trong bãi: ${curr} xe · Trống: ${avail} / ${cap} slots`
            ]
      );
    }
    rampSprites.forEach(({ upSprite, downSprite, fromFloor, toFloor }) => {
      updateBillboardSprite(upSprite, [
        isEn ? `Up Ramp ↑ (F${fromFloor} → F${toFloor})` : `Lối đi lên ↑ (Tầng ${fromFloor} → ${toFloor})`
      ]);
      updateBillboardSprite(downSprite, [
        isEn ? `Down Ramp ↓ (F${toFloor} → F${fromFloor})` : `Lối đi xuống ↓ (Tầng ${toFloor} → ${fromFloor})`
      ]);
    });
  };

  return {
    scene,
    floors,
    floorColumnGroups,
    motoFloor1CenterSprite,
    floorHeight,
    slotMeshes,
    interactables,
    updateMotoStats,
    dispose
  };
}

export function createBasementParkingArea(levels = [], initialMotoStats = null) {
  const scene = new THREE.Scene();
  scene.name = "Parking Basement 3D";
  scene.background = new THREE.Color(0xdce9f3);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 2.3));

  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.position.set(40, 75, 45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -120;
  sun.shadow.camera.right = 120;
  sun.shadow.camera.top = 120;
  sun.shadow.camera.bottom = -120;
  scene.add(sun);

  const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.75);
  fillLight.position.set(-50, 20, -45);
  scene.add(fillLight);

  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...extra });

  const concrete = mat(0xaab5c0);
  const columnMat = mat(0x64748b);
  const white = mat(0xf8fafc);
  const wallWhite = mat(0xeef2f6, { roughness: 0.65 });
  const yellow = mat(0xfacc15);
  const cyanLine = mat(0x38bdf8, { roughness: 0.5 });
  const asphalt = mat(0x424b57);
  const rampRoadMat = mat(0x3b4450);
  const signBoardMat = mat(0x0f172a);
  const signPoleMat = mat(0x475569);

  const arrowYellowMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const arrowInMat = new THREE.MeshBasicMaterial({
    color: 0x4ade80,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const arrowOutMat = new THREE.MeshBasicMaterial({
    color: 0x60a5fa,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const floorHeight = 5.2;
  const BW = 52;
  const BD = 60;
  const HBW = BW / 2;
  const HBD = BD / 2;

  const RAMP_INNER_W = 6.5;
  const RAMP_WELL_W = 8.5;
  const RAMP_TOTAL_W = RAMP_INNER_W + RAMP_WELL_W;
  const X_RAMP_SPLIT = -HBW - RAMP_INNER_W;
  const X_RAMP_OUTER = -HBW - RAMP_TOTAL_W;
  const Z_RAMP_START = -11;
  const Z_RAMP_END = 11;

  const floors = [];
  const slotMeshes = [];
  const interactables = [];
  const floorColumnGroups = [];
  const floorZoneSprites = [];
  const rampSprites = [];
  const floorTagSprites = [];

  const MOTO_CAPACITY = initialMotoStats?.maxCapacity ?? 100;
  const MOTO_AVAILABLE = initialMotoStats?.availableMoto ?? MOTO_CAPACITY;
  const MOTO_CURRENT = initialMotoStats?.currentMoto ?? Math.max(0, MOTO_CAPACITY - MOTO_AVAILABLE);
  const initialEn = initialMotoStats?.lang === "en";

  let b1BoardSpriteRef = null;
  let motoB1CenterSprite = null;
  let b1SignBoardMeshRef = null;
  let portalSignSpriteRef = null;
  let aptTitleSpriteRef = null;

  function box(parent, w, h, d, x, y, z, material, castShadow = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function createSlotLabel(text, isEV = false) {
    if (typeof document === "undefined") {
      return new THREE.Mesh();
    }
    const canvas = document.createElement("canvas");
    canvas.width = 280;
    canvas.height = 100;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = isEV ? "#e0f2fe" : "#ffffff";
      ctx.font = "bold 42px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 16);
    }

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 0.78),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(canvas),
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  function arrow(parent, x, y, z, yaw = 0, material = arrowYellowMat, scale = 1) {
    const shape = new THREE.Shape();
    shape.moveTo(-0.25, -0.8);
    shape.lineTo(0.25, -0.8);
    shape.lineTo(0.25, 0.15);
    shape.lineTo(0.67, 0.15);
    shape.lineTo(0, 1.1);
    shape.lineTo(-0.67, 0.15);
    shape.lineTo(-0.25, 0.15);
    shape.closePath();

    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
    mesh.rotation.x = -Math.PI / 2;

    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    pivot.rotation.y = yaw;
    mesh.scale.setScalar(scale);
    pivot.add(mesh);
    parent.add(pivot);
    return pivot;
  }

  // ── PHẦN TRÊN MẶT ĐẤT: CỔNG HẦM & KHỐI CHUNG CƯ BÁN TRONG SUỐT ───────────
  const groundPortalGroup = new THREE.Group();
  groundPortalGroup.name = "Ground Portal";
  scene.add(groundPortalGroup);

  const apartmentGroup = new THREE.Group();
  apartmentGroup.name = "Apartment Above Ground";
  scene.add(apartmentGroup);

  {
    const wellCenterX = (X_RAMP_SPLIT + X_RAMP_OUTER) / 2;
    const wallH = 1.05;
    const wallT = 0.35;

    const approachLen = 25;
    const approachZ = Z_RAMP_END + approachLen / 2;
    box(groundPortalGroup, RAMP_WELL_W + 0.8, 0.36, approachLen, wellCenterX, 0, approachZ, concrete);
    box(groundPortalGroup, RAMP_WELL_W - 0.1, 0.05, approachLen - 0.2, wellCenterX, 0.2, approachZ, rampRoadMat);
    box(groundPortalGroup, 0.18, 0.14, approachLen - 2, wellCenterX, 0.27, approachZ, wallWhite);
    box(groundPortalGroup, wallT, wallH, approachLen, X_RAMP_OUTER, 0.68, approachZ, wallWhite);
    box(groundPortalGroup, wallT, wallH, approachLen, X_RAMP_SPLIT, 0.68, approachZ, wallWhite);

    const wellLen = Z_RAMP_END - Z_RAMP_START;
    box(groundPortalGroup, RAMP_WELL_W + wallT, wallH, wallT, wellCenterX, 0.68, Z_RAMP_START, wallWhite);
    box(groundPortalGroup, wallT, wallH, wellLen + wallT, X_RAMP_SPLIT, 0.68, 0, wallWhite);
    box(groundPortalGroup, wallT, wallH, wellLen + wallT, X_RAMP_OUTER, 0.68, 0, wallWhite);

    const xDownLane = wellCenterX + RAMP_WELL_W / 4;
    const xUpLane = wellCenterX - RAMP_WELL_W / 4;
    for (const zPos of [15, 22, 29]) {
      arrow(groundPortalGroup, xDownLane, 0.25, zPos, 0, arrowInMat, 0.8);
      arrow(groundPortalGroup, xUpLane, 0.25, zPos, Math.PI, arrowOutMat, 0.8);
    }

    const canopyMat = mat(0x1e293b, { roughness: 0.45 });
    const canopyGlassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      roughness: 0.2,
      depthWrite: false
    });
    box(groundPortalGroup, 0.45, 4.4, 0.45, X_RAMP_OUTER, 2.2, 13.5, canopyMat);
    box(groundPortalGroup, 0.45, 4.4, 0.45, X_RAMP_SPLIT, 2.2, 13.5, canopyMat);
    box(groundPortalGroup, 0.45, 4.4, 0.45, X_RAMP_OUTER, 2.2, 19.5, canopyMat);
    box(groundPortalGroup, 0.45, 4.4, 0.45, X_RAMP_SPLIT, 2.2, 19.5, canopyMat);
    box(groundPortalGroup, RAMP_WELL_W + 1.2, 0.35, 7.2, wellCenterX, 4.45, 16.5, canopyMat);
    box(groundPortalGroup, RAMP_WELL_W + 0.4, 0.08, 6.2, wellCenterX, 4.66, 16.5, canopyGlassMat, false);

    portalSignSpriteRef = makeBillboardSprite(
      initialEn
        ? [
            "🏢 BASEMENT PORTAL (B1 – B2 – B3)",
            "← Exit Up ↑   |   Entry Down ↓ →"
          ]
        : [
            "🏢 CỔNG HẦM CHUNG CƯ (B1 – B2 – B3)",
            "← Lối ra hầm ↑   |   Lối vào hầm ↓ →"
          ],
      {
        bgColor: "rgba(15, 23, 42, 0.94)",
        borderColor: "#38bdf8",
        textColor: "#ffffff",
        subTextColor: "#7dd3fc",
        scaleX: 13.5,
        scaleY: 3.8,
        alwaysOnTop: true
      }
    );
    portalSignSpriteRef.position.set(wellCenterX, 7.2, 16.5);
    groundPortalGroup.add(portalSignSpriteRef);

    // Mặt đất bán trong suốt tại y = 0
    const groundGlassMat = new THREE.MeshStandardMaterial({
      color: 0x86efac,
      transparent: true,
      opacity: 0.24,
      roughness: 0.9,
      depthWrite: false
    });
    const groundDeck = new THREE.Mesh(new THREE.BoxGeometry(BW + 13, 0.22, BD + 12), groundGlassMat);
    groundDeck.position.set(0, 0, 0);
    apartmentGroup.add(groundDeck);

    const groundEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(BW + 13, 0.22, BD + 12)),
      new THREE.LineBasicMaterial({ color: 0x15803d, transparent: true, opacity: 0.55 })
    );
    groundEdges.position.set(0, 0, 0);
    apartmentGroup.add(groundEdges);

    // Khối đế sảnh chung cư
    const podiumW = 42;
    const podiumD = 44;
    const podiumH = 4.4;
    const podiumGlass = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.2,
      roughness: 0.3,
      depthWrite: false
    });
    const podiumMesh = new THREE.Mesh(new THREE.BoxGeometry(podiumW, podiumH, podiumD), podiumGlass);
    podiumMesh.position.set(0, podiumH / 2 + 0.15, 0);
    apartmentGroup.add(podiumMesh);

    const podiumEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(podiumW, podiumH, podiumD)),
      new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.45 })
    );
    podiumEdges.position.copy(podiumMesh.position);
    apartmentGroup.add(podiumEdges);

    // Thân tòa nhà chung cư 8 tầng bán trong suốt
    const towerW = 36;
    const towerD = 34;
    const numAptFloors = 8;
    const aptFloorH = 3.2;
    const towerH = numAptFloors * aptFloorH;
    const towerBaseY = podiumH + 0.15;

    const towerGlass = new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.16,
      roughness: 0.25,
      depthWrite: false
    });
    const towerMesh = new THREE.Mesh(new THREE.BoxGeometry(towerW, towerH, towerD), towerGlass);
    towerMesh.position.set(0, towerBaseY + towerH / 2, 0);
    apartmentGroup.add(towerMesh);

    const towerEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(towerW, towerH, towerD)),
      new THREE.LineBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.42 })
    );
    towerEdges.position.copy(towerMesh.position);
    apartmentGroup.add(towerEdges);

    const slabEdgeMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.3 });
    const slabGeom = new THREE.EdgesGeometry(new THREE.BoxGeometry(towerW + 0.4, 0.18, towerD + 0.4));
    for (let i = 1; i <= numAptFloors; i++) {
      const slabLine = new THREE.LineSegments(slabGeom, slabEdgeMat);
      slabLine.position.set(0, towerBaseY + i * aptFloorH, 0);
      apartmentGroup.add(slabLine);
    }

    const roofBox = new THREE.Mesh(new THREE.BoxGeometry(14, 2.4, 12), podiumGlass);
    roofBox.position.set(0, towerBaseY + towerH + 1.2, 0);
    apartmentGroup.add(roofBox);

    const roofEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(14, 2.4, 12)),
      new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.45 })
    );
    roofEdges.position.copy(roofBox.position);
    apartmentGroup.add(roofEdges);

    aptTitleSpriteRef = makeBillboardSprite(
      [initialEn ? "🏢 APARTMENT BUILDING (GROUND: Y = 0)" : "🏢 TÒA NHÀ CHUNG CƯ (MẶT ĐẤT: Y = 0)"],
      {
        bgColor: "rgba(15, 23, 42, 0.78)",
        borderColor: "#94a3b8",
        textColor: "#f8fafc",
        scaleX: 16,
        scaleY: 3.1,
        alwaysOnTop: false
      }
    );
    aptTitleSpriteRef.position.set(0, towerBaseY + towerH + 5.2, 0);
    apartmentGroup.add(aptTitleSpriteRef);
  }

  function buildBasementRampFlight(parentGroup, yBottom, yTop, basementLevel) {
    const dZ = Z_RAMP_END - Z_RAMP_START;
    const dY = yTop - yBottom;
    const rampLen = Math.hypot(dZ, dY);
    const slopeAngle = Math.atan2(dY, dZ);

    const wellCenterX = (X_RAMP_SPLIT + X_RAMP_OUTER) / 2;
    const midY = (yBottom + yTop) / 2;
    const midZ = (Z_RAMP_START + Z_RAMP_END) / 2;

    const rampPivot = new THREE.Group();
    rampPivot.position.set(wellCenterX, midY, midZ);
    rampPivot.rotation.x = -slopeAngle;
    parentGroup.add(rampPivot);

    box(rampPivot, RAMP_WELL_W, 0.38, rampLen + 0.35, 0, 0, 0, concrete);
    box(rampPivot, RAMP_WELL_W - 0.15, 0.05, rampLen + 0.3, 0, 0.21, 0, rampRoadMat);

    const halfW = RAMP_WELL_W / 2;
    box(rampPivot, 0.35, 1.05, rampLen + 0.45, -halfW, 0.68, 0, wallWhite);
    box(rampPivot, 0.35, 1.05, rampLen + 0.45, +halfW, 0.68, 0, wallWhite);
    box(rampPivot, 0.18, 0.12, rampLen - 0.6, 0, 0.26, 0, wallWhite);

    const xUpLane = -RAMP_WELL_W / 4;
    const xDownLane = +RAMP_WELL_W / 4;
    for (const zLocal of [-6, 0, 6]) {
      arrow(rampPivot, xUpLane, 0.26, zLocal, Math.PI, arrowOutMat, 0.72);
      arrow(rampPivot, xDownLane, 0.26, zLocal, 0, arrowInMat, 0.72);
    }

    const upperVi = basementLevel === 1 ? "Mặt đất" : `B${basementLevel - 1}`;
    const upperEn = basementLevel === 1 ? "Ground" : `B${basementLevel - 1}`;
    const lowerLabel = `B${basementLevel}`;

    const upSprite = makeBillboardSprite(
      [initialEn ? `Exit / Up ↑ (${lowerLabel} → ${upperEn})` : `Lối ra / lên ↑ (${lowerLabel} → ${upperVi})`],
      {
        bgColor: "rgba(30, 58, 138, 0.92)",
        borderColor: "#60a5fa",
        textColor: "#ffffff",
        scaleX: 9.2,
        scaleY: 2.35,
        alwaysOnTop: true
      }
    );
    upSprite.position.set(wellCenterX + xUpLane, midY + 1.85, midZ + 2.6);
    parentGroup.add(upSprite);

    const downSprite = makeBillboardSprite(
      [initialEn ? `Entry / Down ↓ (${upperEn} → ${lowerLabel})` : `Lối vào / xuống ↓ (${upperVi} → ${lowerLabel})`],
      {
        bgColor: "rgba(22, 101, 52, 0.92)",
        borderColor: "#4ade80",
        textColor: "#ffffff",
        scaleX: 9.2,
        scaleY: 2.35,
        alwaysOnTop: true
      }
    );
    downSprite.position.set(wellCenterX + xDownLane, midY + 1.85, midZ - 2.6);
    parentGroup.add(downSprite);
    rampSprites.push({ upSprite, downSprite, basementLevel });
  }

  function buildBasementFloorBase(group, y, basementLevel) {
    const slabH = 0.42;
    const asphaltH = 0.045;
    const wallH = 1.05;
    const wallT = 0.35;
    const wallY = y + 0.68;

    const mainPlusInnerW = BW + RAMP_INNER_W;
    const mainPlusInnerX = -RAMP_INNER_W / 2;
    box(group, mainPlusInnerW, slabH, BD, mainPlusInnerX, y, 0, concrete);
    box(group, mainPlusInnerW - 0.2, asphaltH, BD - 0.2, mainPlusInnerX, y + 0.23, 0, asphalt);

    const wellCenterX = (X_RAMP_SPLIT + X_RAMP_OUTER) / 2;
    const backLandLen = Z_RAMP_START - -HBD;
    const backLandZ = (-HBD + Z_RAMP_START) / 2;
    const frontLandLen = HBD - Z_RAMP_END;
    const frontLandZ = (Z_RAMP_END + HBD) / 2;

    box(group, RAMP_WELL_W, slabH, backLandLen, wellCenterX, y, backLandZ, concrete);
    box(group, RAMP_WELL_W - 0.1, asphaltH, backLandLen - 0.1, wellCenterX, y + 0.23, backLandZ, asphalt);

    box(group, RAMP_WELL_W, slabH, frontLandLen, wellCenterX, y, frontLandZ, concrete);
    box(group, RAMP_WELL_W - 0.1, asphaltH, frontLandLen - 0.1, wellCenterX, y + 0.23, frontLandZ, asphalt);

    if (basementLevel === 3) {
      const midLen = Z_RAMP_END - Z_RAMP_START;
      box(group, RAMP_WELL_W, slabH, midLen, wellCenterX, y, 0, concrete);
      box(group, RAMP_WELL_W - 0.1, asphaltH, midLen, wellCenterX, y + 0.23, 0, asphalt);
      box(group, 0.22, 0.28, 7.5, wellCenterX, y + 0.34, Z_RAMP_START - 4.2, wallWhite);
      box(group, RAMP_WELL_W + wallT, wallH, wallT, wellCenterX, wallY, Z_RAMP_END, wallWhite);
      box(group, wallT, wallH, midLen + wallT, X_RAMP_SPLIT, wallY, 0, wallWhite);
    }

    const colGroup = new THREE.Group();
    colGroup.name = `columns-B${basementLevel}`;
    for (const cx of [-HBW + 2, -13, 0, 13, HBW - 2]) {
      for (const cz of [-HBD + 2, HBD - 2]) {
        box(colGroup, 0.75, floorHeight - 0.4, 0.75, cx, y + floorHeight / 2, cz, columnMat);
      }
    }
    group.add(colGroup);
    floorColumnGroups.push(colGroup);

    const totalW = BW + RAMP_TOTAL_W;
    const totalCenterX = (X_RAMP_OUTER + HBW) / 2;

    box(group, totalW + wallT, wallH, wallT, totalCenterX, wallY, -HBD, wallWhite);
    box(group, totalW + wallT, wallH, wallT, totalCenterX, wallY, HBD, wallWhite);
    box(group, wallT, wallH, BD + wallT, HBW, wallY, 0, wallWhite);
    box(group, wallT, wallH, backLandLen + 0.3, X_RAMP_OUTER, wallY, backLandZ, wallWhite);
    box(group, wallT, wallH, frontLandLen + 0.3, X_RAMP_OUTER, wallY, frontLandZ, wallWhite);
    if (basementLevel === 3) {
      box(group, wallT, wallH, Z_RAMP_END - Z_RAMP_START + 0.3, X_RAMP_OUTER, wallY, 0, wallWhite);
    }

    const innerCorrX = (X_RAMP_SPLIT + -HBW) / 2;
    arrow(group, wellCenterX + 1.5, y + 0.32, -20.5, -Math.PI / 2, arrowInMat, 0.7);
    arrow(group, innerCorrX, y + 0.32, -20.5, -Math.PI / 2, arrowInMat, 0.65);

    if (basementLevel < 3) {
      for (const zc of [-8, 4, 16]) {
        arrow(group, innerCorrX - 1.2, y + 0.32, zc, Math.PI, arrowInMat, 0.58);
        arrow(group, innerCorrX + 1.2, y + 0.32, zc, 0, arrowOutMat, 0.58);
      }
      arrow(group, wellCenterX + 1.2, y + 0.32, 20.5, Math.PI / 2, arrowInMat, 0.68);
    } else {
      for (const zc of [-4, 10]) {
        arrow(group, innerCorrX, y + 0.32, zc, 0, arrowOutMat, 0.62);
      }
    }
    arrow(group, wellCenterX - 1.6, y + 0.32, -16, Math.PI, arrowOutMat, 0.68);

    const floorTag = makeBillboardSprite(
      [initialEn ? `BASEMENT B${basementLevel}` : `TẦNG HẦM B${basementLevel}`],
      {
        bgColor: basementLevel === 1 ? "rgba(15, 118, 110, 0.9)" : "rgba(30, 58, 138, 0.9)",
        borderColor: "#ffffff",
        textColor: "#ffffff",
        scaleX: 7.2,
        scaleY: 2.0,
        alwaysOnTop: false
      }
    );
    floorTag.position.set(HBW - 2.5, y + 2.5, HBD - 1.5);
    group.add(floorTag);
    floorTagSprites.push({ sprite: floorTag, basementLevel });

    buildBasementRampFlight(group, y, y + floorHeight, basementLevel);
  }

  // ── TẦNG HẦM B1 – 100 XE MÁY ──────────────────────────────────────────────
  {
    const level = 1;
    const y = -level * floorHeight;
    const group = new THREE.Group();
    group.name = "Basement B1";

    buildBasementFloorBase(group, y, level);

    for (const ax of [-18, -6, 6, 16]) {
      arrow(group, ax, y + 0.32, -20.5, -Math.PI / 2, arrowInMat, 0.65);
      arrow(group, ax, y + 0.32, 20.5, Math.PI / 2, arrowOutMat, 0.65);
    }
    const zoneW = 38;
    const zoneD = 30;
    box(group, zoneW, 0.05, 0.16, 2, y + 0.31, -zoneD / 2, yellow);
    box(group, zoneW, 0.05, 0.16, 2, y + 0.31, +zoneD / 2, yellow);
    box(group, 0.16, 0.05, zoneD, 2 - zoneW / 2, y + 0.31, 0, yellow);
    box(group, 0.16, 0.05, zoneD, 2 + zoneW / 2, y + 0.31, 0, yellow);

    const boardGroup = new THREE.Group();
    boardGroup.name = "B1 Moto Info Board";
    boardGroup.position.set(-20.5, y, -12.5);
    group.add(boardGroup);

    box(boardGroup, 4.4, 0.3, 1.3, 0, 0.35, 0, concrete);
    box(boardGroup, 0.2, 2.8, 0.2, -1.5, 1.75, 0, signPoleMat);
    box(boardGroup, 0.2, 2.8, 0.2, 1.5, 1.75, 0, signPoleMat);

    b1SignBoardMeshRef = box(boardGroup, 4.6, 1.7, 0.35, 0, 3.0, 0, signBoardMat);
    b1SignBoardMeshRef.userData = {
      id: initialEn ? "MOTORBIKE PARKING INFO BOARD (B1)" : "BẢNG THÔNG TIN BÃI XE MÁY (B1)",
      floor: "B1",
      isMotoInfo: true,
      currentMoto: MOTO_CURRENT,
      availableMoto: MOTO_AVAILABLE,
      maxCapacity: MOTO_CAPACITY
    };
    interactables.push(b1SignBoardMeshRef);

    b1BoardSpriteRef = makeBillboardSprite(
      initialEn
        ? [
            "🏍️ MOTORBIKE PARKING (BASEMENT B1)",
            `Available slots: ${MOTO_AVAILABLE} / ${MOTO_CAPACITY}`
          ]
        : [
            "🏍️ BÃI XE MÁY (TẦNG HẦM B1)",
            `Slots trống: ${MOTO_AVAILABLE} / ${MOTO_CAPACITY}`
          ],
      {
        bgColor: "rgba(15, 23, 42, 0.95)",
        borderColor: "#22c55e",
        textColor: "#ffffff",
        subTextColor: "#4ade80",
        scaleX: 11.5,
        scaleY: 3.5,
        alwaysOnTop: true
      }
    );
    b1BoardSpriteRef.position.set(0, 4.6, 0);
    boardGroup.add(b1BoardSpriteRef);

    motoB1CenterSprite = makeBillboardSprite(
      initialEn
        ? [
            `🏍️ MOTORBIKE PARKING ZONE (B1 – ${MOTO_CAPACITY} BIKES)`,
            `Parked: ${MOTO_CURRENT} bikes · Available: ${MOTO_AVAILABLE} / ${MOTO_CAPACITY} slots`
          ]
        : [
            `🏍️ KHU VỰC ĐỖ XE MÁY (TẦNG B1 – ${MOTO_CAPACITY} XE)`,
            `Đang gửi: ${MOTO_CURRENT} xe · Trống: ${MOTO_AVAILABLE} / ${MOTO_CAPACITY} slots`
          ],
      {
        bgColor: "rgba(13, 148, 136, 0.94)",
        borderColor: "#ffffff",
        textColor: "#ffffff",
        subTextColor: "#fef08a",
        scaleX: 18,
        scaleY: 5.0,
        alwaysOnTop: true
      }
    );
    motoB1CenterSprite.position.set(2, y + 2.9, 0);
    motoB1CenterSprite.visible = false;
    group.add(motoB1CenterSprite);

    scene.add(group);
    floors.push(group);
  }

  // ── TẦNG HẦM B2 & B3 – 25 Ô TÔ THƯỜNG + 25 Ô TÔ ĐIỆN / TẦNG ─────────────
  const safeLevels = Array.isArray(levels) ? levels : [];
  const findBasementLevel = (lvlNum) => {
    const targetCode = `B${lvlNum}`;
    const byCode = safeLevels.find((l) => String(l.levelCode || "").toUpperCase() === targetCode);
    if (byCode) return byCode;
    return safeLevels[lvlNum - 1] ?? null;
  };

  for (let level = 2; level <= 3; level++) {
    const y = -level * floorHeight;
    const floorCode = `B${level}`;
    const group = new THREE.Group();
    group.name = `Basement ${floorCode}`;

    buildBasementFloorBase(group, y, level);

    const slotW = 2.6;
    const slotD = 5.0;
    const rowZPositions = [-22, -11, 0, 11, 22];

    const aisleZPositions = [-16.5, -5.5, 5.5, 16.5];
    for (const az of aisleZPositions) {
      for (const ax of [-14, -6, 6, 14]) {
        box(group, 3.0, 0.05, 0.12, ax, y + 0.32, az, yellow);
      }
      for (const ax of [-10, 10]) {
        arrow(group, ax, y + 0.35, az - 1.2, Math.PI / 2, arrowYellowMat, 0.52);
        arrow(group, ax, y + 0.35, az + 1.2, -Math.PI / 2, arrowYellowMat, 0.52);
      }
    }

    for (const sideZ of [-11, 11]) {
      arrow(group, -21, y + 0.35, sideZ, 0, arrowYellowMat, 0.62);
      arrow(group, 21, y + 0.35, sideZ, Math.PI, arrowYellowMat, 0.62);
    }
    for (const cz of [-22, -11, 0, 11, 22]) {
      box(group, 0.14, 0.05, 4.2, 0, y + 0.32, cz, cyanLine);
    }

    const matchedLevel = findBasementLevel(level);
    const levelSlots = matchedLevel?.slots ?? [];
    const slotByCode = new Map();
    levelSlots.forEach((s) => {
      const code = String(s.slotCode || "").toUpperCase();
      if (code) slotByCode.set(code, s);
    });
    const carFallbackSlots = levelSlots.filter((s) => !isEvParkingSlot(s));
    const evFallbackSlots = levelSlots.filter((s) => isEvParkingSlot(s));
    const usedIds = new Set();
    let carSeq = 0;
    let evSeq = 0;

    // ── KHU A (BÊN TRÁI): 25 Ô TÔ THƯỜNG ──
    const carStartX = -14.7;
    let carCount = 0;
    rowZPositions.forEach((sz) => {
      for (let c = 0; c < 5; c++) {
        carCount++;
        const sx = carStartX + c * slotW;
        const defaultId = `${floorCode}-C${String(carCount).padStart(2, "0")}`;
        let apiSlot = slotByCode.get(defaultId);
        if (apiSlot && usedIds.has(apiSlot.slotId)) apiSlot = undefined;
        if (!apiSlot) {
          while (carSeq < carFallbackSlots.length && usedIds.has(carFallbackSlots[carSeq].slotId)) {
            carSeq++;
          }
          if (carSeq < carFallbackSlots.length) {
            apiSlot = carFallbackSlots[carSeq++];
          }
        }
        if (apiSlot) usedIds.add(apiSlot.slotId);

        const displayCode = apiSlot?.slotCode || defaultId;
        const statusKey = String(apiSlot?.status || "AVAILABLE").toUpperCase();
        const slotInfo = {
          slotId: apiSlot?.slotId || defaultId,
          slotCode: displayCode,
          floorCode: apiSlot?.floorCode || matchedLevel?.levelCode || floorCode,
          zoneCode: apiSlot?.zoneCode || "CAR",
          supportedVehicleTypes: apiSlot?.supportedVehicleTypes || ["CAR"],
          features: apiSlot?.features || [],
          vehicleType: "CAR",
          isEvSlot: false,
          id: displayCode,
          slotOrder: carCount,
          floor: floorCode,
          floorIndex: level,
          status: statusKey,
          isSlot: true,
          isParkingSlot: true
        };

        const mesh = box(
          group,
          slotW - 0.14, 0.035, slotD - 0.14,
          sx, y + 0.305, sz,
          mat(getSlotColorHex(slotInfo, false), { transparent: true, opacity: 0.8 }),
          false
        );
        mesh.userData = slotInfo;
        slotMeshes.push(mesh);
        interactables.push(mesh);

        for (const dx of [-slotW / 2 + 0.04, slotW / 2 - 0.04]) {
          box(group, 0.07, 0.05, slotD, sx + dx, y + 0.33, sz, white, false);
        }
        box(group, slotW, 0.05, 0.07, sx, y + 0.33, sz - slotD / 2, white, false);
        box(group, slotW, 0.05, 0.07, sx, y + 0.33, sz + slotD / 2, white, false);

        const lbl = createSlotLabel(displayCode, false);
        lbl.position.set(sx, y + 0.355, sz);
        group.add(lbl);
      }
    });

    // ── KHU B (BÊN PHẢI): 25 Ô TÔ ĐIỆN (EV) ──
    const evStartX = 4.3;
    let evCount = 0;
    rowZPositions.forEach((sz) => {
      for (let c = 0; c < 5; c++) {
        evCount++;
        const sx = evStartX + c * slotW;
        const defaultId = `${floorCode}-EV${String(evCount).padStart(2, "0")}`;
        let apiSlot = slotByCode.get(defaultId);
        if (apiSlot && usedIds.has(apiSlot.slotId)) apiSlot = undefined;
        if (!apiSlot) {
          while (evSeq < evFallbackSlots.length && usedIds.has(evFallbackSlots[evSeq].slotId)) {
            evSeq++;
          }
          if (evSeq < evFallbackSlots.length) {
            apiSlot = evFallbackSlots[evSeq++];
          }
        }
        if (apiSlot) usedIds.add(apiSlot.slotId);

        const displayCode = apiSlot?.slotCode || defaultId;
        const statusKey = String(apiSlot?.status || "AVAILABLE").toUpperCase();
        const slotInfo = {
          slotId: apiSlot?.slotId || defaultId,
          slotCode: displayCode,
          floorCode: apiSlot?.floorCode || matchedLevel?.levelCode || floorCode,
          zoneCode: apiSlot?.zoneCode || "EV",
          supportedVehicleTypes: apiSlot?.supportedVehicleTypes || ["CAR"],
          features: apiSlot?.features?.length ? apiSlot.features : ["EV_CHARGING"],
          vehicleType: "EV",
          isEvSlot: true,
          id: displayCode,
          slotOrder: evCount,
          floor: floorCode,
          floorIndex: level,
          status: statusKey,
          isSlot: true,
          isParkingSlot: true
        };

        const mesh = box(
          group,
          slotW - 0.14, 0.035, slotD - 0.14,
          sx, y + 0.305, sz,
          mat(getSlotColorHex(slotInfo, false), { transparent: true, opacity: 0.82 }),
          false
        );
        mesh.userData = slotInfo;
        slotMeshes.push(mesh);
        interactables.push(mesh);

        for (const dx of [-slotW / 2 + 0.04, slotW / 2 - 0.04]) {
          box(group, 0.08, 0.05, slotD, sx + dx, y + 0.33, sz, cyanLine, false);
        }
        box(group, slotW, 0.05, 0.08, sx, y + 0.33, sz - slotD / 2, cyanLine, false);
        box(group, slotW, 0.05, 0.08, sx, y + 0.33, sz + slotD / 2, cyanLine, false);

        const lbl = createSlotLabel(`⚡${displayCode}`, true);
        lbl.position.set(sx, y + 0.355, sz);
        group.add(lbl);
      }
    });

    const carZoneSprite = makeBillboardSprite(
      [initialEn ? `🚗 REGULAR CAR ZONE (${floorCode} – 25 SPOTS)` : `🚗 KHU Ô TÔ THƯỜNG (${floorCode} – 25 XE)`],
      {
        bgColor: "rgba(22, 101, 52, 0.92)",
        borderColor: "#4ade80",
        textColor: "#ffffff",
        scaleX: 12.5,
        scaleY: 2.8,
        alwaysOnTop: true
      }
    );
    carZoneSprite.position.set(-9.5, y + 3.0, -28.0);
    carZoneSprite.visible = false;
    group.add(carZoneSprite);

    const evZoneSprite = makeBillboardSprite(
      [initialEn ? `⚡ ELECTRIC CAR ZONE (${floorCode} – 25 EV)` : `⚡ KHU Ô TÔ ĐIỆN (${floorCode} – 25 XE)`],
      {
        bgColor: "rgba(3, 105, 161, 0.92)",
        borderColor: "#38bdf8",
        textColor: "#ffffff",
        scaleX: 12.5,
        scaleY: 2.8,
        alwaysOnTop: true
      }
    );
    evZoneSprite.position.set(9.5, y + 3.0, -28.0);
    evZoneSprite.visible = false;
    group.add(evZoneSprite);

    floorZoneSprites.push({
      floorIndex: level,
      floorCode,
      carZoneSprite,
      evZoneSprite,
      sprites: [carZoneSprite, evZoneSprite]
    });

    scene.add(group);
    floors.push(group);
  }

  const dispose = () => {
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Sprite) {
        if (object.geometry) geometries.add(object.geometry);
        const list = Array.isArray(object.material) ? object.material : [object.material];
        list.forEach((m) => {
          if (!m) return;
          materials.add(m);
          if (m.map) textures.add(m.map);
        });
      }
    });
    textures.forEach((t) => t.dispose());
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    scene.clear();
  };

  const updateMotoStats = (stats) => {
    if (!stats) return;
    const isEn = stats.lang === "en";
    const cap = stats.maxCapacity ?? MOTO_CAPACITY;
    const avail = stats.availableMoto ?? cap;
    const curr = stats.currentMoto ?? Math.max(0, cap - avail);
    if (b1SignBoardMeshRef) {
      b1SignBoardMeshRef.userData.id = isEn
        ? "MOTORBIKE PARKING INFO BOARD (B1)"
        : "BẢNG THÔNG TIN BÃI XE MÁY (B1)";
      b1SignBoardMeshRef.userData.availableMoto = avail;
      b1SignBoardMeshRef.userData.maxCapacity = cap;
      b1SignBoardMeshRef.userData.currentMoto = curr;
    }
    if (b1BoardSpriteRef) {
      updateBillboardSprite(
        b1BoardSpriteRef,
        isEn
          ? [
              "🏍️ MOTORBIKE PARKING (BASEMENT B1)",
              `Available slots: ${avail} / ${cap}`
            ]
          : [
              "🏍️ BÃI XE MÁY (TẦNG HẦM B1)",
              `Slots trống: ${avail} / ${cap}`
            ]
      );
    }
    if (motoB1CenterSprite) {
      updateBillboardSprite(
        motoB1CenterSprite,
        isEn
          ? [
              `🏍️ MOTORBIKE PARKING ZONE (B1 – ${cap} BIKES)`,
              `Parked: ${curr} bikes · Available: ${avail} / ${cap} slots`
            ]
          : [
              `🏍️ KHU VỰC ĐỖ XE MÁY (TẦNG B1 – ${cap} XE)`,
              `Đang gửi: ${curr} xe · Trống: ${avail} / ${cap} slots`
            ]
      );
    }
    if (portalSignSpriteRef) {
      updateBillboardSprite(
        portalSignSpriteRef,
        isEn
          ? [
              "🏢 BASEMENT PORTAL (B1 – B2 – B3)",
              "← Exit Up ↑   |   Entry Down ↓ →"
            ]
          : [
              "🏢 CỔNG HẦM CHUNG CƯ (B1 – B2 – B3)",
              "← Lối ra hầm ↑   |   Lối vào hầm ↓ →"
            ]
      );
    }
    if (aptTitleSpriteRef) {
      updateBillboardSprite(aptTitleSpriteRef, [
        isEn ? "🏢 APARTMENT BUILDING (GROUND: Y = 0)" : "🏢 TÒA NHÀ CHUNG CƯ (MẶT ĐẤT: Y = 0)"
      ]);
    }
    rampSprites.forEach(({ upSprite, downSprite, basementLevel }) => {
      const upperVi = basementLevel === 1 ? "Mặt đất" : `B${basementLevel - 1}`;
      const upperEn = basementLevel === 1 ? "Ground" : `B${basementLevel - 1}`;
      const lowerLabel = `B${basementLevel}`;
      updateBillboardSprite(upSprite, [
        isEn ? `Exit / Up ↑ (${lowerLabel} → ${upperEn})` : `Lối ra / lên ↑ (${lowerLabel} → ${upperVi})`
      ]);
      updateBillboardSprite(downSprite, [
        isEn ? `Entry / Down ↓ (${upperEn} → ${lowerLabel})` : `Lối vào / xuống ↓ (${upperVi} → ${lowerLabel})`
      ]);
    });
    floorTagSprites.forEach(({ sprite, basementLevel }) => {
      updateBillboardSprite(sprite, [
        isEn ? `BASEMENT B${basementLevel}` : `TẦNG HẦM B${basementLevel}`
      ]);
    });
    floorZoneSprites.forEach(({ floorCode, carZoneSprite, evZoneSprite }) => {
      updateBillboardSprite(carZoneSprite, [
        isEn ? `🚗 REGULAR CAR ZONE (${floorCode} – 25 SPOTS)` : `🚗 KHU Ô TÔ THƯỜNG (${floorCode} – 25 XE)`
      ]);
      updateBillboardSprite(evZoneSprite, [
        isEn ? `⚡ ELECTRIC CAR ZONE (${floorCode} – 25 EV)` : `⚡ KHU Ô TÔ ĐIỆN (${floorCode} – 25 XE)`
      ]);
    });
  };

  return {
    scene,
    floors,
    floorColumnGroups,
    floorZoneSprites,
    groundPortalGroup,
    apartmentGroup,
    motoB1CenterSprite,
    floorHeight,
    slotMeshes,
    interactables,
    updateMotoStats,
    dispose
  };
}



