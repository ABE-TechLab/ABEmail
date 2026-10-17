import { NextResponse } from "next/server";

export function GET() {
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  const pilotKeyConfigured = Boolean(process.env.ABEMAIL_RESEND_OTTAWA_API_KEY);
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
      emailProvider: pilotKeyConfigured ? "pilot_key_configured_not_probed" : "missing_pilot_key",
      inboundEmail: webhookConfigured ? "webhook_secret_configured_not_probed" : "missing_webhook_secret",
      pilotSetup: operatorAllowlistConfigured ? "operator_allowlist_configured" : "disabled_missing_operator_allowlist",
    },
  });
}
