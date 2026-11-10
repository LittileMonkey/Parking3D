import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ═══════════════════════════════════════════════════════════════════════════
//  1. KHỞI TẠO SCENE, CAMERA, RENDERER & ĐIỀU KHIỂN GÓC NHÌN (ORBIT CONTROLS)
// ═══════════════════════════════════════════════════════════════════════════

// Tạo không gian 3D (Scene) và đặt màu nền xanh nhạt da trời
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdce9f3);

// Thiết lập Camera phối cảnh (PerspectiveCamera)
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(70, 55, 80);

// Khởi tạo bộ dựng hình WebGL (Renderer) có khử răng cưa và đổ bóng
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.getElementById('viewer').appendChild(renderer.domElement);

// Thiết lập điều khiển xoay, thu phóng, kéo chuột (OrbitControls)
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 8, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.02; // Giới hạn không cho camera lật xuống dưới mặt đất
controls.update();

// ═══════════════════════════════════════════════════════════════════════════
//  2. HỆ THỐNG ÁNH SÁNG (LIGHTING)
// ═══════════════════════════════════════════════════════════════════════════

// Ánh sáng bán cầu (HemisphereLight) giúp chiếu sáng đều toàn cảnh
scene.add(new THREE.HemisphereLight(0xffffff, 0x7b8794, 2.2));

// Ánh sáng mặt trời định hướng (DirectionalLight) tạo bóng đổ
const sun = new THREE.DirectionalLight(0xffffff, 2.0);
sun.position.set(30, 60, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -120;
sun.shadow.camera.right = 120;
sun.shadow.camera.top = 120;
sun.shadow.camera.bottom = -120;
scene.add(sun);

// ═══════════════════════════════════════════════════════════════════════════
//  3. VẬT LIỆU (MATERIALS) & CẤU HÌNH THÔNG SỐ TÒA NHÀ
// ═══════════════════════════════════════════════════════════════════════════

// Hàm tiện ích tạo vật liệu tiêu chuẩn (MeshStandardMaterial)
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...extra });

const concrete = mat(0xaab5c0);     // Màu bê tông sàn và tường
const columnMat = mat(0x6f7c89);    // Màu cột trụ chịu lực
const white = mat(0xf8fafc);        // Màu vạch kẻ trắng
const yellow = mat(0xfacc15);       // Màu vạch kẻ vàng
const asphalt = mat(0x48515c);      // Màu mặt đường nhựa
const rampPadMat = mat(0x334155);   // Màu nền khu vực cửa lên/xuống tầng (Ramp)
const stairStepMat = mat(0x64748b); // Màu bậc cầu thang / khối đường dốc nối tầng
const railMat = mat(0xcbd5e1);      // Màu lan can bảo vệ cầu thang
const signBoardMat = mat(0x0f172a); // Màu khung bảng thông tin trước cổng
const signPoleMat = mat(0x475569);  // Màu trụ đỡ bảng thông tin

// Vật liệu dùng cho Bốt bảo vệ (giống hệt file parking.js)
const boothBlue = mat(0x2878b8, { roughness: 0.75 });
const boothDark = mat(0x303942, { roughness: 0.75 });
const boothGlass = new THREE.MeshStandardMaterial({
    color: 0x8dc8e8,
    transparent: true,
    opacity: 0.6,
    metalness: 0.1,
    roughness: 0.15,
    side: THREE.DoubleSide,
    depthWrite: false
});

const arrowMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, depthWrite: false });

// Bảng màu trạng thái của các ô đỗ xe
const STATUS_COLORS = {
    AVAILABLE: 0x16a34a,   // Trống (Xanh lá)
    OCCUPIED: 0x888e96,    // Đã có xe (Xám)
    MAINTENANCE: 0xeab308, // Bảo trì (Vàng)
    SELECTED: 0xef4444     // Đang chọn (Đỏ)
};

// Quản lý danh sách các tầng, các đối tượng tương tác click và nhóm cột trụ
const floors = [];
const interactables = [];          // Danh sách các mesh có thể click (ô đỗ ô tô + bảng thông tin)
const floorColumnGroups = [];      // Nhóm cột của từng tầng (để ẩn khi xem riêng từng tầng)
let selected = null;               // Đối tượng đang được người dùng click chọn
let motoFloor1CenterSprite = null; // Bảng chữ nổi ở giữa Tầng 1 (chỉ hiện khi chọn xem riêng Tầng 1)
let stairStructureGroup = null;    // Nhóm cấu trúc khối mô phỏng cầu thang nối các tầng
const floorHeight = 5.2;           // Chiều cao mỗi tầng (5.2m)

// Kích thước mặt sàn tòa nhà (áp dụng chung cho cả 3 tầng)
const BW = 72;        // Chiều rộng tòa nhà theo trục X (72m)
const BD = 60;        // Chiều sâu tòa nhà theo trục Z (60m)
const HBW = BW / 2;   // Nửa chiều rộng = 36m
const HBD = BD / 2;   // Nửa chiều sâu = 30m

