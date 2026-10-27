const supportedStatuses = new Set([
  "AVAILABLE",
  "HELD",
  "RESERVED",
  "OCCUPIED",
  "MAINTENANCE",
]);

function getStringField(payload, field) {
  const value = payload[field] ?? payload[`${field[0].toUpperCase()}${field.slice(1)}`];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function parseSlotStatusChanged(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;

  const slotId = getStringField(payload, "slotId");
  const status = getStringField(payload, "status")?.toUpperCase();
  if (!slotId || !status || !supportedStatuses.has(status)) return null;

  return {
    slotId,
    status,
    parkingLotId: getStringField(payload, "parkingLotId"),
  };
}

export function applySlotStatusChanges(slots, changes, parkingLotId) {
  const changesById = new Map(
    changes
      .filter(change => !change.parkingLotId || change.parkingLotId === parkingLotId)
      .map(change => [change.slotId, change.status]),
  );

  let changed = false;
  const updatedSlots = slots.map(slot => {
    const status = changesById.get(slot.slotId);
    if (!status || slot.status === status) return slot;
    changed = true;
    return { ...slot, status };
  });

  return changed ? updatedSlots : [...slots];
}
