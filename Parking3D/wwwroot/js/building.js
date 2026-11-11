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
controls.target.set(-5, 8, 0);
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

const concrete = mat(0xaab5c0);     // Màu bê tông sàn
const columnMat = mat(0x6f7c89);    // Màu cột trụ chịu lực
const white = mat(0xf8fafc);        // Màu vạch kẻ trắng & tường lan can trắng theo mẫu
const wallWhite = mat(0xeef2f6, { roughness: 0.65 }); // Màu tường chắn màu trắng sáng giống hình mẫu
const yellow = mat(0xfacc15);       // Màu vạch kẻ vàng
const asphalt = mat(0x48515c);      // Màu mặt đường nhựa
const rampRoadMat = mat(0x434c56);  // Màu mặt đường dốc lên/xuống
const signBoardMat = mat(0x0f172a); // Màu khung bảng thông tin trước cổng
const signPoleMat = mat(0x475569);  // Màu trụ đỡ bảng thông tin
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
const floorHeight = 5.2;           // Chiều cao mỗi tầng (5.2m)

// Kích thước khu vực đỗ xe chính (áp dụng chung cho cả 3 tầng)
const BW = 72;        // Chiều rộng khu đỗ xe chính theo trục X (72m: từ -36 đến +36)
const BD = 60;        // Chiều sâu tòa nhà theo trục Z (60m: từ -30 đến +30)
const HBW = BW / 2;   // Nửa chiều rộng = 36m
const HBD = BD / 2;   // Nửa chiều sâu = 30m

// Kích thước khu vực Đường dốc lên/xuống (Ramp Wing) bên hông trái (-X) theo đúng hình mẫu:
// - Gồm hành lang dẫn bên trong (rộng 6.5m) + Ô giếng trời chứa dốc nghiêng bên ngoài (rộng 8.5m)
const RAMP_INNER_W = 6.5;                           // Bề rộng hành lang phẳng bên trong khu dốc
const RAMP_WELL_W = 8.5;                            // Bề rộng bản dốc (chia 2 làn: Lối lên & Lối xuống)
const RAMP_TOTAL_W = RAMP_INNER_W + RAMP_WELL_W;    // Tổng bề rộng khối đường dốc = 15m
const X_RAMP_SPLIT = -HBW - RAMP_INNER_W;           // Tọa độ X ngăn cách hành lang trong và bản dốc (-42.5m)
const X_RAMP_OUTER = -HBW - RAMP_TOTAL_W;           // Tọa độ X mép ngoài cùng bên trái (-51.0m)
const Z_RAMP_START = -11;                           // Tọa độ Z chân dốc (-11m)
const Z_RAMP_END = 11;                              // Tọa độ Z đỉnh dốc (+11m)

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
        ctx.font = 'bold 44px Arial';
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
 * Dựng kết cấu mặt sàn + Khu vực đường dốc nghiêng (Sloped Ramp Wing) đúng theo hình mẫu:
 * - Mặt sàn khu đỗ xe chính (X từ -36 đến +36)
 * - Khu vực đường dốc bên trái (X từ -36 đến -51):
 *   + Dải hành lang trong (X từ -36 đến -42.5): Phẳng suốt từ sau ra trước để xe lưu thông vòng quanh ô giếng trời
 *   + Dải bản dốc ngoài (X từ -42.5 đến -51):
 *     * Đoạn sau (Z từ -30 đến -11): Sàn chiếu nghỉ phẳng chân dốc
 *     * Đoạn giữa (Z từ -11 đến +11): Ở Tầng 1 & 2 có bản dốc nghiêng đi lên tầng trên; ở Tầng 2 & 3 khoét lỗ thông tầng (Cutout Well)
 *       kèm tường lan can trắng chữ U bao quanh lỗ thông tầng giống hệt ảnh mẫu
 *     * Đoạn trước (Z từ +11 đến +30): Sàn chiếu nghỉ phẳng đỉnh dốc
 *   + Lan can trắng bên ngoài chạy ngang ở chiếu nghỉ sau -> uốn nghiêng dọc theo bản dốc -> chạy ngang ở chiếu nghỉ trước tầng trên
 */
