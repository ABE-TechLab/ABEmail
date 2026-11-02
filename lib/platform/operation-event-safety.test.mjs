import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeAuditMetadata, sanitizeUsageMetadata } from "./operation-event-safety.mjs";

test("audit metadata keeps only bounded operational fields", () => {
  assert.deepEqual(
    sanitizeAuditMetadata({
      from_role: "member",
      to_role: "admin",
      changed_fields: ["display_name", "api_key", "mailbox_id", "DROP TABLE"],
      email: "customer@example.com",
      subject: "private subject",
      secret: "never store",
      message_count: 3,
    }),
    {
      from_role: "member",
      to_role: "admin",
      changed_fields: ["display_name", "mailbox_id"],
      message_count: 3,
    },
  );
});

test("usage metadata excludes message content and recipient addresses", () => {
  assert.deepEqual(
    sanitizeUsageMetadata({
      message_id: "message-123",
      recipient_count: 2,
      source: "scheduled",
      subject: "private",
      to: ["person@example.com"],
      body: "private body",
    }),
    { message_id: "message-123", recipient_count: 2, source: "scheduled" },
  );
});

test("invalid and nested values are ignored", () => {
  assert.deepEqual(
    sanitizeAuditMetadata({ from_status: { nested: true }, to_status: "", outcome: true, message_count: Infinity }),
    { outcome: true },
  );
});