// Thông số số lượng xe máy tại Tầng 1 (Tầng trệt)
const MOTO_CURRENT = 150;                            // Số lượng xe máy hiện đang có trong bãi
const MOTO_CAPACITY = 500;                           // Tổng sức chứa của bãi xe máy
const MOTO_AVAILABLE = MOTO_CAPACITY - MOTO_CURRENT; // Số lượng slots trống (350 chỗ trống)

// Cập nhật hiển thị số lượng xe máy lên giao diện HTML (nếu có phần tử #moto-counter)
const motoCounterEl = document.getElementById('moto-counter');
if (motoCounterEl) {
    motoCounterEl.textContent =
        `🏍️ Bãi xe máy (Tầng 1): Trống ${MOTO_AVAILABLE} / ${MOTO_CAPACITY} slots (Đang gửi: ${MOTO_CURRENT} xe)`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  4. CÁC HÀM TIỆN ÍCH DỰNG HÌNH 3D (HELPERS)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tạo một khối hộp 3D (BoxGeometry) và gắn vào nhóm cha (parent)
 */
function box(parent, w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
}

/**
 * Tạo nhãn văn bản phẳng nằm trên mặt sàn (dùng để đánh mã số cho từng slot ô tô)
 */
function label(text, width = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, 50);

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

/**
 * Tạo bảng chữ nổi 3D (THREE.Sprite - Billboard)
 * Đặc điểm: Luôn tự động hướng mặt chữ về phía Camera ở MỌI góc nhìn 3D (xoay 360 độ đều đọc được).
 */
function createBillboardSprite(lines, options = {}) {
    const {
        bgColor = 'rgba(15, 23, 42, 0.92)',
        borderColor = '#38bdf8',
        textColor = '#ffffff',
        subTextColor = '#fde047',
        scaleX = 12,
        scaleY = 3.8,
        alwaysOnTop = true
    } = options;

    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 280;
    const ctx = canvas.getContext('2d');

    // Vẽ khung nền bo góc
    const pad = 16;
    const r = 30;
    const w = canvas.width - pad * 2;
    const h = canvas.height - pad * 2;
    const maxTextWidth = w - 64; // Giới hạn bề ngang chữ để không bao giờ chạm viền khung

    ctx.fillStyle = bgColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 8;

    ctx.beginPath();
    ctx.roundRect(pad, pad, w, h, r);
    ctx.fill();
    ctx.stroke();

    // Vẽ nội dung chữ (hỗ trợ 1 hoặc 2 dòng chữ)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (lines.length === 1) {
        ctx.fillStyle = textColor;
        ctx.font = 'bold 52px Arial';
        ctx.fillText(lines[0], canvas.width / 2, canvas.height / 2, maxTextWidth);
    } else {
        ctx.fillStyle = textColor;
        ctx.font = 'bold 42px Arial';
        ctx.fillText(lines[0], canvas.width / 2, canvas.height / 2 - 44, maxTextWidth);

        ctx.fillStyle = subTextColor;
        ctx.font = 'bold 46px Arial';
        ctx.fillText(lines[1], canvas.width / 2, canvas.height / 2 + 42, maxTextWidth);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // Sử dụng SpriteMaterial để bảng chữ luôn xoay đối diện với Camera
    const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: !alwaysOnTop, // Tắt depthTest để chữ không bị tường/cột che khuất ở bất kỳ góc xoay nào
        depthWrite: false
    });

    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(scaleX, scaleY, 1);
    if (alwaysOnTop) {
        sprite.renderOrder = 999; // Ưu tiên vẽ lên lớp trên cùng
    }
    return sprite;
}

/**
 * Tạo mũi tên chỉ hướng di chuyển trên mặt đường
 */
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

/**
 * Tạo Bốt bảo vệ (Security Booth) tại Tầng 1
 * Thiết kế, kích thước và màu sắc giống hệt với bốt bảo vệ trong file parking.js
 */
function createSecurityBooth(parent, x, y, z) {
    const booth = new THREE.Group();
    booth.name = 'Security Booth';
    booth.position.set(x, y, z);
    parent.add(booth);

    // Nền bốt bảo vệ
    box(booth, 3.8, 0.2, 3.5, 0, 0.1, 0, concrete);

    // Tường phía sau
    box(booth, 3.2, 2.8, 0.15, 0, 1.6, -1.4, boothBlue);

    // Tường bên trái
    box(booth, 0.15, 2.8, 2.8, -1.6, 1.6, 0, boothBlue);

    // Tường bên phải
    box(booth, 0.15, 2.8, 2.8, 1.6, 1.6, 0, boothBlue);

    // Tường mặt trước (chừa lối cửa ở giữa)
    box(booth, 0.8, 2.8, 0.15, -1.2, 1.6, 1.4, boothBlue);
    box(booth, 0.8, 2.8, 0.15, 1.2, 1.6, 1.4, boothBlue);
    box(booth, 1.6, 0.5, 0.15, 0, 2.75, 1.4, boothBlue);

    // Cửa kính mặt trước
    box(booth, 1.5, 2.25, 0.04, 0, 1.35, 1.48, boothGlass);

    // Cửa sổ kính hai bên hông
    box(booth, 0.04, 1.2, 1.6, -1.7, 1.9, 0, boothGlass);
    box(booth, 0.04, 1.2, 1.6, 1.7, 1.9, 0, boothGlass);

    // Mái phẳng bốt bảo vệ
    box(booth, 4.0, 0.3, 3.7, 0, 3.2, 0, boothDark);

    return booth;
}

