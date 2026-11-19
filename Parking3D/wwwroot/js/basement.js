import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ═══════════════════════════════════════════════════════════════════════════
//  1. KHỞI TẠO SCENE, CAMERA, RENDERER & ORBIT CONTROLS
// ═══════════════════════════════════════════════════════════════════════════

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdce9f3);

const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(58, 22, 68);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('viewer').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-7, -5, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.72; // Cho phép quan sát thuận tiện cả 3 tầng hầm dưới mặt đất
controls.update();

// ═══════════════════════════════════════════════════════════════════════════
//  2. HỆ THỐNG ÁNH SÁNG (LIGHTING)
// ═══════════════════════════════════════════════════════════════════════════

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

// Ánh sáng phụ chiếu nhẹ từ phía đối diện để các tầng hầm sâu luôn rõ chi tiết
const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.75);
fillLight.position.set(-50, 20, -45);
scene.add(fillLight);

// ═══════════════════════════════════════════════════════════════════════════
//  3. VẬT LIỆU (MATERIALS) & THÔNG SỐ KÍCH THƯỚC HẦM CHUNG CƯ
// ═══════════════════════════════════════════════════════════════════════════

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...extra });

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

const arrowYellowMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, depthWrite: false });
const arrowInMat = new THREE.MeshBasicMaterial({ color: 0x4ade80, side: THREE.DoubleSide, depthWrite: false });
const arrowOutMat = new THREE.MeshBasicMaterial({ color: 0x60a5fa, side: THREE.DoubleSide, depthWrite: false });

// Bảng màu trạng thái ô đỗ (phân biệt rõ Ô tô thường và Ô tô điện)
const STATUS_COLORS = {
    AVAILABLE_CAR: 0x16a34a, // Ô tô thường trống (Xanh lá)
    AVAILABLE_EV: 0x0284c7,  // Ô tô điện trống (Xanh dương điện)
    OCCUPIED: 0x888e96,      // Đã có xe (Xám)
    MAINTENANCE: 0xeab308,   // Đang bảo trì (Vàng)
    SELECTED: 0xef4444       // Đang chọn (Đỏ)
};

const STATUS_LABELS = {
    AVAILABLE: 'Trống (AVAILABLE)',
    OCCUPIED: 'Đã có xe (OCCUPIED)',
    MAINTENANCE: 'Đang bảo trì (MAINTENANCE)'
};

// Kích thước kết cấu hầm 3 tầng: B1 (-5.2m), B2 (-10.4m), B3 (-15.6m)
const floorHeight = 5.2;
const BW = 52;       // Chiều rộng khu đỗ xe chính theo trục X (-26m đến +26m)
const BD = 60;       // Chiều sâu hầm theo trục Z (-30m đến +30m)
const HBW = BW / 2;  // 26m
const HBD = BD / 2;  // 30m

// Khu vực đường dốc nối tầng bên hông trái (-X) tương tự building.js
const RAMP_INNER_W = 6.5;                         // Hành lang phẳng lưu thông trong khu dốc
const RAMP_WELL_W = 8.5;                          // Bản dốc 2 làn (Lối lên ↑ & Lối xuống ↓)
const RAMP_TOTAL_W = RAMP_INNER_W + RAMP_WELL_W;  // 15m
const X_RAMP_SPLIT = -HBW - RAMP_INNER_W;         // -32.5m
const X_RAMP_OUTER = -HBW - RAMP_TOTAL_W;         // -41.0m
const Z_RAMP_START = -11;                         // Chân dốc (-11m)
const Z_RAMP_END = 11;                            // Đỉnh dốc (+11m)

// Quản lý nhóm tầng & tương tác
const floors = [];              // [B1Group, B2Group, B3Group]
const interactables = [];       // Ô đỗ xe B2/B3 + Bảng thông tin xe máy B1
const carSlotMeshes = [];       // Danh sách riêng các ô đỗ B2/B3 để thống kê động
const floorColumnGroups = [];   // Cột chịu lực mỗi tầng (ẩn khi xem tầng lẻ)
const floorZoneSprites = [];    // Bảng tên khu vực (chỉ hiện khi xem riêng tầng B2/B3)

let currentFloor = 0;           // 0 = Toàn cảnh, 1 = B1, 2 = B2, 3 = B3
let showApartmentInOverview = true;
let selected = null;

// Số liệu bãi xe máy Tầng B1 (Sức chứa 100 xe máy)
const MOTO_CAPACITY = 100;
let motoCurrent = 35;
let b1BoardSprite = null;
let motoB1CenterSprite = null;
let b1SignBoardMesh = null;

// ═══════════════════════════════════════════════════════════════════════════
//  4. HÀM TIỆN ÍCH DỰNG HÌNH 3D (HELPERS)
// ═══════════════════════════════════════════════════════════════════════════

function box(parent, w, h, d, x, y, z, material, castShadow = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
}

/**
 * Tạo nhãn văn bản phẳng nằm trên mặt ô đỗ xe
 */
