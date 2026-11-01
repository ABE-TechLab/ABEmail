import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyAndParseResendWebhook, verifyResendWebhookSignature } from "./resend-webhook-security.mjs";
import {
  aggregateRecipientDeliveryStatus,
  processResendRecipientDeliveryEvent,
  shouldApplyRecipientEvent,
} from "./resend-delivery-state.mjs";
import { classifyProviderEventDuplicate } from "./resend-webhook-state.mjs";

const now = () => new Date("2026-11-01T15:00:00.000Z");
const orgA = "20000000-0000-4000-8000-000000000001";
const orgB = "20000000-0000-4000-8000-000000000002";
const mailboxA = "31000000-0000-4000-8000-000000000001";
const messageId = "60000000-0000-4000-8000-000000000001";
const providerMessageId = "re_multi_001";
const recipients = ["alice@example.net", "bob@example.net"];

function signatureFor(rawBody, id, timestamp, secret) {
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const digest = createHmac("sha256", key).update(id + "." + timestamp + "." + rawBody).digest("base64");
  return "v1," + digest;
}

function memoryRepository(messages) {
  const rows = new Map();
  const events = [];
  return {
    rows,
    events,
    async findOutboundMessage({ providerMessageId: requestedId, organizationId, fromAddress }) {
      return messages.find((message) =>
        message.providerMessageId === requestedId &&
        message.direction === "outbound" &&
        (organizationId ? message.organizationId === organizationId : message.fromAddress === fromAddress)
      ) ?? null;
    },
    async ensureRecipient(input) {
      const key = input.organizationId + ":" + input.messageId + ":" + input.recipientEmail;
      if (!rows.has(key)) rows.set(key, { ...input, status: "processing", lastEventAt: null, deliveredAt: null });
    },
    async applyRecipientEvent(input) {
      const key = input.organizationId + ":" + input.messageId + ":" + input.recipientEmail;
      const row = rows.get(key);
      if (!row) throw new Error("recipient row missing");
      if (!shouldApplyRecipientEvent(row.status, row.lastEventAt, input.status, input.eventAt)) return false;
      Object.assign(row, { status: input.status, lastEventAt: input.eventAt, lastProviderEventId: input.eventId, deliveredAt: input.deliveredAt ?? row.deliveredAt });
      return true;
    },
  };
}

test("verifies the exact raw Resend webhook payload and rejects tampering", () => {
  const rawBody = JSON.stringify({ type: "email.delivered", data: { email_id: providerMessageId, to: ["alice@example.net"] } });
  const id = "evt_test_001";
  const timestamp = String(Math.floor(now().getTime() / 1000));
  const secret = "whsec_" + Buffer.from("test-signing-secret").toString("base64");
  const signature = signatureFor(rawBody, id, timestamp, secret);
  assert.equal(verifyResendWebhookSignature({ rawBody, id, timestamp, signature, secret, now: now().getTime() }), true);
  assert.equal(verifyResendWebhookSignature({ rawBody: rawBody + " ", id, timestamp, signature, secret, now: now().getTime() }), false);
  assert.equal(verifyResendWebhookSignature({ rawBody, id, timestamp: String(Number(timestamp) - 600), signature, secret, now: now().getTime() }), false);

  const parsed = verifyAndParseResendWebhook({ rawBody, id, timestamp, signature, secret, now: now().getTime() });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.event.type, "email.delivered");
  assert.equal(parsed.eventId, id);

  const malformed = "{not-json";
  const malformedSignature = signatureFor(malformed, id, timestamp, secret);
  const malformedResult = verifyAndParseResendWebhook({ rawBody: malformed, id, timestamp, signature: malformedSignature, secret, now: now().getTime() });
  assert.deepEqual(malformedResult, { ok: false, status: 400, error: "Invalid webhook payload." });

  const invalidSignature = verifyAndParseResendWebhook({ rawBody, id, timestamp, signature: "v1,invalid", secret, now: now().getTime() });
  assert.equal(invalidSignature.ok, false);
  assert.equal(invalidSignature.status, 401);
});