/**
 * Dựng kết cấu cơ bản của một tầng:
 * - Mặt sàn bê tông + lớp thảm nhựa
 * - Hệ thống cột chịu lực
 * - Tường chắn bảo vệ xung quanh
 * - Khu vực cổng chờ Lối lên/xuống tầng (Ramp / Driveway) kèm chữ 3D luôn hướng về Camera
 */
function buildFloorBase(group, y, wallGapZ, floorNumber) {
    // 1. Mặt sàn bê tông và lớp nhựa trải sàn
    box(group, BW + 4, 0.45, BD + 4, 0, y, 0, concrete);
    box(group, BW, 0.045, BD, 0, y + 0.25, 0, asphalt);

    // 2. Các cột trụ chịu lực (đặt vào nhóm riêng để tự động ẩn khi xem từng tầng lẻ)
    const colGroup = new THREE.Group();
    colGroup.name = 'columns';
    for (const cx of [-HBW + 2, -HBW / 2, 0, HBW / 2, HBW - 2]) {
        for (const cz of [-HBD + 2, HBD - 2]) {
            // Ở Tầng 1, bỏ cột giữa mặt trước (cx = 0, cz = HBD - 2) để không chắn ngay giữa cổng vào
            if (floorNumber === 1 && cx === 0 && cz === HBD - 2) continue;
            box(colGroup, 0.75, 4.7, 0.75, cx, y + 2.55, cz, columnMat);
        }
    }
    group.add(colGroup);
    floorColumnGroups.push(colGroup);

    // 3. Tường chắn an toàn bao quanh mặt sàn
    const wallY = y + 0.83;
    const wallH = 1.15;
    const wallT = 0.25;

    // Tường phía sau (-Z, liền mạch)
    box(group, BW + 5, wallH, wallT, 0, wallY, -HBD - 2, concrete);
    // Tường bên phải (+X, liền mạch)
    box(group, wallT, wallH, BD + 5, HBW + 2, wallY, 0, concrete);

    // Tường bên trái (-X) có chừa khoảng trống (wallGapZ) làm lối lên/xuống tầng (Ramp / Driveway)
    const g = 4.0; // Nửa độ rộng cổng lên/xuống (tổng rộng 8m)
    const s1 = (wallGapZ - g) - (-HBD - 2);
    if (s1 > 0.1) {
        box(group, wallT, wallH, s1, -HBW - 2, wallY, (-HBD - 2 + wallGapZ - g) / 2, concrete);
    }
    const s2 = (HBD + 2) - (wallGapZ + g);
    if (s2 > 0.1) {
        box(group, wallT, wallH, s2, -HBW - 2, wallY, (wallGapZ + g + HBD + 2) / 2, concrete);
    }

    // Tường phía trước (+Z): Tầng 1 chừa cổng chính rộng 10m ở giữa; Tầng 2 & 3 đóng kín tường trước để an toàn
    if (floorNumber === 1) {
        box(group, HBW - 3, wallH, wallT, -(HBW / 2 + 3.5), wallY, HBD + 2, concrete);
        box(group, HBW - 3, wallH, wallT, (HBW / 2 + 3.5), wallY, HBD + 2, concrete);
    } else {
        box(group, BW + 5, wallH, wallT, 0, wallY, HBD + 2, concrete);
    }

    // 4. Đánh dấu khu vực lối chuyển tầng (Ramp / Driveway) tại vị trí cổng bên trái (-X)
    const rampPadX = -HBW + 1.5;
    box(group, 6.5, 0.05, g * 2 - 0.4, rampPadX, y + 0.29, wallGapZ, rampPadMat);

    // Vạch vàng cảnh báo hai bên mép lối lên/xuống
    box(group, 6.5, 0.06, 0.18, rampPadX, y + 0.31, wallGapZ - g + 0.3, yellow);
    box(group, 6.5, 0.06, 0.18, rampPadX, y + 0.31, wallGapZ + g - 0.3, yellow);

    // Mũi tên chỉ hướng ra/vào lối lên xuống tầng
    arrow(group, rampPadX, y + 0.34, wallGapZ - 1.5, -Math.PI / 2, arrowMat, 0.75);
    arrow(group, rampPadX, y + 0.34, wallGapZ + 1.5, Math.PI / 2, arrowMat, 0.75);

    // 5. Gắn bảng chữ 3D (Sprite luôn hướng về Camera ở mọi góc nhìn) tại lối lên/xuống
    const rampSubtitle = floorNumber === 1
        ? 'Lối lên Tầng 2 ↑'
        : (floorNumber === 2 ? 'Lên Tầng 3 ↑ · Xuống Tầng 1 ↓' : 'Lối xuống Tầng 2 ↓');

    const rampSprite = createBillboardSprite(
        ['Ramp ↑↓ (Driveway)', rampSubtitle],
        {
            bgColor: 'rgba(30, 41, 59, 0.92)',
            borderColor: '#facc15',
            textColor: '#ffffff',
            subTextColor: '#fde047',
            scaleX: 11.5,
            scaleY: 3.6,
            alwaysOnTop: true
        }
    );
    // Đặt bảng chữ nổi phía trên khu vực khối cầu thang / lối lên xuống của tầng
    rampSprite.position.set(-HBW - 6.0, y + 3.0, wallGapZ);
    group.add(rampSprite);
}