function buildFloorBase(group, y, floorNumber) {
    const slabH = 0.42;
    const asphaltH = 0.045;
    const wallH = 1.05;
    const wallT = 0.35;
    const wallY = y + 0.68;

    // ── 1. MẶT SÀN KHU ĐỖ XE CHÍNH + HÀNH LANG TRONG CỦA KHU DỐC ─────────────
    // Sàn liền khối cho khu đỗ xe chính (-36..+36) và dải hành lang trong (-42.5..-36)
    const mainPlusInnerW = BW + RAMP_INNER_W;
    const mainPlusInnerX = -RAMP_INNER_W / 2;
    box(group, mainPlusInnerW, slabH, BD, mainPlusInnerX, y, 0, concrete);
    box(group, mainPlusInnerW - 0.2, asphaltH, BD - 0.2, mainPlusInnerX, y + 0.23, 0, asphalt);

    // ── 2. SÀN CHIẾU NGHỈ SAU (-30..-11) & CHIẾU NGHỈ TRƯỚC (+11..+30) CỦA DẢI DỐC NGOÀI ──
    const wellCenterX = (X_RAMP_SPLIT + X_RAMP_OUTER) / 2; // -46.75m
    const backLandLen = Z_RAMP_START - (-HBD);             // 19m (từ -30 đến -11)
    const backLandZ = (-HBD + Z_RAMP_START) / 2;           // -20.5m
    const frontLandLen = HBD - Z_RAMP_END;                 // 19m (từ +11 đến +30)
    const frontLandZ = (Z_RAMP_END + HBD) / 2;             // +20.5m

    // Chiếu nghỉ phẳng phía sau (-Z)
    box(group, RAMP_WELL_W, slabH, backLandLen, wellCenterX, y, backLandZ, concrete);
    box(group, RAMP_WELL_W - 0.1, asphaltH, backLandLen - 0.1, wellCenterX, y + 0.23, backLandZ, asphalt);

    // Chiếu nghỉ phẳng phía trước (+Z)
    box(group, RAMP_WELL_W, slabH, frontLandLen, wellCenterX, y, frontLandZ, concrete);
    box(group, RAMP_WELL_W - 0.1, asphaltH, frontLandLen - 0.1, wellCenterX, y + 0.23, frontLandZ, asphalt);

    // Ở Tầng 1, lót thêm nền đất dưới gầm bản dốc (-11..+11) để mặt đất tầng trệt liền lạc
    if (floorNumber === 1) {
        const midLen = Z_RAMP_END - Z_RAMP_START;
        box(group, RAMP_WELL_W, slabH, midLen, wellCenterX, y, 0, concrete);
        box(group, RAMP_WELL_W - 0.1, asphaltH, midLen, wellCenterX, y + 0.23, 0, asphalt);

        // Vạch gờ trắng phân tách 2 làn ở chân dốc tầng trệt (giống hình mẫu)
        box(group, 0.25, 0.32, 8.0, wellCenterX, y + 0.35, Z_RAMP_END + 4.5, wallWhite);
    }

    // ── 3. HỆ THỐNG CỘT TRỤ CHỊU LỰC TRONG KHU ĐỖ XE CHÍNH ──────────────────
    const colGroup = new THREE.Group();
    colGroup.name = 'columns';
    for (const cx of [-HBW + 2, -HBW / 2, 0, HBW / 2, HBW - 2]) {
        for (const cz of [-HBD + 2, HBD - 2]) {
            if (floorNumber === 1 && cx === 0 && cz === HBD - 2) continue;
            box(colGroup, 0.75, floorHeight - 0.4, 0.75, cx, y + floorHeight / 2, cz, columnMat);
        }
    }
    group.add(colGroup);
    floorColumnGroups.push(colGroup);

    // ── 4. TƯỜNG LAN CAN TRẮNG BAO QUANH SÀN & Ô GIẾNG TRỜI (THEO HÌNH MẪU) ─
    const totalW = BW + RAMP_TOTAL_W;         // 87m (từ -51 đến +36)
    const totalCenterX = (X_RAMP_OUTER + HBW) / 2; // -7.5m

    // Tường phía sau (-Z, chạy liền suốt từ -51 đến +36)
    box(group, totalW + wallT, wallH, wallT, totalCenterX, wallY, -HBD, wallWhite);

    // Tường bên phải (+X, chạy liền suốt từ -30 đến +30)
    box(group, wallT, wallH, BD + wallT, HBW, wallY, 0, wallWhite);

    // Tường phía trước (+Z): Tầng 1 chừa cổng chính rộng 10m tại x = 0; Tầng 2 & 3 đóng kín
    if (floorNumber === 1) {
        // Đoạn trước bên trái cổng (từ X_RAMP_OUTER = -51 đến -5)
        const leftFrontLen = -5 - X_RAMP_OUTER;
        box(group, leftFrontLen, wallH, wallT, (X_RAMP_OUTER - 5) / 2, wallY, HBD, wallWhite);
        // Đoạn trước bên phải cổng (từ +5 đến HBW = +36)
        const rightFrontLen = HBW - 5;
        box(group, rightFrontLen, wallH, wallT, (5 + HBW) / 2, wallY, HBD, wallWhite);
    } else {
        box(group, totalW + wallT, wallH, wallT, totalCenterX, wallY, HBD, wallWhite);
    }

    // Tường mép ngoài bên trái (x = X_RAMP_OUTER = -51):
    // - Đoạn sau (-30 đến -11): Luôn nằm ngang ở cả 3 tầng
    box(group, wallT, wallH, backLandLen + 0.3, X_RAMP_OUTER, wallY, backLandZ, wallWhite);

    // - Đoạn trước (+11 đến +30): Ở Tầng 1 là lan can tầng trệt, ở Tầng 2 & 3 nối tiếp đỉnh dốc đi lên từ tầng dưới
    box(group, wallT, wallH, frontLandLen + 0.3, X_RAMP_OUTER, wallY, frontLandZ, wallWhite);

    // Tường lan can chữ U bao quanh lỗ thông tầng (Cutout Well) ở Tầng 2 & Tầng 3 (giống hệt tầng trên cùng trong ảnh mẫu)
    if (floorNumber >= 2) {
        // Cạnh ngang chắn mép sau lỗ thông tầng (tại z = Z_RAMP_START = -11, từ X_RAMP_OUTER đến X_RAMP_SPLIT)
        box(group, RAMP_WELL_W + wallT, wallH, wallT, wellCenterX, wallY, Z_RAMP_START, wallWhite);

        // Cạnh dọc chắn mép trong lỗ thông tầng (tại x = X_RAMP_SPLIT = -42.5, từ -11 đến +11)
        const wellLen = Z_RAMP_END - Z_RAMP_START;
        box(group, wallT, wallH, wellLen + wallT, X_RAMP_SPLIT, wallY, 0, wallWhite);
    }

    // ── 5. DỰNG BẢN DỐC NGHIÊNG NỐI LÊN TẦNG TRÊN (CHO TẦNG 1->2 VÀ TẦNG 2->3) ─
    if (floorNumber <= 2) {
        buildInclinedRampFlight(group, y, y + floorHeight, floorNumber);
    }
}

