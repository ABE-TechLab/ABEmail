import test from "node:test";
import assert from "node:assert/strict";
import { canScheduledCreatorSend } from "./scheduled-mail-auth.mjs";

test("active owner and administrator can send scheduled mail", () => {
  assert.equal(canScheduledCreatorSend({ role: "owner", status: "active" }, null), true);
  assert.equal(canScheduledCreatorSend({ role: "admin", status: "active" }, null), true);
});

test("active member requires an active mailbox send grant", () => {
  assert.equal(canScheduledCreatorSend({ role: "member", status: "active" }, { status: "active", can_send: true }), true);
  assert.equal(canScheduledCreatorSend({ role: "member", status: "active" }, { status: "active", can_send: false }), false);
  assert.equal(canScheduledCreatorSend({ role: "member", status: "active" }, { status: "revoked", can_send: true }), false);
  assert.equal(canScheduledCreatorSend({ role: "member", status: "active" }, null), false);
});

test("inactive or missing organization membership always blocks scheduled sending", () => {
  assert.equal(canScheduledCreatorSend({ role: "owner", status: "removed" }, null), false);
  assert.equal(canScheduledCreatorSend(null, { status: "active", can_send: true }), false);
});