/**
 * Xây dựng cấu trúc khối mô phỏng cầu thang / đường dốc nối 3 tầng bên hông trái (-X)
 * Thiết kế dạng cầu thang đổi chiều (U-turn) kết nối liền mạch vào cửa (z = 0) của Tầng 1, 2, 3:
 * - Cụm chiếu nghỉ trung tâm (z từ -4 đến +4) tại cả 3 tầng nối thẳng vào cổng tầng
 * - Phía trước (+Z): Vế lên từ Tầng 1 -> Chiếu nghỉ giữa (+Z) -> Vế lên nối về cửa Tầng 2
 * - Phía sau (-Z): Vế lên từ Tầng 2 -> Chiếu nghỉ giữa (-Z) -> Vế lên nối về cửa Tầng 3
 */
function buildSimulatedStairBlock() {
    const group = new THREE.Group();
    group.name = 'Simulated Staircase Block';

    const laneW = 3.8;                     // Bề rộng mỗi vế thang (3.8m)
    const gapW = 0.4;                      // Khoảng hở khe giữa 2 vế thang (0.4m)
    const totalW = laneW * 2 + gapW;       // Tổng bề rộng khối cầu thang = 8.0m
    const wallEdgeX = -HBW - 2;            // Tọa độ X mép ngoài tường bên trái tòa nhà (-38m)
    const blockCenterX = wallEdgeX - totalW / 2; // Tâm X của toàn khối cầu thang (-42m)

    // Tâm X của vế trong (sát tường tòa nhà) và vế ngoài
    const xInner = wallEdgeX - laneW / 2;            // -39.9m
    const xOuter = wallEdgeX - laneW - gapW - laneW / 2; // -44.1m

    const centerLandD = 8.0;  // Chiều sâu chiếu nghỉ trung tâm tại z = 0 (khớp cổng 8m: từ -4 đến +4)
    const flightLen = 10.0;   // Chiều dài mỗi vế bậc thang theo trục Z (10m)
    const midLandD = 4.2;     // Chiều sâu chiếu nghỉ đổi chiều ở hai đầu (4.2m)

    // 1. Ba sàn chiếu nghỉ trung tâm tại cửa Tầng 1, Tầng 2, Tầng 3 (z = 0)
    for (let f = 1; f <= 3; f++) {
        const y = (f - 1) * floorHeight;

        // Sàn bê tông chiếu nghỉ nối liền vào cổng tầng
        box(group, totalW + 0.4, 0.45, centerLandD, blockCenterX + 0.2, y, 0, concrete);
        box(group, totalW - 0.2, 0.05, centerLandD - 0.2, blockCenterX, y + 0.25, 0, rampPadMat);

        // Lan can bảo vệ mép ngoài (-X) của chiếu nghỉ trung tâm
        box(group, 0.25, 1.15, centerLandD, blockCenterX - totalW / 2 + 0.12, y + 0.83, 0, concrete);
    }

    // 2. Hàm dựng 1 vế bậc thang đặc (Stepped Block) từ (zStart, yStart) đến (zEnd, yEnd)
    function buildSteppedLane(laneX, zStart, zEnd, yStart, yEnd) {
        const N_STEPS = 12;
        const dZ = (zEnd - zStart) / N_STEPS;
        const dY = (yEnd - yStart) / N_STEPS;
        const stepDepth = Math.abs(dZ);

        for (let i = 0; i < N_STEPS; i++) {
            const zC = zStart + (i + 0.5) * dZ;
            const topY = yStart + (i + 1) * dY;
            const botY = yStart + i * dY - 0.35;
            const h = topY - botY;
            const yC = (topY + botY) / 2;

            // Khối bậc thang bê tông
            box(group, laneW - 0.15, h, stepDepth + 0.04, laneX, yC, zC, stairStepMat);
            // Vạch vàng đánh dấu bậc
            box(group, laneW - 0.5, 0.03, 0.1, laneX, topY + 0.015, zC, yellow);

            // Lan can hai bên vế thang
            for (const side of [-1, 1]) {
                box(
                    group,
                    0.16, 0.9, stepDepth + 0.02,
                    laneX + side * (laneW / 2 - 0.08),
                    topY + 0.45,
                    zC,
                    railMat
                );
            }
        }
    }

    // 3. Cụm thang nối TẦNG 1 (y = 0) -> TẦNG 2 (y = floorHeight) ở phía trước (+Z)
    const zEdgePos = centerLandD / 2;               // +4.0m
    const zTurnPos = zEdgePos + flightLen;          // +14.0m
    const midY12 = floorHeight / 2;                 // +2.6m

    // Vế 1A (Vế trong): Đi từ chiếu nghỉ Tầng 1 (+4m, y=0) ra chiếu nghỉ giữa (+14m, y=2.6m)
    buildSteppedLane(xInner, zEdgePos, zTurnPos, 0, midY12);

    // Chiếu nghỉ đổi chiều giữa Tầng 1 & Tầng 2 (tại z = +14m đến +18.2m, cao y = 2.6m)
    const midLandPosZ = zTurnPos + midLandD / 2;
    box(group, totalW, 0.45, midLandD, blockCenterX, midY12 - 0.2, midLandPosZ, concrete);
    box(group, totalW - 0.3, 0.05, midLandD - 0.3, blockCenterX, midY12 + 0.05, midLandPosZ, rampPadMat);
    box(group, 0.25, 1.1, midLandD, blockCenterX - totalW / 2 + 0.12, midY12 + 0.55, midLandPosZ, railMat);
    box(group, 0.25, 1.1, midLandD, blockCenterX + totalW / 2 - 0.12, midY12 + 0.55, midLandPosZ, railMat);
    box(group, totalW, 1.1, 0.25, blockCenterX, midY12 + 0.55, zTurnPos + midLandD - 0.12, railMat);

    // Vế 1B (Vế ngoài): Đi ngược từ chiếu nghỉ giữa (+14m, y=2.6m) về chiếu nghỉ Tầng 2 (+4m, y=5.2m)
    buildSteppedLane(xOuter, zTurnPos, zEdgePos, midY12, floorHeight);

    // 4. Cụm thang nối TẦNG 2 (y = floorHeight) -> TẦNG 3 (y = 2*floorHeight) ở phía sau (-Z)
    const zEdgeNeg = -centerLandD / 2;              // -4.0m
    const zTurnNeg = zEdgeNeg - flightLen;          // -14.0m
    const midY23 = floorHeight * 1.5;               // +7.8m

    // Vế 2A (Vế trong): Đi từ chiếu nghỉ Tầng 2 (-4m, y=5.2m) ra chiếu nghỉ giữa (-14m, y=7.8m)
    buildSteppedLane(xInner, zEdgeNeg, zTurnNeg, floorHeight, midY23);

    // Chiếu nghỉ đổi chiều giữa Tầng 2 & Tầng 3 (tại z = -14m đến -18.2m, cao y = 7.8m)
    const midLandNegZ = zTurnNeg - midLandD / 2;
    box(group, totalW, 0.45, midLandD, blockCenterX, midY23 - 0.2, midLandNegZ, concrete);
    box(group, totalW - 0.3, 0.05, midLandD - 0.3, blockCenterX, midY23 + 0.05, midLandNegZ, rampPadMat);
    box(group, 0.25, 1.1, midLandD, blockCenterX - totalW / 2 + 0.12, midY23 + 0.55, midLandNegZ, railMat);
    box(group, 0.25, 1.1, midLandD, blockCenterX + totalW / 2 - 0.12, midY23 + 0.55, midLandNegZ, railMat);
    box(group, totalW, 1.1, 0.25, blockCenterX, midY23 + 0.55, zTurnNeg - midLandD + 0.12, railMat);

    // Vế 2B (Vế ngoài): Đi ngược từ chiếu nghỉ giữa (-14m, y=7.8m) về chiếu nghỉ Tầng 3 (-4m, y=10.4m)
    buildSteppedLane(xOuter, zTurnNeg, zEdgeNeg, midY23, 2 * floorHeight);

    // 5. Hệ thống cột trụ đỡ khối cầu thang từ mặt đất
    const supportConfigs = [
        { z: -(zTurnPos + midLandD - 0.5), h: midY23 },
        { z: -zEdgePos, h: 2 * floorHeight },
        { z: zEdgePos, h: 2 * floorHeight },
        { z: zTurnPos + midLandD - 0.5, h: midY12 }
    ];
    for (const cfg of supportConfigs) {
        for (const px of [blockCenterX - totalW / 2 + 0.4, blockCenterX + totalW / 2 - 0.4]) {
            box(group, 0.6, cfg.h + 0.4, 0.6, px, cfg.h / 2 - 0.2, cfg.z, columnMat);
        }
    }

    scene.add(group);
    return group;
}

