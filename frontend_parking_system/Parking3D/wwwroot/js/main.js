

import * as THREE from "three";

import { OrbitControls } from
    "three/addons/controls/OrbitControls.js";

import { createParkingArea } from "./parking.js";

const {
    scene,
    entranceBarrier,
    exitBarrier,
    slotMeshes
} = createParkingArea();

console.log("Scene loaded:", scene);
console.log("Parking slots:", slotMeshes.length);

const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(35, 35, 45);

const renderer = new THREE.WebGLRenderer({
    antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(
    camera, renderer.domElement
);
controls.target.set(0, 0, 0);
controls.enableDamping = true;

function toggleBarrier(barrier) {
    barrier.open = !barrier.open;
    barrier.group.userData.open = barrier.open;
}

document.getElementById("entranceBtn")
    .addEventListener("click", () => {
        toggleBarrier(entranceBarrier);
    });

document.getElementById("exitBtn")
    .addEventListener("click", () => {
        toggleBarrier(exitBarrier);
    });

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    for (const barrier of [entranceBarrier, exitBarrier]) {
        const target = barrier.open
            ? barrier.direction * Math.PI / 2
            : 0;

        const current = barrier.pivot.rotation.z;
        const diff = target - current;
        const step = Math.sign(diff) *
            Math.min(Math.abs(diff), delta * 1.5);

        barrier.pivot.rotation.z += step;
    }

    controls.update();
    renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
    camera.aspect =
        window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
});

document.getElementById("exportBtn")
    .addEventListener("click", () => {
        const json = JSON.stringify(
            scene.toJSON(), null, 2
        );
        const blob = new Blob([json], {
            type: "application/json"
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "parking-area.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });


// ========== SLOT SELECTION ==========

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let selectedSlot = null;

// Display selected slot information
function showSlotInfo(slot) {
    const info = slot.userData;

    document.getElementById("slotId").textContent =
        info.slotId;

    document.getElementById("slotFloor").textContent =
        info.floor;

    document.getElementById("slotType").textContent =
        info.type;

    document.getElementById("slotStatus").textContent =
        info.status;

    document.getElementById("slotWidth").textContent =
        info.width + " m";

    document.getElementById("slotLength").textContent =
        info.length + " m";

    document.getElementById("slotInfo").style.display =
        "block";

    document.getElementById("slotStatusSelect").value =
        info.status;
}

// Restore previous slot color

const SLOT_COLORS = {
    AVAILABLE: 0x16a34a,
    OCCUPIED: 0x888e96,
    MAINTENANCE: 0xeab308,
    SELECTED: 0xef4444
};

function updateSlotColor(slot) {
    if (!slot) return;

    const color = slot === selectedSlot
        ? SLOT_COLORS.SELECTED
        : (SLOT_COLORS[slot.userData.status]
            ?? SLOT_COLORS.AVAILABLE);

    slot.material.color.setHex(color);
}

function resetSelectedSlot() {
    if (selectedSlot) {
        const previous = selectedSlot;
        selectedSlot = null;
        updateSlotColor(previous);
    }
}


// Click event
renderer.domElement.addEventListener("click", (event) => {
    const rect = renderer.domElement.getBoundingClientRect();

    mouse.x =
        ((event.clientX - rect.left) / rect.width) * 2 - 1;

    mouse.y =
        -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(
        slotMeshes,
        false
    );

    if (intersects.length > 0) {
        resetSelectedSlot();

        selectedSlot = intersects[0].object;

        updateSlotColor(selectedSlot);
        showSlotInfo(selectedSlot);
    }
});

// Update selected slot status
document.getElementById("saveSlotStatus")
    .addEventListener("click", () => {
        if (!selectedSlot) return;

        const newStatus = document.getElementById(
            "slotStatusSelect"
        ).value;

        selectedSlot.userData.status = newStatus;

        // Keep parent Group data synchronized
        selectedSlot.parent.userData.status = newStatus;

        updateSlotColor(selectedSlot);
        showSlotInfo(selectedSlot);
    });

// Close information panel
document.getElementById("closeSlotInfo")
    .addEventListener("click", () => {
        document.getElementById("slotInfo")
            .style.display = "none";

        resetSelectedSlot();
    });