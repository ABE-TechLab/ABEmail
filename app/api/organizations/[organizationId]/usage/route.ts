import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ organizationId: string }> };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function utcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET(_request: Request, context: RouteContext) {
  const { organizationId } = await context.params;
  if (!UUID_PATTERN.test(organizationId)) return json({ error: "Invalid workspace." }, 400);

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Sign in to view workspace usage." }, 401);

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("role, status")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) return json({ error: "Workspace access could not be checked." }, 503);
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return json({ error: "Only workspace owners and admins can view usage." }, 403);
  }

  const today = utcDate(new Date());
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 29);
  const from = utcDate(start);

  const [limitResult, eventResult] = await Promise.all([
    supabase.from("organization_usage_limits")
      .select("outbound_messages_per_utc_day, enabled, updated_at")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase.from("organization_usage_events")
      .select("id, mailbox_id, metric, event_type, quantity, period_start, occurred_at, created_at, metadata")
      .eq("organization_id", organizationId)
      .gte("period_start", from)
      .lte("period_start", today)
      .order("occurred_at", { ascending: false })
      .limit(1000),
  ]);

  if (limitResult.error || eventResult.error) return json({ error: "Workspace usage could not be loaded." }, 503);

  const daily = new Map<string, {
    outboundReserved: number;
    outboundAccepted: number;
    outboundRecipients: number;
    inboundReceived: number;
    providerEventsProcessed: number;
  }>();

  for (const event of eventResult.data ?? []) {
    let row = daily.get(event.period_start);
    if (!row) {
      row = { outboundReserved: 0, outboundAccepted: 0, outboundRecipients: 0, inboundReceived: 0, providerEventsProcessed: 0 };
      daily.set(event.period_start, row);
    }
    if (event.metric === "outbound_message_capacity") row.outboundReserved += event.quantity;
    if (event.metric === "outbound_messages_accepted") row.outboundAccepted += event.quantity;
    if (event.metric === "outbound_recipients_accepted") row.outboundRecipients += event.quantity;
    if (event.metric === "inbound_messages_received") row.inboundReceived += event.quantity;
    if (event.metric === "provider_events_processed") row.providerEventsProcessed += event.quantity;
  }

  const limit = limitResult.data?.outbound_messages_per_utc_day ?? 250;
  const todayUsage = daily.get(today) ?? {
    outboundReserved: 0, outboundAccepted: 0, outboundRecipients: 0,
    inboundReceived: 0, providerEventsProcessed: 0,
  };

  return json({
    period: { from, through: today, timezone: "UTC" },
    limits: {
      outboundMessagesPerUtcDay: limit,
      enabled: limitResult.data?.enabled ?? false,
      updatedAt: limitResult.data?.updated_at ?? null,
    },
    today: {
      outboundCapacityUsed: Math.max(0, todayUsage.outboundReserved),
      outboundMessagesAccepted: todayUsage.outboundAccepted,
      outboundRecipientsAccepted: todayUsage.outboundRecipients,
      inboundMessagesReceived: todayUsage.inboundReceived,
      providerEventsProcessed: todayUsage.providerEventsProcessed,
      outboundMessagesRemaining: limitResult.data?.enabled === false
        ? null
        : Math.max(0, limit - Math.max(0, todayUsage.outboundReserved)),
    },
    daily: Array.from(daily.entries()).sort(([left], [right]) => right.localeCompare(left))
      .map(([date, values]) => ({ date, ...values })),
    recentEvents: (eventResult.data ?? []).slice(0, 100),
    truncated: (eventResult.data?.length ?? 0) >= 1000,
  });
}