test("tenant webhook routing never matches a message owned by a different organization", async () => {
  const repository = memoryRepository([{
    id: messageId, organizationId: orgB, mailboxId: "31000000-0000-4000-8000-000000000003",
    providerMessageId, direction: "outbound", fromAddress: "team@tenant-b.example.com",
    toAddresses: recipients,
  }]);
  const result = await processResendRecipientDeliveryEvent({
    event: { type: "email.delivered", created_at: "2026-11-01T14:00:00.000Z", data: { email_id: providerMessageId, to: ["alice@example.net"] } },
    eventId: "evt_tenant_scope",
    tenantOrganizationId: orgA,
    repository,
    now,
  });
  assert.equal(result.matched, false);
  assert.equal(repository.rows.size, 0);
});

test("separate delivery events update only their addressed recipients and aggregate to partial delivery", async () => {
  const repository = memoryRepository([{
    id: messageId, organizationId: orgA, mailboxId: mailboxA,
    providerMessageId, direction: "outbound", fromAddress: "owner@tenant-a.example.com",
    toAddresses: recipients,
  }]);

  const delivered = await processResendRecipientDeliveryEvent({
    event: { type: "email.delivered", created_at: "2026-11-01T14:00:00.000Z", data: { email_id: providerMessageId, to: ["Alice <alice@example.net>"] } },
    eventId: "evt_delivered_a", tenantOrganizationId: orgA, repository, now,
  });
  const bounced = await processResendRecipientDeliveryEvent({
    event: { type: "email.bounced", created_at: "2026-11-01T14:01:00.000Z", data: { email_id: providerMessageId, to: ["bob@example.net"] } },
    eventId: "evt_bounced_b", tenantOrganizationId: orgA, repository, now,
  });

  assert.equal(delivered.updatedRecipients, 1);
  assert.equal(bounced.updatedRecipients, 1);
  assert.equal(repository.rows.get(orgA + ":" + messageId + ":alice@example.net").status, "delivered");
  assert.equal(repository.rows.get(orgA + ":" + messageId + ":bob@example.net").status, "bounced");
  assert.equal(aggregateRecipientDeliveryStatus(Array.from(repository.rows.values()).map((row) => row.status)), "partially_delivered");
});

test("a late delayed event cannot regress a recipient already marked delivered", async () => {
  const repository = memoryRepository([{
    id: messageId, organizationId: orgA, mailboxId: mailboxA,
    providerMessageId, direction: "outbound", fromAddress: "owner@tenant-a.example.com",
    toAddresses: [recipients[0]],
  }]);
  await processResendRecipientDeliveryEvent({
    event: { type: "email.delivered", created_at: "2026-11-01T14:02:00.000Z", data: { email_id: providerMessageId, to: [recipients[0]] } },
    eventId: "evt_delivered_later", tenantOrganizationId: orgA, repository, now,
  });
  const delayed = await processResendRecipientDeliveryEvent({
    event: { type: "email.delivery_delayed", created_at: "2026-11-01T14:01:00.000Z", data: { email_id: providerMessageId, to: [recipients[0]] } },
    eventId: "evt_delayed_earlier", tenantOrganizationId: orgA, repository, now,
  });
  assert.equal(delayed.updatedRecipients, 0);
  assert.equal(repository.rows.get(orgA + ":" + messageId + ":" + recipients[0]).status, "delivered");
});

test("an ambiguous multi-recipient outcome payload is not applied to every recipient", async () => {
  const repository = memoryRepository([{
    id: messageId, organizationId: orgA, mailboxId: mailboxA,
    providerMessageId, direction: "outbound", fromAddress: "owner@tenant-a.example.com",
    toAddresses: recipients,
  }]);
  const result = await processResendRecipientDeliveryEvent({
    event: { type: "email.bounced", created_at: "2026-11-01T14:00:00.000Z", data: { email_id: providerMessageId, to: recipients } },
    eventId: "evt_ambiguous", tenantOrganizationId: orgA, repository, now,
  });
  assert.equal(result.reason, "recipient_unresolved");
  assert.equal(repository.rows.size, 0);
});

test("processed webhook rows are acknowledged, while in-flight rows ask for a retry", () => {
  assert.equal(classifyProviderEventDuplicate("processed", "2026-11-01T14:00:00.000Z", now().getTime()), "acknowledge");
  assert.equal(classifyProviderEventDuplicate("processing", "2026-11-01T14:59:59.000Z", now().getTime()), "retry");
  assert.equal(classifyProviderEventDuplicate("failed", "2026-11-01T14:59:00.000Z", now().getTime()), "claim");
});
