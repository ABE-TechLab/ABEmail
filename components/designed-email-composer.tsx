"use client";

import { useEffect, useMemo, useState, type DragEvent, type KeyboardEvent } from "react";
import {
  renderEmailDesign,
  validateEmailDesignContent,
  type EmailDesignBlock,
  type EmailDesignContent,
  type EmailDesignBrandProfile,
} from "@/lib/email-design/render.mjs";
import { EMAIL_DESIGN_STARTERS, createEmailDesignStarter } from "@/lib/email-design/starters";
import styles from "./designed-email-composer.module.css";

type DesignedTemplate = {
  id: string;
  name: string;
  subject: string;
  contentJson: EmailDesignContent;
};
type ApiResponse = {
  ok?: boolean;
  error?: string;
  templates?: DesignedTemplate[];
  profile?: EmailDesignBrandProfile;
};
type Change = { content: EmailDesignContent | null; text: string; subject?: string };
type Props = {
  organizationId: string;
  value: EmailDesignContent | null;
  disabled?: boolean;
  onChange: (change: Change) => void;
};
type SimpleBlockType = "heading" | "paragraph" | "button" | "image" | "logo" | "divider" | "spacer" | "footer" | "contact" | "row" | "social";

const EMPTY_BRAND: EmailDesignBrandProfile = {
  brandName: "",
  primaryColor: "#2B2B2B",
  accentColor: "#D7F36A",
  backgroundColor: "#F3F4F6",
  textColor: "#242424",
  fontFamily: "Arial",
  socialLinks: [],
};
const BLOCKS: { value: SimpleBlockType; label: string }[] = [
  { value: "heading", label: "Heading" },
  { value: "paragraph", label: "Paragraph" },
  { value: "button", label: "Button" },
  { value: "image", label: "Image" },
  { value: "logo", label: "Logo" },
  { value: "divider", label: "Divider" },
  { value: "spacer", label: "Spacing" },
  { value: "contact", label: "Contact details" },
  { value: "footer", label: "Footer" },
  { value: "row", label: "Two/three-column row" },
  { value: "social", label: "Social links" },
];
function makeId() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 16);
}

function makeBlock(type: SimpleBlockType): EmailDesignBlock {
  const id = makeId();
  switch (type) {
    case "heading": return { id, type, text: "Your headline", level: 1 };
    case "paragraph": return { id, type, text: "Write your message here." };
    case "button": return { id, type, label: "Take action", href: "https://example.com" };
    case "image": return { id, type, src: "https://example.com/image.png", alt: "Describe this image", width: 600 };
    case "logo": return { id, type, src: null, alt: "", width: 160 };
    case "divider": return { id, type };
    case "spacer": return { id, type, height: 24 };
    case "contact": return { id, type, email: "", phone: "", websiteUrl: "", address: "" };
    case "footer": return { id, type, text: "You are receiving this email because we work with you." };
    case "row": return { id, type, columns: [
      { id: makeId(), blocks: [{ id: makeId(), type: "heading", text: "Column one", level: 3 }, { id: makeId(), type: "paragraph", text: "Add supporting detail." }] },
      { id: makeId(), blocks: [{ id: makeId(), type: "heading", text: "Column two", level: 3 }, { id: makeId(), type: "paragraph", text: "Add another detail." }] },
    ] };
    case "social": return { id, type, links: [{ label: "Website", href: "https://example.com" }] };
  }
}

function blockName(block: EmailDesignBlock) {
  return BLOCKS.find((item) => item.value === block.type)?.label ?? (block.type === "row" ? "Columns" : block.type === "social" ? "Social links" : "Content");
}

