import test from "node:test";
import assert from "node:assert/strict";
import { classifyProviderEventDuplicate } from "./resend-webhook-state.mjs";

const NOW = Date.parse("2026-11-01T15:00:00.000Z");

test("acknowledges only events already marked processed", () => {
  assert.equal(classifyProviderEventDuplicate("processed", "2026-11-01T14:59:00.000Z", NOW), "acknowledge");
});

test("allows an atomic reclaim only for a failed event", () => {
  assert.equal(classifyProviderEventDuplicate("failed", "2026-11-01T14:59:00.000Z", NOW), "claim");
});

test("asks the provider to retry an event that is still being processed", () => {
  assert.equal(classifyProviderEventDuplicate("processing", "2026-11-01T14:58:00.001Z", NOW), "retry");
});

test("marks a processing event stale at the five-minute boundary", () => {
  assert.equal(classifyProviderEventDuplicate("processing", "2026-11-01T14:55:00.000Z", NOW), "recover");
});

test("fails closed when the processing timestamp is missing or invalid", () => {
  assert.equal(classifyProviderEventDuplicate("processing", null, NOW), "retry");
  assert.equal(classifyProviderEventDuplicate("processing", "not-a-date", NOW), "retry");
});

test("does not acknowledge unknown event states", () => {
  assert.equal(classifyProviderEventDuplicate("unknown", "2026-11-01T14:59:00.000Z", NOW), "retry");
});
