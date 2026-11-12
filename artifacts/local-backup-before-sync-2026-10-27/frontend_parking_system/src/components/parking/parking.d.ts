import type { Scene, Mesh } from "three";
export interface ParkingLayoutSlot {
  slotId: string; floor: number; type: string; status: string;
  width: number; length: number; positionX: number; positionZ: number; backDirection?: number;
}
export interface ParkingLayout { width: number; depth: number; slots: ParkingLayoutSlot[] }
export const SLOT_COLORS: Record<string, number>;
export function createParkingArea(layout?: ParkingLayout): { scene: Scene; slotMeshes: Mesh[] };
