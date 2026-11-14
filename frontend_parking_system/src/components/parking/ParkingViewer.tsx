import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  createParkingArea,
  type ParkingMapObject,
  type ParkingSceneSlot,
} from "./parking.js";

export interface ModelSlot extends ParkingSceneSlot {
  floorCode: string;
}

export interface ModelLevel {
  levelId: string;
  levelCode: string;
  levelName: string;
  elevationM?: number | null;
  slots: ModelSlot[];
}

const slotColors: Record<string, number> = {
  AVAILABLE: 0x14b8a6,
  HELD: 0xfbbf24,
  RESERVED: 0xfbbf24,
  OCCUPIED: 0xf87171,
  MAINTENANCE: 0x94a3b8
};

interface SlotInstance {
  mesh: THREE.InstancedMesh;
  instanceId: number;
  slot: ModelSlot;
}

interface CameraTransition {
  fromPosition: THREE.Vector3;
  toPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  startedAt: number;
}

export default function ParkingViewer({ levels, mapObjects = [], selectedLevelCode, selectedId, onSelect }: {
  levels: ModelLevel[];
  mapObjects?: ParkingMapObject[];
  selectedLevelCode: string;
  selectedId: string | null;
  onSelect: (slot: ModelSlot) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const slotInstances = useRef(new Map<string, SlotInstance>());
  const slotMeshes = useRef<THREE.InstancedMesh[]>([]);
  const colorTransitions = useRef(new Map<string, {
    from: THREE.Color;
    to: THREE.Color;
    startedAt: number;
  }>());
  const resetCameraRef = useRef<(() => void) | null>(null);
  const focusLevelRef = useRef<((levelCode: string) => void) | null>(null);
  const selectCallback = useRef(onSelect);
  const levelsRef = useRef(levels);
  const selectedLevelRef = useRef(selectedLevelCode);
  const [error, setError] = useState(false);
  const layoutKey = useMemo(() => JSON.stringify({
    levels: levels.map(level => [
      level.levelId,
      level.levelCode,
      level.slots.map(slot => [slot.slotId, slot.zoneCode]),
    ]),
    mapObjects,
  }), [levels, mapObjects]);
  selectCallback.current = onSelect;
  levelsRef.current = levels;
  selectedLevelRef.current = selectedLevelCode;

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
    const { scene, levelGroups, slotMeshes: sceneSlotMeshes, dispose } =
      createParkingArea(levelsRef.current, mapObjects);
    slotMeshes.current = sceneSlotMeshes;
    slotInstances.current.clear();
    sceneSlotMeshes.forEach(mesh => {
      const meshSlots = mesh.userData.slots as ModelSlot[];
      meshSlots.forEach((slot, instanceId) => {
        slotInstances.current.set(slot.slotId, { mesh, instanceId, slot });
      });
    });

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.05;

    let transition: CameraTransition | null = null;
    const activeLevelIndex = () => Math.max(
      0,
      levelGroups.findIndex(level => level.levelCode === selectedLevelRef.current),
    );
    const fitCamera = () => {
      const activeLevel = levelGroups[activeLevelIndex()];
      if (!activeLevel) return;
      transition = null;
      const size = new THREE.Vector3(activeLevel.width, 1, activeLevel.depth);
      const distance = Math.max(size.x, size.z, 8) * 1.65;
      controls.target.copy(activeLevel.center);
      camera.position.set(
        activeLevel.center.x + distance * 0.72,
        activeLevel.center.y + distance,
        activeLevel.center.z + distance,
      );
      camera.near = Math.max(distance / 1000, 0.1);
      camera.far = distance * 20;
      camera.updateProjectionMatrix();
      controls.minDistance = Math.max(4, distance / 4);
      controls.maxDistance = distance * 5;
      controls.update();
    };

    const crossSection = (levelCode: string, animate: boolean) => {
      const selectedIndex = Math.max(
        0,
        levelGroups.findIndex(level => level.levelCode === levelCode),
      );
      levelGroups.forEach((level, index) => {
        const distance = Math.abs(index - selectedIndex);
        level.group.visible = distance <= 1;
        const opacityScale = distance === 0 ? 1 : 0.2;
        level.group.traverse(object => {
          if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments)) return;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => {
            material.userData.baseOpacity ??= material.opacity;
            material.userData.baseTransparent ??= material.transparent;
            const transparent = material.userData.baseTransparent || opacityScale < 1;
            if (material.transparent !== transparent) material.needsUpdate = true;
            material.transparent = transparent;
            material.opacity = material.userData.baseOpacity * opacityScale;
            material.depthWrite = !transparent;
          });
        });
      });

      const targetLevel = levelGroups[selectedIndex];
      if (!targetLevel) return;
      const targetPosition = camera.position.clone();
      targetPosition.y += targetLevel.center.y - controls.target.y;
      const now = performance.now();
      transition = animate ? {
        fromPosition: camera.position.clone(),
        toPosition: targetPosition,
        fromTarget: controls.target.clone(),
        toTarget: targetLevel.center.clone(),
        startedAt: now,
      } : null;
      if (!animate) {
        camera.position.copy(targetPosition);
        controls.target.copy(targetLevel.center);
        controls.update();
      }
    };
    fitCamera();
    crossSection(selectedLevelCode, false);
    resetCameraRef.current = fitCamera;
    focusLevelRef.current = levelCode => crossSection(levelCode, true);

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
      const hit = raycaster.intersectObjects(slotMeshes.current, false)[0];
      if (!hit || hit.instanceId === undefined) return;
      const slot = hit.object.userData.slots[hit.instanceId] as ModelSlot | undefined;
      if (slot) selectCallback.current(slot);
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    const dirtyMeshes = new Set<THREE.InstancedMesh>();
    renderer.setAnimationLoop(() => {
      const now = performance.now();
      if (transition) {
        const progress = Math.min(1, (now - transition.startedAt) / 360);
        const eased = 1 - (1 - progress) ** 3;
        camera.position.lerpVectors(transition.fromPosition, transition.toPosition, eased);
        controls.target.lerpVectors(transition.fromTarget, transition.toTarget, eased);
        if (progress === 1) transition = null;
      }

      dirtyMeshes.clear();
      colorTransitions.current.forEach((colorTransition, slotId) => {
        const instance = slotInstances.current.get(slotId);
        if (!instance) {
          colorTransitions.current.delete(slotId);
          return;
        }
        const progress = Math.min(1, (now - colorTransition.startedAt) / 180);
        const color = colorTransition.from.clone().lerp(colorTransition.to, progress);
        instance.mesh.setColorAt(instance.instanceId, color);
        dirtyMeshes.add(instance.mesh);
        if (progress === 1) colorTransitions.current.delete(slotId);
      });
      dirtyMeshes.forEach(mesh => {
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      });
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      resize.disconnect();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      controls.dispose();
      dispose();
      renderer.dispose();
      renderer.domElement.remove();
      slotMeshes.current = [];
      slotInstances.current.clear();
      colorTransitions.current.clear();
      resetCameraRef.current = null;
      focusLevelRef.current = null;
    };
  }, [layoutKey]);

  useEffect(() => {
    const activeIndex = levels.findIndex(level => level.levelCode === selectedLevelCode);
    const activeLevel = levels[activeIndex];
    if (!activeLevel) return;
    const activeSlots = new Map(levels.flatMap(level => level.slots.map(slot => [slot.slotId, slot] as const)));
    slotInstances.current.forEach((instance, slotId) => {
      const slot = activeSlots.get(slotId);
      if (!slot) return;
      instance.slot = slot;
      const target = new THREE.Color(slot.slotId === selectedId
        ? 0x072d59
        : slotColors[slot.status.toUpperCase()] ?? 0x64748b);
      const current = new THREE.Color();
      instance.mesh.getColorAt(instance.instanceId, current);
      if (!current.equals(target)) {
        colorTransitions.current.set(slotId, {
          from: current,
          to: target,
          startedAt: performance.now(),
        });
      }
    });
  }, [levels, selectedId, selectedLevelCode]);

  useEffect(() => {
    focusLevelRef.current?.(selectedLevelCode);
  }, [selectedLevelCode, layoutKey]);

  const selectedLevelName = levels.find(level => level.levelCode === selectedLevelCode)?.levelName
    ?? selectedLevelCode;

  return (
    <div className="booking-viewer" ref={host} aria-label="Mô hình bãi đỗ 3D">
      <p className="booking-cross-section" aria-live="polite">
        Mặt cắt {selectedLevelName} · tầng liền kề hiển thị mờ
      </p>
      {error && <p role="alert">Không thể mở đồ họa 3D. Danh sách ô bên dưới vẫn dùng được.</p>}
      <button className="booking-camera-reset" type="button" disabled={error}
        onClick={() => resetCameraRef.current?.()}>
        Đặt lại camera
      </button>
    </div>
  );
}
