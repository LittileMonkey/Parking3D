import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createParkingArea, SLOT_COLORS } from "./parking.js";
import type { ParkingLayout } from "./parking.js";

export interface ModelSlot {
  slotId: string; floor: number; type: string; status: string; width: number; length: number;
}
export default function ParkingViewer({ selectedId, onSelect, layout, topView, resetKey, onError }: {
  selectedId: string | null; onSelect: (slot: ModelSlot) => void;
  layout: ParkingLayout; topView: boolean; resetKey: number; onError: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const meshes = useRef<THREE.Mesh[]>([]);
  const selectCallback = useRef(onSelect);
  const errorCallback = useRef(onError);
  const selection = useRef(selectedId);
  const frame = useRef<(() => void) | null>(null);
  const view = useRef(topView);
  const [hovered, setHovered] = useState<ModelSlot | null>(null);
  selectCallback.current = onSelect; errorCallback.current = onError;
  selection.current = selectedId; view.current = topView;

  useEffect(() => {
    const container = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
    catch { errorCallback.current(); return; }
    const { scene, slotMeshes } = createParkingArea(layout);
    meshes.current = slotMeshes;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.domElement.setAttribute('aria-label', 'Sơ đồ 3D; dùng danh sách ô bên dưới để thao tác bằng bàn phím');
    container.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 250);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 16; controls.maxDistance = 100;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.target.set(0, 0, 2);
    const fit = () => {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix(); renderer.setSize(rect.width, rect.height);
      const size = Math.max(layout.width + 6, layout.depth + 12);
      const distance = size / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / Math.min(camera.aspect, 1.15) * (camera.aspect < 1 ? 1.25 : 1.05);
      controls.target.set(0, 0, 2);
      const direction = view.current ? new THREE.Vector3(0, 1, 0.001) : new THREE.Vector3(0.55, 0.95, 1);
      camera.position.copy(controls.target).add(direction.normalize().multiplyScalar(distance));
      controls.enableRotate = !view.current;
      controls.update();
    };
    frame.current = fit;
    const resize = new ResizeObserver(fit); resize.observe(container); fit();
    const raycaster = new THREE.Raycaster();
    const hitAt = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
      return raycaster.intersectObjects(slotMeshes, false)[0]?.object.userData as ModelSlot | undefined;
    };
    let down: { x: number; y: number } | null = null;
    let pointerCount = 0;
    const pointerDown = (event: PointerEvent) => {
      pointerCount++;
      down = pointerCount === 1 && event.isPrimary && event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
    };
    const pointerUp = (event: PointerEvent) => {
      pointerCount = Math.max(0, pointerCount - 1);
      const origin = down; down = null;
      if (!origin || !event.isPrimary || Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 5) return;
      const hit = hitAt(event);
      if (hit) selectCallback.current({ ...hit });
    };
    const pointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.buttons) return;
      const hit = hitAt(event); setHovered(hit ? { ...hit } : null);
      renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
    };
    const leave = () => { setHovered(null); down = null; pointerCount = 0; };
    const lostContext = (event: Event) => { event.preventDefault(); errorCallback.current(); };
    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointermove', pointerMove); canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('pointercancel', leave); canvas.addEventListener('webglcontextlost', lostContext);
    const paintSelection = () => slotMeshes.forEach(mesh => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      const active = mesh.userData.slotId === selection.current;
      material.color.setHex(active ? SLOT_COLORS.SELECTED : SLOT_COLORS[mesh.userData.status] ?? SLOT_COLORS.MAINTENANCE);
      material.opacity = active ? 0.7 : 0.24;
    });
    paintSelection();
    renderer.setAnimationLoop(() => { paintSelection(); controls.update(); renderer.render(scene, camera); });
    return () => {
      resize.disconnect(); renderer.setAnimationLoop(null);
      canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointermove', pointerMove); canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('pointercancel', leave); canvas.removeEventListener('webglcontextlost', lostContext);
      controls.dispose();
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
      scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          geometries.add(object.geometry);
          (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => {
            materials.add(material);
            Object.values(material).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); });
          });
        }
      });
      textures.forEach(texture => texture.dispose()); geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
      renderer.dispose(); canvas.remove(); meshes.current = []; frame.current = null;
    };
  }, [layout]);
  useEffect(() => { frame.current?.(); }, [topView, resetKey]);
  return <div className="booking-viewer" ref={host} aria-label="Mô hình bãi đỗ 3D">
    {hovered && <div className="booking-hover" aria-hidden="true">Ô {hovered.slotId} · {statusLabel(hovered.status)}</div>}
    <div className="booking-compass" aria-hidden="true">MẶT BẰNG MINH HỌA</div>
  </div>;
}
export function statusLabel(status: string) {
  return ({ AVAILABLE: 'Còn trống', OCCUPIED: 'Có xe', RESERVED: 'Đặt trước', MAINTENANCE: 'Bảo trì' } as Record<string, string>)[status] ?? 'Chưa xác định';
}

