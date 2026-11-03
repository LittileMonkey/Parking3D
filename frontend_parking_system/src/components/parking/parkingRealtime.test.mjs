import assert from "node:assert/strict";
import test from "node:test";
import {
  applySlotStatusChanges,
  parseSlotStatusChanged,
} from "./parkingRealtime.js";

test("parses PascalCase SignalR slot status payloads", () => {
  assert.deepEqual(parseSlotStatusChanged({
    SlotId: "slot-1",
    Status: "Occupied",
    ParkingLotId: "lot-1",
  }), {
    slotId: "slot-1",
    status: "OCCUPIED",
    parkingLotId: "lot-1",
  });
});

test("ignores payloads without a supported slot status", () => {
  assert.equal(parseSlotStatusChanged({ SlotId: "slot-1", Status: 3 }), null);
  assert.equal(parseSlotStatusChanged({ SlotId: "slot-1", Status: "Unknown" }), null);
});

test("applies only matching slot changes and preserves unrelated slot data", () => {
  const slots = [
    { slotId: "slot-1", slotCode: "A1", status: "AVAILABLE" },
    { slotId: "slot-2", slotCode: "A2", status: "AVAILABLE" },
  ];
  const changes = [
    { slotId: "slot-1", status: "OCCUPIED", parkingLotId: "lot-1" },
    { slotId: "unknown", status: "RESERVED" },
  ];

  assert.deepEqual(applySlotStatusChanges(slots, changes, "lot-1"), [
    { slotId: "slot-1", slotCode: "A1", status: "OCCUPIED" },
    { slotId: "slot-2", slotCode: "A2", status: "AVAILABLE" },
  ]);
});

test("ignores changes tagged for a different parking lot", () => {
  const slots = [{ slotId: "slot-1", status: "AVAILABLE" }];

  assert.deepEqual(applySlotStatusChanges(slots, [
    { slotId: "slot-1", status: "OCCUPIED", parkingLotId: "lot-2" },
  ], "lot-1"), slots);
});