function createSlotLabel(text, isEV = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 280;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = isEV ? '#e0f2fe' : '#ffffff';
    ctx.font = 'bold 42px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

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

/**
 * Tạo texture cho bảng chữ nổi 3D (Billboard Sprite)
 */
function createBillboardTexture(lines, options = {}) {
    const {
        bgColor = 'rgba(15, 23, 42, 0.92)',
        borderColor = '#38bdf8',
        textColor = '#ffffff',
        subTextColor = '#fde047'
    } = options;

    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 280;
    const ctx = canvas.getContext('2d');

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

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (lines.length === 1) {
        ctx.fillStyle = textColor;
        ctx.font = 'bold 50px Arial';
        ctx.fillText(lines[0], canvas.width / 2, canvas.height / 2, maxTextWidth);
    } else {
        ctx.fillStyle = textColor;
        ctx.font = 'bold 44px Arial';
        ctx.fillText(lines[0], canvas.width / 2, canvas.height / 2 - 44, maxTextWidth);

        ctx.fillStyle = subTextColor;
        ctx.font = 'bold 44px Arial';
        ctx.fillText(lines[1], canvas.width / 2, canvas.height / 2 + 42, maxTextWidth);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

/**
 * Tạo bảng chữ nổi 3D (THREE.Sprite) luôn xoay mặt về phía Camera ở mọi góc nhìn
 */
function createBillboardSprite(lines, options = {}) {
    const {
        scaleX = 12,
        scaleY = 3.6,
        alwaysOnTop = true
    } = options;

    const texture = createBillboardTexture(lines, options);
    const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: !alwaysOnTop,
        depthWrite: false
    });

    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(scaleX, scaleY, 1);
    sprite.userData.billboardOptions = options;
    if (alwaysOnTop) {
        sprite.renderOrder = 999;
    }
    return sprite;
}

/**
 * Cập nhật lại nội dung chữ trên Billboard Sprite động
 */
function updateBillboardSprite(sprite, lines) {
    if (!sprite) return;
    const oldMap = sprite.material.map;
    sprite.material.map = createBillboardTexture(lines, sprite.userData.billboardOptions || {});
    sprite.material.needsUpdate = true;
    if (oldMap) oldMap.dispose();
}

/**
 * Tạo mũi tên 3D chỉ hướng di chuyển trên mặt đường
 * Quy ước yaw: 0 -> hướng -Z, Math.PI -> hướng +Z, Math.PI/2 -> hướng -X, -Math.PI/2 -> hướng +X
 */
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

// ═══════════════════════════════════════════════════════════════════════════
//  5. PHẦN TRÊN MẶT ĐẤT: MẶT ĐẤT CẮT LỚP, CỔNG HẦM & TÒA CHUNG CƯ BÁN TRONG SUỐT
// ═══════════════════════════════════════════════════════════════════════════

const groundPortalGroup = new THREE.Group();
groundPortalGroup.name = 'Ground Portal';
scene.add(groundPortalGroup);

const apartmentGroup = new THREE.Group();
apartmentGroup.name = 'Apartment Above Ground';
scene.add(apartmentGroup);

function buildAboveGroundContext() {
    const wellCenterX = (X_RAMP_SPLIT + X_RAMP_OUTER) / 2; // -36.75m
    const wallH = 1.05;
    const wallT = 0.35;

    // ── A. LỐI DẪN XE VÀO/RA HẦM TẠI MẶT ĐẤT (y = 0) ────────────────────────
    // Đường dẫn phẳng từ đường phố (z = +36) vào đỉnh ram dốc xuống B1 (z = +11)
    const approachLen = 25;
    const approachZ = Z_RAMP_END + approachLen / 2; // +23.5m
    box(groundPortalGroup, RAMP_WELL_W + 0.8, 0.36, approachLen, wellCenterX, 0, approachZ, concrete);
    box(groundPortalGroup, RAMP_WELL_W - 0.1, 0.05, approachLen - 0.2, wellCenterX, 0.2, approachZ, rampRoadMat);

    // Gờ phân làn trắng giữa lối vào hầm (bên phải) và lối ra hầm (bên trái)
    box(groundPortalGroup, 0.18, 0.14, approachLen - 2, wellCenterX, 0.27, approachZ, wallWhite);

    // Lan can 2 bên đường dẫn miệng hầm
    box(groundPortalGroup, wallT, wallH, approachLen, X_RAMP_OUTER, 0.68, approachZ, wallWhite);
    box(groundPortalGroup, wallT, wallH, approachLen, X_RAMP_SPLIT, 0.68, approachZ, wallWhite);

    // Lan can chữ U bao quanh hố ram dốc trên mặt đất (z = -11 và dọc x = -32.5, x = -41)
    const wellLen = Z_RAMP_END - Z_RAMP_START; // 22m
    box(groundPortalGroup, RAMP_WELL_W + wallT, wallH, wallT, wellCenterX, 0.68, Z_RAMP_START, wallWhite);
    box(groundPortalGroup, wallT, wallH, wellLen + wallT, X_RAMP_SPLIT, 0.68, 0, wallWhite);
    box(groundPortalGroup, wallT, wallH, wellLen + wallT, X_RAMP_OUTER, 0.68, 0, wallWhite);

    // Mũi tên chỉ hướng trên đường dẫn mặt đất:
    // - Làn phải (+X trong làn): Lối vào / Xuống hầm ↓ (hướng -Z, yaw = 0)
    // - Làn trái (-X trong làn): Lối ra / Lên mặt đất ↑ (hướng +Z, yaw = Math.PI)
    const xDownLane = wellCenterX + RAMP_WELL_W / 4;
    const xUpLane = wellCenterX - RAMP_WELL_W / 4;
    for (const zPos of [15, 22, 29]) {
        arrow(groundPortalGroup, xDownLane, 0.25, zPos, 0, arrowInMat, 0.8);
        arrow(groundPortalGroup, xUpLane, 0.25, zPos, Math.PI, arrowOutMat, 0.8);
    }

    // Cổng vòm / Mái che miệng hầm chung cư tại z = +13
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

    // Biển chữ nổi 3D trên cổng hầm chung cư
    const portalSign = createBillboardSprite(
        [
            '🏢 CỔNG HẦM CHUNG CƯ (B1 – B2 – B3)',
            '← Lối ra hầm ↑   |   Lối vào hầm ↓ →'
        ],
        {
            bgColor: 'rgba(15, 23, 42, 0.94)',
            borderColor: '#38bdf8',
            textColor: '#ffffff',
            subTextColor: '#7dd3fc',
            scaleX: 13.5,
            scaleY: 3.8,
            alwaysOnTop: true
        }
    );
    portalSign.position.set(wellCenterX, 7.2, 16.5);
    groundPortalGroup.add(portalSign);

    // ── B. MẶT ĐẤT BÁN TRONG SUỐT & KHỐI TÒA CHUNG CƯ PHÍA TRÊN HẦM ─────────
    // Mặt đất bán trong suốt tại y = 0 bao quanh khối chung cư (nhìn xuyên xuống 3 tầng hầm)
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

    // Viền đánh dấu cao độ mặt đất (y = 0) sắc nét
    const groundEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(BW + 13, 0.22, BD + 12)),
        new THREE.LineBasicMaterial({ color: 0x15803d, transparent: true, opacity: 0.55 })
    );
    groundEdges.position.set(0, 0, 0);
    apartmentGroup.add(groundEdges);

    // Khối đế sảnh chung cư (Podium: y = 0.2 .. 4.6)
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

    // Thân tòa nhà chung cư 8 tầng bán trong suốt (y = 4.6 .. 30.2)
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

    // Các đường sàn phân tầng của khối chung cư (tạo cảm giác kiến trúc chung cư nhiều tầng)
    const slabEdgeMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.3 });
    const slabGeom = new THREE.EdgesGeometry(new THREE.BoxGeometry(towerW + 0.4, 0.18, towerD + 0.4));
    for (let i = 1; i <= numAptFloors; i++) {
        const slabLine = new THREE.LineSegments(slabGeom, slabEdgeMat);
        slabLine.position.set(0, towerBaseY + i * aptFloorH, 0);
        apartmentGroup.add(slabLine);
    }

    // Khối kỹ thuật sân thượng
    const roofBox = new THREE.Mesh(new THREE.BoxGeometry(14, 2.4, 12), podiumGlass);
    roofBox.position.set(0, towerBaseY + towerH + 1.2, 0);
    apartmentGroup.add(roofBox);

    const roofEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(14, 2.4, 12)),
        new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.45 })
    );
    roofEdges.position.copy(roofBox.position);
    apartmentGroup.add(roofEdges);

    // Nhãn tòa chung cư phía trên mái
    const aptTitleSprite = createBillboardSprite(
        ['🏢 TÒA NHÀ CHUNG CƯ (MẶT ĐẤT: Y = 0)'],
        {
            bgColor: 'rgba(15, 23, 42, 0.78)',
            borderColor: '#94a3b8',
            textColor: '#f8fafc',
            scaleX: 16,
            scaleY: 3.1,
            alwaysOnTop: false
        }
    );
    aptTitleSprite.position.set(0, towerBaseY + towerH + 5.2, 0);
    apartmentGroup.add(aptTitleSprite);
}

