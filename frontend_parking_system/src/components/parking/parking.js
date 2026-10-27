import * as THREE from "three";

const slotColors = {
    AVAILABLE: 0x14b8a6,
    HELD: 0xfbbf24,
    RESERVED: 0xfbbf24,
    OCCUPIED: 0xf87171,
    MAINTENANCE: 0x94a3b8
};

export function createParkingArea(slots) {
    const scene = new THREE.Scene();
    scene.name = "Parking Lot Availability";
    scene.background = new THREE.Color(0xcfe8ff);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 2));
    const sunlight = new THREE.DirectionalLight(0xffffff, 2.5);
    sunlight.position.set(12, 24, 16);
    scene.add(sunlight);

    const columns = Math.min(8, Math.max(1, Math.ceil(Math.sqrt(slots.length))));
    const rows = Math.ceil(slots.length / columns);
    const width = columns * 4.5;
    const depth = rows * 6.5;
    const floor = new THREE.Mesh(
        new THREE.BoxGeometry(width + 4, 0.3, depth + 4),
        new THREE.MeshStandardMaterial({ color: 0x454b52, roughness: 0.85 })
    );
    floor.position.y = -0.15;
    floor.name = "Parking Floor";
    scene.add(floor);

    const slotMeshes = slots.map((slot, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = (column - (columns - 1) / 2) * 4.5;
        const z = (row - (rows - 1) / 2) * 6.5;
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(4.1, 6.1),
            new THREE.MeshStandardMaterial({
                color: slotColors[String(slot.status).toUpperCase()] ?? 0x64748b,
                side: THREE.DoubleSide,
                roughness: 0.8
            })
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0.02, z);
        mesh.name = `Slot ${slot.slotCode}`;
        mesh.userData = { ...slot };
        scene.add(mesh);

        const outline = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.PlaneGeometry(4.1, 6.1)),
            new THREE.LineBasicMaterial({ color: 0xffffff })
        );
        outline.rotation.x = -Math.PI / 2;
        outline.position.set(x, 0.03, z);
        scene.add(outline);
        return mesh;
    });

    return { scene, slotMeshes };
}