// Khởi tạo khối cầu thang mô phỏng bên hông trái tòa nhà
stairStructureGroup = buildSimulatedStairBlock();

// ═══════════════════════════════════════════════════════════════════════════
//  5. TẦNG 1 (TẦNG TRỆT) – KHU VỰC BÃI ĐỖ XE MÁY + BỐT BẢO VỆ + BẢNG THÔNG TIN
//  Yêu cầu:
//  - Để trống mặt sàn bên trong Tầng 1 (không vẽ các slot lẻ bên trong)
//  - Tạo 1 bảng thông tin đặt ở trước cổng vào, hiển thị số lượng slots trống
//  - Thêm Bốt bảo vệ ngay Tầng 1 (giống với bãi xe 1 tầng trong file parking.js)
//  - Nếu người dùng chọn chỉ xem Tầng 1 (f === 1) thì hiển thị bảng chữ nổi ở giữa sàn
// ═══════════════════════════════════════════════════════════════════════════
{
    const f = 1;
    const y = 0;
    const group = new THREE.Group();
    group.name = 'Floor 1';

    // Xây dựng mặt sàn Tầng 1 (bên trong để trống hoàn toàn) với cổng Ramp ở tường bên trái (z = 0)
    buildFloorBase(group, y, 0, f);

    // ── A. BỐT BẢO VỆ NGAY CỔNG TẦNG 1 (Giống file parking.js) ─────────────
    // Đặt ngay bên trái lối vào cổng chính Tầng 1 (x = -8.5, z = HBD + 5.2)
    createSecurityBooth(group, -8.5, -0.35, HBD + 5.2);

    // ── B. BẢNG THÔNG TIN ĐẶT Ở TRƯỚC CỔNG VÀO TẦNG TRỆT ───────────────────
    // Đặt ngay bên phải lối vào cổng chính (x = 9.5, z = HBD + 5.5), đối xứng với Bốt bảo vệ
    const signX = 9.5;
    const signZ = HBD + 5.5;
    const entranceSignGroup = new THREE.Group();
    entranceSignGroup.name = 'Entrance Info Board';
    entranceSignGroup.position.set(signX, 0, signZ);
    group.add(entranceSignGroup);

    // Chân đế bê tông của bảng thông tin
    box(entranceSignGroup, 4.6, 0.3, 1.4, 0, -0.25, 0, concrete);

    // Hai trụ thép đỡ bảng thông tin
    box(entranceSignGroup, 0.22, 3.2, 0.22, -1.6, 1.4, 0, signPoleMat);
    box(entranceSignGroup, 0.22, 3.2, 0.22, 1.6, 1.4, 0, signPoleMat);

    // Khung hộp bảng điện tử LED phía trên trụ (có thể click để xem chi tiết)
    const signBoardMesh = box(entranceSignGroup, 4.8, 1.8, 0.35, 0, 2.7, 0, signBoardMat);
    signBoardMesh.userData = {
        id: 'BẢNG THÔNG TIN BÃI XE MÁY',
        floor: f,
        isMotoInfo: true,
        currentMoto: MOTO_CURRENT,
        availableMoto: MOTO_AVAILABLE,
        maxCapacity: MOTO_CAPACITY
    };
    interactables.push(signBoardMesh);

    // Hiển thị chữ nổi 3D trên bảng thông tin trước cổng (báo số lượng slots trống)
    const gateSignSprite = createBillboardSprite(
        [
            '🏍️ BÃI XE MÁY (TẦNG TRỆT)',
            `Slots trống: ${MOTO_AVAILABLE} / ${MOTO_CAPACITY}`
        ],
        {
            bgColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: '#22c55e',
            textColor: '#ffffff',
            subTextColor: '#4ade80',
            scaleX: 13.5,
            scaleY: 4.2,
            alwaysOnTop: true
        }
    );
    gateSignSprite.position.set(0, 4.2, 0);
    entranceSignGroup.add(gateSignSprite);

    // ── C. BẢNG CHỮ NỔI Ở GIỮA SÀN TẦNG 1 (CHỈ HIỂN THỊ KHI CHỌN XEM TẦNG 1) ─
    motoFloor1CenterSprite = createBillboardSprite(
        [
            '🏍️ KHU VỰC ĐỖ XE MÁY (TẦNG TRỆT)',
            `Đang có trong bãi: ${MOTO_CURRENT} xe · Trống: ${MOTO_AVAILABLE} slots`
        ],
        {
            bgColor: 'rgba(13, 148, 136, 0.94)',
            borderColor: '#ffffff',
            textColor: '#ffffff',
            subTextColor: '#fef08a',
            scaleX: 19,
            scaleY: 5.4,
            alwaysOnTop: true
        }
    );
    motoFloor1CenterSprite.position.set(0, y + 2.8, 0);
    // Mặc định ẩn khi đang ở chế độ "Toàn cảnh 3 tầng", chỉ bật lên khi bấm nút "Tầng 1"
    motoFloor1CenterSprite.visible = false;
    group.add(motoFloor1CenterSprite);

    scene.add(group);
    floors.push(group);
}