buildAboveGroundContext();

// ═══════════════════════════════════════════════════════════════════════════
//  6. KẾT CẤU SÀN & HỆ THỐNG RAM DỐC NỐI TẦNG HẦM (MẶT ĐẤT ↔ B1 ↔ B2 ↔ B3)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Dựng bản dốc nghiêng 2 làn nối từ tầng hầm hiện tại (yBottom) lên tầng ngay trên nó (yTop):
 * - B1: Mặt đất (0) ↔ B1 (-5.2)
 * - B2: B1 (-5.2) ↔ B2 (-10.4)
 * - B3: B2 (-10.4) ↔ B3 (-15.6)
 */
function buildBasementRampFlight(parentGroup, yBottom, yTop, upperLabel, lowerLabel) {
    const dZ = Z_RAMP_END - Z_RAMP_START;  // 22m
    const dY = yTop - yBottom;             // 5.2m
    const rampLen = Math.hypot(dZ, dY);    // ~22.61m
    const slopeAngle = Math.atan2(dY, dZ); // ~13.3°

    const wellCenterX = (X_RAMP_SPLIT + X_RAMP_OUTER) / 2; // -36.75m
    const midY = (yBottom + yTop) / 2;
    const midZ = (Z_RAMP_START + Z_RAMP_END) / 2;          // 0m

    // Đầu +Z ở cao độ yTop (tầng trên), đầu -Z ở cao độ yBottom (tầng dưới)
    const rampPivot = new THREE.Group();
    rampPivot.position.set(wellCenterX, midY, midZ);
    rampPivot.rotation.x = -slopeAngle;
    parentGroup.add(rampPivot);

    // 1. Bản bê tông & mặt nhựa đường dốc
    box(rampPivot, RAMP_WELL_W, 0.38, rampLen + 0.35, 0, 0, 0, concrete);
    box(rampPivot, RAMP_WELL_W - 0.15, 0.05, rampLen + 0.3, 0, 0.21, 0, rampRoadMat);

    // 2. Hai tường lan can trắng dọc mép bản dốc
    const halfW = RAMP_WELL_W / 2;
    box(rampPivot, 0.35, 1.05, rampLen + 0.45, -halfW, 0.68, 0, wallWhite);
    box(rampPivot, 0.35, 1.05, rampLen + 0.45, +halfW, 0.68, 0, wallWhite);

    // 3. Gờ trắng phân chia 2 làn đi lên & đi xuống
    box(rampPivot, 0.18, 0.12, rampLen - 0.6, 0, 0.26, 0, wallWhite);

    // 4. Mũi tên 3D chỉ hướng trên bản dốc (theo luật đi bên phải)
    // - Làn ngoài (-X): Lối đi lên / Ra hầm ↑ (từ -Z lên +Z, yaw = Math.PI)
    // - Làn trong (+X): Lối đi xuống / Vào hầm ↓ (từ +Z xuống -Z, yaw = 0)
    const xUpLane = -RAMP_WELL_W / 4;
    const xDownLane = +RAMP_WELL_W / 4;
    for (const zLocal of [-6, 0, 6]) {
        arrow(rampPivot, xUpLane, 0.26, zLocal, Math.PI, arrowOutMat, 0.72);
        arrow(rampPivot, xDownLane, 0.26, zLocal, 0, arrowInMat, 0.72);
    }

    // 5. Bảng chữ nổi 3D (Billboard Sprite) chỉ lối lên và lối xuống giống building.js
    const upSprite = createBillboardSprite(
        [`Lối ra / lên ↑ (${lowerLabel} → ${upperLabel})`],
        {
            bgColor: 'rgba(30, 58, 138, 0.92)',
            borderColor: '#60a5fa',
            textColor: '#ffffff',
            scaleX: 9.2,
            scaleY: 2.35,
            alwaysOnTop: true
        }
    );
    upSprite.position.set(wellCenterX + xUpLane, midY + 1.85, midZ + 2.6);
    parentGroup.add(upSprite);

    const downSprite = createBillboardSprite(
        [`Lối vào / xuống ↓ (${upperLabel} → ${lowerLabel})`],
        {
            bgColor: 'rgba(22, 101, 52, 0.92)',
            borderColor: '#4ade80',
            textColor: '#ffffff',
            scaleX: 9.2,
            scaleY: 2.35,
            alwaysOnTop: true
        }
    );
    downSprite.position.set(wellCenterX + xDownLane, midY + 1.85, midZ - 2.6);
    parentGroup.add(downSprite);
}

