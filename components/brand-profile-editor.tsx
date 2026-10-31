"use client";

import { useEffect, useState, type FormEvent } from "react";
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

export default function BrandProfileEditor({ organizationId, canManage }: { organizationId: string; canManage: boolean }) {
  const endpoint = "/api/organizations/" + organizationId + "/brand-profile";
  const [profile, setProfile] = useState<BrandProfile>(DEFAULT_PROFILE);
  const [socialLinksText, setSocialLinksText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
        const next = { ...DEFAULT_PROFILE, ...(result.profile ?? {}) };
        setProfile(next);
        setSocialLinksText((next.socialLinks ?? []).map((link) => link.label + " | " + link.href).join("\n"));
      })
      .catch((cause: unknown) => {
        if (!active || (cause instanceof Error && cause.name === "AbortError")) return;
        setError(cause instanceof Error ? cause.message : "Brand profile could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [endpoint]);

  function update<K extends keyof BrandProfile>(field: K, value: BrandProfile[K]) {
    setProfile((current) => ({ ...current, [field]: value }));
    setError("");
    setNotice("");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || saving) return;

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
        body: JSON.stringify({ ...profile, socialLinks }),
      });
      const result = await response.json() as BrandApiPayload;
      if (!response.ok || !result.ok || !result.profile) throw new Error(result.error || "Brand profile could not be saved.");
      const saved = { ...DEFAULT_PROFILE, ...result.profile };
      setProfile(saved);
      setSocialLinksText((saved.socialLinks ?? []).map((link) => link.label + " | " + link.href).join("\n"));
      setNotice("Brand profile saved. Designed emails will use these defaults in their previews.");
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
          <strong>Organization brand profile</strong>
          <p>One shared identity for designed emails. Existing plain-text snippets and personal signatures remain unchanged.</p>
        </div>
        <span className={canManage ? "settings-status active" : "settings-status pending"}><span />{canManage ? "Can edit" : "View only"}</span>
      </div>

      {loading ? <p className="settings-muted">Loading brand profile…</p> : (
        <form onSubmit={saveProfile}>
          <div className="settings-form-grid">
            <label className="settings-field"><span>Brand / company name</span><input value={profile.brandName} onChange={(event) => update("brandName", event.target.value)} maxLength={120} placeholder="Your company name" disabled={!canManage || saving} /></label>
            <label className="settings-field"><span>Logo URL</span><input type="url" value={profile.logoUrl ?? ""} onChange={(event) => update("logoUrl", event.target.value || null)} maxLength={2048} placeholder="https://assets.example.com/logo.png" disabled={!canManage || saving} /><small>Use a recipient-loadable HTTPS URL. Private attachments are not public logos.</small></label>
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
          <div className="settings-info-banner"><span aria-hidden="true">i</span><p>Logos and images should be hosted at recipient-accessible HTTPS addresses. Some email clients block remote images until the recipient allows them.</p></div>
          <div className="settings-form-footer">
            <span>{canManage ? "Changes are shared with active members of this workspace." : "Only workspace owners and admins can update brand defaults."}</span>
            {canManage && <button className="mail-primary-action" type="submit" disabled={saving}>{saving ? "Saving…" : "Save brand profile"}</button>}
          </div>
          {error && <p className="settings-profile-alert" role="alert">{error}</p>}
          {notice && <div className="settings-profile-success" role="status"><span>{notice}</span><button type="button" className="mail-notice-dismiss" aria-label="Dismiss notice" onClick={() => setNotice("")}>×</button></div>}
        </form>
      )}
    </div>
  );
}
