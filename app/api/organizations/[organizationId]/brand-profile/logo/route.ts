import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrganizationRequestContext } from "@/lib/organizations/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "organization-brand-logos";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

type RouteContext = { params: Promise<{ organizationId: string }> };

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function detectImage(bytes: Uint8Array): { contentType: string; extension: string } | null {
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return { contentType: "image/png", extension: "png" };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { contentType: "image/jpeg", extension: "jpg" };
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return { contentType: "image/webp", extension: "webp" };
  return null;
}

function getOwnedStoragePath(url: string | null, organizationId: string): string | null {
  if (!url) return null;
  const marker = "/storage/v1/object/public/" + BUCKET + "/";
  const markerIndex = url.indexOf(marker);
  if (markerIndex < 0) return null;
  const encodedPath = url.slice(markerIndex + marker.length).split(/[?#]/, 1)[0];
  try {
    const path = decodeURIComponent(encodedPath);
    return path.startsWith(organizationId + "/") ? path : null;
  } catch {
    return null;
  }
}

async function getAuthorizedWorkspace(organizationId: string) {
  const context = await getOrganizationRequestContext(organizationId, "workspace logo");
  if ("response" in context) return { response: context.response } as const;
  const { data: membership, error } = await context.supabase.from("organization_memberships")
    .select("role").eq("organization_id", organizationId).eq("user_id", context.user.id)
    .eq("status", "active").maybeSingle();
  if (error) return { response: json({ ok: false, error: "Workspace permissions could not be verified." }, 503) } as const;
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return { response: json({ ok: false, error: "Only workspace owners and admins can change the workspace logo." }, 403) } as const;
  }
  const admin = createAdminClient();
  if (!admin) return { response: json({ ok: false, error: "Secure image storage is not configured." }, 503) } as const;
  return { context, admin } as const;
}

export async function POST(request: Request, { params }: RouteContext) {
  const { organizationId } = await params;
  const authorized = await getAuthorizedWorkspace(organizationId);
  if ("response" in authorized) return authorized.response;
  const { context, admin } = authorized;

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_LOGO_BYTES + 16_384) return json({ ok: false, error: "Workspace logos must be 2 MB or smaller." }, 413);
  let formData: FormData;
  try { formData = await request.formData(); }
  catch { return json({ ok: false, error: "Choose a valid image file." }, 400); }

  const file = formData.get("file");
  if (!(file instanceof File)) return json({ ok: false, error: "Choose a PNG, JPEG, or WebP image." }, 400);
  if (file.size < 1 || file.size > MAX_LOGO_BYTES) return json({ ok: false, error: "Workspace logos must be between 1 byte and 2 MB." }, 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = detectImage(bytes);
  if (!image || file.type !== image.contentType) return json({ ok: false, error: "The image content must match a supported PNG, JPEG, or WebP file type." }, 415);

  const [{ data: organization, error: organizationError }, { data: currentProfile, error: profileError }] = await Promise.all([
    context.supabase.from("organizations").select("name").eq("id", organizationId).eq("status", "active").single(),
    context.supabase.from("organization_brand_profiles").select("logo_url").eq("organization_id", organizationId).maybeSingle(),
  ]);
  if (organizationError || !organization) return json({ ok: false, error: "Workspace details could not be loaded." }, 503);
  if (profileError) return json({ ok: false, error: "The current workspace logo could not be checked." }, 503);

  const path = organizationId + "/" + randomUUID() + "." + image.extension;
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: image.contentType, cacheControl: "3600", upsert: false,
  });
  if (uploadError) return json({ ok: false, error: "The workspace logo could not be uploaded to secure storage." }, 503);

  const logoUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error: saveError } = await context.supabase.from("organization_brand_profiles").upsert({
    organization_id: organizationId, brand_name: organization.name, logo_url: logoUrl, updated_by: context.user.id,
  }, { onConflict: "organization_id" });
  if (saveError) {
    await admin.storage.from(BUCKET).remove([path]);
    return json({ ok: false, error: "The logo was uploaded but could not be saved to the workspace profile." }, 503);
  }

  const previousPath = getOwnedStoragePath(currentProfile?.logo_url ?? null, organizationId);
  if (previousPath && previousPath !== path) await admin.storage.from(BUCKET).remove([previousPath]);
  return json({ ok: true, logoUrl });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { organizationId } = await params;
  const authorized = await getAuthorizedWorkspace(organizationId);
  if ("response" in authorized) return authorized.response;
  const { context, admin } = authorized;

  const { data: profile, error } = await context.supabase.from("organization_brand_profiles")
    .select("logo_url").eq("organization_id", organizationId).maybeSingle();
  if (error) return json({ ok: false, error: "The workspace logo could not be loaded." }, 503);
  const path = getOwnedStoragePath(profile?.logo_url ?? null, organizationId);
  const { error: updateError } = await context.supabase.from("organization_brand_profiles")
    .update({ logo_url: null, updated_by: context.user.id }).eq("organization_id", organizationId);
  if (updateError) return json({ ok: false, error: "The workspace logo could not be removed." }, 503);
  if (path) await admin.storage.from(BUCKET).remove([path]);
  return json({ ok: true });
}