/**
 * Dựng mặt sàn, tường bao, cột chịu lực, hành lang dốc và lối đi cho từng tầng hầm B1, B2, B3
 */
function buildBasementFloorBase(group, y, basementLevel) {
    const slabH = 0.42;
    const asphaltH = 0.045;
    const wallH = 1.05;
    const wallT = 0.35;
    const wallY = y + 0.68;

    // 1. Sàn khu đỗ xe chính (-26..+26) + dải hành lang phẳng khu dốc (-32.5..-26)
    const mainPlusInnerW = BW + RAMP_INNER_W;
    const mainPlusInnerX = -RAMP_INNER_W / 2;
    box(group, mainPlusInnerW, slabH, BD, mainPlusInnerX, y, 0, concrete);
    box(group, mainPlusInnerW - 0.2, asphaltH, BD - 0.2, mainPlusInnerX, y + 0.23, 0, asphalt);

    // 2. Chiếu nghỉ sau (-30..-11) và chiếu nghỉ trước (+11..+30) của dải dốc ngoài
    const wellCenterX = (X_RAMP_SPLIT + X_RAMP_OUTER) / 2; // -36.75m
    const backLandLen = Z_RAMP_START - (-HBD);             // 19m
    const backLandZ = (-HBD + Z_RAMP_START) / 2;           // -20.5m
    const frontLandLen = HBD - Z_RAMP_END;                 // 19m
    const frontLandZ = (Z_RAMP_END + HBD) / 2;             // +20.5m

    box(group, RAMP_WELL_W, slabH, backLandLen, wellCenterX, y, backLandZ, concrete);
    box(group, RAMP_WELL_W - 0.1, asphaltH, backLandLen - 0.1, wellCenterX, y + 0.23, backLandZ, asphalt);

    box(group, RAMP_WELL_W, slabH, frontLandLen, wellCenterX, y, frontLandZ, concrete);
    box(group, RAMP_WELL_W - 0.1, asphaltH, frontLandLen - 0.1, wellCenterX, y + 0.23, frontLandZ, asphalt);

    // Ở tầng hầm sâu nhất (B3): lót kín nền bê tông dưới gầm bản dốc vì không còn tầng dưới nữa
    if (basementLevel === 3) {
        const midLen = Z_RAMP_END - Z_RAMP_START;
        box(group, RAMP_WELL_W, slabH, midLen, wellCenterX, y, 0, concrete);
        box(group, RAMP_WELL_W - 0.1, asphaltH, midLen, wellCenterX, y + 0.23, 0, asphalt);
        // Gờ trắng phân làn tại chân dốc tầng B3
        box(group, 0.22, 0.28, 7.5, wellCenterX, y + 0.34, Z_RAMP_START - 4.2, wallWhite);
        // Chắn mép trước và mép trong dưới gầm bản dốc tầng B3 để tránh xe đi vào khu thấp trần
        box(group, RAMP_WELL_W + wallT, wallH, wallT, wellCenterX, wallY, Z_RAMP_END, wallWhite);
        box(group, wallT, wallH, midLen + wallT, X_RAMP_SPLIT, wallY, 0, wallWhite);
    }

    // 3. Hệ thống cột trụ chịu lực (ẩn khi xem riêng từng tầng)
    const colGroup = new THREE.Group();
    colGroup.name = `columns-B${basementLevel}`;
    for (const cx of [-HBW + 2, -13, 0, 13, HBW - 2]) {
        for (const cz of [-HBD + 2, HBD - 2]) {
            box(colGroup, 0.75, floorHeight - 0.4, 0.75, cx, y + floorHeight / 2, cz, columnMat);
        }
    }
    group.add(colGroup);
    floorColumnGroups.push(colGroup);

    // 4. Tường bao quanh sàn hầm
    const totalW = BW + RAMP_TOTAL_W; // 67m
    const totalCenterX = (X_RAMP_OUTER + HBW) / 2; // -7.5m

    // Tường sau (-Z), tường trước (+Z), tường phải (+X)
    box(group, totalW + wallT, wallH, wallT, totalCenterX, wallY, -HBD, wallWhite);
    box(group, totalW + wallT, wallH, wallT, totalCenterX, wallY, HBD, wallWhite);
    box(group, wallT, wallH, BD + wallT, HBW, wallY, 0, wallWhite);

    // Tường mép ngoài bên trái (x = X_RAMP_OUTER = -41)
    box(group, wallT, wallH, backLandLen + 0.3, X_RAMP_OUTER, wallY, backLandZ, wallWhite);
    box(group, wallT, wallH, frontLandLen + 0.3, X_RAMP_OUTER, wallY, frontLandZ, wallWhite);
    if (basementLevel === 3) {
        box(group, wallT, wallH, Z_RAMP_END - Z_RAMP_START + 0.3, X_RAMP_OUTER, wallY, 0, wallWhite);
    }

    // 5. Mũi tên điều hướng trên hành lang kết nối ram dốc (-32.5 .. -26) & chiếu nghỉ
    const innerCorrX = (X_RAMP_SPLIT + (-HBW)) / 2; // -29.25m
    // Xe từ chân dốc (z = -20.5) rẽ phải vào bãi hoặc đi dọc hành lang
    arrow(group, wellCenterX + 1.5, y + 0.32, -20.5, -Math.PI / 2, arrowInMat, 0.7);
    arrow(group, innerCorrX, y + 0.32, -20.5, -Math.PI / 2, arrowInMat, 0.65);

    // Hành lang 2 chiều dọc khu dốc (nối chiếu nghỉ sau <-> chiếu nghỉ trước để đi tiếp xuống tầng sâu hoặc lên tầng trên)
    if (basementLevel < 3) {
        for (const zc of [-8, 4, 16]) {
            arrow(group, innerCorrX - 1.2, y + 0.32, zc, Math.PI, arrowInMat, 0.58);  // Chiều đi tiếp xuống hầm dưới (+Z)
            arrow(group, innerCorrX + 1.2, y + 0.32, zc, 0, arrowOutMat, 0.58);       // Chiều quay lên hầm trên (-Z)
        }
        // Mũi tên rẽ trái ở chiếu nghỉ trước (+20.5) để xuống tầng hầm sâu hơn
        arrow(group, wellCenterX + 1.2, y + 0.32, 20.5, Math.PI / 2, arrowInMat, 0.68);
    } else {
        // B3: Chỉ cần mũi tên hướng lên ram dốc để ra khỏi tầng B3
        for (const zc of [-4, 10]) {
            arrow(group, innerCorrX, y + 0.32, zc, 0, arrowOutMat, 0.62);
        }
    }
    // Mũi tên rẽ trái vào làn đi lên ở chiếu nghỉ sau (-16)
    arrow(group, wellCenterX - 1.6, y + 0.32, -16, Math.PI, arrowOutMat, 0.68);

    // Nhãn nhận diện tầng hầm ở mép góc phải trước sàn
    const floorTag = createBillboardSprite(
        [`TẦNG HẦM B${basementLevel}`],
        {
            bgColor: basementLevel === 1 ? 'rgba(15, 118, 110, 0.9)' : 'rgba(30, 58, 138, 0.9)',
            borderColor: '#ffffff',
            textColor: '#ffffff',
            scaleX: 7.2,
            scaleY: 2.0,
            alwaysOnTop: false
        }
    );
    floorTag.position.set(HBW - 2.5, y + 2.5, HBD - 1.5);
    group.add(floorTag);

    // 6. Dựng bản dốc nghiêng nối từ tầng hiện tại lên tầng phía trên
    const upperName = basementLevel === 1 ? 'Mặt đất' : `B${basementLevel - 1}`;
    const lowerName = `B${basementLevel}`;
    buildBasementRampFlight(group, y, y + floorHeight, upperName, lowerName);
}