/**
 * Dựng Bản dốc nghiêng (Inclined Ramp Flight) nối từ tầng hiện tại (y0) lên tầng kế tiếp (y1):
 * - Nghiêng từ (z = Z_RAMP_START = -11, y = y0) lên đến (z = Z_RAMP_END = +11, y = y1)
 * - Có 2 tường lan can trắng chạy dọc hai mép bản dốc khớp liền mạch với lan can ngang của 2 tầng
 * - Chia làm 2 làn xe rõ ràng: 1 bên Lối đi lên ↑ và 1 bên Lối đi xuống ↓ kèm chữ 3D
 */
function buildInclinedRampFlight(parentGroup, y0, y1, fromFloor) {
    const dZ = Z_RAMP_END - Z_RAMP_START;      // Chiều dài hình chiếu bằng = 22m
    const dY = y1 - y0;                        // Chiều cao nâng tầng = 5.2m
    const rampLen = Math.hypot(dZ, dY);        // Chiều dài thực của bản dốc (~22.61m)
    const slopeAngle = Math.atan2(dY, dZ);     // Góc nghiêng của dốc (~13.3 độ)

    const wellCenterX = (X_RAMP_SPLIT + X_RAMP_OUTER) / 2; // -46.75m
    const midY = (y0 + y1) / 2;
    const midZ = (Z_RAMP_START + Z_RAMP_END) / 2;          // 0m

    // Nhóm nghiêng theo góc dốc (-slopeAngle để đầu +Z cao hơn đầu -Z)
    const rampPivot = new THREE.Group();
    rampPivot.position.set(wellCenterX, midY, midZ);
    rampPivot.rotation.x = -slopeAngle;
    parentGroup.add(rampPivot);

    // 1. Bản sàn bê tông nghiêng và mặt nhựa đường dốc
    box(rampPivot, RAMP_WELL_W, 0.38, rampLen + 0.35, 0, 0, 0, concrete);
    box(rampPivot, RAMP_WELL_W - 0.15, 0.05, rampLen + 0.3, 0, 0.21, 0, rampRoadMat);

    // 2. Hai dải tường lan can trắng nghiêng dọc theo hai bên mép dốc (khớp liền với lan can ngang 2 đầu)
    const halfW = RAMP_WELL_W / 2;
    box(rampPivot, 0.35, 1.05, rampLen + 0.45, -halfW, 0.68, 0, wallWhite); // Lan can mép ngoài (-X)
    box(rampPivot, 0.35, 1.05, rampLen + 0.45, +halfW, 0.68, 0, wallWhite); // Lan can mép trong (+X)

    // 3. Gờ phân làn màu trắng ở chính giữa bản dốc (chia đôi Làn đi lên và Làn đi xuống)
    box(rampPivot, 0.18, 0.12, rampLen - 0.6, 0, 0.26, 0, wallWhite);

    // 4. Mũi tên 3D chỉ hướng trên mặt dốc:
    // - Làn bên ngoài (xLocal = -RAMP_WELL_W / 4): LỐI ĐI LÊN ↑ (hướng về +Z, yaw = Math.PI)
    // - Làn bên trong (xLocal = +RAMP_WELL_W / 4): LỐI ĐI XUỐNG ↓ (hướng về -Z, yaw = 0)
    const xUpLane = -RAMP_WELL_W / 4;
    const xDownLane = +RAMP_WELL_W / 4;
    for (const zLocal of [-6, 0, 6]) {
        arrow(rampPivot, xUpLane, 0.26, zLocal, Math.PI, arrowMat, 0.72);
        arrow(rampPivot, xDownLane, 0.26, zLocal, 0, arrowMat, 0.72);
    }

    // 5. Bảng chữ nổi 3D (THREE.Sprite luôn hướng về Camera) hiển thị "Lối đi lên" và "Lối đi xuống"
    const toFloor = fromFloor + 1;
    const upSprite = createBillboardSprite(
        [`Lối đi lên ↑ (Tầng ${fromFloor} → ${toFloor})`],
        {
            bgColor: 'rgba(22, 101, 52, 0.92)',
            borderColor: '#4ade80',
            textColor: '#ffffff',
            scaleX: 9.5,
            scaleY: 2.5,
            alwaysOnTop: true
        }
    );
    upSprite.position.set(wellCenterX + xUpLane, midY + 1.9, midZ - 2.5);
    parentGroup.add(upSprite);

    const downSprite = createBillboardSprite(
        [`Lối đi xuống ↓ (Tầng ${toFloor} → ${fromFloor})`],
        {
            bgColor: 'rgba(30, 58, 138, 0.92)',
            borderColor: '#60a5fa',
            textColor: '#ffffff',
            scaleX: 9.5,
            scaleY: 2.5,
            alwaysOnTop: true
        }
    );
    downSprite.position.set(wellCenterX + xDownLane, midY + 1.9, midZ + 2.5);
    parentGroup.add(downSprite);
}