// ═══════════════════════════════════════════════════════════════════════════
//  6. TẦNG 2 & TẦNG 3 – BÃI ĐỖ XE Ô TÔ (100 SLOTS / TẦNG)
//  Yêu cầu:
//  - Phân bố lại các slot hợp lý trên mặt sàn 72m × 60m
//  - Đảm bảo số lượng chính xác 100 slots mỗi tầng (5 hàng × 20 ô = 100 ô)
// ═══════════════════════════════════════════════════════════════════════════
for (let f = 2; f <= 3; f++) {
    const y = (f - 1) * floorHeight;
    const group = new THREE.Group();
    group.name = `Floor ${f}`;

    // Xây dựng mặt sàn Tầng 2 & 3 với cổng Ramp nằm ở giữa tường bên trái (z = 0)
    buildFloorBase(group, y, 0, f);

    // Kích thước tiêu chuẩn của 1 ô đỗ ô tô: rộng 2.5m × sâu 5.0m
    const slotW = 2.5;
    const slotD = 5.0;

    // Cấu hình 5 hàng (A, B, C, D, E) × 20 cột = đúng 100 ô đỗ mỗi tầng
    const rowCodes = ['A', 'B', 'C', 'D', 'E'];
    const rowZPositions = [-22, -11, 0, 11, 22]; // Phân bố đều 5 hàng theo chiều sâu Z (-30m đến +30m)
    const N_COL = 20;                            // 20 ô mỗi hàng (tổng rộng 50m, chừa 11m lối đi mỗi bên trái/phải)
    const startX = -((N_COL - 1) * slotW) / 2;   // Tọa độ X của ô đầu tiên (-23.75m)

    // Vẽ 4 làn đường chạy xe (rộng 6m) nằm xen kẽ giữa 5 hàng đỗ xe
    const aisleZPositions = [-16.5, -5.5, 5.5, 16.5];
    for (const az of aisleZPositions) {
        // Vạch vàng nét đứt phân làn ở tim đường
        for (const ax of [-20, -10, 0, 10, 20]) {
            box(group, 3.2, 0.05, 0.12, ax, y + 0.33, az, yellow);
        }
        // Mũi tên chỉ hướng lưu thông 2 chiều trên mỗi làn đường
        for (const ax of [-16, 0, 16]) {
            arrow(group, ax, y + 0.36, az - 1.2, Math.PI / 2, arrowMat, 0.55);
            arrow(group, ax, y + 0.36, az + 1.2, -Math.PI / 2, arrowMat, 0.55);
        }
    }

    // Mũi tên dẫn hướng trên 2 trục đường chính dọc hai đầu trái (-X) và phải (+X)
    for (const sideZ of [-11, 11]) {
        arrow(group, -29.5, y + 0.36, sideZ, 0, arrowMat, 0.65);
        arrow(group, 29.5, y + 0.36, sideZ, Math.PI, arrowMat, 0.65);
    }

    // Tạo 100 ô đỗ xe ô tô (5 hàng × 20 cột)
    let floorSlotCount = 0;
    rowZPositions.forEach((sz, rowIndex) => {
        const rowCode = rowCodes[rowIndex];

        for (let c = 0; c < N_COL; c++) {
            const sx = startX + c * slotW;
            floorSlotCount++;

            // Mã ô đỗ: Ví dụ F2-A01 .. F2-E20 (tổng cộng đúng 100 ô từ 001 đến 100)
            const slotNumberInRow = String(c + 1).padStart(2, '0');
            const id = `F${f}-${rowCode}${slotNumberInRow}`;
            const status = 'AVAILABLE';

            // Mặt nền của ô đỗ xe
            const mesh = box(
                group,
                slotW - 0.12, 0.035, slotD - 0.12,
                sx, y + 0.305, sz,
                mat(STATUS_COLORS[status], { transparent: true, opacity: 0.78 })
            );

            // Lưu dữ liệu thông tin vào userData để truy xuất khi click
            mesh.userData = {
                id,
                slotOrder: floorSlotCount,
                floor: f,
                status,
                isSlot: true
            };
            interactables.push(mesh);

            // Vạch trắng phân cách hai bên trái/phải của từng ô
            for (const dx of [-slotW / 2 + 0.04, slotW / 2 - 0.04]) {
                box(group, 0.07, 0.05, slotD, sx + dx, y + 0.34, sz, white);
            }

            // Vạch trắng chặn đầu và cuối ô đỗ
            box(group, slotW, 0.05, 0.07, sx, y + 0.34, sz - slotD / 2, white);
            box(group, slotW, 0.05, 0.07, sx, y + 0.34, sz + slotD / 2, white);

            // Nhãn hiển thị mã số ô đỗ trên mặt sàn
            const lbl = label(id);
            lbl.position.set(sx, y + 0.36, sz);
            group.add(lbl);
        }
    });

    console.log(`Floor ${f} total car slots:`, floorSlotCount); // Kiểm tra: đúng 100 slots/tầng
    scene.add(group);
    floors.push(group);
}

