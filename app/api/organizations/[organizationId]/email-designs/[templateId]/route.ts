import { NextResponse } from "next/server";
import { getOrganizationRequestContext } from "@/lib/organizations/request-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordOrganizationAuditEvent } from "@/lib/platform/organization-operations";
import { validateEmailDesignContent, EMAIL_DESIGN_SCHEMA_VERSION } from "@/lib/email-design/render.mjs";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ organizationId: string; templateId: string }> };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELDS = "id, organization_id, created_by, updated_by, name, subject, description, schema_version, content_json, created_at, updated_at";

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
  return { data: { name, subject, description, contentJson: content.data }, error: null };
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

export async function PATCH(request: Request, { params }: RouteContext) {
  const { organizationId, templateId } = await params;
  if (!UUID_PATTERN.test(templateId)) return NextResponse.json({ ok: false, error: "Invalid design." }, { status: 400 });

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

  const { data, error } = await context.supabase
    .from("email_design_templates")
    .update({
      updated_by: context.user.id,
      name: parsed.data.name,
      subject: parsed.data.subject,
      description: parsed.data.description,
      schema_version: EMAIL_DESIGN_SCHEMA_VERSION,
      content_json: parsed.data.contentJson,
    })
    .eq("id", templateId)
    .eq("organization_id", organizationId)
    .select(FIELDS)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: "Designed email could not be updated." }, { status: 503 });
  if (!data) return NextResponse.json({ ok: false, error: "Design not found or you do not have permission to edit it." }, { status: 404 });
  const auditAdmin = createAdminClient();
  if (!auditAdmin) return NextResponse.json({ ok: true, template: publicDesign(data as Record<string, unknown>), auditRecorded: false }, { status: 202 });
  try {
    await recordOrganizationAuditEvent(auditAdmin, {
      organizationId, actorUserId: context.user.id, action: "email_design.updated",
      resourceType: "email_design", resourceId: templateId,
      metadata: { template_id: templateId, changed_fields: ["name", "subject", "description", "content_json"] },
    });
  } catch { return NextResponse.json({ ok: true, template: publicDesign(data as Record<string, unknown>), auditRecorded: false }, { status: 202 }); }
  return NextResponse.json({ ok: true, template: publicDesign(data as Record<string, unknown>), auditRecorded: true });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { organizationId, templateId } = await params;
  if (!UUID_PATTERN.test(templateId)) return NextResponse.json({ ok: false, error: "Invalid design." }, { status: 400 });

  const context = await getOrganizationRequestContext(organizationId, "designed email templates");
  if ("response" in context) return context.response;

  const { data, error } = await context.supabase
    .from("email_design_templates")
    .delete()
    .eq("id", templateId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: "Designed email could not be deleted." }, { status: 503 });
  if (!data) return NextResponse.json({ ok: false, error: "Design not found or you do not have permission to delete it." }, { status: 404 });
  const auditAdmin = createAdminClient();
  if (!auditAdmin) return NextResponse.json({ ok: true, id: data.id, auditRecorded: false }, { status: 202 });
  try {
    await recordOrganizationAuditEvent(auditAdmin, {
      organizationId, actorUserId: context.user.id, action: "email_design.deleted",
      resourceType: "email_design", resourceId: templateId,
      metadata: { template_id: templateId },
    });
  } catch { return NextResponse.json({ ok: true, id: data.id, auditRecorded: false }, { status: 202 }); }
  return NextResponse.json({ ok: true, id: data.id, auditRecorded: true });
}
