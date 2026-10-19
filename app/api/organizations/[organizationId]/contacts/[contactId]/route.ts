import { NextResponse } from "next/server";
import { CONTACT_FIELDS } from "@/lib/contacts/types";
import { getContactRequestContext } from "@/lib/contacts/request-context";
import { parseContactInput } from "@/lib/contacts/validation";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RouteContext = { params: Promise<{ organizationId: string; contactId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { organizationId, contactId } = await params;
  if (!UUID_PATTERN.test(contactId)) {
    return NextResponse.json({ ok: false, error: "Invalid contact." }, { status: 400 });
  }

  const context = await getContactRequestContext(organizationId);
  if ("response" in context) return context.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Send a valid JSON request." }, { status: 400 });
  }

  const parsed = parseContactInput(body);
  if (parsed.error || !parsed.data) {
    return NextResponse.json({ ok: false, error: parsed.error ?? "Contact details are invalid." }, { status: 400 });
  }

  const { data: contact, error } = await context.supabase
    .from("contacts")
    .update(parsed.data)
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .select(CONTACT_FIELDS)
    .maybeSingle();

  if (error?.code === "23505") {
    return NextResponse.json({ ok: false, error: "Another contact in this workspace already uses that email." }, { status: 409 });
  }
  if (error) {
    return NextResponse.json({ ok: false, error: "The contact could not be updated." }, { status: 503 });
  }
  if (!contact) {
    return NextResponse.json({ ok: false, error: "Contact not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, contact });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { organizationId, contactId } = await params;
  if (!UUID_PATTERN.test(contactId)) {
    return NextResponse.json({ ok: false, error: "Invalid contact." }, { status: 400 });
  }

  const context = await getContactRequestContext(organizationId);
  if ("response" in context) return context.response;

  const { data: contact, error } = await context.supabase
    .from("contacts")
    .delete()
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: "The contact could not be deleted." }, { status: 503 });
  }
  if (!contact) {
    return NextResponse.json({ ok: false, error: "Contact not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