// ═══════════════════════════════════════════════════════════════════════════
//  7. MẶT ĐẤT BÊN NGOÀI & ĐƯỜNG DẪN VÀO CỔNG TẦNG TRỆT
//  (Đã xóa mũi tên chỉ đường màu trắng phía trước bãi xe theo yêu cầu)
// ═══════════════════════════════════════════════════════════════════════════

// Thảm cỏ / mặt đất bao quanh tòa nhà
box(scene, 180, 0.35, 150, 0, -0.55, 0, mat(0x7e9b81));

// Đoạn đường nhựa dẫn vào cổng chính ở mặt trước (+Z) của Tầng 1 (không vẽ mũi tên)
// box(scene, 10, 0.06, 14, 0, -0.30, HBD + 9, asphalt);

// ═══════════════════════════════════════════════════════════════════════════
//  8. XỬ LÝ TƯƠNG TÁC NGƯỜI DÙNG (CHỌN Ô, ĐỔI TẦNG, RESIZE)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cập nhật lại màu sắc của ô đỗ hoặc bảng thông tin khi được chọn / bỏ chọn
 */
function paint(item) {
    if (!item) return;
    if (item.userData.isMotoInfo) {
        item.material.color.setHex(item === selected ? STATUS_COLORS.SELECTED : 0x0f172a);
        return;
    }
    item.material.color.setHex(
        item === selected ? STATUS_COLORS.SELECTED : STATUS_COLORS[item.userData.status]
    );
}

