export type SlotStatus = "AVAILABLE" | "HELD" | "RESERVED" | "OCCUPIED" | "MAINTENANCE";

export interface SlotStatusChange {
  slotId: string;
  status: SlotStatus;
  parkingLotId?: string;
}

interface SlotWithStatus {
  slotId: string;
  status: string;
}

export function parseSlotStatusChanged(payload: unknown): SlotStatusChange | null;

export function applySlotStatusChanges<T extends SlotWithStatus>(
  slots: readonly T[],
  changes: readonly SlotStatusChange[],
  parkingLotId: string,
): T[];