// ═══════════════════════════════════════════════════════════════════════════
//  7. TẦNG HẦM B1 – BÃI ĐỖ 100 XE MÁY (SÀN TRỐNG + BẢNG THÔNG TIN + CHỮ NỔI)
// ═══════════════════════════════════════════════════════════════════════════
{
    const level = 1;
    const y = -level * floorHeight; // -5.2m
    const group = new THREE.Group();
    group.name = 'Basement B1';

    buildBasementFloorBase(group, y, level);

    // Vẽ đường dẫn điều hướng vào/ra khu vực đỗ xe máy B1
    for (const ax of [-18, -6, 6, 16]) {
        arrow(group, ax, y + 0.32, -20.5, -Math.PI / 2, arrowInMat, 0.65);
        arrow(group, ax, y + 0.32, 20.5, Math.PI / 2, arrowOutMat, 0.65);
    }
    // Vạch khung lớn phân định khu vực đỗ xe máy (để sàn trống bên trong giống Tầng 1 ở building.js)
    const zoneW = 38;
    const zoneD = 30;
    box(group, zoneW, 0.05, 0.16, 2, y + 0.31, -zoneD / 2, yellow);
    box(group, zoneW, 0.05, 0.16, 2, y + 0.31, +zoneD / 2, yellow);
    box(group, 0.16, 0.05, zoneD, 2 - zoneW / 2, y + 0.31, 0, yellow);
    box(group, 0.16, 0.05, zoneD, 2 + zoneW / 2, y + 0.31, 0, yellow);

    // Bảng thông tin điện tử đặt ngay lối vào khu xe máy B1 (click được để xem & chỉnh số xe)
    const boardGroup = new THREE.Group();
    boardGroup.name = 'B1 Moto Info Board';
    boardGroup.position.set(-20.5, y, -12.5);
    group.add(boardGroup);

    box(boardGroup, 4.4, 0.3, 1.3, 0, 0.35, 0, concrete);
    box(boardGroup, 0.2, 2.8, 0.2, -1.5, 1.75, 0, signPoleMat);
    box(boardGroup, 0.2, 2.8, 0.2, 1.5, 1.75, 0, signPoleMat);

    b1SignBoardMesh = box(boardGroup, 4.6, 1.7, 0.35, 0, 3.0, 0, signBoardMat);
    b1SignBoardMesh.userData = {
        id: 'BẢNG THÔNG TIN BÃI XE MÁY (B1)',
        floor: 'B1',
        vehicleTypeLabel: 'Xe máy',
        isMotoInfo: true
    };
    interactables.push(b1SignBoardMesh);

    b1BoardSprite = createBillboardSprite(
        [
            '🏍️ BÃI XE MÁY (TẦNG B1)',
            `Slots trống: ${MOTO_CAPACITY - motoCurrent} / ${MOTO_CAPACITY}`
        ],
        {
            bgColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: '#22c55e',
            textColor: '#ffffff',
            subTextColor: '#4ade80',
            scaleX: 11.5,
            scaleY: 3.5,
            alwaysOnTop: true
        }
    );
    b1BoardSprite.position.set(0, 4.6, 0);
    boardGroup.add(b1BoardSprite);

    // Bảng chữ nổi ở giữa sàn Tầng B1 (chỉ hiện khi chọn xem riêng Tầng B1)
    motoB1CenterSprite = createBillboardSprite(
        [
            '🏍️ KHU VỰC ĐỖ XE MÁY (TẦNG B1 – 100 XE)',
            `Đang gửi: ${motoCurrent} xe · Trống: ${MOTO_CAPACITY - motoCurrent} / ${MOTO_CAPACITY} slots`
        ],
        {
            bgColor: 'rgba(13, 148, 136, 0.94)',
            borderColor: '#ffffff',
            textColor: '#ffffff',
            subTextColor: '#fef08a',
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

// ═══════════════════════════════════════════════════════════════════════════
//  8. TẦNG HẦM B2 & B3 – 25 Ô TÔ THƯỜNG + 25 Ô TÔ ĐIỆN / TẦNG (50 SLOTS/TẦNG)
// ═══════════════════════════════════════════════════════════════════════════

for (let level = 2; level <= 3; level++) {
    const y = -level * floorHeight; // B2: -10.4m, B3: -15.6m
    const floorCode = `B${level}`;
    const group = new THREE.Group();
    group.name = `Basement ${floorCode}`;

    buildBasementFloorBase(group, y, level);

    const slotW = 2.6;
    const slotD = 5.0;
    const rowZPositions = [-22, -11, 0, 11, 22]; // 5 hàng

    // 4 làn đường chạy xe 2 chiều (rộng 6m) xen kẽ giữa 5 hàng đỗ xe
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

    // 2 trục đường vòng hai bên trái (-21m) & phải (+21m) + hành lang phân khu ở giữa (x = 0)
    for (const sideZ of [-11, 11]) {
        arrow(group, -21, y + 0.35, sideZ, 0, arrowYellowMat, 0.62);
        arrow(group, 21, y + 0.35, sideZ, Math.PI, arrowYellowMat, 0.62);
    }
    // Vạch phân cách trung tâm giữa Khu Ô tô thường (bên trái) và Khu Ô tô điện (bên phải)
    for (const cz of [-22, -11, 0, 11, 22]) {
        box(group, 0.14, 0.05, 4.2, 0, y + 0.32, cz, cyanLine);
    }

    // ── KHU A (BÊN TRÁI): 25 Ô TÔ THƯỜNG (5 hàng × 5 cột) ────────────────────
    const carStartX = -14.7; // 5 cột: -14.7, -12.1, -9.5, -6.9, -4.3
    let carCount = 0;

    rowZPositions.forEach((sz) => {
        for (let c = 0; c < 5; c++) {
            carCount++;
            const sx = carStartX + c * slotW;
            const id = `${floorCode}-C${String(carCount).padStart(2, '0')}`;
            const status = 'AVAILABLE';

            const mesh = box(
                group,
                slotW - 0.14, 0.035, slotD - 0.14,
                sx, y + 0.305, sz,
                mat(STATUS_COLORS.AVAILABLE_CAR, { transparent: true, opacity: 0.8 }),
                false
            );

            mesh.userData = {
                id,
                slotOrder: carCount,
                floor: floorCode,
                floorIndex: level,
                vehicleType: 'CAR',
                vehicleTypeLabel: 'Ô tô thường',
                status,
                isSlot: true
            };
            interactables.push(mesh);
            carSlotMeshes.push(mesh);

            // Vạch trắng bao quanh ô tô thường
            for (const dx of [-slotW / 2 + 0.04, slotW / 2 - 0.04]) {
                box(group, 0.07, 0.05, slotD, sx + dx, y + 0.33, sz, white, false);
            }
            box(group, slotW, 0.05, 0.07, sx, y + 0.33, sz - slotD / 2, white, false);
            box(group, slotW, 0.05, 0.07, sx, y + 0.33, sz + slotD / 2, white, false);

            const lbl = createSlotLabel(id, false);
            lbl.position.set(sx, y + 0.355, sz);
            group.add(lbl);
        }
    });

    // ── KHU B (BÊN PHẢI): 25 Ô TÔ ĐIỆN / EV (5 hàng × 5 cột) ─────────────────
    const evStartX = 4.3; // 5 cột: 4.3, 6.9, 9.5, 12.1, 14.7
    let evCount = 0;

    rowZPositions.forEach((sz) => {
        for (let c = 0; c < 5; c++) {
            evCount++;
            const sx = evStartX + c * slotW;
            const id = `${floorCode}-EV${String(evCount).padStart(2, '0')}`;
            const status = 'AVAILABLE';

            const mesh = box(
                group,
                slotW - 0.14, 0.035, slotD - 0.14,
                sx, y + 0.305, sz,
                mat(STATUS_COLORS.AVAILABLE_EV, { transparent: true, opacity: 0.82 }),
                false
            );

            mesh.userData = {
                id,
                slotOrder: evCount,
                floor: floorCode,
                floorIndex: level,
                vehicleType: 'EV',
                vehicleTypeLabel: 'Ô tô điện (EV)',
                status,
                isSlot: true
            };
            interactables.push(mesh);
            carSlotMeshes.push(mesh);

            // Vạch xanh điện (cyan) bao quanh ô tô điện để luôn dễ phân biệt ngay cả khi đã có xe / bảo trì
            for (const dx of [-slotW / 2 + 0.04, slotW / 2 - 0.04]) {
                box(group, 0.08, 0.05, slotD, sx + dx, y + 0.33, sz, cyanLine, false);
            }
            box(group, slotW, 0.05, 0.08, sx, y + 0.33, sz - slotD / 2, cyanLine, false);
            box(group, slotW, 0.05, 0.08, sx, y + 0.33, sz + slotD / 2, cyanLine, false);

            const lbl = createSlotLabel(`⚡${id}`, true);
            lbl.position.set(sx, y + 0.355, sz);
            group.add(lbl);
        }
    });

    // Nhãn khu vực nổi cho B2 & B3 (chỉ hiện khi chọn xem riêng tầng tương ứng)
    const carZoneSprite = createBillboardSprite(
        [`🚗 KHU Ô TÔ THƯỜNG (${floorCode} – 25 XE)`],
        {
            bgColor: 'rgba(22, 101, 52, 0.92)',
            borderColor: '#4ade80',
            textColor: '#ffffff',
            scaleX: 12.5,
            scaleY: 2.8,
            alwaysOnTop: true
        }
    );
    carZoneSprite.position.set(-9.5, y + 3.0, -28.0);
    carZoneSprite.visible = false;
    group.add(carZoneSprite);

    const evZoneSprite = createBillboardSprite(
        [`⚡ KHU Ô TÔ ĐIỆN (${floorCode} – 25 XE)`],
        {
            bgColor: 'rgba(3, 105, 161, 0.92)',
            borderColor: '#38bdf8',
            textColor: '#ffffff',
            scaleX: 12.5,
            scaleY: 2.8,
            alwaysOnTop: true
        }
    );
    evZoneSprite.position.set(9.5, y + 3.0, -28.0);
    evZoneSprite.visible = false;
    group.add(evZoneSprite);

    floorZoneSprites.push({ floorIndex: level, sprites: [carZoneSprite, evZoneSprite] });

    console.log(`Basement ${floorCode}: ${carCount} regular cars + ${evCount} electric cars = ${carCount + evCount} slots`);
    scene.add(group);
    floors.push(group);
}

// ═══════════════════════════════════════════════════════════════════════════
//  9. CẬP NHẬT THỐNG KÊ, MÀU SẮC & XỬ LÝ TƯƠNG TÁC NGƯỜI DÙNG
// ═══════════════════════════════════════════════════════════════════════════

function getSlotBaseColor(userData) {
    if (userData.status === 'OCCUPIED') return STATUS_COLORS.OCCUPIED;
    if (userData.status === 'MAINTENANCE') return STATUS_COLORS.MAINTENANCE;
    return userData.vehicleType === 'EV' ? STATUS_COLORS.AVAILABLE_EV : STATUS_COLORS.AVAILABLE_CAR;
}

function paint(item, highlightSelected = true) {
    if (!item) return;
    if (item.userData.isMotoInfo) {
        item.material.color.setHex(highlightSelected && item === selected ? STATUS_COLORS.SELECTED : 0x0f172a);
        return;
    }
    item.material.color.setHex(
        highlightSelected && item === selected ? STATUS_COLORS.SELECTED : getSlotBaseColor(item.userData)
    );
}

function refreshStatsUI() {
    const motoAvail = MOTO_CAPACITY - motoCurrent;
    const statB1 = document.getElementById('stat-b1');
    if (statB1) {
        statB1.textContent = `🏍️ B1 (Xe máy): Trống ${motoAvail} / ${MOTO_CAPACITY} (Đang gửi: ${motoCurrent} xe)`;
    }

    for (const lvl of [2, 3]) {
        const floorSlots = carSlotMeshes.filter(m => m.userData.floorIndex === lvl);
        const carAvail = floorSlots.filter(m => m.userData.vehicleType === 'CAR' && m.userData.status === 'AVAILABLE').length;
        const evAvail = floorSlots.filter(m => m.userData.vehicleType === 'EV' && m.userData.status === 'AVAILABLE').length;
        const el = document.getElementById(`stat-b${lvl}`);
        if (el) {
            el.textContent = `🚗 B${lvl}: Ô tô trống ${carAvail}/25 · ⚡ Ô tô điện trống ${evAvail}/25`;
        }
    }
}

function refreshMotoSprites() {
    const motoAvail = MOTO_CAPACITY - motoCurrent;
    updateBillboardSprite(b1BoardSprite, [
        '🏍️ BÃI XE MÁY (TẦNG B1)',
        `Slots trống: ${motoAvail} / ${MOTO_CAPACITY}`
    ]);
    updateBillboardSprite(motoB1CenterSprite, [
        '🏍️ KHU VỰC ĐỖ XE MÁY (TẦNG B1 – 100 XE)',
        `Đang gửi: ${motoCurrent} xe · Trống: ${motoAvail} / ${MOTO_CAPACITY} slots`
    ]);
    refreshStatsUI();
}

function renderInfoPanel(item) {
    const data = item.userData;
    document.getElementById('slot-id').textContent = data.id;
    document.getElementById('slot-floor').textContent = `Tầng: ${data.floor}`;
    document.getElementById('slot-type').textContent = `Loại xe: ${data.vehicleTypeLabel}`;

    const carEditor = document.getElementById('car-status-editor');
    const motoEditor = document.getElementById('moto-editor');

    if (data.isMotoInfo) {
        const motoAvail = MOTO_CAPACITY - motoCurrent;
        document.getElementById('slot-status').textContent =
            `Trống: ${motoAvail} / ${MOTO_CAPACITY} slots (Đang gửi: ${motoCurrent} xe)`;
        carEditor.style.display = 'none';
        motoEditor.style.display = 'flex';
    } else {
        document.getElementById('slot-status').textContent =
            `Trạng thái: ${STATUS_LABELS[data.status] || data.status} (Ô số ${data.slotOrder}/25)`;
        document.getElementById('slot-status-select').value = data.status;
        carEditor.style.display = 'flex';
        motoEditor.style.display = 'none';
    }

    document.getElementById('info').style.display = 'block';
}

function clearSelection() {
    if (selected) {
        const old = selected;
        selected = null;
        paint(old, false);
    }
    document.getElementById('info').style.display = 'none';
}

function updateApartmentToggleUI() {
    const btn = document.getElementById('toggle-apartment');
    if (!btn) return;
    btn.disabled = currentFloor !== 0;
    btn.classList.toggle('secondary-active', currentFloor === 0 && showApartmentInOverview);
    btn.textContent = showApartmentInOverview ? '🏢 Chung cư: Đang hiện' : '🏢 Chung cư: Đang ẩn';
}

/**
 * Chuyển đổi góc nhìn theo tầng:
 * - f = 0: Toàn cảnh 3 tầng hầm + mặt đất & khối chung cư bán trong suốt phía trên
 * - f = 1: Chỉ xem Tầng B1 (100 xe máy)
 * - f = 2: Chỉ xem Tầng B2 (25 ô tô + 25 ô tô điện)
 * - f = 3: Chỉ xem Tầng B3 (25 ô tô + 25 ô tô điện)
 */
function showFloor(f) {
    currentFloor = f;
    clearSelection();

    // Bật/tắt các tầng hầm
    floors.forEach((g, i) => {
        g.visible = (f === 0 || f === i + 1);
    });

    // Tự động ẩn mặt đất, cổng hầm & khối chung cư khi xem riêng từng tầng B1/B2/B3
    groundPortalGroup.visible = (f === 0);
    apartmentGroup.visible = (f === 0 && showApartmentInOverview);

    // Chỉ hiện bảng chữ nổi giữa sàn B1 khi xem riêng Tầng B1
    if (motoB1CenterSprite) {
        motoB1CenterSprite.visible = (f === 1);
    }

    // Chỉ hiện nhãn khu vực (Ô tô thường / Ô tô điện) khi xem riêng Tầng B2 hoặc B3
    floorZoneSprites.forEach(({ floorIndex, sprites }) => {
        sprites.forEach(s => { s.visible = (f === floorIndex); });
    });

    // Chỉ hiện cột chịu lực ở chế độ Toàn cảnh
    floorColumnGroups.forEach(cg => {
        cg.visible = (f === 0);
    });

    // Cập nhật nút bấm đang active
    document.querySelectorAll('[data-floor]').forEach(b =>
        b.classList.toggle('active', Number(b.dataset.floor) === f)
    );
    updateApartmentToggleUI();

    // Điều chỉnh góc nhìn Camera mượt mà theo tầng đang chọn
    if (f === 0) {
        controls.target.set(-7, -5, 0);
        camera.position.set(58, 22, 68);
    } else {
        const y = -f * floorHeight;
        controls.target.set(-6, y + 1.5, 0);
        camera.position.set(-6, y + 46, 44);
    }
    controls.update();
}

// Sự kiện nút chọn tầng
document.querySelectorAll('[data-floor]').forEach(b =>
    b.addEventListener('click', () => showFloor(Number(b.dataset.floor)))
);

// Sự kiện bật/tắt tòa nhà chung cư ở chế độ Toàn cảnh
document.getElementById('toggle-apartment').addEventListener('click', () => {
    if (currentFloor !== 0) return;
    showApartmentInOverview = !showApartmentInOverview;
    apartmentGroup.visible = showApartmentInOverview;
    updateApartmentToggleUI();
});

// Raycaster bắt sự kiện click ô đỗ xe B2/B3 hoặc bảng thông tin xe máy B1
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

renderer.domElement.addEventListener('click', e => {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1
    );

    raycaster.setFromCamera(pointer, camera);

    const visibleItems = interactables.filter(s => {
        let p = s.parent;
        while (p) {
            if (!p.visible) return false;
            p = p.parent;
        }
        return true;
    });

    const hit = raycaster.intersectObjects(visibleItems, false)[0];
    if (!hit) return;

    clearSelection();
    selected = hit.object;
    paint(selected, true);
    renderInfoPanel(selected);
});

// Cập nhật trạng thái ô đỗ ô tô / ô tô điện
document.getElementById('save-slot-status').addEventListener('click', () => {
    if (!selected || !selected.userData.isSlot) return;

    const newStatus = document.getElementById('slot-status-select').value;
    selected.userData.status = newStatus;

    // Hiển thị ngay màu trạng thái mới lên mô hình 3D và cập nhật bảng thống kê
    paint(selected, false);
    renderInfoPanel(selected);
    refreshStatsUI();
});

// Cập nhật số lượng xe máy đang gửi ở tầng B1
document.querySelectorAll('[data-moto-delta]').forEach(btn => {
    btn.addEventListener('click', () => {
        const delta = Number(btn.dataset.motoDelta);
        motoCurrent = Math.max(0, Math.min(MOTO_CAPACITY, motoCurrent + delta));
        refreshMotoSprites();
        if (selected && selected.userData.isMotoInfo) {
            renderInfoPanel(selected);
        }
    });
});

// Đóng bảng thông tin
document.getElementById('close-info').addEventListener('click', clearSelection);

// Khởi tạo số liệu ban đầu
refreshStatsUI();
updateApartmentToggleUI();

// Resize cửa sổ trình duyệt
addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

// Vòng lặp render
renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
});