export default function DesignedEmailComposer({ organizationId, value, disabled = false, onChange }: Props) {
  const [templates, setTemplates] = useState<DesignedTemplate[]>([]);
  const [brand, setBrand] = useState<EmailDesignBrandProfile>(EMPTY_BRAND);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [blockType, setBlockType] = useState<SimpleBlockType>("heading");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [blockDropTarget, setBlockDropTarget] = useState<{ id: string; position: "before" | "after" } | null>(null);
  const [draggingColumn, setDraggingColumn] = useState<{ rowId: string; columnId: string } | null>(null);
  const [columnDropTarget, setColumnDropTarget] = useState<{ rowId: string; columnId: string; position: "before" | "after" } | null>(null);
  const content = value ?? { version: 1 as const, blocks: [] };

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const base = "/api/organizations/" + organizationId;
    void Promise.all([
      fetch(base + "/email-designs", { cache: "no-store", signal: controller.signal }),
      fetch(base + "/brand-profile", { cache: "no-store", signal: controller.signal }),
    ]).then(async ([designResponse, brandResponse]) => {
      const designPayload = await designResponse.json() as ApiResponse;
      const brandPayload = await brandResponse.json() as ApiResponse;
      if (!designResponse.ok || !designPayload.ok) throw new Error(designPayload.error || "Designed templates could not be loaded.");
      if (!brandResponse.ok || !brandPayload.ok) throw new Error(brandPayload.error || "Brand profile could not be loaded.");
      if (active) {
        setTemplates(designPayload.templates ?? []);
        setBrand({ ...EMPTY_BRAND, ...(brandPayload.profile ?? {}) });
        setLoadError("");
      }
    }).catch((cause: unknown) => {
      if (!active || (cause instanceof Error && cause.name === "AbortError")) return;
      setLoadError(cause instanceof Error ? cause.message : "Designed email data could not be loaded.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [organizationId]);

  function emit(next: EmailDesignContent, subject?: string) {
    const parsed = validateEmailDesignContent(next);
    if (parsed.error || !parsed.data) {
      onChange({ content: next, text: "", ...(subject !== undefined ? { subject } : {}) });
      return;
    }
    let text = "";
    try { text = renderEmailDesign(parsed.data, brand).text; } catch { /* server validation remains authoritative */ }
    onChange({ content: parsed.data, text, ...(subject !== undefined ? { subject } : {}) });
  }

  function applyStarter(starterId: string) {
    setSelectedTemplateId("");
    if (starterId === "blank") {
      emit({ version: 1, blocks: [] }, "");
      return;
    }
    const starter = createEmailDesignStarter(starterId, makeId);
    if (!starter) return;
    emit({ version: 1, blocks: starter.blocks }, starter.subject);
  }

  function chooseTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    const parsed = validateEmailDesignContent(template.contentJson);
    if (parsed.error || !parsed.data) {
      setLoadError(parsed.error || "The selected template is invalid.");
      return;
    }
    setLoadError("");
    emit(parsed.data, template.subject);
  }

  function updateBlock(index: number, change: (block: EmailDesignBlock) => EmailDesignBlock) {
    emit({ version: 1, blocks: content.blocks.map((block, i) => i === index ? change(block) : block) });
  }

  function updateNestedRow(index: number, columnId: string, nestedIndex: number, change: (block: EmailDesignBlock) => EmailDesignBlock) {
    updateBlock(index, (current) => current.type === "row" ? {
      ...current,
      columns: current.columns.map((column) => column.id !== columnId ? column : {
        ...column,
        blocks: column.blocks.map((child, i) => i === nestedIndex ? change(child) : child),
      }),
    } : current);
  }

  function moveBlockTo(sourceId: string, targetId: string, position: "before" | "after") {
    if (sourceId === targetId) return;
    const blocks = [...content.blocks];
    const sourceIndex = blocks.findIndex((item) => item.id === sourceId);
    if (sourceIndex < 0) return;
    const [moving] = blocks.splice(sourceIndex, 1);
    const targetIndex = blocks.findIndex((item) => item.id === targetId);
    if (targetIndex < 0) return;
    blocks.splice(targetIndex + (position === "after" ? 1 : 0), 0, moving);
    emit({ version: 1, blocks });
  }

  function handleBlockDragStart(event: DragEvent<HTMLButtonElement>, blockId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", "block:" + blockId);
    setDraggingBlockId(blockId);
  }

  function handleBlockDragOver(event: DragEvent<HTMLElement>, blockId: string) {
    if (!draggingBlockId || draggingBlockId === blockId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const bounds = event.currentTarget.getBoundingClientRect();
    setBlockDropTarget({ id: blockId, position: event.clientY < bounds.top + bounds.height / 2 ? "before" : "after" });
  }

  function handleBlockDrop(event: DragEvent<HTMLElement>, targetId: string) {
    event.preventDefault();
    const payload = event.dataTransfer.getData("text/plain");
    const sourceId = payload.startsWith("block:") ? payload.slice(6) : draggingBlockId;
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
    if (sourceId) moveBlockTo(sourceId, targetId, position);
    setDraggingBlockId(null);
    setBlockDropTarget(null);
  }

  function handleBlockKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    const source = content.blocks[index];
    const target = content.blocks[index + (event.key === "ArrowUp" ? -1 : 1)];
    if (!source || !target) return;
    event.preventDefault();
    moveBlockTo(source.id, target.id, event.key === "ArrowUp" ? "before" : "after");
  }

  function reorderColumns(rowId: string, sourceId: string, targetId: string, position: "before" | "after") {
    if (sourceId === targetId) return;
    emit({
      version: 1,
      blocks: content.blocks.map((block) => {
        if (block.id !== rowId || block.type !== "row") return block;
        const columns = [...block.columns];
        const sourceIndex = columns.findIndex((column) => column.id === sourceId);
        if (sourceIndex < 0) return block;
        const [moving] = columns.splice(sourceIndex, 1);
        const targetIndex = columns.findIndex((column) => column.id === targetId);
        if (targetIndex < 0) return block;
        columns.splice(targetIndex + (position === "after" ? 1 : 0), 0, moving);
        return { ...block, columns };
      }),
    });
  }

  function addBlock() {
    if (content.blocks.length >= 100) return;
    emit({ version: 1, blocks: [...content.blocks, makeBlock(blockType)] });
    setSelectedTemplateId("");
  }

  const preview = useMemo(() => {
    if (!content.blocks.length) return { html: "", error: "" };
    const parsed = validateEmailDesignContent(content);
    if (parsed.error || !parsed.data) return { html: "", error: parsed.error || "The design is invalid." };
    try { return { html: renderEmailDesign(parsed.data, brand).html, error: "" }; }
    catch { return { html: "", error: "Preview is unavailable for the current design." }; }
  }, [content, brand]);

  function textField(label: string, inputValue: string, onInput: (next: string) => void, multiline = false) {
    return <label className={styles.field}>
      <span>{label}</span>
      {multiline
        ? <textarea value={inputValue} onChange={(event) => onInput(event.target.value)} rows={3} disabled={disabled} />
        : <input value={inputValue} onChange={(event) => onInput(event.target.value)} disabled={disabled} />}
    </label>;
  }

  function renderBlock(block: EmailDesignBlock, index: number) {
    const updateText = (text: string) => updateBlock(index, (current) =>
      current.type === "heading" || current.type === "paragraph" || current.type === "footer"
        ? { ...current, text }
        : current);
    return <article
      className={[
        styles.block,
        draggingBlockId === block.id ? styles.dragging : "",
        blockDropTarget?.id === block.id ? (blockDropTarget.position === "before" ? styles.dropBefore : styles.dropAfter) : "",
      ].filter(Boolean).join(" ")}
      key={block.id}
      onDragOver={(event) => handleBlockDragOver(event, block.id)}
      onDrop={(event) => handleBlockDrop(event, block.id)}
    >
      <header className={styles.blockHeader}>
        <strong>{index + 1}. {blockName(block)}</strong>
        <div className={styles.actions}>
          <button type="button" className={styles.dragHandle} draggable={!disabled} disabled={disabled}
            aria-label={`Move ${blockName(block)}. Drag to reposition, or focus and use the up and down arrow keys.`}
            title="Drag to move · Use ↑/↓ when focused"
            onDragStart={(event) => handleBlockDragStart(event, block.id)}
            onDragEnd={() => { setDraggingBlockId(null); setBlockDropTarget(null); }}
            onKeyDown={(event) => handleBlockKeyDown(event, index)}>⠿</button>
          <button type="button" title="Remove" aria-label="Remove block" disabled={disabled} onClick={() => emit({ version: 1, blocks: content.blocks.filter((_, i) => i !== index) })}>×</button>
        </div>
      </header>
      {(block.type === "heading" || block.type === "paragraph" || block.type === "footer") && (
        <>
          {block.type === "heading" && <label className={styles.field}><span>Heading size</span><select value={block.level ?? 2} disabled={disabled} onChange={(event) => updateBlock(index, (current) => current.type === "heading" ? { ...current, level: Number(event.target.value) as 1 | 2 | 3 } : current)}><option value={1}>Large</option><option value={2}>Medium</option><option value={3}>Small</option></select></label>}
          {textField(block.type === "heading" ? "Heading text" : block.type === "footer" ? "Footer text" : "Paragraph text", block.text, updateText, block.type !== "heading")}
        </>
      )}
      {block.type === "button" && <>
        {textField("Button label", block.label, (next) => updateBlock(index, (current) => current.type === "button" ? { ...current, label: next } : current))}
        {textField("Destination URL (HTTPS)", block.href, (next) => updateBlock(index, (current) => current.type === "button" ? { ...current, href: next } : current))}
      </>}
      {block.type === "image" && <>
        {textField("Image URL (HTTPS)", block.src, (next) => updateBlock(index, (current) => current.type === "image" ? { ...current, src: next } : current))}
        {textField("Alternative text", block.alt ?? "", (next) => updateBlock(index, (current) => current.type === "image" ? { ...current, alt: next } : current))}
      </>}
      {block.type === "logo" && <>
        {textField("Logo URL (optional)", block.src ?? "", (next) => updateBlock(index, (current) => current.type === "logo" ? { ...current, src: next || null } : current))}
        {textField("Alternative text", block.alt ?? "", (next) => updateBlock(index, (current) => current.type === "logo" ? { ...current, alt: next } : current))}
      </>}
      {block.type === "spacer" && <label className={styles.field}><span>Height</span><select value={block.height ?? 24} disabled={disabled} onChange={(event) => updateBlock(index, (current) => current.type === "spacer" ? { ...current, height: Number(event.target.value) } : current)}><option value={8}>Small</option><option value={24}>Medium</option><option value={48}>Large</option><option value={80}>Extra large</option></select></label>}
      {block.type === "social" && textField("Links (one per line: label | https://…)", block.links.map((link) => link.label + " | " + link.href).join("\n"), (value) => updateBlock(index, (current) => current.type === "social" ? {
        ...current,
        links: value.split(/\r?\n/).map((line) => {
          const separator = line.indexOf("|");
          return separator < 0 ? { label: line.trim(), href: "" } : { label: line.slice(0, separator).trim(), href: line.slice(separator + 1).trim() };
        }).filter((link) => link.label || link.href),
      } : current), true)}
      {block.type === "row" && <div className={styles.blockList}>
        <div className={styles.addRow}>
          <button type="button" disabled={disabled || block.columns.length >= 3} onClick={() => updateBlock(index, (current) => current.type === "row" && current.columns.length < 3 ? { ...current, columns: [...current.columns, { id: makeId(), blocks: [{ id: makeId(), type: "heading", level: 3, text: "New section" }, { id: makeId(), type: "paragraph", text: "Add supporting detail." }] }] } : current)}>Add column</button>
          <button type="button" disabled={disabled || block.columns.length <= 2} onClick={() => updateBlock(index, (current) => current.type === "row" && current.columns.length > 2 ? { ...current, columns: current.columns.slice(0, -1) } : current)}>Remove last column</button>
        </div>
        {block.columns.map((column, columnIndex) => <section
          className={[
            styles.block, styles.columnCard,
            draggingColumn?.rowId === block.id && draggingColumn.columnId === column.id ? styles.dragging : "",
            columnDropTarget?.rowId === block.id && columnDropTarget.columnId === column.id
              ? (columnDropTarget.position === "before" ? styles.columnDropBefore : styles.columnDropAfter) : "",
          ].filter(Boolean).join(" ")}
          key={column.id}
          onDragOver={(event) => {
            if (draggingColumn?.rowId !== block.id || draggingColumn.columnId === column.id) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            const bounds = event.currentTarget.getBoundingClientRect();
            setColumnDropTarget({ rowId: block.id, columnId: column.id, position: event.clientX < bounds.left + bounds.width / 2 ? "before" : "after" });
          }}
          onDrop={(event) => {
            event.preventDefault();
            const payload = event.dataTransfer.getData("text/plain");
            const sourceId = payload.startsWith("column:") ? payload.slice(7) : draggingColumn?.columnId;
            if (sourceId && draggingColumn?.rowId === block.id) {
              const bounds = event.currentTarget.getBoundingClientRect();
              reorderColumns(block.id, sourceId, column.id, event.clientX < bounds.left + bounds.width / 2 ? "before" : "after");
            }
            setDraggingColumn(null);
            setColumnDropTarget(null);
          }}
        >
          <header className={styles.columnHeader}>
            <button type="button" className={styles.columnDragHandle} draggable={!disabled} disabled={disabled}
              aria-label={`Move column ${columnIndex + 1}. Drag to reorder, or focus and use the left and right arrow keys.`}
              title="Drag to reorder column · Use ←/→ when focused"
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", "column:" + column.id);
                setDraggingColumn({ rowId: block.id, columnId: column.id });
              }}
              onDragEnd={() => { setDraggingColumn(null); setColumnDropTarget(null); }}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                const nextIndex = columnIndex + (event.key === "ArrowLeft" ? -1 : 1);
                const target = block.columns[nextIndex];
                if (!target) return;
                event.preventDefault();
                reorderColumns(block.id, column.id, target.id, event.key === "ArrowLeft" ? "before" : "after");
              }}>⠿</button>
            <strong>Column {columnIndex + 1}</strong>
          </header>
          {column.blocks.map((child, nestedIndex) => <div className={styles.field} key={child.id}>
            <small>{blockName(child)}</small>
            {(child.type === "heading" || child.type === "paragraph" || child.type === "footer") && textField("Text", child.text, (value) => updateNestedRow(index, column.id, nestedIndex, (current) => current.type === child.type ? { ...current, text: value } : current), child.type !== "heading")}
            {child.type === "button" && <>
              {textField("Button label", child.label, (value) => updateNestedRow(index, column.id, nestedIndex, (current) => current.type === "button" ? { ...current, label: value } : current))}
              {textField("Button destination (HTTPS)", child.href, (value) => updateNestedRow(index, column.id, nestedIndex, (current) => current.type === "button" ? { ...current, href: value } : current))}
            </>}
            <label className={styles.field}><span>Alignment</span><select value={child.align ?? "left"} disabled={disabled} onChange={(event) => updateNestedRow(index, column.id, nestedIndex, (current) => ({ ...current, align: event.target.value as "left" | "center" | "right" }))}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
          </div>)}
        </section>)}
      </div>}
      {block.type === "contact" && <>
        {textField("Email", block.email ?? "", (next) => updateBlock(index, (current) => current.type === "contact" ? { ...current, email: next } : current))}
        {textField("Phone", block.phone ?? "", (next) => updateBlock(index, (current) => current.type === "contact" ? { ...current, phone: next } : current))}
        {textField("Website (HTTPS)", block.websiteUrl ?? "", (next) => updateBlock(index, (current) => current.type === "contact" ? { ...current, websiteUrl: next } : current))}
        {textField("Address", block.address ?? "", (next) => updateBlock(index, (current) => current.type === "contact" ? { ...current, address: next } : current), true)}
      </>}
      {block.type === "divider" && <p className={styles.hint}>A horizontal divider separates parts of your message.</p>}
      <div className={styles.selectRow}>
        <label className={styles.field}><span>Alignment</span><select value={block.align ?? "left"} disabled={disabled} onChange={(event) => updateBlock(index, (current) => ({ ...current, align: event.target.value as "left" | "center" | "right" }))}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
        <label className={styles.field}><span>Space after (px)</span><select value={block.spacingAfter ?? 16} disabled={disabled} onChange={(event) => updateBlock(index, (current) => ({ ...current, spacingAfter: Number(event.target.value) }))}><option value={0}>None</option><option value={8}>8</option><option value={16}>16</option><option value={24}>24</option><option value={32}>32</option><option value={48}>48</option><option value={64}>64</option></select></label>
      </div>

    </article>;
  }

  return <section className={styles.root} aria-label="Designed email composer">
    <header className={styles.heading}>
      <div><strong>Branded email</strong><p>Compose from a saved design, a starter, or a blank canvas. The server will validate the design before sending.</p></div>
    </header>
    <div className={styles.selectRow}>
      <label className={styles.field}>
        <span>Saved design</span>
        <select value={selectedTemplateId} disabled={disabled || loading || templates.length === 0} onChange={(event) => chooseTemplate(event.target.value)}>
          <option value="">Choose a saved design…</option>
          {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
      </label>
      <label className={styles.field}>
        <span>Start from</span>
        <select disabled={disabled} defaultValue="" onChange={(event) => { if (event.target.value) applyStarter(event.target.value); event.currentTarget.value = ""; }}>
          <option value="" disabled>Blank or starter…</option>
          <option value="blank">Blank design</option>
          {EMAIL_DESIGN_STARTERS.map((starter) => <option key={starter.value} value={starter.value}>{starter.label}</option>)}
        </select>
      </label>
    </div>
    {loading && <p className={styles.hint} role="status">Loading designs and brand profile…</p>}
    {loadError && <p className={styles.error} role="alert">{loadError}</p>}
    <div className={styles.editorGrid}>
      <div className={styles.editor}>
        <div className={styles.subheading}><strong>Content blocks</strong><span>{content.blocks.length}/100</span></div>
        <div className={styles.addRow}>
          <select value={blockType} disabled={disabled || content.blocks.length >= 100} onChange={(event) => setBlockType(event.target.value as SimpleBlockType)} aria-label="Block to add">
            {BLOCKS.map((block) => <option key={block.value} value={block.value}>{block.label}</option>)}
          </select>
          <button type="button" disabled={disabled || content.blocks.length >= 100} onClick={addBlock}>Add block</button>
        </div>
        {content.blocks.length === 0 ? <p className={styles.empty}>Choose a saved design or add a heading or paragraph to start composing.</p> : <div className={styles.blockList}>{content.blocks.map(renderBlock)}</div>}
      </div>
      <div className={styles.preview}>
        <header className={styles.previewHeader}>
          <strong>Preview</strong>
          <div><button type="button" className={device === "desktop" ? styles.deviceActive : ""} onClick={() => setDevice("desktop")}>Desktop</button><button type="button" className={device === "mobile" ? styles.deviceActive : ""} onClick={() => setDevice("mobile")}>Mobile</button></div>
        </header>
        <div className={styles.previewStage}>
          {preview.error ? <p className={styles.error}>{preview.error}</p> : preview.html ? <iframe title="Designed email preview" sandbox="" referrerPolicy="no-referrer" srcDoc={preview.html} className={device === "mobile" ? styles.mobileFrame : styles.desktopFrame} /> : <p className={styles.empty}>Your email preview will appear here.</p>}
        </div>
      </div>
    </div>
    <p className={styles.hint}>Use publicly accessible HTTPS image URLs for recipient-visible logos and images. Some email clients require recipients to allow remote images.</p>
  </section>;
}
