import { NextResponse } from "next/server";
import { getOrganizationRequestContext } from "@/lib/organizations/request-context";
import { validateEmailDesignContent, EMAIL_DESIGN_SCHEMA_VERSION } from "@/lib/email-design/render.mjs";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ organizationId: string }> };
const FIELDS = "id, organization_id, created_by, updated_by, name, subject, description, schema_version, content_json, created_at, updated_at";
const MAX_DESIGNS_PER_ORGANIZATION = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDesign(value: unknown) {
  if (!isRecord(value)) return { data: null, error: "Send valid designed-email details." };
  const name = typeof value.name === "string" ? value.name.trim().replace(/\s+/g, " ") : "";
  const subject = typeof value.subject === "string" ? value.subject.trim() : "";
  const description = typeof value.description === "string" ? value.description.trim() : "";
  if (!name || name.length > 120) return { data: null, error: "Design name must contain 1–120 characters." };
  if (subject.length > 998) return { data: null, error: "Subject must be 998 characters or fewer." };
  if (description.length > 500) return { data: null, error: "Description must be 500 characters or fewer." };
  const content = validateEmailDesignContent(value.contentJson);
  if (content.error || !content.data) return { data: null, error: content.error ?? "Email design is invalid." };
  return {
    data: { name, subject, description, contentJson: content.data },
    error: null,
  };
}

function publicDesign(row: Record<string, unknown>) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    name: row.name,
    subject: row.subject,
    description: row.description,
    schemaVersion: row.schema_version,
    contentJson: row.content_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { organizationId } = await params;
  const context = await getOrganizationRequestContext(organizationId, "designed email templates");
  if ("response" in context) return context.response;

  const { data, error, count } = await context.supabase
    .from("email_design_templates")
    .select(FIELDS, { count: "exact" })
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(MAX_DESIGNS_PER_ORGANIZATION);

  if (error) return NextResponse.json({ ok: false, error: "Designed email templates could not be loaded." }, { status: 503 });
  return NextResponse.json({ ok: true, templates: (data ?? []).map((row) => publicDesign(row as Record<string, unknown>)), count: count ?? data?.length ?? 0 });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { organizationId } = await params;
  const context = await getOrganizationRequestContext(organizationId, "designed email templates");
  if ("response" in context) return context.response;

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 300000) return NextResponse.json({ ok: false, error: "Design is too large. Keep the design under 256 KB." }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "Send a valid JSON request." }, { status: 400 });
  }

  const parsed = parseDesign(body);
  if (parsed.error || !parsed.data) return NextResponse.json({ ok: false, error: parsed.error ?? "Design is invalid." }, { status: 400 });

  const { count, error: countError } = await context.supabase
    .from("email_design_templates")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (countError) return NextResponse.json({ ok: false, error: "Template limits could not be checked." }, { status: 503 });
  if ((count ?? 0) >= MAX_DESIGNS_PER_ORGANIZATION) {
    return NextResponse.json({ ok: false, error: "You can save up to 100 designed emails in this workspace." }, { status: 409 });
  }

  const { data, error } = await context.supabase
    .from("email_design_templates")
    .insert({
      organization_id: organizationId,
      created_by: context.user.id,
      updated_by: context.user.id,
      name: parsed.data.name,
      subject: parsed.data.subject,
      description: parsed.data.description,
      schema_version: EMAIL_DESIGN_SCHEMA_VERSION,
      content_json: parsed.data.contentJson,
    })
    .select(FIELDS)
    .single();

  if (error || !data) return NextResponse.json({ ok: false, error: "Designed email could not be saved." }, { status: 503 });
  return NextResponse.json({ ok: true, template: publicDesign(data as Record<string, unknown>) }, { status: 201 });
}
