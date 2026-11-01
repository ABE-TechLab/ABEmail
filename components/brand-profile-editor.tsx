"use client";

import Image from "next/image";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useTransientNotice } from "@/lib/use-transient-notice";

type BrandProfile = {
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

type BrandApiPayload = { ok?: boolean; error?: string; profile?: Partial<BrandProfile> };

const DEFAULT_PROFILE: BrandProfile = {
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

const FONTS = ["Arial", "Helvetica", "Georgia", "Tahoma", "Verdana", "Trebuchet MS"];

export default function BrandProfileEditor({ organizationId, organizationName, canManage }: { organizationId: string; organizationName: string; canManage: boolean }) {
  const endpoint = "/api/organizations/" + organizationId + "/brand-profile";
  const [profile, setProfile] = useState<BrandProfile>(DEFAULT_PROFILE);
  const [socialLinksText, setSocialLinksText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useTransientNotice();

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as BrandApiPayload;
        if (!response.ok || !result.ok) throw new Error(result.error || "Brand profile could not be loaded.");
        if (!active) return;
        const next = { ...DEFAULT_PROFILE, ...(result.profile ?? {}), brandName: organizationName };
        setProfile(next);
        setSocialLinksText((next.socialLinks ?? []).map((link) => link.label + " | " + link.href).join("\n"));
      })
      .catch((cause: unknown) => {
        if (!active || (cause instanceof Error && cause.name === "AbortError")) return;
        setError(cause instanceof Error ? cause.message : "Brand profile could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [endpoint, organizationName]);

  function update<K extends keyof BrandProfile>(field: K, value: BrandProfile[K]) {
    setProfile((current) => ({ ...current, [field]: value }));
    setError("");
    setNotice("");
  }

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (!new Set(["image/png", "image/jpeg", "image/webp"]).has(file.type)) {
      setError("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size < 1 || file.size > 2 * 1024 * 1024) {
      setError("Workspace logos must be 2 MB or smaller.");
      return;
    }
    setUploadingLogo(true);
    setError("");
    setNotice("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(endpoint + "/logo", { method: "POST", body: formData });
      const result = await response.json() as { ok?: boolean; error?: string; logoUrl?: string };
      if (!response.ok || !result.ok || !result.logoUrl) throw new Error(result.error || "The workspace logo could not be uploaded.");
      setProfile((current) => ({ ...current, logoUrl: result.logoUrl ?? null }));
      setNotice("Workspace logo uploaded and saved. It is shared by every mailbox in this workspace.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The workspace logo could not be uploaded.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function removeLogo() {
    if (!canManage || uploadingLogo || saving || !profile.logoUrl) return;
    setUploadingLogo(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(endpoint + "/logo", { method: "DELETE" });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "The workspace logo could not be removed.");
      setProfile((current) => ({ ...current, logoUrl: null }));
      setNotice("Workspace logo removed from every mailbox in this workspace.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The workspace logo could not be removed.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || saving || uploadingLogo) return;

    const socialLinks: BrandProfile["socialLinks"] = [];
    for (const line of socialLinksText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
      const separator = line.indexOf("|");
      if (separator < 1) {
        setError("Use one social link per line in the format Label | https://…");
        return;
      }
      socialLinks.push({ label: line.slice(0, separator).trim(), href: line.slice(separator + 1).trim() });
    }
    if (socialLinks.length > 8) {
      setError("Add no more than eight social links.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, brandName: organizationName, socialLinks }),
      });
      const result = await response.json() as BrandApiPayload;
      if (!response.ok || !result.ok || !result.profile) throw new Error(result.error || "Brand profile could not be saved.");
      const saved = { ...DEFAULT_PROFILE, ...result.profile, brandName: organizationName };
      setProfile(saved);
      setSocialLinksText((saved.socialLinks ?? []).map((link) => link.label + " | " + link.href).join("\n"));
      setNotice("Workspace profile saved. Every mailbox and designed email uses these shared brand defaults.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Brand profile could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="settings-section-summary">
        <div>
          <strong>Company identity</strong>
          <p>{organizationName} has one shared logo and brand profile. Every mailbox and alias in this workspace inherits the same identity.</p>
        </div>
        <span className={canManage ? "settings-status active" : "settings-status pending"}><span />{canManage ? "Can edit" : "View only"}</span>
      </div>

      {loading ? <p className="settings-muted">Loading brand profile…</p> : (
        <form onSubmit={saveProfile}>
          <div className="settings-form-grid">
            <div className="settings-brand-logo-field settings-field-wide">
              <div className="settings-brand-logo-preview" aria-hidden="true">
                {profile.logoUrl ? <Image src={profile.logoUrl} alt="" width={72} height={72} unoptimized /> : <span>{organizationName.trim().slice(0, 1).toUpperCase() || "W"}</span>}
              </div>
              <div className="settings-brand-logo-copy">
                <strong>Workspace logo</strong>
                <p>Used in the workspace switcher and as the default logo in branded emails for every mailbox.</p>
                {canManage && <div className="settings-brand-logo-actions">
                  <label className="mail-secondary-action settings-brand-logo-upload">{uploadingLogo ? "Uploading…" : "Upload logo"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo} disabled={uploadingLogo || saving} /></label>
                  {profile.logoUrl && <button type="button" className="mail-secondary-action" onClick={removeLogo} disabled={uploadingLogo || saving}>Remove logo</button>}
                </div>}
                <small>PNG, JPEG, or WebP · Maximum 2 MB. The logo is public so email recipients can load it.</small>
              </div>
            </div>
            <label className="settings-field"><span>Website</span><input type="url" value={profile.websiteUrl ?? ""} onChange={(event) => update("websiteUrl", event.target.value || null)} maxLength={2048} placeholder="https://company.example" disabled={!canManage || saving} /></label>
            <label className="settings-field"><span>Contact phone</span><input value={profile.phone} onChange={(event) => update("phone", event.target.value)} maxLength={80} placeholder="+234…" disabled={!canManage || saving} /></label>
            <label className="settings-field"><span>Primary brand color</span><div className="settings-color-field"><input type="color" value={profile.primaryColor} onChange={(event) => update("primaryColor", event.target.value.toUpperCase())} disabled={!canManage || saving} /><input value={profile.primaryColor} onChange={(event) => update("primaryColor", event.target.value)} pattern="^#[0-9A-Fa-f]{6}$" maxLength={7} required disabled={!canManage || saving} /></div></label>
            <label className="settings-field"><span>Accent color</span><div className="settings-color-field"><input type="color" value={profile.accentColor} onChange={(event) => update("accentColor", event.target.value.toUpperCase())} disabled={!canManage || saving} /><input value={profile.accentColor} onChange={(event) => update("accentColor", event.target.value)} pattern="^#[0-9A-Fa-f]{6}$" maxLength={7} required disabled={!canManage || saving} /></div></label>
            <label className="settings-field"><span>Email background color</span><div className="settings-color-field"><input type="color" value={profile.backgroundColor} onChange={(event) => update("backgroundColor", event.target.value.toUpperCase())} disabled={!canManage || saving} /><input value={profile.backgroundColor} onChange={(event) => update("backgroundColor", event.target.value)} pattern="^#[0-9A-Fa-f]{6}$" maxLength={7} required disabled={!canManage || saving} /></div></label>
            <label className="settings-field"><span>Email text color</span><div className="settings-color-field"><input type="color" value={profile.textColor} onChange={(event) => update("textColor", event.target.value.toUpperCase())} disabled={!canManage || saving} /><input value={profile.textColor} onChange={(event) => update("textColor", event.target.value)} pattern="^#[0-9A-Fa-f]{6}$" maxLength={7} required disabled={!canManage || saving} /></div></label>
            <label className="settings-field"><span>Email-safe font</span><select value={profile.fontFamily} onChange={(event) => update("fontFamily", event.target.value)} disabled={!canManage || saving}>{FONTS.map((font) => <option key={font} value={font}>{font}</option>)}</select></label>
            <label className="settings-field settings-field-wide"><span>Business address</span><textarea value={profile.address} onChange={(event) => update("address", event.target.value)} rows={2} maxLength={1000} placeholder="Street, city, country" disabled={!canManage || saving} /></label>
            <label className="settings-field settings-field-wide"><span>Default email footer</span><textarea value={profile.footerText} onChange={(event) => update("footerText", event.target.value)} rows={3} maxLength={4000} placeholder="Optional footer or company notice to include in designed emails" disabled={!canManage || saving} /><small>Keep this useful and concise. You can still add a specific footer block to an individual design.</small></label>
            <label className="settings-field settings-field-wide"><span>Social links</span><textarea value={socialLinksText} onChange={(event) => { setSocialLinksText(event.target.value); setError(""); setNotice(""); }} rows={3} placeholder={"LinkedIn | https://linkedin.com/company/example\nInstagram | https://instagram.com/example"} disabled={!canManage || saving} /><small>One per line, up to 8. Use HTTPS links only.</small></label>
          </div>
          <div className="settings-info-banner"><span aria-hidden="true">i</span><p>The workspace name is the single company name used across ABEmail. The logo, brand colors, contact details and footer are shared by every mailbox. Recipients may still need to allow remote images in their email client.</p></div>
          <div className="settings-form-footer">
            <span>{canManage ? "Changes are shared with active members of this workspace." : "Only workspace owners and admins can update brand defaults."}</span>
            {canManage && <button className="mail-primary-action" type="submit" disabled={saving || uploadingLogo}>{saving ? "Saving…" : "Save workspace identity"}</button>}
          </div>
          {error && <p className="settings-profile-alert" role="alert">{error}</p>}
          {notice && <div className="settings-profile-success" role="status"><span>{notice}</span><button type="button" className="mail-notice-dismiss" aria-label="Dismiss notice" onClick={() => setNotice("")}>×</button></div>}
        </form>
      )}
    </div>
  );
}
