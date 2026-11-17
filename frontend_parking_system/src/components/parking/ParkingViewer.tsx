import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useLanguage } from "../../context/LanguageContext";
import {
  createBuildingParkingArea,
  createOutdoorParkingArea,
  OUTDOOR_SLOT_COLORS,
  type MotoSceneStats,
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

function resolveBuildingFloorNumber(levelCode: string, levels: ModelLevel[]): number {
  const code = (levelCode || "").trim().toUpperCase();
  if (!code || code === "ALL" || code === "0") return 0;
  if (code === "F1" || code === "1" || code === "MOTO") return 1;
  if (code === "F2" || code === "2") return 2;
  if (code === "F3" || code === "3") return 3;
  const idx = levels.findIndex(l => l.levelCode.toUpperCase() === code);
  if (idx >= 0) {
    if (levels.length === 1) return 2;
    return Math.min(3, idx + 1);
  }
  return 0;
}

export default function ParkingViewer({
  levels,
  selectedLevelCode,
  selectedId,
  onSelect,
  lotCode,
  isBuilding,
  motoStats,
}: {
  levels: ModelLevel[];
  mapObjects?: ParkingMapObject[];
  selectedLevelCode: string;
  selectedId: string | null;
  onSelect: (slot: ModelSlot) => void;
  lotCode?: string;
  isBuilding?: boolean;
  motoStats?: MotoSceneStats | null;
}) {
  const { lang } = useLanguage();
  const isEn = lang === "en";
  const host = useRef<HTMLDivElement>(null);
  const meshes = useRef<THREE.Mesh[]>([]);
  const colorTransitions = useRef(new Map<THREE.Mesh, {
    from: THREE.Color;
    to: THREE.Color;
    startedAt: number;
  }>());
  const resetCameraRef = useRef<(() => void) | null>(null);
  const applyFloorViewRef = useRef<((floorNum: number) => void) | null>(null);
  const updateMotoStatsRef = useRef<((stats: MotoSceneStats | null) => void) | null>(null);
  const selectCallback = useRef(onSelect);
  const [error, setError] = useState(false);
  const [motoBoardInfo, setMotoBoardInfo] = useState<{
    id: string;
    floor: number;
    availableMoto: number;
    maxCapacity: number;
    currentMoto: number;
  } | null>(null);

  const buildingMode = useMemo(() => {
    if (typeof isBuilding === "boolean") return isBuilding;
    const upperLot = (lotCode || "").toUpperCase();
    if (upperLot.includes("BT")) return false;
    if (upperLot.includes("Q1") || upperLot.includes("Q7")) return true;
    if (levels.length > 1) return true;
    const firstCode = levels[0]?.levelCode?.toUpperCase() ?? "";
    return firstCode === "B1" || firstCode === "F1" || firstCode === "F2" || firstCode === "F3";
  }, [isBuilding, lotCode, levels]);

  const activeLevel = useMemo(
    () => levels.find(level => level.levelCode === selectedLevelCode) ?? levels[0] ?? null,
    [levels, selectedLevelCode],
  );
  const activeSlots = useMemo(
    () => (buildingMode ? levels.flatMap(level => level.slots) : activeLevel?.slots ?? []),
    [buildingMode, levels, activeLevel],
  );

  const levelsRef = useRef(levels);
  const activeSlotsRef = useRef(activeSlots);
  const selectedIdRef = useRef(selectedId);
  const selectedLevelCodeRef = useRef(selectedLevelCode);
  const motoStatsRef = useRef(motoStats ?? null);

  selectCallback.current = onSelect;
  levelsRef.current = levels;
  activeSlotsRef.current = activeSlots;
  selectedIdRef.current = selectedId;
  selectedLevelCodeRef.current = selectedLevelCode;
  motoStatsRef.current = motoStats ?? null;

  const layoutKey = useMemo(() => {
    if (buildingMode) {
      return `building:${levels.map(l => `${l.levelId}:${l.slots.length}`).join("|")}`;
    }
    return `outdoor:${activeLevel?.levelId ?? ""}:${(activeLevel?.slots ?? []).map(s => s.slotId).join("|")}`;
  }, [buildingMode, levels, activeLevel]);

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
    setMotoBoardInfo(null);
    colorTransitions.current.clear();

    const isBuildingScene = buildingMode;
    const camera = new THREE.PerspectiveCamera(isBuildingScene ? 55 : 60, 1, 0.1, 1000);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = isBuildingScene;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 12;
    controls.maxDistance = isBuildingScene ? 180 : 100;
    controls.maxPolarAngle = Math.PI / 2.02;

    let scene: THREE.Scene;
    let interactableMeshes: THREE.Mesh[] = [];
    let disposeScene: () => void;

    if (isBuildingScene) {
      const built = createBuildingParkingArea(levelsRef.current, motoStatsRef.current);
      scene = built.scene;
      meshes.current = built.slotMeshes;
      interactableMeshes = built.interactables;
      disposeScene = built.dispose;
      updateMotoStatsRef.current = built.updateMotoStats;

      const showFloor = (f: number) => {
        setMotoBoardInfo(null);
        built.floors.forEach((g, i) => {
          g.visible = f === 0 || f === i + 1;
        });
        if (built.motoFloor1CenterSprite) {
          built.motoFloor1CenterSprite.visible = f === 1;
        }
        built.floorColumnGroups.forEach(cg => {
          cg.visible = f === 0;
        });
        const targetY = f === 0 ? 9 : (f - 1) * built.floorHeight + 1.5;
        controls.target.set(-5, targetY, 0);
        camera.position.set(
          f === 0 ? 70 : -5,
          f === 0 ? 55 : (f - 1) * built.floorHeight + 48,
          f === 0 ? 80 : 48,
        );
        camera.updateProjectionMatrix();
        controls.update();
      };

      applyFloorViewRef.current = showFloor;
      const initialFloor = resolveBuildingFloorNumber(selectedLevelCodeRef.current, levelsRef.current);
      showFloor(initialFloor);
      resetCameraRef.current = () => {
        const currentFloor = resolveBuildingFloorNumber(selectedLevelCodeRef.current, levelsRef.current);
        showFloor(currentFloor);
      };
    } else {
      const built = createOutdoorParkingArea(activeSlotsRef.current, motoStatsRef.current);
      scene = built.scene;
      meshes.current = built.slotMeshes;
      interactableMeshes = built.slotMeshes;
      disposeScene = built.dispose;
      updateMotoStatsRef.current = built.updateMotoStats;

      const fitOutdoorCamera = () => {
        controls.target.set(0, 0, 0);
        camera.position.set(35, 35, 45);
        camera.updateProjectionMatrix();
        controls.update();
      };
      fitOutdoorCamera();
      applyFloorViewRef.current = null;
      resetCameraRef.current = fitOutdoorCamera;
    }

    meshes.current.forEach(mesh => {
      const slot = mesh.userData as ModelSlot;
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.color.setHex(
        slot.slotId === selectedIdRef.current
          ? OUTDOOR_SLOT_COLORS.SELECTED
          : OUTDOOR_SLOT_COLORS[String(slot.status).toUpperCase()] ?? OUTDOOR_SLOT_COLORS.AVAILABLE,
      );
    });

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
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      ), camera);

      const visibleTargets = interactableMeshes.filter(s => {
        let p: THREE.Object3D | null = s.parent;
        while (p) {
          if (!p.visible) return false;
          p = p.parent;
        }
        return true;
      });

      const hit = raycaster.intersectObjects(visibleTargets, false)[0];
      if (!hit) return;

      const data = hit.object.userData;
      if (data?.isMotoInfo) {
        setMotoBoardInfo({
          id: data.id,
          floor: data.floor,
          availableMoto: data.availableMoto,
          maxCapacity: data.maxCapacity,
          currentMoto: data.currentMoto,
        });
        return;
      }

      setMotoBoardInfo(null);
      const slot = data as ModelSlot | undefined;
      if (slot && slot.slotId) {
        selectCallback.current({ ...slot });
      }
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);

    renderer.setAnimationLoop(() => {
      const now = performance.now();
      colorTransitions.current.forEach((transition, mesh) => {
        const progress = Math.min(1, (now - transition.startedAt) / 180);
        (mesh.material as THREE.MeshStandardMaterial).color
          .copy(transition.from)
          .lerp(transition.to, progress);
        if (progress === 1) colorTransitions.current.delete(mesh);
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
      disposeScene();
      renderer.dispose();
      renderer.domElement.remove();
      meshes.current = [];
      colorTransitions.current.clear();
      resetCameraRef.current = null;
      applyFloorViewRef.current = null;
      updateMotoStatsRef.current = null;
    };
  }, [layoutKey, buildingMode]);

  useEffect(() => {
    if (!buildingMode || !applyFloorViewRef.current) return;
    const floorNum = resolveBuildingFloorNumber(selectedLevelCode, levels);
    applyFloorViewRef.current(floorNum);
  }, [buildingMode, selectedLevelCode, levels]);

  useEffect(() => {
    updateMotoStatsRef.current?.(motoStats ?? null);
    if (motoStats) {
      setMotoBoardInfo(prev =>
        prev
          ? {
              ...prev,
              availableMoto: motoStats.availableMoto,
              maxCapacity: motoStats.maxCapacity,
              currentMoto: motoStats.currentMoto,
            }
          : null,
      );
    }
  }, [motoStats]);

  useEffect(() => {
    const slotById = new Map(activeSlots.map(slot => [slot.slotId, slot] as const));
    meshes.current.forEach(mesh => {
      const slot = slotById.get(String(mesh.userData.slotId));
      if (slot) {
        mesh.userData = { ...mesh.userData, ...slot };
      }
      const status = String(slot?.status ?? mesh.userData.status ?? "AVAILABLE").toUpperCase();
      const isSelected = String(mesh.userData.slotId) === selectedId;
      const material = mesh.material as THREE.MeshStandardMaterial;
      const target = new THREE.Color(
        isSelected
          ? OUTDOOR_SLOT_COLORS.SELECTED
          : OUTDOOR_SLOT_COLORS[status] ?? OUTDOOR_SLOT_COLORS.AVAILABLE,
      );
      if (!material.color.equals(target)) {
        colorTransitions.current.set(mesh, {
          from: material.color.clone(),
          to: target,
          startedAt: performance.now(),
        });
      }
    });
  }, [activeSlots, selectedId]);

  return (
    <div className="booking-viewer" ref={host} aria-label={isEn ? "3D parking model" : "Mô hình bãi đỗ 3D"}>
      {error && <p role="alert">{isEn ? "Unable to open 3D graphics. You can still use the slot list below." : "Không thể mở đồ họa 3D. Danh sách ô bên dưới vẫn dùng được."}</p>}
      {motoBoardInfo && (
        <div
          style={{
            position: "absolute",
            left: 14,
            bottom: 14,
            zIndex: 2,
            background: "rgba(255, 255, 255, 0.94)",
            border: "1px solid #cbdde5",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 12,
            color: "#072d59",
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.14)",
          }}
        >
          <strong style={{ display: "block", marginBottom: 4 }}>{isEn ? "MOTORBIKE PARKING INFO BOARD" : motoBoardInfo.id}</strong>
          <div>
            {isEn
              ? `Floor ${motoBoardInfo.floor} · Available: ${motoBoardInfo.availableMoto} / ${motoBoardInfo.maxCapacity} slots (Parked: ${motoBoardInfo.currentMoto} bikes)`
              : `Tầng ${motoBoardInfo.floor} · Trống: ${motoBoardInfo.availableMoto} / ${motoBoardInfo.maxCapacity} slots (Đang gửi: ${motoBoardInfo.currentMoto} xe)`}
          </div>
        </div>
      )}
      <button className="booking-camera-reset" type="button" disabled={error}
        onClick={() => resetCameraRef.current?.()}>
        {isEn ? "Reset camera" : "Đặt lại camera"}
      </button>
    </div>
  );
}
