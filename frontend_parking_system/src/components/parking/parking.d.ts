import type { Scene, Mesh } from "three";

export interface ParkingSceneSlot {
  slotId: string;
  slotCode: string;
  floorCode: string;
  zoneCode: string;
  status: string;
}

export function createParkingArea(slots: ParkingSceneSlot[]): { scene: Scene; slotMeshes: Mesh[] };
