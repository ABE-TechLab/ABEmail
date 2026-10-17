import type { NextRequest } from "next/server";
import { handleResendWebhook } from "@/lib/email/resend-webhook-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ organizationId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { organizationId } = await context.params;
  return handleResendWebhook(request, organizationId);
}
