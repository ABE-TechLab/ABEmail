"use client";

import { useEffect, useState } from "react";

type UsageReport = {
  period: { from: string; through: string; timezone: string };
  limits: { outboundMessagesPerUtcDay: number; enabled: boolean; updatedAt: string | null };
  today: { outboundCapacityUsed: number; outboundMessagesAccepted: number; outboundRecipientsAccepted: number; inboundMessagesReceived: number; providerEventsProcessed: number; outboundMessagesRemaining: number | null };
  daily: Array<{ date: string; outboundReserved: number; outboundAccepted: number; outboundRecipients: number; inboundReceived: number; providerEventsProcessed: number }>;
  truncated: boolean;
};

type AuditEvent = { id: string; actor_type: string; action: string; resource_type: string; resource_id: string | null; outcome: string; created_at: string };

function MetricCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <article className="settings-security-card"><div><small className="settings-muted">{label}</small><strong>{value}</strong><p>{detail}</p></div></article>;
}

export default function OrganizationOperationsPanel({ organizationId }: { organizationId: string }) {
  const [usage, setUsage] = useState<UsageReport | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [usageResponse, auditResponse] = await Promise.all([
          fetch("/api/organizations/" + organizationId + "/usage", { cache: "no-store", signal: controller.signal }),
          fetch("/api/organizations/" + organizationId + "/audit-events?limit=50", { cache: "no-store", signal: controller.signal }),
        ]);
        const [usagePayload, auditPayload] = await Promise.all([
          usageResponse.json() as Promise<UsageReport & { error?: string }>,
          auditResponse.json() as Promise<{ events?: AuditEvent[]; error?: string }>,
        ]);
        if (!usageResponse.ok || !auditResponse.ok) throw new Error(usagePayload.error || auditPayload.error || "Operations data could not be loaded.");
        if (!active) return;
        setUsage(usagePayload);
        setEvents(auditPayload.events ?? []);
      } catch (caught) {
        if (active && !(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Operations data could not be loaded.");
      } finally {
        if (active) { setLoading(false); setRefreshing(false); }
      }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [organizationId, refreshKey]);

  function refresh() { setRefreshing(true); setRefreshKey((current) => current + 1); }

  return (
    <div className="workspace-profile-settings">
      <div className="settings-section-summary">
        <div><strong>Organization usage</strong><p>Usage is shared across all workspace mailboxes. Daily limits and totals use Coordinated Universal Time (UTC).</p></div>
        <button type="button" className="mail-secondary-action" onClick={refresh} disabled={loading || refreshing}>{loading || refreshing ? "Refreshing..." : "Refresh"}</button>
      </div>
      {error && <div className="settings-info-banner" role="alert"><span>!</span><p>{error}</p></div>}
      {loading && <p className="settings-muted" role="status">Loading usage and audit history...</p>}
      {usage && <>
        <div className="settings-form-grid">
          <MetricCard label="Outbound capacity used today" value={usage.today.outboundCapacityUsed + " / " + usage.limits.outboundMessagesPerUtcDay} detail={usage.today.outboundMessagesRemaining === null ? "Quota disabled" : usage.today.outboundMessagesRemaining + " messages remaining today"} />
          <MetricCard label="Outbound messages accepted" value={usage.today.outboundMessagesAccepted} detail={usage.today.outboundRecipientsAccepted + " recipients accepted"} />
          <MetricCard label="Inbound messages received" value={usage.today.inboundMessagesReceived} detail="Successfully stored today" />
          <MetricCard label="Provider events processed" value={usage.today.providerEventsProcessed} detail="Successfully processed tenant events today" />
        </div>
        <div className="settings-section-summary"><div><strong>Daily usage - last 30 days</strong><p>{usage.period.from} through {usage.period.through} ({usage.period.timezone})</p></div><span className="settings-summary-chip">{usage.limits.enabled ? "Quota active" : "Quota disabled"}</span></div>
        <div className="settings-domain-list">
          {usage.daily.length === 0 ? <p className="settings-muted">No usage events recorded in this period.</p> : usage.daily.slice(0, 10).map((day) => <article className="settings-domain-record" key={day.date}><div className="settings-domain-row"><strong className="settings-domain-name">{day.date}</strong><span className="settings-muted">Outbound {day.outboundAccepted} accepted / {day.outboundReserved} capacity / Inbound {day.inboundReceived} / Recipients {day.outboundRecipients}</span></div></article>)}
        </div>
        {usage.truncated && <p className="settings-muted">The 1,000-event read limit was reached. Some daily figures may be incomplete.</p>}
      </>}
      <div className="settings-section-summary"><div><strong>Administrative audit history</strong><p>Important workspace, provider, mailbox, domain, invitation, brand and designed-template changes.</p></div></div>
      <div className="settings-domain-list">
        {events.length === 0 && !loading ? <p className="settings-muted">No administrative events have been recorded yet.</p> : events.slice(0, 20).map((event) => <article className="settings-domain-record" key={event.id}><div className="settings-domain-row"><span className="settings-domain-icon" aria-hidden="true">A</span><span className="settings-domain-name"><strong>{event.action.replaceAll("_", " ").replaceAll(".", " / ")}</strong><small>{event.resource_type}{event.resource_id ? " / " + event.resource_id : ""} / {event.actor_type} / {new Date(event.created_at).toLocaleString()}</small></span><span className="settings-summary-chip">{event.outcome}</span></div></article>)}
      </div>
      <div className="settings-info-banner"><span>i</span><p>Audit and usage records are append-only. The initial allowance is 250 outbound messages per organization per UTC day. Changing an allowance requires a reviewed operator action.</p></div>
    </div>
  );
}
