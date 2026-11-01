import { NextResponse } from "next/server";
import { getOrganizationRequestContext } from "@/lib/organizations/request-context";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ organizationId: string }> };
type BrandProfileInput = {
  brandName: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  websiteUrl: string | null;
  phone: string;
  address: string;
  footerText: string;
  socialLinks: { label: string; href: string }[];
};

const DEFAULT_PROFILE: BrandProfileInput = {
  brandName: "",
  logoUrl: null,
  primaryColor: "#2B2B2B",
  accentColor: "#D7F36A",
  backgroundColor: "#F3F4F6",
  textColor: "#242424",
  fontFamily: "Arial",
  websiteUrl: null,
  phone: "",
  address: "",
  footerText: "",
  socialLinks: [],
};
const COLORS = ["primaryColor", "accentColor", "backgroundColor", "textColor"] as const;
const FONTS = new Set(["Arial", "Helvetica", "Georgia", "Tahoma", "Verdana", "Trebuchet MS"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length > 2048 || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    if (url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname.endsWith(".local")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function toPublicProfile(row: Record<string, unknown> | null): BrandProfileInput {
  if (!row) return DEFAULT_PROFILE;
  return {
    brandName: String(row.brand_name ?? ""),
    logoUrl: typeof row.logo_url === "string" ? row.logo_url : null,
    primaryColor: String(row.primary_color ?? DEFAULT_PROFILE.primaryColor),
    accentColor: String(row.accent_color ?? DEFAULT_PROFILE.accentColor),
    backgroundColor: String(row.background_color ?? DEFAULT_PROFILE.backgroundColor),
    textColor: String(row.text_color ?? DEFAULT_PROFILE.textColor),
    fontFamily: String(row.font_family ?? DEFAULT_PROFILE.fontFamily),
    websiteUrl: typeof row.website_url === "string" ? row.website_url : null,
    phone: String(row.phone ?? ""),
    address: String(row.address ?? ""),
    footerText: String(row.default_footer_text ?? ""),
    socialLinks: Array.isArray(row.social_links) ? row.social_links as BrandProfileInput["socialLinks"] : [],
  };
}

function parseProfile(value: unknown): { data: BrandProfileInput | null; error: string | null } {
  if (!isRecord(value)) return { data: null, error: "Send a valid brand profile." };

  const brandName = typeof value.brandName === "string" ? value.brandName.trim() : null;
  const phone = typeof value.phone === "string" ? value.phone.trim() : null;
  const address = typeof value.address === "string" ? value.address.trim() : null;
  const footerText = typeof value.footerText === "string" ? value.footerText.trim() : null;
  const fontFamily = typeof value.fontFamily === "string" ? value.fontFamily : "";
  if (brandName === null || brandName.length > 120) return { data: null, error: "Brand name must be 120 characters or fewer." };
  if (phone === null || phone.length > 80) return { data: null, error: "Phone must be 80 characters or fewer." };
  if (address === null || address.length > 1000) return { data: null, error: "Address must be 1,000 characters or fewer." };
  if (footerText === null || footerText.length > 4000) return { data: null, error: "Default footer must be 4,000 characters or fewer." };
  if (!FONTS.has(fontFamily)) return { data: null, error: "Choose an email-safe font." };

  const colors: Partial<Record<typeof COLORS[number], string>> = {};
  for (const field of COLORS) {
    const candidate = value[field];
    if (typeof candidate !== "string" || !/^#[0-9a-fA-F]{6}$/.test(candidate)) {
      return { data: null, error: "Choose valid six-digit hex colors." };
    }
    colors[field] = candidate.toUpperCase();
  }

  let logoUrl: string | null = null;
  if (value.logoUrl !== null && value.logoUrl !== undefined && value.logoUrl !== "") {
    logoUrl = safeHttpsUrl(value.logoUrl);
    if (!logoUrl) return { data: null, error: "Logo URL must be a valid HTTPS URL." };
  }
  let websiteUrl: string | null = null;
  if (value.websiteUrl !== null && value.websiteUrl !== undefined && value.websiteUrl !== "") {
    websiteUrl = safeHttpsUrl(value.websiteUrl);
    if (!websiteUrl) return { data: null, error: "Website URL must be a valid HTTPS URL." };
  }

  if (!Array.isArray(value.socialLinks) || value.socialLinks.length > 8) {
    return { data: null, error: "Add no more than eight social links." };
  }
  const socialLinks: BrandProfileInput["socialLinks"] = [];
  for (const item of value.socialLinks) {
    if (!isRecord(item) || typeof item.label !== "string" || typeof item.href !== "string") {
      return { data: null, error: "Each social link needs a label and URL." };
    }
    const label = item.label.trim();
    const href = safeHttpsUrl(item.href);
    if (!label || label.length > 80 || !href) return { data: null, error: "Social links need a label (up to 80 characters) and a valid HTTPS URL." };
    socialLinks.push({ label, href });
  }

  return {
    data: {
      brandName,
      logoUrl,
      primaryColor: colors.primaryColor!,
      accentColor: colors.accentColor!,
      backgroundColor: colors.backgroundColor!,
      textColor: colors.textColor!,
      fontFamily,
      websiteUrl,
      phone,
      address,
      footerText,
      socialLinks,
    },
    error: null,
  };
}

const PROFILE_FIELDS = "organization_id, brand_name, logo_url, primary_color, accent_color, background_color, text_color, font_family, website_url, phone, address, default_footer_text, social_links, updated_at";

export async function GET(_request: Request, { params }: RouteContext) {
  const { organizationId } = await params;
  const context = await getOrganizationRequestContext(organizationId, "brand profile");
  if ("response" in context) return context.response;

  const [{ data, error }, { data: organization, error: organizationError }] = await Promise.all([
    context.supabase
      .from("organization_brand_profiles")
      .select(PROFILE_FIELDS)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    context.supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .eq("status", "active")
      .single(),
  ]);

  if (error || organizationError || !organization) return NextResponse.json({ ok: false, error: "Workspace profile could not be loaded." }, { status: 503 });
  return NextResponse.json({
    ok: true,
    profile: { ...toPublicProfile(data as Record<string, unknown> | null), brandName: organization.name },
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { organizationId } = await params;
  const context = await getOrganizationRequestContext(organizationId, "brand profile");
  if ("response" in context) return context.response;

  const { data: membership, error: membershipError } = await context.supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", context.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) return NextResponse.json({ ok: false, error: "Workspace permissions could not be verified." }, { status: 503 });
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return NextResponse.json({ ok: false, error: "Only workspace owners and admins can update the brand profile." }, { status: 403 });
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 20000) return NextResponse.json({ ok: false, error: "Brand profile is too large." }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "Send a valid JSON request." }, { status: 400 });
  }

  const parsed = parseProfile(body);
  if (parsed.error || !parsed.data) {
    return NextResponse.json({ ok: false, error: parsed.error ?? "Brand profile is invalid." }, { status: 400 });
  }

  const { data: organization, error: organizationError } = await context.supabase
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .eq("status", "active")
    .single();
  if (organizationError || !organization) return NextResponse.json({ ok: false, error: "Workspace name could not be loaded." }, { status: 503 });

  const profile = { ...parsed.data, brandName: organization.name };
  const { data: saved, error } = await context.supabase
    .from("organization_brand_profiles")
    .upsert({
      organization_id: organizationId,
      brand_name: organization.name,
      logo_url: profile.logoUrl,
      primary_color: profile.primaryColor,
      accent_color: profile.accentColor,
      background_color: profile.backgroundColor,
      text_color: profile.textColor,
      font_family: profile.fontFamily,
      website_url: profile.websiteUrl,
      phone: profile.phone || null,
      address: profile.address || null,
      default_footer_text: profile.footerText,
      social_links: profile.socialLinks,
      updated_by: context.user.id,
    }, { onConflict: "organization_id" })
    .select(PROFILE_FIELDS)
    .single();

  if (error || !saved) return NextResponse.json({ ok: false, error: "Brand profile could not be saved." }, { status: 503 });
  return NextResponse.json({ ok: true, profile: toPublicProfile(saved as Record<string, unknown>) });
}