// ═══════════════════════════════════════════════════════════════════════════
//  5. TẦNG 1 (TẦNG TRỆT) – KHU VỰC BÃI ĐỖ XE MÁY + BẢNG THÔNG TIN TRƯỚC CỔNG
//  Yêu cầu:
//  - Để trống mặt sàn bên trong Tầng 1 (không vẽ các slot lẻ bên trong)
//  - Tạo 1 bảng thông tin đặt ở trước cổng vào, hiển thị số lượng slots trống
//  - Nếu người dùng chọn chỉ xem Tầng 1 (f === 1) thì hiển thị bảng chữ nổi ở giữa sàn
// ═══════════════════════════════════════════════════════════════════════════
{
    const f = 1;
    const y = 0;
    const group = new THREE.Group();
    group.name = 'Floor 1';

    // Xây dựng mặt sàn Tầng 1 + Bản dốc nghiêng từ Tầng 1 lên Tầng 2
    buildFloorBase(group, y, f);

    // ── A. BẢNG THÔNG TIN ĐẶT Ở TRƯỚC CỔNG VÀO TẦNG TRỆT ───────────────────
    // Đặt ngay bên phải lối vào cổng chính (x = 9.5, z = HBD + 5.5)
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

    // Xây dựng mặt sàn Tầng 2 & 3 + Khu vực đường dốc & lỗ thông tầng (Cutout Well)
    buildFloorBase(group, y, f);

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
//  7. MẶT ĐẤT BÊN NGOÀI BAO QUANH TÒA NHÀ
//  (Đã xóa bốt bảo vệ và phần đường dẫn phía trước bãi xe theo yêu cầu)
// ═══════════════════════════════════════════════════════════════════════════

// Thảm cỏ / mặt đất bao quanh tòa nhà
box(scene, 200, 0.35, 150, -10, -0.55, 0, mat(0x7e9b81));

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
 * - f = 0: Hiển thị toàn cảnh cả 3 tầng
 * - f = 1: Chỉ xem Tầng 1 -> Hiển thị bảng chữ nổi ở giữa Tầng 1
 * - f = 2, 3: Chỉ hiển thị tầng ô tô tương ứng và ẩn các cột trụ để dễ quan sát
 */
function showFloor(f) {
    clearSelection();

    // Bật/tắt hiển thị từng tầng
    floors.forEach((g, i) => {
        g.visible = (f === 0 || f === i + 1);
    });

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
    controls.target.set(-5, targetY, 0);
    camera.position.set(
        f === 0 ? 70 : -5,
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
