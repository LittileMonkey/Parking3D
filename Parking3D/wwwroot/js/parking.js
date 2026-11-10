
import * as THREE from "three";

export function createParkingArea() {
    console.log("PARKING VERSION: 12 SLOTS - UPDATED");
    const scene = new THREE.Scene();
    scene.name = "Outdoor Parking 3D";
    scene.background = new THREE.Color(0xcfe8ff);

    const parking = new THREE.Group();
    parking.name = "Parking Structure";
    scene.add(parking);

    // ========== MATERIALS ==========

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

    const SLOT_COLORS = {
        AVAILABLE: 0x16a34a,
        OCCUPIED: 0x888e96,
        MAINTENANCE: 0xeab308,
        SELECTED: 0xef4444
    };

    // ========== HELPER ==========

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

    // ========== GROUND ==========

    box(
        parking,
        "Asphalt Ground",
        40, 0.3, 30,
        0, -0.15, 0,
        asphalt
    );
    function createSlotLabel(text) {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 128;

        const ctx = canvas.getContext("2d");

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.font = "bold 42px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

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

    // ========== PARKING SLOTS ==========

    // ========== PARKING SLOTS ==========

    const slots = new THREE.Group();
    slots.name = "Parking Slots";
    parking.add(slots);

    const slotMeshes = [];

    // Slot nằm ngang:
    // Chiều rộng theo X = 5.8
    // Chiều sâu theo Z = 3.4
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

    for (const column of parkingColumns) {
        column.positionsZ.forEach((z, index) => {

            const x = column.x;

            const number = column.startNumber + index;

            const id = `${column.code}${String(number).padStart(2, "0")}`;

            const group = new THREE.Group();
            group.name = `Slot ${id}`;
            slots.add(group);

            const slotInfo = {
                slotId: id,
                floor: 1,
                type: "Car",
                status: "AVAILABLE",
                width: SLOT_WIDTH,
                length: SLOT_DEPTH,
                positionX: x,
                positionZ: z
            };

            group.userData = { ...slotInfo };

            // ===== SLOT SURFACE =====

            const slotMaterial = new THREE.MeshStandardMaterial({
                color: SLOT_COLORS[slotInfo.status],
                transparent: true,
                opacity: 0.85,
                depthWrite: false,
                side: THREE.DoubleSide,
                roughness: 0.85
            });

            // QUAN TRỌNG:
            // Mặt xanh và viền trắng cùng kích thước.
            const slotSurface = new THREE.Mesh(
                new THREE.PlaneGeometry(
                    SLOT_WIDTH - 0.12,
                    SLOT_DEPTH - 0.12
                ),
                slotMaterial
            );

            slotSurface.rotation.x = -Math.PI / 2;
            slotSurface.position.set(x, 0.045, z);

            slotSurface.name = `Surface ${id}`;

            slotSurface.userData = {
                ...slotInfo,
                isParkingSlot: true
            };

            group.add(slotSurface);
            slotMeshes.push(slotSurface);

            // ===== WHITE BOUNDARY LINES =====

            // Vạch trên
            box(
                group,
                "Top Line",
                SLOT_WIDTH, 0.025, 0.08,
                x, 0.07,
                z - SLOT_DEPTH / 2,
                white
            );

            // Vạch dưới
            box(
                group,
                "Bottom Line",
                SLOT_WIDTH, 0.025, 0.08,
                x, 0.07,
                z + SLOT_DEPTH / 2,
                white
            );

            // Vạch bên trái
            box(
                group,
                "Left Line",
                0.08, 0.025, SLOT_DEPTH,
                x - SLOT_WIDTH / 2,
                0.07, z,
                white
            );

            // Vạch bên phải
            box(
                group,
                "Right Line",
                0.08, 0.025, SLOT_DEPTH,
                x + SLOT_WIDTH / 2,
                0.07, z,
                white
            );

            // ===== SLOT ID =====

            const label = createSlotLabel(id);

            label.position.set(x, 0.09, z);

            group.add(label);
        });
    }

    console.log("Total Parking Slots:", slotMeshes.length);
    console.log(
        "Slot IDs:",
        slotMeshes.map(s => s.userData.slotId)
    );


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

    // Lối vào: X = -7
    // Lối ra: X = 7
    // Vạch dẫn từ khu vực cổng về đường giữa.
    // Hai bên lối xe không có ô đỗ.

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

    // Vạch dừng trước barrier
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

        // Thân mũi tên
        box(
            arrow,
            "Arrow Shaft",
            0.22, 0.015, 1.5,
            0, 0, 0.25,
            white
        );

        // Đầu mũi tên
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
    // Hướng di chuyển trên làn đường giữa
    // roadArrow("Central Arrow Left", -2, -2, Math.PI / 2);
    // roadArrow("Central Arrow Right", 2, 2, -Math.PI / 2);

    // ========== PERIMETER WALLS ==========

    const walls = new THREE.Group();
    walls.name = "Boundary Walls";
    parking.add(walls);

    // Tường phía sau
    box(
        walls,
        "North Wall",
        40, 0.7, 0.3,
        0, 0.35, -15,
        concrete
    );

    // Tường bên trái
    box(
        walls,
        "West Wall",
        0.3, 0.7, 30,
        -20, 0.35, 0,
        concrete
    );

    // Tường bên phải
    box(
        walls,
        "East Wall",
        0.3, 0.7, 30,
        20, 0.35, 0,
        concrete
    );

    // Tường phía trước có hai khoảng trống
    // dành cho xe vào và xe ra.

    box(
        walls,
        "South Left",
        10, 0.7, 0.3,
        -15, 0.35, 15,
        concrete
    );

    box(
        walls,
        "South Center",
        4, 0.7, 0.3,
        0, 0.35, 15,
        concrete
    );

    box(
        walls,
        "South Right",
        10, 0.7, 0.3,
        15, 0.35, 15,
        concrete
    );

    // ========== SECURITY BOOTH ==========

    const booth = new THREE.Group();
    booth.name = "Security Booth";

    booth.position.set(0, 0, 17.5);
    parking.add(booth);

    // Nền bốt bảo vệ
    box(
        booth,
        "Platform",
        3.8, 0.2, 3.5,
        0, 0.1, 0,
        concrete
    );

    // Tường phía sau
    box(
        booth,
        "Back Wall",
        3.2, 2.8, 0.15,
        0, 1.6, -1.4,
        blue
    );

    // Tường trái
    box(
        booth,
        "Left Wall",
        0.15, 2.8, 2.8,
        -1.6, 1.6, 0,
        blue
    );

    // Tường phải
    box(
        booth,
        "Right Wall",
        0.15, 2.8, 2.8,
        1.6, 1.6, 0,
        blue
    );

    // Tường mặt trước
    box(
        booth,
        "Front Left",
        0.8, 2.8, 0.15,
        -1.2, 1.6, 1.4,
        blue
    );

    box(
        booth,
        "Front Right",
        0.8, 2.8, 0.15,
        1.2, 1.6, 1.4,
        blue
    );

    box(
        booth,
        "Door Header",
        1.6, 0.5, 0.15,
        0, 2.75, 1.4,
        blue
    );

    // Cửa kính
    box(
        booth,
        "Glass Door",
        1.5, 2.25, 0.04,
        0, 1.35, 1.48,
        glass
    );

    // Cửa sổ
    box(
        booth,
        "Left Window",
        0.04, 1.2, 1.6,
        -1.7, 1.9, 0,
        glass
    );

    box(
        booth,
        "Right Window",
        0.04, 1.2, 1.6,
        1.7, 1.9, 0,
        glass
    );

    // Mái bốt bảo vệ
    box(
        booth,
        "Flat Roof",
        4, 0.3, 3.7,
        0, 3.2, 0,
        dark
    );

    // ========== BARRIERS ==========

    function createBarrier(name, x, z, isEntrance) {
        const group = new THREE.Group();

        group.name = name;
        group.position.set(x, 0, z);

        parking.add(group);

        // Vị trí trụ barrier
        const direction = isEntrance ? 1 : -1;
        const pivotX = direction * -2.35;

        // Chân barrier
        box(
            group,
            "Barrier Base",
            0.75, 1.0, 0.75,
            pivotX, 0.5, 0,
            orange
        );

        // Trục quay thanh chắn
        const pivot = new THREE.Group();

        pivot.name = "Barrier Arm Pivot";
        pivot.position.set(pivotX, 0.95, 0);

        group.add(pivot);

        // Thanh barrier
        box(
            pivot,
            "Barrier Arm",
            4.6, 0.16, 0.18,
            direction * 2.3, 0, 0,
            white
        );

        // Các sọc đỏ trên thanh chắn
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

        return {
            group,
            pivot,
            direction,
            open: false
        };
    }

    // Barrier lối vào
    const entranceBarrier = createBarrier(
        "Entrance Barrier",
        -7,
        14,
        true
    );

    // Barrier lối ra
    const exitBarrier = createBarrier(
        "Exit Barrier",
        7,
        14,
        false
    );

    // ========== ENTRANCE / EXIT MARKERS ==========

    // Vạch xanh ở lối vào
    box(
        parking,
        "Entrance Green",
        5, 0.03, 0.4,
        -7, 0.04, 14.7,
        green
    );

    // Vạch cam ở lối ra
    box(
        parking,
        "Exit Orange",
        5, 0.03, 0.4,
        7, 0.04, 14.7,
        orange
    );

    // ========== LIGHT POSTS ==========

    function lamp(x, z, index) {
        const group = new THREE.Group();

        group.name = `Lamp ${index}`;
        group.position.set(x, 0, z);

        parking.add(group);

        // Thân đèn
        const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.1, 0.13, 5, 12
            ),
            concrete
        );

        pole.position.y = 2.5;
        group.add(pole);

        // Đầu đèn
        box(
            group,
            "Lamp Head",
            1.2, 0.2, 0.6,
            0, 5.1, 0,
            white
        );
    }

    lamp(-18, -13, 1);
    lamp(18, -13, 2);
    lamp(-18, 13, 3);
    lamp(18, 13, 4);

    // ========== LIGHTING ==========

    scene.add(
        new THREE.HemisphereLight(
            0xffffff,
            0x808080,
            2
        )
    );

    const sunlight = new THREE.DirectionalLight(
        0xffffff,
        2.5
    );

    sunlight.position.set(20, 30, 15);
    scene.add(sunlight);

    // ========== RETURN ==========

    return {
        scene,
        entranceBarrier,
        exitBarrier,
        slotMeshes
    };
}
