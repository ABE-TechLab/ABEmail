import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    service: "abemail",
    status: "ok",
    mode: "application-foundation",
    integrations: {
      database: "not-configured",
      emailProvider: "not-configured",
      authentication: "not-configured",
    },
  });
}
