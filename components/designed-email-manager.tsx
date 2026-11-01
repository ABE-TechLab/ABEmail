"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  renderEmailDesign,
  validateEmailDesignContent,
  type EmailDesignBlock,
  type EmailDesignContent,
  type EmailDesignBrandProfile,
} from "@/lib/email-design/render.mjs";
import { EMAIL_DESIGN_STARTERS, createEmailDesignStarter } from "@/lib/email-design/starters";
import styles from "./designed-email-manager.module.css";
import { useTransientNotice } from "@/lib/use-transient-notice";

type DesignTemplate = {
  id: string;
  name: string;
  subject: string;
  description: string;
  contentJson: EmailDesignContent;
  createdAt: string;
  updatedAt: string;
};
type DesignForm = { name: string; subject: string; description: string; contentJson: EmailDesignContent };
type ApiPayload = { ok?: boolean; error?: string; templates?: DesignTemplate[]; template?: DesignTemplate[] | DesignTemplate; count?: number; profile?: EmailDesignBrandProfile };
type BlockType = "logo" | "heading" | "paragraph" | "image" | "button" | "divider" | "spacer" | "row" | "social" | "footer" | "contact";

const BLOCK_TYPES: { value: BlockType; label: string }[] = [
  { value: "logo", label: "Brand logo" },
  { value: "heading", label: "Heading" },
  { value: "paragraph", label: "Text paragraph" },
  { value: "image", label: "Image" },
  { value: "button", label: "Call-to-action button" },
  { value: "divider", label: "Divider" },
  { value: "spacer", label: "Spacing" },
  { value: "row", label: "Two-column row" },
  { value: "social", label: "Social links" },
  { value: "contact", label: "Contact details" },
  { value: "footer", label: "Footer text" },
];

const EMPTY_CONTENT: EmailDesignContent = { version: 1, blocks: [] };
const DEFAULT_BRAND: EmailDesignBrandProfile = {
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
  socialLinks: [],
};
const DEFAULT_FORM: DesignForm = { name: "", subject: "", description: "", contentJson: EMPTY_CONTENT };

function newId() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 16);
}

function createBlock(type: BlockType): EmailDesignBlock {
  const id = newId();
  switch (type) {
    case "logo": return { id, type, src: null, alt: "", width: 160 };
    case "heading": return { id, type, text: "Your headline", level: 1 };
    case "paragraph": return { id, type, text: "Write a clear message for your recipient." };
    case "image": return { id, type, src: "https://example.com/image.png", alt: "Describe this image", width: 600 };
    case "button": return { id, type, label: "Take action", href: "https://example.com" };
    case "divider": return { id, type };
    case "spacer": return { id, type, height: 24 };
    case "row": return { id, type, columns: [
      { id: newId(), blocks: [{ id: newId(), type: "heading", text: "Column one", level: 3 }, { id: newId(), type: "paragraph", text: "Add supporting detail." }] },
      { id: newId(), blocks: [{ id: newId(), type: "heading", text: "Column two", level: 3 }, { id: newId(), type: "paragraph", text: "Add another detail." }] },
    ] };
    case "social": return { id, type, links: [{ label: "Website", href: "https://example.com" }] };
    case "contact": return { id, type, email: "hello@example.com", phone: "", websiteUrl: "", address: "" };
    case "footer": return { id, type, text: "You are receiving this email because we work with you." };
  }
}

const STARTERS = EMAIL_DESIGN_STARTERS;

function blockLabel(block: EmailDesignBlock) {
  const item = BLOCK_TYPES.find((type) => type.value === block.type);
  return item?.label ?? "Content block";
}

function shortDescription(template: DesignTemplate) {
  const fromBlocks = template.contentJson.blocks.map((block) => {
    if (block.type === "heading" || block.type === "paragraph" || block.type === "footer") return block.text;
    if (block.type === "button") return block.label;
    return "";
  }).filter(Boolean).join(" ");
  const value = (template.description || fromBlocks).replace(/\s+/g, " ").trim();
  return value.length > 80 ? value.slice(0, 77) + "…" : value || "Blank design";
}

