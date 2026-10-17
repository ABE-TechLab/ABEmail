import { NextResponse } from "next/server";

export function GET() {
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  const pilotSendKeyConfigured = Boolean(process.env.ABEMAIL_RESEND_OTTAWA_SEND_API_KEY);
  const pilotReceiveKeyConfigured = Boolean(process.env.ABEMAIL_RESEND_OTTAWA_RECEIVE_API_KEY);
  const webhookConfigured = Boolean(process.env.ABEMAIL_RESEND_OTTAWA_WEBHOOK_SECRET);
  const operatorAllowlistConfigured = Boolean(process.env.ABEMAIL_PILOT_OPERATOR_EMAILS?.trim());

  return NextResponse.json({
    service: "abemail",
    // Liveness only; these flags indicate environment-variable presence, not provider health.
    status: "ok",
    readiness: supabaseConfigured ? "partial" : "blocked",
    mode: "application-foundation",
    integrations: {
      database: supabaseConfigured ? "configured_not_probed" : "missing_configuration",
      authentication: supabaseConfigured ? "configured_not_probed" : "missing_configuration",
      emailProvider: pilotSendKeyConfigured ? "pilot_send_key_configured_not_probed" : "missing_pilot_send_key",
      inboundEmail: webhookConfigured && pilotReceiveKeyConfigured
        ? "webhook_secret_and_receive_key_configured_not_probed"
        : !webhookConfigured && !pilotReceiveKeyConfigured
          ? "missing_webhook_secret_and_receive_key"
          : !webhookConfigured
            ? "missing_webhook_secret"
            : "missing_pilot_receive_key",
      pilotSetup: operatorAllowlistConfigured ? "operator_allowlist_configured" : "disabled_missing_operator_allowlist",
    },
  });
}