/**
 * Hủy chọn đối tượng hiện tại và ẩn bảng thông tin
 */
function clearSelection() {
    if (selected) {
        const old = selected;
        selected = null;
        paint(old);
    }
    document.getElementById('info').style.display = 'none';
}

/**
 * Chuyển đổi chế độ hiển thị theo tầng:
 * - f = 0: Hiển thị toàn cảnh cả 3 tầng + khối cầu thang nối tầng (ẩn bảng chữ nổi ở giữa Tầng 1)
 * - f = 1: Chỉ xem Tầng 1 -> Hiển thị bảng chữ nổi ở giữa Tầng 1
 * - f = 2, 3: Chỉ hiển thị tầng ô tô tương ứng và ẩn các cột trụ để dễ quan sát
 */
function showFloor(f) {
    clearSelection();

    // Bật/tắt hiển thị từng tầng
    floors.forEach((g, i) => {
        g.visible = (f === 0 || f === i + 1);
    });

    // Hiển thị khối cầu thang nối tầng khi xem toàn cảnh 3 tầng
    if (stairStructureGroup) {
        stairStructureGroup.visible = (f === 0);
    }

    // Chỉ hiện bảng chữ nổi giữa sàn Tầng 1 khi người dùng chọn chỉ xem riêng Tầng 1 (f === 1)
    if (motoFloor1CenterSprite) {
        motoFloor1CenterSprite.visible = (f === 1);
    }

    // Chỉ hiện cột trụ khi xem toàn cảnh 3 tầng (ẩn đi khi xem từng tầng lẻ)
    floorColumnGroups.forEach((cg) => {
        cg.visible = (f === 0);
    });

    // Cập nhật trạng thái nút bấm đang active trên giao diện
    document.querySelectorAll('[data-floor]').forEach(b =>
        b.classList.toggle('active', Number(b.dataset.floor) === f)
    );

    // Di chuyển góc nhìn Camera phù hợp với tầng đang chọn
    const targetY = f === 0 ? 9 : (f - 1) * floorHeight + 1.5;
    controls.target.set(0, targetY, 0);
    camera.position.set(
        f === 0 ? 70 : 0,
        f === 0 ? 55 : (f - 1) * floorHeight + 48,
        f === 0 ? 80 : 48
    );
    controls.update();
}

// Gắn sự kiện click cho các nút chuyển tầng
document.querySelectorAll('[data-floor]').forEach(b =>
    b.addEventListener('click', () => showFloor(Number(b.dataset.floor)))
);

// Sử dụng Raycaster để bắt sự kiện click chuột vào ô đỗ ô tô hoặc bảng thông tin
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

renderer.domElement.addEventListener('click', e => {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1
    );

    raycaster.setFromCamera(pointer, camera);

    // Chỉ kiểm tra va chạm tia với các đối tượng thuộc tầng đang hiển thị
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
    paint(selected);

    const data = selected.userData;
    document.getElementById('slot-id').textContent = data.id;
    document.getElementById('slot-floor').textContent = `Tầng: ${data.floor}`;

    if (data.isMotoInfo) {
        document.getElementById('slot-status').textContent =
            `Slots trống: ${data.availableMoto} / ${data.maxCapacity} (Đang gửi: ${data.currentMoto} xe)`;
    } else {
        document.getElementById('slot-status').textContent =
            `Trạng thái: ${data.status} (Ô số ${data.slotOrder}/100)`;
    }
    document.getElementById('info').style.display = 'block';
});

// Nút đóng bảng thông tin chi tiết
document.getElementById('close-info').addEventListener('click', clearSelection);

// Tự động cập nhật tỷ lệ khung hình khi thay đổi kích thước cửa sổ trình duyệt
addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

// Vòng lặp dựng hình (Render Loop)
renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
});
