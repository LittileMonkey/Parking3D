import * as THREE from "three";

export const SLOT_COLORS = { AVAILABLE: 0x3e997b, OCCUPIED: 0xc46a60, RESERVED: 0xd6a33f, MAINTENANCE: 0x88929b, SELECTED: 0x168bce };

// The scene is presentation only. Supply a facility layout to replace this preview.
export function createParkingArea(layout) {
    const config = layout ?? { width: 30, depth: 28, slots: [] };
    const gateZ = config.depth / 2;
    const laneX = config.width / 2 - 2.5;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe9eeec);
    const parking = new THREE.Group();
    scene.add(parking);
    const mat = (color, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness });
    const asphalt = mat(0x343e43), concrete = mat(0xb8c2bf), white = mat(0xf0eee2);
    const ink = mat(0x253c40), green = mat(0x547c53), bark = mat(0x73614a);
    const yellow = mat(0xe8c16a), glass = mat(0x294c59, 0.22);
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    function box(parent, name, w, h, d, x, y, z, material) {
        const mesh = new THREE.Mesh(boxGeometry, material);
        mesh.name = name;
        mesh.scale.set(w, h, d);
        mesh.position.set(x, y, z);
        mesh.castShadow = h > 0.1;
        mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
    }
    function label(text, x, y, z, width, depth, color = '#f4f1df', background = null, standing = false) {
        if (typeof document === 'undefined') return;
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, 512, 128); }
        ctx.fillStyle = color; ctx.font = '600 72px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, 256, 66);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
        mesh.position.set(x, y, z);
        if (!standing) mesh.rotation.x = -Math.PI / 2;
        parking.add(mesh);
    }
    // Raised site plinth and apron; no external textures or model downloads.
    box(parking, 'Site foundation', config.width + 4, 0.55, config.depth + 10, 0, -0.48, 2, concrete);
    box(parking, 'Asphalt', config.width, 0.18, config.depth, 0, -0.1, 0, asphalt);
    box(parking, 'Entrance apron', config.width, 0.12, 6, 0, -0.13, config.depth / 2 + 3, asphalt);
    for (const side of [-1, 1]) {
        box(parking, 'Sidewalk', 1.3, 0.18, config.depth, side * (config.width / 2 + 0.65), 0, 0, white);
        for (let z = -config.depth / 2; z < config.depth / 2; z += 1.25)
            box(parking, 'Curb', 0.2, 0.24, 1.2, side * config.width / 2, 0.02, z + 0.6, Math.round(z * 4) % 2 ? white : ink);
    }
    box(parking, 'Rear planting bed', config.width, 0.23, 1.2, 0, 0, -config.depth / 2 + 0.6, green);
    box(parking, 'Rear wall', config.width + 2.6, 0.55, 0.25, 0, 0.15, -config.depth / 2 - 0.3, concrete);
    // Shared wheel geometry and body materials across all preview vehicles.
    const wheelGeometry = new THREE.CylinderGeometry(0.31, 0.31, 0.23, 12);
    const rubber = mat(0x252a2b), rim = mat(0xaab5b8, 0.35);
    const paints = [0xd9e0dc, 0x436a7a, 0xbec7c7, 0xb86250].map(c => mat(c, 0.3));
    function car(slot, index) {
        const group = new THREE.Group();
        group.name = `Vehicle ${slot.slotId}`;
        group.position.set(slot.positionX, 0.05, slot.positionZ);
        group.rotation.y = (slot.backDirection ?? Math.sign(slot.positionZ)) > 0 ? Math.PI : 0;
        parking.add(group);
        const paint = paints[index % paints.length];
        const suv = index % 3 === 0;
        box(group, 'Body', 1.82, 0.56, 4.1, 0, 0.65, 0, paint);
        box(group, 'Cabin glass', 1.57, suv ? 0.72 : 0.58, 1.95, 0, 1.22, 0.12, glass);
        box(group, 'Roof', 1.6, 0.12, 1.7, 0, suv ? 1.62 : 1.55, 0.18, paint);
        for (const x of [-0.8, 0.8]) box(group, 'Pillar', 0.08, 0.65, 0.1, x, 1.23, 0.3, paint);
        for (const x of [-0.91, 0.91]) for (const z of [-1.25, 1.25]) {
            const wheel = new THREE.Mesh(wheelGeometry, rubber);
            wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.37, z); wheel.castShadow = true; group.add(wheel);
            const hub = new THREE.Mesh(wheelGeometry, rim);
            hub.scale.set(0.53, 1.05, 0.53); hub.rotation.z = Math.PI / 2; hub.position.copy(wheel.position); group.add(hub);
        }
        for (const x of [-0.62, 0.62]) {
            box(group, 'Headlight', 0.42, 0.15, 0.035, x, 0.78, -2.06, white);
            box(group, 'Tail light', 0.35, 0.13, 0.035, x, 0.78, 2.06, mat(0xb94b42));
            box(group, 'Mirror', 0.19, 0.13, 0.28, x * 1.55, 1.08, -0.6, paint);
        }
        box(group, 'Front grille', 0.8, 0.18, 0.04, 0, 0.62, -2.07, ink);
    }
    const slotMeshes = [];
    config.slots.forEach((slot, index) => {
        const { positionX: x, positionZ: z, width: w, length: d } = slot;
        const surface = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.12, d - 0.12), new THREE.MeshStandardMaterial({ color: SLOT_COLORS[slot.status] ?? SLOT_COLORS.MAINTENANCE, transparent: true, opacity: 0.24, roughness: 1, depthWrite: false }));
        surface.rotation.x = -Math.PI / 2; surface.position.set(x, 0.015, z);
        surface.userData = { ...slot, isParkingSlot: true }; surface.name = slot.slotId;
        parking.add(surface); slotMeshes.push(surface);
        for (const side of [-1, 1]) box(parking, 'Bay marking', 0.055, 0.012, d, x + side * w / 2, 0.025, z, white);
        box(parking, 'Bay end', w, 0.012, 0.06, x, 0.025, z + (slot.backDirection ?? Math.sign(z)) * d / 2, white);
        box(parking, 'Wheel stop', w * 0.65, 0.13, 0.2, x, 0.07, z + (slot.backDirection ?? Math.sign(z)) * (d / 2 - 0.65), yellow);
        label(slot.slotId, x, 0.05, z - (slot.backDirection ?? Math.sign(z)) * (d / 2 - 0.55), 1.45, 0.42);
        if (slot.status === 'OCCUPIED') car(slot, index);
        if (slot.status === 'MAINTENANCE') {
            for (const sign of [-1, 1]) {
                const stripe = box(parking, 'Maintenance cross', w * 0.8, 0.02, 0.11, x, 0.04, z, yellow);
                stripe.rotation.y = sign * Math.PI / 4;
            }
        }
    });
    // Clear circulation aisle and separate gate lanes, away from parking bays.
    for (let x = -config.width / 2 + 4; x <= config.width / 2 - 4; x += 3) box(parking, 'Centre dash', 1.2, 0.012, 0.07, x, 0.025, 0, yellow);
    function arrow(x, z, angle) {
        const group = new THREE.Group(); group.position.set(x, 0.035, z); group.rotation.y = angle; parking.add(group);
        box(group, 'Arrow stem', 0.15, 0.01, 1.3, 0, 0, 0.3, white);
        for (const sign of [-1, 1]) {
            const head = box(group, 'Arrow tip', 0.13, 0.01, 0.8, sign * 0.25, 0, -0.35, white);
            head.rotation.y = sign * -Math.PI / 4;
        }
    }
    arrow(-7, -1.5, -Math.PI / 2); arrow(7, 1.5, Math.PI / 2);
    for (const z of [-config.depth / 2 + 3, 0, config.depth / 2 - 3]) { arrow(-laneX, z, 0); arrow(laneX, z, Math.PI); }
    // Security pavilion with overhanging roof and framed glazing.
    box(parking, 'Booth base', 3.2, 0.2, 2.7, 0, 0, gateZ, concrete);
    box(parking, 'Booth', 2.8, 2.3, 2.3, 0, 1.25, gateZ, white);
    box(parking, 'Booth glazing', 2.5, 1.12, 0.03, 0, 1.65, gateZ + 1.17, glass);
    box(parking, 'Booth side glazing', 0.03, 1.12, 1.7, -1.42, 1.65, gateZ, glass);
    box(parking, 'Canopy', 4, 0.22, 3.3, 0, 2.65, gateZ, ink);
    label('PARKMATRIX', 0, 2.4, gateZ + 1.2, 2.5, 0.44, '#f3f2e8', '#253c40', true);
    label('LỐI VÀO', -laneX, 0.04, gateZ + 2.3, 3.6, 0.8);
    label('LỐI RA', laneX, 0.04, gateZ + 2.3, 3.6, 0.8);
    for (const side of [-1, 1]) {
        const gateX = side * laneX;
        box(parking, 'Barrier pedestal', 0.45, 1, 0.5, gateX - side * 1.25, 0.5, gateZ - 1, yellow);
        box(parking, 'Barrier arm', 2.4, 0.12, 0.12, gateX, 1, gateZ - 1, white);
        for (let i = 0; i < 4; i++) box(parking, 'Barrier stripe', 0.25, 0.13, 0.13, gateX - 0.9 + i * 0.6, 1, gateZ - 1, mat(0xbd665a));
        for (let i = 0; i < 5; i++) box(parking, 'Pedestrian crossing', 1.25, 0.015, 0.35, side * 6, 0.03, gateZ - 3 + i * 0.6, white);
    }
    // Landscape kept at the perimeter to preserve sight lines.
    const crownGeometry = new THREE.IcosahedronGeometry(1, 1);
    for (const x of [-config.width / 2 - 0.7, config.width / 2 + 0.7]) for (const z of [-config.depth / 2 + 4, -8, 5, config.depth / 2 - 5]) {
        box(parking, 'Planter', 1.5, 0.3, 1.5, x, 0.12, z, concrete);
        box(parking, 'Tree trunk', 0.18, 1.8, 0.18, x, 1, z, bark);
        const crown = new THREE.Mesh(crownGeometry, green);
        crown.position.set(x, 2.7, z); crown.scale.set(1.15, 1.45, 1.1); crown.castShadow = true; parking.add(crown);
    }
    for (const x of [-config.width / 2 + 0.8, config.width / 2 - 0.8]) for (const z of [-config.depth / 2 + 2, config.depth / 2 - 3]) {
        box(parking, 'Light post', 0.09, 4.2, 0.09, x, 2.1, z, ink);
        box(parking, 'Lamp head', 0.85, 0.1, 0.32, x, 4.2, z, white);
    }
    scene.add(new THREE.HemisphereLight(0xf3f6f5, 0x7e8b77, 2.2));
    const sun = new THREE.DirectionalLight(0xfff1d9, 3.2);
    sun.position.set(-30, 48, 32); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 150 });
    sun.shadow.normalBias = 0.04; sun.shadow.bias = -0.0002;
    scene.add(sun);
    return { scene, slotMeshes };
}
