import { NextResponse } from "next/server";

export function GET() {
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  return NextResponse.json({
    service: "abemail",
    // Liveness only. Config presence is not a live dependency probe.
    status: "ok",
    readiness: supabaseConfigured ? "partial" : "blocked",
    mode: "application-foundation",
    integrations: {
      database: supabaseConfigured ? "configured_not_probed" : "missing_configuration",
      authentication: supabaseConfigured ? "configured_not_probed" : "missing_configuration",
      emailProvider: "not_connected",
      inboundEmail: "not_connected",
    },
  });
}
