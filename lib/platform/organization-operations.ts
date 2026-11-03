import "server-only";

import { sanitizeAuditMetadata, sanitizeUsageMetadata } from "@/lib/platform/operation-event-safety.mjs";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

export type OrganizationAuditEvent = {
  organizationId: string;
  actorUserId?: string | null;
  actorType?: "user" | "system" | "provider";
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome?: "success" | "denied" | "failure";
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
};

export type OrganizationUsageEvent = {
  organizationId: string;
  mailboxId?: string | null;
  metric:
    | "outbound_messages_accepted"
    | "outbound_recipients_accepted"
    | "inbound_messages_received"
    | "provider_events_processed";
  eventType: string;
  quantity?: number;
  idempotencyKey: string;
  provider?: string | null;
  providerEventId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordOrganizationAuditEvent(
  admin: AdminClient,
  event: OrganizationAuditEvent,
): Promise<void> {
  const payload = {
    organization_id: event.organizationId,
    actor_user_id: event.actorUserId ?? null,
    actor_type: event.actorType ?? (event.actorUserId ? "user" : "system"),
    action: event.action,
    resource_type: event.resourceType,
    resource_id: event.resourceId ?? null,
    outcome: event.outcome ?? "success",
    idempotency_key: event.idempotencyKey ?? null,
    metadata: sanitizeAuditMetadata(event.metadata),
  };

  const { error } = event.idempotencyKey
    ? await admin.from("organization_audit_events").upsert(payload, {
        onConflict: "organization_id,idempotency_key",
        ignoreDuplicates: true,
      })
    : await admin.from("organization_audit_events").insert(payload);

  if (error) throw new Error("PLATFORM_AUDIT_EVENT_WRITE_FAILED");
}

export async function recordOrganizationUsageEvent(
  admin: AdminClient,
  event: OrganizationUsageEvent,
): Promise<void> {
  const { error } = await admin.from("organization_usage_events").upsert({
    organization_id: event.organizationId,
    mailbox_id: event.mailboxId ?? null,
    metric: event.metric,
    event_type: event.eventType,
    quantity: event.quantity ?? 1,
    idempotency_key: event.idempotencyKey,
    provider: event.provider ?? null,
    provider_event_id: event.providerEventId ?? null,
    metadata: sanitizeUsageMetadata(event.metadata),
  }, {
    onConflict: "organization_id,idempotency_key",
    ignoreDuplicates: true,
  });

  if (error) throw new Error("ORGANIZATION_USAGE_EVENT_WRITE_FAILED");
}

export type OutboundReservation = {
  allowed: boolean;
  used: number;
  dailyLimit: number;
  alreadyReserved: boolean;
};

export async function reserveOrganizationOutboundMessage(
  admin: AdminClient,
  organizationId: string,
  mailboxId: string,
  idempotencyKey: string,
): Promise<OutboundReservation> {
  const { data, error } = await admin.rpc("reserve_organization_outbound_message", {
    p_organization_id: organizationId,
    p_mailbox_id: mailboxId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw new Error("ORGANIZATION_USAGE_RESERVATION_FAILED");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.allowed !== "boolean") throw new Error("ORGANIZATION_USAGE_RESERVATION_INVALID");
  return {
    allowed: row.allowed,
    used: Number(row.used ?? 0),
    dailyLimit: Number(row.daily_limit ?? 250),
    alreadyReserved: Boolean(row.already_reserved),
  };
}

export async function releaseOrganizationOutboundMessage(
  admin: AdminClient,
  organizationId: string,
  idempotencyKey: string,
): Promise<void> {
  const { error } = await admin.rpc("release_organization_outbound_message", {
    p_organization_id: organizationId,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error("ORGANIZATION_USAGE_RELEASE_FAILED");
}

