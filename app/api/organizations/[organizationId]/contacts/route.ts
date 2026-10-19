import { NextResponse } from "next/server";
import { CONTACT_FIELDS } from "@/lib/contacts/types";
import { getContactRequestContext } from "@/lib/contacts/request-context";
import { parseContactInput } from "@/lib/contacts/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ organizationId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { organizationId } = await params;
  const context = await getContactRequestContext(organizationId);
  if ("response" in context) return context.response;

  const url = new URL(request.url);
  const term = (url.searchParams.get("q") ?? "")
    .replace(/[,%()\\\\]/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);

  let query = context.supabase
    .from("contacts")
    .select(CONTACT_FIELDS, { count: "exact" })
    .eq("organization_id", organizationId);

  if (term) {
    const pattern = "%" + term + "%";
    query = query.or(
      "name.ilike." + pattern +
      ",email.ilike." + pattern +
      ",company.ilike." + pattern +
      ",role.ilike." + pattern
    );
  }

  const { data, error, count } = await query.order("name", { ascending: true }).limit(200);
  if (error) {
    return NextResponse.json({ ok: false, error: "Contacts could not be loaded." }, { status: 503 });
  }

  return NextResponse.json({ ok: true, contacts: data ?? [], count: count ?? data?.length ?? 0 });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { organizationId } = await params;
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
    .insert({ ...parsed.data, organization_id: organizationId, created_by: context.user.id })
    .select(CONTACT_FIELDS)
    .single();

  if (error?.code === "23505") {
    return NextResponse.json({ ok: false, error: "A contact with this email already exists in this workspace." }, { status: 409 });
  }
  if (error || !contact) {
    return NextResponse.json({ ok: false, error: "The contact could not be saved." }, { status: 503 });
  }

  return NextResponse.json({ ok: true, contact }, { status: 201 });
}
