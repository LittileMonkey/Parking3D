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
