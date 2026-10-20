import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createParkingArea } from "./parking.js";

export interface ModelSlot {
  slotId: string;
  floor: number;
  type: string;
  status: string;
  width: number;
  length: number;
}

export default function ParkingViewer({ selectedId, onSelect, onReady }: {
  selectedId: string | null;
  onSelect: (slot: ModelSlot) => void;
  onReady: (slots: ModelSlot[]) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const meshes = useRef<THREE.Mesh[]>([]);
  const selectCallback = useRef(onSelect);
  const readyCallback = useRef(onReady);
  const [error, setError] = useState(false);
  selectCallback.current = onSelect;
  readyCallback.current = onReady;

  useEffect(() => {
    const container = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
    catch { setError(true); return; }
    const { scene, slotMeshes } = createParkingArea();
    meshes.current = slotMeshes;
    readyCallback.current(slotMeshes.map(mesh => ({ ...mesh.userData } as ModelSlot)));
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(26, 28, 34);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 15;
    controls.maxDistance = 100;
    controls.maxPolarAngle = Math.PI / 2.05;
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
    renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
    return () => {
      resize.disconnect();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      controls.dispose();
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          geometries.add(object.geometry);
          (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
        }
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      meshes.current = [];
    };
  }, []);

  useEffect(() => {
    const colors: Record<string, number> = { AVAILABLE: 0x16a34a, OCCUPIED: 0x888e96, MAINTENANCE: 0xeab308 };
    meshes.current.forEach(mesh => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.color.setHex(mesh.userData.slotId === selectedId ? 0xef4444 : colors[mesh.userData.status] ?? 0x888e96);
    });
  }, [selectedId]);

  return <div className="booking-viewer" ref={host} aria-label="Mô hình bãi đỗ 3D">
    {error && <p role="alert">Không thể mở đồ họa 3D. Bạn vẫn có thể chọn ô trong danh sách bên dưới.</p>}
  </div>;
}