export default function DesignedEmailManager({ organizationId }: { organizationId: string }) {
  const endpoint = "/api/organizations/" + organizationId + "/email-designs";
  const brandEndpoint = "/api/organizations/" + organizationId + "/brand-profile";
  const [templates, setTemplates] = useState<DesignTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<DesignForm>(DEFAULT_FORM);
  const [brand, setBrand] = useState<EmailDesignBrandProfile>(DEFAULT_BRAND);
  const [brandLoading, setBrandLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useTransientNotice();
  const [error, setError] = useState("");
  const [blockToAdd, setBlockToAdd] = useState<BlockType>("heading");
  const [starter, setStarter] = useState("welcome");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewOpen, setPreviewOpen] = useState(true);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as ApiPayload;
        if (!response.ok || !payload.ok) throw new Error(payload.error || "Designed emails could not be loaded.");
        if (active) {
          setTemplates(payload.templates ?? []);
          setLoadError("");
        }
      })
      .catch((cause: unknown) => {
        if (!active || (cause instanceof Error && cause.name === "AbortError")) return;
        setLoadError(cause instanceof Error ? cause.message : "Designed emails could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [endpoint]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void fetch(brandEndpoint, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as ApiPayload;
        if (!response.ok || !payload.ok) throw new Error(payload.error || "Brand profile could not be loaded.");
        if (active) setBrand({ ...DEFAULT_BRAND, ...(payload.profile ?? {}) });
      })
      .catch(() => { if (active) setBrand(DEFAULT_BRAND); })
      .finally(() => { if (active) setBrandLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [brandEndpoint]);

  function blankDesign() {
    setSelectedId(null);
    setForm({ ...DEFAULT_FORM, contentJson: { version: 1, blocks: [] } });
    setNotice("");
    setError("");
    setPreviewOpen(true);
  }

  function startEditing(template: DesignTemplate) {
    const content = validateEmailDesignContent(template.contentJson);
    setSelectedId(template.id);
    setForm({
      name: template.name,
      subject: template.subject,
      description: template.description,
      contentJson: content.data ?? EMPTY_CONTENT,
    });
    setNotice("");
    setError(content.error ?? "");
    setPreviewOpen(true);
  }

  function applyStarter(value: string) {
    const selected = createEmailDesignStarter(value, newId);
    if (!selected) return;
    setSelectedId(null);
    setForm({
      name: selected.label,
      subject: selected.subject,
      description: "Starter design — replace the example copy, details, images, and links before saving.",
      contentJson: { version: 1, blocks: selected.blocks },
    });
    setNotice("Starter design loaded. Replace the example copy, details, images, and links before saving.");
    setError("");
    setPreviewOpen(true);
  }

  function updateForm(field: "name" | "subject" | "description", value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setNotice("");
    setError("");
  }

  function updateBlock(index: number, update: (block: EmailDesignBlock) => EmailDesignBlock) {
    setForm((current) => ({
      ...current,
      contentJson: {
        ...current.contentJson,
        blocks: current.contentJson.blocks.map((block, i) => i === index ? update(block) : block),
      },
    }));
    setNotice("");
    setError("");
  }

  function addBlock() {
    if (form.contentJson.blocks.length >= 100) {
      setError("A design can contain at most 100 blocks.");
      return;
    }
    setForm((current) => ({ ...current, contentJson: { ...current.contentJson, blocks: [...current.contentJson.blocks, createBlock(blockToAdd)] } }));
    setNotice("");
    setError("");
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= form.contentJson.blocks.length) return;
    setForm((current) => {
      const blocks = [...current.contentJson.blocks];
      [blocks[index], blocks[nextIndex]] = [blocks[nextIndex], blocks[index]];
      return { ...current, contentJson: { ...current.contentJson, blocks } };
    });
  }

  function removeBlock(index: number) {
    setForm((current) => ({ ...current, contentJson: { ...current.contentJson, blocks: current.contentJson.blocks.filter((_, i) => i !== index) } }));
    setNotice("");
    setError("");
  }

  function updateNestedRow(index: number, columnId: string, nestedIndex: number, update: (block: EmailDesignBlock) => EmailDesignBlock) {
    updateBlock(index, (block) => {
      if (block.type !== "row") return block;
      return {
        ...block,
        columns: block.columns.map((column) => column.id !== columnId ? column : {
          ...column,
          blocks: column.blocks.map((child, i) => i === nestedIndex ? update(child) : child),
        }),
      };
    });
  }

  async function saveDesign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const parsed = validateEmailDesignContent(form.contentJson);
    if (parsed.error || !parsed.data) {
      setError(parsed.error ?? "Design content is invalid.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(selectedId ? endpoint + "/" + selectedId : endpoint, {
        method: selectedId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, subject: form.subject, description: form.description, contentJson: parsed.data }),
      });
      const payload = await response.json() as ApiPayload;
      if (!response.ok || !payload.ok || !payload.template || Array.isArray(payload.template)) {
        throw new Error(payload.error || "The designed email could not be saved.");
      }
      const saved = payload.template as DesignTemplate;
      setSelectedId(saved.id);
      setForm({ name: saved.name, subject: saved.subject, description: saved.description, contentJson: saved.contentJson });
      setTemplates((current) => [saved, ...current.filter((item) => item.id !== saved.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      setNotice(selectedId ? "Design saved." : "Designed email created.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The designed email could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function duplicateDesign() {
    if (!selectedId || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, name: (form.name.trim() || "Email design") + " copy" }),
      });
      const payload = await response.json() as ApiPayload;
      if (!response.ok || !payload.ok || !payload.template || Array.isArray(payload.template)) {
        throw new Error(payload.error || "The design could not be duplicated.");
      }
      const saved = payload.template as DesignTemplate;
      setSelectedId(saved.id);
      setForm({ name: saved.name, subject: saved.subject, description: saved.description, contentJson: saved.contentJson });
      setTemplates((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setNotice("Design duplicated. Edit the copy independently.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The design could not be duplicated.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDesign() {
    if (!selectedId || deleting) return;
    if (!window.confirm("Delete this designed email? This cannot be undone.")) return;
    setDeleting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(endpoint + "/" + selectedId, { method: "DELETE" });
      const payload = await response.json() as ApiPayload;
      if (!response.ok || !payload.ok) throw new Error(payload.error || "The design could not be deleted.");
      setTemplates((current) => current.filter((item) => item.id !== selectedId));
      blankDesign();
      setNotice("Designed email deleted.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The design could not be deleted.");
    } finally {
      setDeleting(false);
    }
  }

  const preview = useMemo(() => {
    try {
      const parsed = validateEmailDesignContent(form.contentJson);
      if (parsed.error || !parsed.data) return { html: "", error: parsed.error ?? "Design content is invalid." };
      return { html: renderEmailDesign(parsed.data, brand).html, error: "" };
    } catch {
      return { html: "", error: "Preview is unavailable for the current design." };
    }
  }, [form.contentJson, brand]);

  function textField(label: string, value: string, onChange: (value: string) => void, options: { multiline?: boolean; placeholder?: string; type?: string; maxLength?: number } = {}) {
    return (
      <label className={styles.field}>
        <span>{label}</span>
        {options.multiline ? (
          <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={options.placeholder} maxLength={options.maxLength} rows={3} />
        ) : (
          <input type={options.type ?? "text"} value={value} onChange={(event) => onChange(event.target.value)} placeholder={options.placeholder} maxLength={options.maxLength} />
        )}
      </label>
    );
  }

  function renderBlockEditor(block: EmailDesignBlock, index: number, nested = false, nestedContext?: { columnId: string; nestedIndex: number }) {
    const edit = (update: (current: EmailDesignBlock) => EmailDesignBlock) => {
      if (!nestedContext) updateBlock(index, update);
      else updateNestedRow(index, nestedContext.columnId, nestedContext.nestedIndex, update);
    };
    return (
      <article key={block.id} className={nested ? styles.nestedBlock : styles.blockCard}>
        {!nested && (
          <header className={styles.blockHeader}>
            <strong>{index + 1}. {blockLabel(block)}</strong>
            <div className={styles.blockActions}>
              <button type="button" aria-label="Move block up" title="Move up" disabled={index === 0} onClick={() => moveBlock(index, -1)}>↑</button>
              <button type="button" aria-label="Move block down" title="Move down" disabled={index === form.contentJson.blocks.length - 1} onClick={() => moveBlock(index, 1)}>↓</button>
              <button type="button" aria-label="Remove block" title="Remove block" onClick={() => removeBlock(index)}>×</button>
            </div>
          </header>
        )}

        {(block.type === "heading" || block.type === "paragraph" || block.type === "footer") && (
          <>
            {block.type === "heading" && <label className={styles.inlineField}><span>Size</span><select value={block.level} onChange={(event) => edit((current) => current.type === "heading" ? { ...current, level: Number(event.target.value) as 1 | 2 | 3 } : current)}><option value={1}>Large</option><option value={2}>Medium</option><option value={3}>Small</option></select></label>}
            {textField(block.type === "heading" ? "Heading text" : block.type === "footer" ? "Footer text" : "Message text", block.text, (value) => edit((current) => current.type === block.type ? { ...current, text: value } : current), { multiline: block.type !== "heading", placeholder: "Write your copy…", maxLength: block.type === "paragraph" ? 20000 : 4000 })}
          </>
        )}

        {block.type === "logo" && (
          <>
            {textField("Logo URL (optional)", block.src ?? "", (value) => edit((current) => current.type === "logo" ? { ...current, src: value || null } : current), { placeholder: "https://…" })}
            {textField("Alternative text", block.alt ?? "", (value) => edit((current) => current.type === "logo" ? { ...current, alt: value } : current), { maxLength: 250 })}
            <label className={styles.inlineField}><span>Width (px)</span><input type="number" min={48} max={320} value={block.width} onChange={(event) => edit((current) => current.type === "logo" ? { ...current, width: Number(event.target.value) } : current)} /></label>
          </>
        )}

        {block.type === "image" && (
          <>
            {textField("Image URL", block.src, (value) => edit((current) => current.type === "image" ? { ...current, src: value } : current), { placeholder: "https://…" })}
            {textField("Alternative text", block.alt ?? "", (value) => edit((current) => current.type === "image" ? { ...current, alt: value } : current), { maxLength: 500 })}
            <label className={styles.inlineField}><span>Width (px)</span><input type="number" min={80} max={600} value={block.width} onChange={(event) => edit((current) => current.type === "image" ? { ...current, width: Number(event.target.value) } : current)} /></label>
          </>
        )}

        {block.type === "button" && (
          <>
            {textField("Button label", block.label, (value) => edit((current) => current.type === "button" ? { ...current, label: value } : current), { maxLength: 160 })}
            {textField("Button destination (HTTPS)", block.href, (value) => edit((current) => current.type === "button" ? { ...current, href: value } : current), { placeholder: "https://…" })}
          </>
        )}

        {block.type === "spacer" && (
          <label className={styles.inlineField}><span>Height (px)</span><input type="number" min={8} max={80} value={block.height} onChange={(event) => edit((current) => current.type === "spacer" ? { ...current, height: Number(event.target.value) } : current)} /></label>
        )}

        {block.type === "social" && textField("Links (one per line: label | https://…)", block.links.map((link) => link.label + " | " + link.href).join("\n"), (value) => edit((current) => current.type === "social" ? {
          ...current,
          links: value.split(/\r?\n/).map((line) => {
            const separator = line.indexOf("|");
            return separator < 0 ? { label: line.trim(), href: "" } : { label: line.slice(0, separator).trim(), href: line.slice(separator + 1).trim() };
          }).filter((link) => link.label || link.href),
        } : current), { multiline: true, placeholder: "Website | https://example.com" })}

        {block.type === "contact" && (
          <>
            {textField("Email address", block.email ?? "", (value) => edit((current) => current.type === "contact" ? { ...current, email: value } : current), { type: "email" })}
            {textField("Phone", block.phone ?? "", (value) => edit((current) => current.type === "contact" ? { ...current, phone: value } : current))}
            {textField("Website URL", block.websiteUrl ?? "", (value) => edit((current) => current.type === "contact" ? { ...current, websiteUrl: value } : current), { placeholder: "https://…" })}
            {textField("Address", block.address ?? "", (value) => edit((current) => current.type === "contact" ? { ...current, address: value } : current), { multiline: true, maxLength: 1000 })}
          </>
        )}

        {block.type === "row" && (
          <div className={styles.rowColumns}>
            <div className={styles.blockActions}>
              <button type="button" disabled={block.columns.length >= 3} onClick={() => edit((current) => current.type === "row" && current.columns.length < 3 ? { ...current, columns: [...current.columns, { id: newId(), blocks: [{ id: newId(), type: "heading", text: "New section", level: 3 }, { id: newId(), type: "paragraph", text: "Add supporting detail." }] }] } : current)}>Add column</button>
              <button type="button" disabled={block.columns.length <= 2} onClick={() => edit((current) => current.type === "row" && current.columns.length > 2 ? { ...current, columns: current.columns.slice(0, -1) } : current)}>Remove last column</button>
            </div>
            {block.columns.map((column, columnIndex) => (
              <div className={styles.rowColumn} key={column.id}>
                <strong>Column {columnIndex + 1}</strong>
                {column.blocks.map((child, nestedIndex) => (
                  <div key={child.id} className={styles.rowChild}>
                    <small>{blockLabel(child)}</small>
                    {(child.type === "heading" || child.type === "paragraph" || child.type === "footer") && textField("Text", child.text, (value) => updateNestedRow(index, column.id, nestedIndex, (current) => current.type === child.type ? { ...current, text: value } : current), { multiline: child.type !== "heading" })}
                    {child.type === "button" && textField("Button label", child.label, (value) => updateNestedRow(index, column.id, nestedIndex, (current) => current.type === "button" ? { ...current, label: value } : current))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {block.type === "divider" && <p className={styles.blockHint}>A subtle horizontal rule separates sections in the email.</p>}
        {!nested && (
          <div className={styles.rowColumns}>
            <label className={styles.inlineField}><span>Alignment</span><select value={block.align ?? "left"} onChange={(event) => edit((current) => ({ ...current, align: event.target.value as "left" | "center" | "right" }))}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
            <label className={styles.inlineField}><span>Space after (px)</span><select value={block.spacingAfter ?? 16} onChange={(event) => edit((current) => ({ ...current, spacingAfter: Number(event.target.value) }))}><option value={0}>None</option><option value={8}>8</option><option value={16}>16</option><option value={24}>24</option><option value={32}>32</option><option value={48}>48</option><option value={64}>64</option></select></label>
          </div>
        )}
      </article>
    );
  }

  return (
    <div className={styles.designer}>
      <header className={styles.toolbar}>
        <div>
          <h2>Designed emails</h2>
          <p>Build reusable, branded emails with blocks. Standard text snippets remain separate.</p>
        </div>
        <div className={styles.toolbarActions}>
          <button type="button" className={styles.secondaryButton} onClick={blankDesign}>＋ Blank design</button>
          <button type="button" className={styles.primaryButton} onClick={() => applyStarter(starter)}>Use starter</button>
        </div>
      </header>

      <div className={styles.editorGrid}>
        <aside className={styles.library} aria-label="Designed email library">
          <div className={styles.libraryHeader}>
            <div><strong>Your designs</strong><small>{templates.length} / 100 saved</small></div>
          </div>
          {loading ? <p className={styles.stateMessage}>Loading designs…</p> : loadError ? <p className={styles.error} role="alert">{loadError}</p> : templates.length === 0 ? (
            <div className={styles.emptyState}><strong>No designed emails yet</strong><p>Start with a blank design or a starter layout.</p></div>
          ) : templates.map((template) => (
            <button type="button" key={template.id} className={selectedId === template.id ? styles.designItemActive : styles.designItem} onClick={() => startEditing(template)} aria-pressed={selectedId === template.id}>
              <span className={styles.designGlyph} aria-hidden="true">✧</span>
              <span><strong>{template.name}</strong><small>{template.subject || "No subject"}</small><span>{shortDescription(template)}</span></span>
            </button>
          ))}
          <div className={styles.libraryFooter}>
            <label className={styles.field}><span>Starter layouts</span><select value={starter} onChange={(event) => setStarter(event.target.value)}>{STARTERS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
            <button type="button" className={styles.secondaryButton} onClick={() => applyStarter(starter)}>Load starter</button>
          </div>
        </aside>

        <form className={styles.editor} onSubmit={saveDesign}>
          <div className={styles.editorHeading}>
            <div><strong>{selectedId ? "Edit design" : "New design"}</strong><small>Design is saved in this workspace.</small></div>
            <div className={styles.editorActions}>
              {selectedId && <button type="button" className={styles.secondaryButton} onClick={() => void duplicateDesign()} disabled={saving || deleting}>Duplicate</button>}
              {selectedId && <button type="button" className={styles.dangerButton} onClick={() => void deleteDesign()} disabled={deleting || saving}>{deleting ? "Deleting…" : "Delete"}</button>}
              <button type="submit" className={styles.primaryButton} disabled={saving || deleting || !form.name.trim()}>{saving ? "Saving…" : selectedId ? "Save changes" : "Save design"}</button>
            </div>
          </div>

          {textField("Design name", form.name, (value) => updateForm("name", value), { placeholder: "e.g. Customer welcome", maxLength: 120 })}
          {textField("Subject line", form.subject, (value) => updateForm("subject", value), { placeholder: "e.g. Welcome to ABE TechLab", maxLength: 998 })}
          {textField("Description (optional)", form.description, (value) => updateForm("description", value), { placeholder: "When to use this design", maxLength: 500 })}

          <div className={styles.blocksHeading}>
            <div><strong>Content blocks</strong><small>{form.contentJson.blocks.length} / 100</small></div>
            <div className={styles.addBlock}>
              <select value={blockToAdd} onChange={(event) => setBlockToAdd(event.target.value as BlockType)} aria-label="Block to add">{BLOCK_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
              <button type="button" className={styles.secondaryButton} onClick={addBlock} disabled={form.contentJson.blocks.length >= 100}>Add block</button>
            </div>
          </div>

          {form.contentJson.blocks.length === 0 ? <div className={styles.emptyBlocks}><strong>Start with your message</strong><p>Add a heading, paragraph, logo, button, or other email block. You can reorder blocks with the arrows.</p></div> : (
            <div className={styles.blocksList}>{form.contentJson.blocks.map((block, index) => renderBlockEditor(block, index))}</div>
          )}

          {error && <p className={styles.error} role="alert">{error}</p>}
          {notice && <div className={styles.notice} role="status"><span>{notice}</span><button type="button" className="mail-notice-dismiss" aria-label="Dismiss notice" onClick={() => setNotice("")}>×</button></div>}
          <p className={styles.helper}>Brand defaults {brandLoading ? "are loading." : "are applied to the preview."} Save and send will validate every block on the server.</p>
        </form>

        <section className={styles.previewPanel} aria-label="Email preview">
          <header className={styles.previewHeader}>
            <div><strong>Preview</strong><small>{previewDevice === "desktop" ? "600 px email canvas" : "Mobile reading width"}</small></div>
            <div className={styles.previewControls}>
              <button type="button" className={previewDevice === "desktop" ? styles.previewSelected : styles.previewButton} onClick={() => setPreviewDevice("desktop")} aria-pressed={previewDevice === "desktop"} title="Desktop preview">▰</button>
              <button type="button" className={previewDevice === "mobile" ? styles.previewSelected : styles.previewButton} onClick={() => setPreviewDevice("mobile")} aria-pressed={previewDevice === "mobile"} title="Mobile preview">▯</button>
              <button type="button" className={styles.previewButton} onClick={() => setPreviewOpen((current) => !current)}>{previewOpen ? "Hide" : "Show"}</button>
            </div>
          </header>
          {previewOpen && (
            <div className={styles.previewStage}>
              {preview.error ? <p className={styles.error}>{preview.error}</p> : preview.html ? (
                <iframe
                  title="Designed email preview"
                  sandbox=""
                  referrerPolicy="no-referrer"
                  srcDoc={preview.html}
                  className={previewDevice === "mobile" ? styles.previewMobile : styles.previewDesktop}
                />
              ) : <p className={styles.stateMessage}>Add content blocks to see your design.</p>}
            </div>
          )}
          <p className={styles.previewNote}>The preview demonstrates layout, not a guarantee of how every email client handles remote images.</p>
        </section>
      </div>
    </div>
  );
}
