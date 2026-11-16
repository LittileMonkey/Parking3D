import type { InstancedMesh, Mesh, Scene, Vector3 } from "three";
import type { ParkingMapObject } from "../../services/api";

export type { ParkingMapObject };

export interface ParkingSceneSlot {
  slotId: string;
  slotCode: string;
  zoneCode: string;
  status: string;
  supportedVehicleTypes: string[];
  features: string[];
  position?: { x: number; y: number; z: number } | null;
  rotationY?: number | null;
  widthM?: number | null;
  lengthM?: number | null;
  size?: { x: number; y: number; z: number } | null;
}

export interface ParkingSceneLevel {
  levelId: string;
  levelCode: string;
  levelName: string;
  elevationM?: number | null;
  slots: ParkingSceneSlot[];
}

export interface ParkingLevelScene {
  levelId: string;
  levelCode: string;
  levelName: string;
  group: import("three").Group;
  floor: Mesh;
  slotMesh: InstancedMesh;
  center: Vector3;
  width: number;
  depth: number;
}

export function createParkingArea(
  levels: ParkingSceneLevel[],
  mapObjects?: ParkingMapObject[],
): {
  scene: Scene;
  levelGroups: ParkingLevelScene[];
  slotMeshes: InstancedMesh[];
  dispose: () => void;
};

export const OUTDOOR_SLOT_COLORS: Record<string, number>;

export interface MotoSceneStats {
  availableMoto: number;
  maxCapacity: number;
  currentMoto: number;
  showOutdoorBanner?: boolean;
  lang?: "vi" | "en";
}

export function createOutdoorParkingArea(
  slots?: ParkingSceneSlot[],
  initialMotoStats?: MotoSceneStats | null,
): {
  scene: Scene;
  slotMeshes: Mesh[];
  entranceBarrier: unknown;
  exitBarrier: unknown;
  updateMotoStats: (stats: MotoSceneStats | null) => void;
  dispose: () => void;
};

export function createBuildingParkingArea(
  levels?: ParkingSceneLevel[],
  initialMotoStats?: MotoSceneStats | null,
): {
  scene: Scene;
  floors: import("three").Group[];
  floorColumnGroups: import("three").Group[];
  motoFloor1CenterSprite: import("three").Sprite | null;
  floorHeight: number;
  slotMeshes: Mesh[];
  interactables: Mesh[];
  updateMotoStats: (stats: MotoSceneStats | null) => void;
  dispose: () => void;
};



