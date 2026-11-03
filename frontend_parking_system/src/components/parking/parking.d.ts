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
}

export interface ParkingSceneLevel {
  levelId: string;
  levelCode: string;
  levelName: string;
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
