import assert from "node:assert/strict";
import test from "node:test";
import { remainingHoldSeconds } from "./bookingHold.ts";

const deadline = "2026-10-29T02:05:00Z";
const atDeadline = Date.parse(deadline);

test("counts down to the persisted backend deadline as time advances", () => {
  assert.equal(remainingHoldSeconds(deadline, atDeadline - 300_000), 300);
  assert.equal(remainingHoldSeconds(deadline, atDeadline - 180_000), 180);
});

test("keeps the last partial second available until the exact deadline", () => {
  assert.equal(remainingHoldSeconds(deadline, atDeadline - 1), 1);
  assert.equal(remainingHoldSeconds(deadline, atDeadline - 999), 1);
});

test("expires exactly at the deadline and never returns a negative countdown", () => {
  assert.equal(remainingHoldSeconds(deadline, atDeadline), 0);
  assert.equal(remainingHoldSeconds(deadline, atDeadline + 1), 0);
});

test("interprets timezone offsets as the same instant", () => {
  assert.equal(remainingHoldSeconds("2026-10-29T09:05:00+07:00", atDeadline - 1000), 1);
});

test("does not invent a new hold for a missing or invalid deadline", () => {
  for (const value of [null, undefined, "", "invalid"]) {
    assert.equal(remainingHoldSeconds(value, atDeadline), null);
  }
});
