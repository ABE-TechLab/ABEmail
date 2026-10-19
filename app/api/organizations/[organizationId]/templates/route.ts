import { NextResponse } from "next/server";
import { getOrganizationRequestContext } from "@/lib/organizations/request-context";
import { parseEmailTemplateInput } from "@/lib/templates/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ organizationId: string }> };
const TEMPLATE_FIELDS = "id, name, subject, body_text, created_at, updated_at";
const MAX_TEMPLATES_PER_USER = 100;

export async function GET(_request: Request, { params }: RouteContext) {
  const { organizationId } = await params;
  const context = await getOrganizationRequestContext(organizationId, "templates");
  if ("response" in context) return context.response;

  const { data, error, count } = await context.supabase
    .from("email_templates")
    .select(TEMPLATE_FIELDS, { count: "exact" })
    .eq("organization_id", organizationId)
    .eq("user_id", context.user.id)
    .order("updated_at", { ascending: false })
    .limit(MAX_TEMPLATES_PER_USER);

  if (error) {
    return NextResponse.json({ ok: false, error: "Templates could not be loaded." }, { status: 503 });
  }

  return NextResponse.json({ ok: true, templates: data ?? [], count: count ?? data?.length ?? 0 });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { organizationId } = await params;
  const context = await getOrganizationRequestContext(organizationId, "templates");
  if ("response" in context) return context.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Send a valid JSON request." }, { status: 400 });
  }

  const parsed = parseEmailTemplateInput(body);
  if (parsed.error || !parsed.data) {
    return NextResponse.json({ ok: false, error: parsed.error ?? "Template details are invalid." }, { status: 400 });
  }

  const { count, error: countError } = await context.supabase
    .from("email_templates")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("user_id", context.user.id);

  if (countError) {
    return NextResponse.json({ ok: false, error: "Template limits could not be checked." }, { status: 503 });
  }
  if ((count ?? 0) >= MAX_TEMPLATES_PER_USER) {
    return NextResponse.json({ ok: false, error: "You can save up to 100 templates in this workspace." }, { status: 409 });
  }

  const { data: template, error } = await context.supabase
    .from("email_templates")
    .insert({ ...parsed.data, organization_id: organizationId, user_id: context.user.id })
    .select(TEMPLATE_FIELDS)
    .single();

  if (error || !template) {
    return NextResponse.json({ ok: false, error: "The template could not be saved." }, { status: 503 });
  }

  return NextResponse.json({ ok: true, template }, { status: 201 });
}
