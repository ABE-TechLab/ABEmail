import { NextResponse } from "next/server";
import { getOrganizationRequestContext } from "@/lib/organizations/request-context";
import { parseEmailTemplateInput } from "@/lib/templates/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ organizationId: string; templateId: string }> };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TEMPLATE_FIELDS = "id, name, subject, body_text, created_at, updated_at";

export async function PATCH(request: Request, { params }: RouteContext) {
  const { organizationId, templateId } = await params;
  if (!UUID_PATTERN.test(templateId)) {
    return NextResponse.json({ ok: false, error: "Invalid template." }, { status: 400 });
  }

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

  const { data: template, error } = await context.supabase
    .from("email_templates")
    .update(parsed.data)
    .eq("id", templateId)
    .eq("organization_id", organizationId)
    .eq("user_id", context.user.id)
    .select(TEMPLATE_FIELDS)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: "The template could not be updated." }, { status: 503 });
  }
  if (!template) {
    return NextResponse.json({ ok: false, error: "Template not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, template });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { organizationId, templateId } = await params;
  if (!UUID_PATTERN.test(templateId)) {
    return NextResponse.json({ ok: false, error: "Invalid template." }, { status: 400 });
  }

  const context = await getOrganizationRequestContext(organizationId, "templates");
  if ("response" in context) return context.response;

  const { data, error } = await context.supabase
    .from("email_templates")
    .delete()
    .eq("id", templateId)
    .eq("organization_id", organizationId)
    .eq("user_id", context.user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: "The template could not be deleted." }, { status: 503 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "Template not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
