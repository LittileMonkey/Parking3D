
import * as THREE from "three";

export function createParkingArea() {
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


    // ========== GROUND ==========
    box(parking, "Asphalt Ground",
        40, 0.3, 30, 0, -0.15, 0, asphalt);


    // ========== PARKING SLOTS ==========
    const slots = new THREE.Group();
    slots.name = "Parking Slots";
    parking.add(slots);

    const positions = [-14, -10, -6, -2, 2, 6, 10, 14];

    // Store clickable slot meshes
    const slotMeshes = [];

    for (const z of [-9, 9]) {
        positions.forEach((x, i) => {
            const row = z < 0 ? "A" : "B";
            const id = `${row}${String(i + 1).padStart(2, "0")}`;

            const group = new THREE.Group();
            group.name = `Slot ${id}`;
            slots.add(group);

            const slotInfo = {
                slotId: id,
                floor: 1,
                type: "Car",
                status: "AVAILABLE",
                width: 4,
                length: 6,
                positionX: x,
                positionZ: z
            };

            group.userData = { ...slotInfo };

            // Clickable slot surface

            const SLOT_COLORS = {
                AVAILABLE: 0x16a34a,
                OCCUPIED: 0x888e96,
                MAINTENANCE: 0xeab308,
                SELECTED: 0xef4444
            };

            const slotMaterial = new THREE.MeshStandardMaterial({
                color: SLOT_COLORS[slotInfo.status],
                transparent: true,
                opacity: 0.8,
                depthWrite: false,
                side: THREE.DoubleSide,
                roughness: 0.85
            });


            const slotSurface = new THREE.Mesh(
                new THREE.PlaneGeometry(3.8, 5.8),
                slotMaterial
            );

            slotSurface.rotation.x = -Math.PI / 2;
            slotSurface.position.set(x, 0.045, z);
            slotSurface.name = `Surface ${id}`;
            slotSurface.userData = { ...slotInfo };
            slotSurface.userData.isParkingSlot = true;

            group.add(slotSurface);
            slotMeshes.push(slotSurface);

            // Side boundary lines
            for (const side of [-1, 1]) {
                box(
                    group,
                    "Side Line",
                    0.08, 0.025, 6,
                    x + side * 2, 0.025, z,
                    white
                );
            }

            // Back boundary
            box(
                group,
                "Back Line",
                4, 0.025, 0.08,
                x, 0.025,
                z + (z < 0 ? -3 : 3),
                white
            );
        });
    }


    // ========== ROAD MARKINGS ==========
    const road = new THREE.Group();
    road.name = "Road Markings";
    parking.add(road);

    // Center dashed line
    for (let x = -16; x <= 16; x += 4) {
        box(road, "Yellow Dashed Line",
            2, 0.03, 0.1,
            x, 0.035, 0, yellow);
    }

    // Entrance and exit lane markers
    for (const x of [-7, 7]) {
        box(road, "Lane Left Line",
            0.1, 0.03, 3,
            x - 2.7, 0.04, 13.3, white);

        box(road, "Lane Right Line",
            0.1, 0.03, 3,
            x + 2.7, 0.04, 13.3, white);
    }

    // Stop lines before barriers
    for (const x of [-7, 7]) {
        box(road, "Stop Line",
            5, 0.035, 0.25,
            x, 0.05, 12.3, white);
    }

    // Directional arrows on the ground

    function roadArrow(name, x, z, angle) {
        const arrow = new THREE.Group();
        arrow.name = name;

        arrow.position.set(x, 0.065, z);
        arrow.rotation.y = angle;

        road.add(arrow);

        // Arrow shaft
        box(
            arrow,
            "Arrow Shaft",
            0.22, 0.015, 1.5,
            0, 0, 0.25,
            white
        );

        // Arrow head (triangle)
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

        // Lay triangle flat on XZ ground
        head.rotation.x = -Math.PI / 2;

        // Point toward negative Z
        head.position.set(0, 0.012, -0.45);

        arrow.add(head);
    }


    // Entrance: forward into parking
    roadArrow("Entrance Arrow", -7, 10.5, 0);

    // Exit: forward out of parking
    roadArrow("Exit Arrow", 7, 10.5, Math.PI);

    // Central circulation
    roadArrow("Central Arrow Left", -7, 0, Math.PI / 2);
    roadArrow("Central Arrow Right", 7, 0, -Math.PI / 2);

    // ========== PERIMETER WALLS ==========
    const walls = new THREE.Group();
    walls.name = "Boundary Walls";
    parking.add(walls);

    box(walls, "North Wall",
        40, 0.7, 0.3, 0, 0.35, -15, concrete);
    box(walls, "West Wall",
        0.3, 0.7, 30, -20, 0.35, 0, concrete);
    box(walls, "East Wall",
        0.3, 0.7, 30, 20, 0.35, 0, concrete);

    box(walls, "South Left",
        10, 0.7, 0.3, -15, 0.35, 15, concrete);
    box(walls, "South Center",
        4, 0.7, 0.3, 0, 0.35, 15, concrete);
    box(walls, "South Right",
        10, 0.7, 0.3, 15, 0.35, 15, concrete);

    // ========== SECURITY BOOTH ==========
    const booth = new THREE.Group();
    booth.name = "Security Booth";
    booth.position.set(0, 0, 17.5);
    parking.add(booth);

    // Platform
    box(booth, "Platform",
        3.8, 0.2, 3.5, 0, 0.1, 0, concrete);

    // Walls
    box(booth, "Back Wall",
        3.2, 2.8, 0.15, 0, 1.6, -1.4, blue);
    box(booth, "Left Wall",
        0.15, 2.8, 2.8, -1.6, 1.6, 0, blue);
    box(booth, "Right Wall",
        0.15, 2.8, 2.8, 1.6, 1.6, 0, blue);

    // Front wall with doorway
    box(booth, "Front Left",
        0.8, 2.8, 0.15, -1.2, 1.6, 1.4, blue);
    box(booth, "Front Right",
        0.8, 2.8, 0.15, 1.2, 1.6, 1.4, blue);
    box(booth, "Door Header",
        1.6, 0.5, 0.15, 0, 2.75, 1.4, blue);

    // Glass door
    box(booth, "Glass Door",
        1.5, 2.25, 0.04, 0, 1.35, 1.48, glass);

    // Windows
    box(booth, "Left Window",
        0.04, 1.2, 1.6, -1.7, 1.9, 0, glass);
    box(booth, "Right Window",
        0.04, 1.2, 1.6, 1.7, 1.9, 0, glass);

    // Roof
    box(booth, "Flat Roof",
        4, 0.3, 3.7, 0, 3.2, 0, dark);

    // ========== BARRIERS ==========
    function createBarrier(name, x, z, isEntrance) {
        const group = new THREE.Group();
        group.name = name;
        group.position.set(x, 0, z);
        parking.add(group);

        // Place pivot at the outer edge of each lane
        const direction = isEntrance ? 1 : -1;
        const pivotX = direction * -2.35;

        box(group, "Barrier Base",
            0.75, 1.0, 0.75,
            pivotX, 0.5, 0, orange);

        const pivot = new THREE.Group();
        pivot.name = "Barrier Arm Pivot";
        pivot.position.set(pivotX, 0.95, 0);
        group.add(pivot);

        // Arm reaches toward the lane center
        box(pivot, "Barrier Arm",
            4.6, 0.16, 0.18,
            direction * 2.3, 0, 0, white);

        for (let i = 0; i < 4; i++) {
            box(pivot, "Red Stripe",
                0.42, 0.17, 0.19,
                direction * (0.65 + i * 1.05),
                0, 0, red);
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

    const entranceBarrier =
        createBarrier("Entrance Barrier", -7, 14, true);

    const exitBarrier =
        createBarrier("Exit Barrier", 7, 14, false);

    // Entrance and exit color strips
    box(parking, "Entrance Green",
        5, 0.03, 0.4, -7, 0.04, 14.7, green);
    box(parking, "Exit Orange",
        5, 0.03, 0.4, 7, 0.04, 14.7, orange);

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

        box(group, "Lamp Head",
            1.2, 0.2, 0.6,
            0, 5.1, 0, white);
    }

    lamp(-18, -13, 1);
    lamp(18, -13, 2);
    lamp(-18, 13, 3);
    lamp(18, 13, 4);

    // ========== LIGHTING ==========
    scene.add(new THREE.HemisphereLight(
        0xffffff, 0x808080, 2
    ));

    const sunlight = new THREE.DirectionalLight(
        0xffffff, 2.5
    );
    sunlight.position.set(20, 30, 15);
    scene.add(sunlight);

    return {
        scene,
        entranceBarrier,
        exitBarrier,
        slotMeshes
    };
}
