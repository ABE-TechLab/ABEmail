import { type NextRequest } from "next/server";
import { handleResendWebhook } from "@/lib/email/resend-webhook-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handleResendWebhook(request);
}
