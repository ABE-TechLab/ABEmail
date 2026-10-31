"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import styles from "./template-manager.module.css";
import DesignedEmailManager from "@/components/designed-email-manager";
import { useTransientNotice } from "@/lib/use-transient-notice";

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body_text: string;
  created_at: string;
  updated_at: string;
};

type TemplateForm = { name: string; subject: string; bodyText: string };
type ApiPayload = { ok?: boolean; error?: string; templates?: EmailTemplate[]; template?: EmailTemplate };

const EMPTY_FORM: TemplateForm = { name: "", subject: "", bodyText: "" };

function describeTemplate(template: EmailTemplate) {
  const value = template.body_text.replace(/\s+/g, " ").trim();
  return value.length > 124 ? value.slice(0, 121) + "…" : value || "No message body";
}

function updatedLabel(value: string) {
  const time = new Date(value);
  if (!Number.isFinite(time.getTime())) return "Recently updated";
  return "Updated " + new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(time);
}

export default function TemplateManager({ organizationId }: { organizationId: string }) {
  const endpoint = "/api/organizations/" + organizationId + "/templates";
  const base = "/dashboard/" + organizationId;
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletePrompt, setDeletePrompt] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useTransientNotice();
  const [activeTab, setActiveTab] = useState<"snippets" | "designed">("snippets");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as ApiPayload;
        if (!response.ok || !payload.ok) throw new Error(payload.error || "Templates could not be loaded.");
        if (active) {
          setTemplates(payload.templates ?? []);
          setLoadError("");
        }
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof Error && error.name === "AbortError")) return;
        setLoadError(error instanceof Error ? error.message : "Templates could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });

    return () => {
      active = false;
      controller.abort();
    };
  }, [endpoint, refreshVersion]);

  function startNew() {
    setSelectedId(null);
    setForm(EMPTY_FORM);
    setDeletePrompt(false);
    setFormError("");
    setNotice("");
  }

  function startEditing(template: EmailTemplate) {
    setSelectedId(template.id);
    setForm({ name: template.name, subject: template.subject, bodyText: template.body_text });
    setDeletePrompt(false);
    setFormError("");
    setNotice("");
  }

  function updateField(field: keyof TemplateForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError("");
    setNotice("");
  }

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError("");
    setNotice("");
    const editing = Boolean(selectedId);

    try {
      const response = await fetch(selectedId ? endpoint + "/" + selectedId : endpoint, {
        method: selectedId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json() as ApiPayload;
      if (!response.ok || !payload.ok || !payload.template) {
        throw new Error(payload.error || "The template could not be saved.");
      }
      setSelectedId(payload.template.id);
      setForm({
        name: payload.template.name,
        subject: payload.template.subject,
        bodyText: payload.template.body_text,
      });
      setNotice(editing ? "Template changes saved." : "Template created.");
      setRefreshVersion((current) => current + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The template could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate() {
    if (!selectedId || deleting) return;
    setDeleting(true);
    setFormError("");
    setNotice("");

    try {
      const response = await fetch(endpoint + "/" + selectedId, { method: "DELETE" });
      const payload = await response.json() as ApiPayload;
      if (!response.ok || !payload.ok) throw new Error(payload.error || "The template could not be deleted.");
      startNew();
      setNotice("Template deleted.");
      setRefreshVersion((current) => current + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The template could not be deleted.");
    } finally {
      setDeleting(false);
    }
  }

  const formValid = Boolean(form.name.trim() && (form.subject.trim() || form.bodyText.trim()));

  return (
    <div className={styles.page}>
      <header className="mail-topbar">
        <div className="mail-breadcrumb">
          <Link href={base + "/mail"}>Workspace</Link>
          <span className="mail-breadcrumb-slash">/</span>
          <strong>Templates</strong>
        </div>
        <div className="mail-topbar-right">
          <Link href={base + "/settings"} className="mail-topbar-profile-link" aria-label="Open workspace settings" title="Workspace settings">
            <span className="mail-user-avatar" aria-hidden="true">⚙</span>
          </Link>
        </div>
      </header>

      <div className={styles.content}>
        <header className={styles.heading}>
          <div>
            <p className={styles.kicker}>WORKSPACE · PRODUCTIVITY</p>
            <h1>Email templates</h1>
            <p className={styles.description}>Save quick text snippets or build polished branded emails with reusable visual blocks.</p>
          </div>
          {activeTab === "snippets" && <button className={styles.primaryButton} type="button" onClick={startNew}>＋ New snippet</button>}
        </header>

        <div className={styles.tabs} role="tablist" aria-label="Template types">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "snippets"}
            className={activeTab === "snippets" ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab("snippets")}
          >Text snippets</button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "designed"}
            className={activeTab === "designed" ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab("designed")}
          >Designed emails</button>
        </div>

        {activeTab === "snippets" ? <>
        <div className={styles.layout}>
          <section className={styles.panel} aria-labelledby="template-library-heading">
            <header className={styles.panelHeader}>
              <div>
                <h2 id="template-library-heading">Your templates</h2>
                <p>{templates.length} of 100 saved in this workspace</p>
              </div>
            </header>
            {loading ? (
              <p className={styles.stateMessage} role="status">Loading templates…</p>
            ) : loadError ? (
              <div className={styles.stateError} role="alert">{loadError}</div>
            ) : templates.length === 0 ? (
              <div className={styles.emptyState}>
                <span aria-hidden="true">▧</span>
                <strong>No saved templates yet</strong>
                <p>Save a message once, then reuse it from the composer instead of rewriting it each time.</p>
                <button type="button" className={styles.secondaryButton} onClick={startNew}>Create your first template</button>
              </div>
            ) : (
              <div className={styles.templateList}>
                {templates.map((template) => (
                  <button
                    className={selectedId === template.id ? styles.templateItemActive : styles.templateItem}
                    type="button"
                    key={template.id}
                    onClick={() => startEditing(template)}
                    aria-pressed={selectedId === template.id}
                  >
                    <span className={styles.templateIcon} aria-hidden="true">▧</span>
                    <span className={styles.templateCopy}>
                      <strong>{template.name}</strong>
                      <small>{template.subject || "No subject"}</small>
                      <span>{describeTemplate(template)}</span>
                      <small>{updatedLabel(template.updated_at)}</small>
                    </span>
                    <span className={styles.itemChevron} aria-hidden="true">›</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className={styles.panel} aria-labelledby="template-editor-heading">
            <header className={styles.panelHeader}>
              <div>
                <h2 id="template-editor-heading">{selectedId ? "Edit template" : "Create a template"}</h2>
                <p>Templates are plain text and private to your account in this workspace.</p>
              </div>
              {selectedId && (
                <button type="button" className={styles.textButton} onClick={startNew}>New</button>
              )}
            </header>

            <form className={styles.form} onSubmit={saveTemplate}>
              <label className={styles.field}>
                <span>Template name</span>
                <input value={form.name} onChange={(event) => updateField("name", event.target.value)} maxLength={120} required placeholder="e.g. Payment reminder" disabled={saving || deleting} />
              </label>
              <label className={styles.field}>
                <span>Subject <small>Optional</small></span>
                <input value={form.subject} onChange={(event) => updateField("subject", event.target.value)} maxLength={998} placeholder="Subject line to reuse" disabled={saving || deleting} />
              </label>
              <label className={styles.field}>
                <span>Message <small>At least a subject or message is required</small></span>
                <textarea value={form.bodyText} onChange={(event) => updateField("bodyText", event.target.value)} maxLength={80000} rows={12} placeholder={"Hello,\n\nThanks for getting in touch…"} disabled={saving || deleting} />
              </label>

              <div className={styles.editorFooter}>
                <span>{form.bodyText.length.toLocaleString("en-GB")} / 80,000 characters</span>
                <div className={styles.actions}>
                  {selectedId && (
                    <button type="button" className={styles.dangerButton} onClick={() => { setDeletePrompt((current) => !current); setFormError(""); }} disabled={saving || deleting}>
                      Delete
                    </button>
                  )}
                  <button type="submit" className={styles.primaryButton} disabled={!formValid || saving || deleting}>
                    {saving ? "Saving…" : selectedId ? "Save changes" : "Save template"}
                  </button>
                </div>
              </div>

              {deletePrompt && selectedId && (
                <div className={styles.deletePrompt} role="alertdialog" aria-label="Confirm template deletion">
                  <p>Delete this template? This cannot be undone.</p>
                  <div className={styles.actions}>
                    <button type="button" className={styles.secondaryButton} onClick={() => setDeletePrompt(false)} disabled={deleting}>Cancel</button>
                    <button type="button" className={styles.dangerButton} onClick={() => void deleteTemplate()} disabled={deleting}>
                      {deleting ? "Deleting…" : "Confirm delete"}
                    </button>
                  </div>
                </div>
              )}

              {formError && <p className={styles.error} role="alert">{formError}</p>}
              {notice && <div className={styles.notice} role="status"><span>{notice}</span><button type="button" className="mail-notice-dismiss" aria-label="Dismiss notice" onClick={() => setNotice("")}>×</button></div>}
              <p className={styles.helper}>After saving, open Compose and choose the template from the Template field to use it in a message.</p>
            </form>
          </section>
        </div>

        <p className={styles.footerNote}>Text snippets are private to your account. Designed emails are shared with active workspace members and use the Brand Profile under Settings.</p>
        </> : <DesignedEmailManager organizationId={organizationId} />}
      </div>
    </div>
  );
}
