const EVENT_STATUS = Object.freeze({
  "email.sent": "accepted",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
  "email.suppressed": "suppressed",
});

const TERMINAL_STATUSES = new Set(["delivered", "bounced", "complained", "failed", "suppressed"]);

/** Normalize a Resend recipient value without trusting display-name text. */
export function normalizeRecipientEmail(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  const angle = trimmed.match(/<([^<>]+)>/);
  const address = (angle?.[1] ?? trimmed).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? address : "";
}

export function recipientStatusFromEvent(eventType) {
  return EVENT_STATUS[eventType] ?? null;
}

/**
 * Resend now emits delivery outcome events for an individual recipient.
 * Only an email.sent event may safely fall back to the full envelope when
 * older payloads omit the recipient. Delivery outcomes must never be guessed.
 */
export function resolveEventRecipients(eventType, eventTo, messageRecipients) {
  const allowed = Array.from(new Set((Array.isArray(messageRecipients) ? messageRecipients : [])
    .map(normalizeRecipientEmail).filter(Boolean)));
  const eventAddresses = Array.isArray(eventTo)
    ? eventTo.map(normalizeRecipientEmail).filter(Boolean)
    : typeof eventTo === "string" ? [normalizeRecipientEmail(eventTo)].filter(Boolean) : [];

  if (eventAddresses.length === 0) {
    if (eventType === "email.sent") return allowed;
    if (allowed.length === 1) return allowed;
    return [];
  }

  const matched = Array.from(new Set(eventAddresses.filter((address) => allowed.includes(address))));
  // A delivery outcome must target exactly one known recipient. A multi-address
  // legacy payload is ambiguous and must not mark every recipient as bounced.
  if (eventType !== "email.sent" && matched.length !== 1) return [];
  return matched;
}

export function shouldApplyRecipientEvent(currentStatus, currentEventAt, nextStatus, nextEventAt) {
  if (!TERMINAL_STATUSES.has(nextStatus) && nextStatus !== "accepted" && nextStatus !== "delayed") return false;
  if (!currentEventAt) return true;
  const currentTime = Date.parse(currentEventAt);
  const nextTime = Date.parse(nextEventAt);
  if (!Number.isFinite(currentTime) || !Number.isFinite(nextTime)) return false;
  return nextTime > currentTime;
}

export function aggregateRecipientDeliveryStatus(statuses) {
  const values = Array.isArray(statuses) ? statuses : [];
  if (values.length === 0) return null;
  const terminalCount = values.filter((status) => TERMINAL_STATUSES.has(status)).length;
  const successCount = values.filter((status) => status === "delivered" || status === "complained").length;
  const failureCount = values.filter((status) => status === "bounced" || status === "failed" || status === "suppressed").length;

  if (terminalCount === values.length) {
    if (successCount > 0 && failureCount > 0) return "partially_delivered";
    if (values.includes("complained")) return "complained";
    if (values.every((status) => status === "delivered")) return "delivered";
    if (values.every((status) => status === "bounced")) return "bounced";
    if (values.every((status) => status === "suppressed")) return "suppressed";
    return "failed";
  }
  if (values.includes("processing")) return "processing";
  if (values.includes("delayed")) return "delayed";
  if (values.includes("accepted")) return "accepted";
  return "processing";
}

/**
 * Apply one signed Resend delivery event to the recipient ledger.
 * Repository methods are injected so the production route and integration
 * tests exercise the same recipient resolution and monotonic status logic.
 */
export async function processResendRecipientDeliveryEvent(input) {
  const {
    event,
    eventId,
    tenantOrganizationId = null,
    pilotFromAddress = null,
    repository,
    now = () => new Date(),
  } = input;

  const providerMessageId = event?.data?.email_id ?? event?.data?.id;
  const nextStatus = recipientStatusFromEvent(event?.type);
  if (!providerMessageId || !nextStatus) {
    return { matched: false, updatedRecipients: 0, reason: "unsupported_event" };
  }

  const message = await repository.findOutboundMessage({
    providerMessageId,
    organizationId: tenantOrganizationId,
    fromAddress: tenantOrganizationId ? null : pilotFromAddress,
  });
  if (!message) return { matched: false, updatedRecipients: 0, reason: "message_not_found" };

  const eventRecipients = resolveEventRecipients(
    event.type,
    event.data?.to,
    message.toAddresses ?? message.to_addresses ?? [],
  );
  if (eventRecipients.length === 0) {
    return {
      matched: true,
      updatedRecipients: 0,
      organizationId: message.organizationId ?? message.organization_id,
      mailboxId: message.mailboxId ?? message.mailbox_id,
      reason: "recipient_unresolved",
    };
  }

  const eventAtValue = event.created_at ?? event.data?.created_at;
  const parsedEventAt = typeof eventAtValue === "string" ? Date.parse(eventAtValue) : Number.NaN;
  const eventAt = Number.isFinite(parsedEventAt) ? new Date(parsedEventAt).toISOString() : now().toISOString();
  const organizationId = message.organizationId ?? message.organization_id;
  const mailboxId = message.mailboxId ?? message.mailbox_id;
  const messageId = message.id;

  let updatedRecipients = 0;
  for (const recipientEmail of eventRecipients) {
    await repository.ensureRecipient({
      organizationId,
      mailboxId,
      messageId,
      recipientEmail,
    });
    const applied = await repository.applyRecipientEvent({
      organizationId,
      mailboxId,
      messageId,
      recipientEmail,
      status: nextStatus,
      eventAt,
      eventId,
      deliveredAt: nextStatus === "delivered" ? eventAt : null,
    });
    if (applied) updatedRecipients += 1;
  }

  return {
    matched: true,
    updatedRecipients,
    organizationId,
    mailboxId,
    reason: updatedRecipients === 0 ? "stale_event" : null,
  };
}
