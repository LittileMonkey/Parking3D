import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createParkingArea } from "./parking.js";

export interface ModelSlot {
  slotId: string;
  slotCode: string;
  floorCode: string;
  zoneCode: string;
  supportedVehicleTypes: string[];
  features: string[];
  status: string;
}

const slotColors: Record<string, number> = {
  AVAILABLE: 0x16a34a,
  HELD: 0xf59e0b,
  RESERVED: 0xf59e0b,
  OCCUPIED: 0xdc2626,
  MAINTENANCE: 0x64748b
};

export default function ParkingViewer({ slots, selectedId, onSelect }: {
  slots: ModelSlot[];
  selectedId: string | null;
  onSelect: (slot: ModelSlot) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const meshes = useRef<THREE.Mesh[]>([]);
  const resetCameraRef = useRef<(() => void) | null>(null);
  const selectCallback = useRef(onSelect);
  const slotsRef = useRef(slots);
  const [error, setError] = useState(false);
  const layoutKey = slots.map(slot => slot.slotId).join("|");
  selectCallback.current = onSelect;
  slotsRef.current = slots;

  useEffect(() => {
    const container = host.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setError(true);
      return;
    }

    setError(false);
    const { scene, slotMeshes } = createParkingArea(slotsRef.current);
    meshes.current = slotMeshes;
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.05;

    const fitCamera = () => {
      if (slotMeshes.length === 0) return;
      const bounds = new THREE.Box3();
      slotMeshes.forEach(mesh => bounds.expandByObject(mesh));
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const distance = Math.max(size.x, size.z, 8) * 1.65;
      controls.target.copy(center);
      camera.position.set(center.x + distance * 0.72, center.y + distance, center.z + distance);
      camera.near = Math.max(distance / 1000, 0.1);
      camera.far = distance * 20;
      camera.updateProjectionMatrix();
      controls.minDistance = Math.max(4, distance / 4);
      controls.maxDistance = distance * 5;
      controls.update();
    };
    resetCameraRef.current = fitCamera;
    fitCamera();

    const resize = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resize.observe(container);

    const raycaster = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    const pointerDown = (event: PointerEvent) => {
      down = event.isPrimary && event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
    };
    const pointerUp = (event: PointerEvent) => {
      if (!down || !event.isPrimary || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) return;
      down = null;
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(
        (event.clientX - rect.left) / rect.width * 2 - 1,
        -(event.clientY - rect.top) / rect.height * 2 + 1,
      ), camera);
      const hit = raycaster.intersectObjects(slotMeshes, false)[0];
      if (hit) selectCallback.current({ ...hit.object.userData } as ModelSlot);
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      resize.disconnect();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      controls.dispose();
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          (Array.isArray(object.material) ? object.material : [object.material])
            .forEach(material => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      meshes.current = [];
      resetCameraRef.current = null;
    };
  }, [layoutKey]);

  useEffect(() => {
    const currentSlots = new Map(slots.map(slot => [slot.slotId, slot]));
    meshes.current.forEach(mesh => {
      const slot = currentSlots.get(String(mesh.userData.slotId));
      if (!slot) return;
      mesh.userData = { ...slot };
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.color.setHex(slot.slotId === selectedId
        ? 0xef4444
        : slotColors[slot.status.toUpperCase()] ?? 0x64748b);
    });
  }, [selectedId, slots]);

  return (
    <div className="booking-viewer" ref={host} aria-label="Mô hình bãi đỗ 3D">
      {error && <p role="alert">Không thể mở đồ họa 3D. Danh sách ô bên dưới vẫn dùng được.</p>}
      <button className="booking-camera-reset" type="button" disabled={error}
        onClick={() => resetCameraRef.current?.()}>
        Đặt lại camera
      </button>
    </div>
  );
}
