const VERSION = 1;
const MAX_BLOCKS = 100;
const MAX_CONTENT_LENGTH = 262144;
const FONT_FAMILIES = new Set(["Arial", "Helvetica", "Georgia", "Tahoma", "Verdana", "Trebuchet MS"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value, keys, allowLayout = false) {
  return Object.keys(value).every((key) => keys.includes(key) || (allowLayout && (key === "align" || key === "spacingAfter")));
}

function cleanText(value, maxLength, label, required = true) {
  if (typeof value !== "string") return { value: null, error: label + " must be text." };
  const text = value.trim();
  if (required && !text) return { value: null, error: label + " is required." };
  if (text.length > maxLength) return { value: null, error: label + " is too long." };
  return { value: text, error: null };
}

function secureHttpsUrl(value) {
  if (typeof value !== "string" || value.trim().length < 1 || value.trim().length > 2048) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    if (url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname.endsWith(".local")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function safeLinkUrl(value) {
  const httpsUrl = secureHttpsUrl(value);
  if (httpsUrl) return httpsUrl;
  if (typeof value === "string" && value.trim().length <= 254) {
    const candidate = value.trim();
    if (candidate.toLowerCase().startsWith("mailto:")) {
      const address = candidate.slice(7);
      if (EMAIL_PATTERN.test(address) && !/[\s<>]/.test(address)) return "mailto:" + address;
    }
  }
  return null;
}

function validId(value, state) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) {
    return { value: null, error: "Each block needs a valid stable ID." };
  }
  if (state.ids.has(value)) return { value: null, error: "Block and column IDs must be unique." };
  state.ids.add(value);
  return { value, error: null };
}

function parseLayout(raw) {
  const align = raw.align === undefined ? "left" : raw.align;
  if (!["left", "center", "right"].includes(align)) return { data: null, error: "Block alignment must be left, center, or right." };
  const defaults = { logo: 20, heading: 16, paragraph: 16, image: 20, button: 24, divider: 20, spacer: 0, row: 16, social: 16, footer: 16, contact: 16 };
  const spacingAfter = raw.spacingAfter === undefined ? (defaults[raw.type] ?? 16) : raw.spacingAfter;
  if (!Number.isInteger(spacingAfter) || spacingAfter < 0 || spacingAfter > 64) return { data: null, error: "Spacing after a block must be between 0 and 64 pixels." };
  return { data: { align, spacingAfter }, error: null };
}
function parseBlocks(rawBlocks, depth, state) {
  if (!Array.isArray(rawBlocks)) return { data: null, error: "Blocks must be a list." };
  const parsed = [];
  for (const raw of rawBlocks) {
    state.count += 1;
    if (state.count > MAX_BLOCKS) return { data: null, error: "A design can contain at most 100 blocks." };
    const result = parseBlock(raw, depth, state);
    if (result.error) return result;
    const layout = parseLayout(raw);
    if (layout.error) return layout;
    parsed.push({ ...result.data, ...layout.data });
  }
  return { data: parsed, error: null };
}

function parseBlock(raw, depth, state) {
  if (!isRecord(raw) || typeof raw.type !== "string") {
    return { data: null, error: "Every block must have a supported type." };
  }
  if (depth > 3) return { data: null, error: "Design sections are nested too deeply." };
  const idResult = validId(raw.id, state);
  if (idResult.error) return { data: null, error: idResult.error };
  const id = idResult.value;
  const type = raw.type;

  if (type === "logo") {
    if (!hasOnlyKeys(raw, ["id", "type", "src", "alt", "width"], true)) return { data: null, error: "The logo block contains unsupported fields." };
    const src = raw.src === undefined || raw.src === null || raw.src === "" ? null : secureHttpsUrl(raw.src);
    if (raw.src !== undefined && raw.src !== null && raw.src !== "" && !src) return { data: null, error: "Logo images must use a secure HTTPS URL." };
    const altResult = raw.alt === undefined ? { value: "", error: null } : cleanText(raw.alt, 250, "Logo alternative text", false);
    if (altResult.error) return { data: null, error: altResult.error };
    const width = raw.width === undefined ? 160 : raw.width;
    if (!Number.isInteger(width) || width < 48 || width > 320) return { data: null, error: "Logo width must be between 48 and 320 pixels." };
    return { data: { id, type, src, alt: altResult.value, width }, error: null };
  }

  if (type === "heading") {
    if (!hasOnlyKeys(raw, ["id", "type", "text", "level"], true)) return { data: null, error: "The heading block contains unsupported fields." };
    const text = cleanText(raw.text, 4000, "Heading");
    if (text.error) return { data: null, error: text.error };
    const level = raw.level === undefined ? 2 : raw.level;
    if (![1, 2, 3].includes(level)) return { data: null, error: "Heading level must be 1, 2, or 3." };
    return { data: { id, type, text: text.value, level }, error: null };
  }

  if (type === "paragraph") {
    if (!hasOnlyKeys(raw, ["id", "type", "text"], true)) return { data: null, error: "The paragraph block contains unsupported fields." };
    const text = cleanText(raw.text, 20000, "Paragraph");
    if (text.error) return { data: null, error: text.error };
    return { data: { id, type, text: text.value }, error: null };
  }

  if (type === "image") {
    if (!hasOnlyKeys(raw, ["id", "type", "src", "alt", "width"], true)) return { data: null, error: "The image block contains unsupported fields." };
    const src = secureHttpsUrl(raw.src);
    if (!src) return { data: null, error: "Images must use a secure HTTPS URL." };
    const alt = cleanText(raw.alt === undefined ? "" : raw.alt, 500, "Image alternative text", false);
    if (alt.error) return { data: null, error: alt.error };
    const width = raw.width === undefined ? 600 : raw.width;
    if (!Number.isInteger(width) || width < 80 || width > 600) return { data: null, error: "Image width must be between 80 and 600 pixels." };
    return { data: { id, type, src, alt: alt.value, width }, error: null };
  }

  if (type === "button") {
    if (!hasOnlyKeys(raw, ["id", "type", "label", "href"], true)) return { data: null, error: "The button block contains unsupported fields." };
    const label = cleanText(raw.label, 160, "Button label");
    if (label.error) return { data: null, error: label.error };
    const href = safeLinkUrl(raw.href);
    if (!href) return { data: null, error: "Buttons must link to HTTPS pages or a valid email address." };
    return { data: { id, type, label: label.value, href }, error: null };
  }

  if (type === "divider") {
    if (!hasOnlyKeys(raw, ["id", "type"], true)) return { data: null, error: "The divider block contains unsupported fields." };
    return { data: { id, type }, error: null };
  }

  if (type === "spacer") {
    if (!hasOnlyKeys(raw, ["id", "type", "height"], true)) return { data: null, error: "The spacer block contains unsupported fields." };
    const height = raw.height === undefined ? 24 : raw.height;
    if (!Number.isInteger(height) || height < 8 || height > 80) return { data: null, error: "Spacer height must be between 8 and 80 pixels." };
    return { data: { id, type, height }, error: null };
  }

  if (type === "row") {
    if (!hasOnlyKeys(raw, ["id", "type", "columns"], true)) return { data: null, error: "The row block contains unsupported fields." };
    if (!Array.isArray(raw.columns) || raw.columns.length < 2 || raw.columns.length > 3) {
      return { data: null, error: "Rows must contain two or three columns." };
    }
    const columns = [];
    for (const column of raw.columns) {
      if (!isRecord(column) || !hasOnlyKeys(column, ["id", "blocks"])) return { data: null, error: "Every row column needs an ID and a block list." };
      const columnId = validId(column.id, state);
      if (columnId.error) return { data: null, error: columnId.error };
      const blocks = parseBlocks(column.blocks, depth + 1, state);
      if (blocks.error) return blocks;
      columns.push({ id: columnId.value, blocks: blocks.data });
    }
    return { data: { id, type, columns }, error: null };
  }

  if (type === "social") {
    if (!hasOnlyKeys(raw, ["id", "type", "links"], true)) return { data: null, error: "The social block contains unsupported fields." };
    if (!Array.isArray(raw.links) || raw.links.length < 1 || raw.links.length > 8) {
      return { data: null, error: "Add between one and eight social links." };
    }
    const links = [];
    for (const link of raw.links) {
      if (!isRecord(link) || !hasOnlyKeys(link, ["label", "href"])) return { data: null, error: "Every social link needs a label and URL." };
      const label = cleanText(link.label, 80, "Social link label");
      if (label.error) return { data: null, error: label.error };
      const href = secureHttpsUrl(link.href);
      if (!href) return { data: null, error: "Social links must use secure HTTPS URLs." };
      links.push({ label: label.value, href });
    }
    return { data: { id, type, links }, error: null };
  }

  if (type === "footer") {
    if (!hasOnlyKeys(raw, ["id", "type", "text"], true)) return { data: null, error: "The footer block contains unsupported fields." };
    const text = cleanText(raw.text, 4000, "Footer", false);
    if (text.error) return { data: null, error: text.error };
    return { data: { id, type, text: text.value }, error: null };
  }

  if (type === "contact") {
    if (!hasOnlyKeys(raw, ["id", "type", "email", "phone", "websiteUrl", "address"], true)) return { data: null, error: "The contact block contains unsupported fields." };
    const email = raw.email === undefined || raw.email === "" ? "" : cleanText(raw.email, 254, "Contact email").value;
    if (raw.email !== undefined && raw.email !== "" && (!email || !EMAIL_PATTERN.test(email))) return { data: null, error: "Enter a valid contact email." };
    const phone = raw.phone === undefined || raw.phone === "" ? "" : cleanText(raw.phone, 80, "Contact phone").value;
    if (raw.phone !== undefined && raw.phone !== "" && phone === null) return { data: null, error: "Contact phone must be text." };
    const websiteUrl = raw.websiteUrl === undefined || raw.websiteUrl === "" ? "" : secureHttpsUrl(raw.websiteUrl);
    if (raw.websiteUrl !== undefined && raw.websiteUrl !== "" && !websiteUrl) return { data: null, error: "Contact websites must use secure HTTPS URLs." };
    const address = raw.address === undefined || raw.address === "" ? "" : cleanText(raw.address, 1000, "Contact address", false).value;
    if (raw.address !== undefined && raw.address !== "" && address === null) return { data: null, error: "Contact address must be text." };
    if (!email && !phone && !websiteUrl && !address) return { data: null, error: "Add at least one contact detail." };
    return { data: { id, type, email, phone, websiteUrl, address }, error: null };
  }

  return { data: null, error: "Unsupported email design block: " + type + "." };
}

export function validateEmailDesignContent(value) {
  if (!isRecord(value)) return { data: null, error: "Send a valid email design." };
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return { data: null, error: "Email design data is invalid." };
  }
  if (serialized.length > MAX_CONTENT_LENGTH) return { data: null, error: "Email design data exceeds 256 KB." };
  if (!hasOnlyKeys(value, ["version", "blocks"]) || value.version !== VERSION) {
    return { data: null, error: "This email design version is not supported." };
  }
  const state = { ids: new Set(), count: 0 };
  const blocks = parseBlocks(value.blocks, 0, state);
  if (blocks.error) return blocks;
  return { data: { version: VERSION, blocks: blocks.data }, error: null };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeBrandProfile(value) {
  const input = isRecord(value) ? value : {};
  const safeText = (field, maxLength) => typeof input[field] === "string" ? input[field].trim().slice(0, maxLength) : "";
  const color = (field, fallback) => {
    const candidate = input[field];
    return typeof candidate === "string" && /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate.toUpperCase() : fallback;
  };
  const fontFamily = FONT_FAMILIES.has(input.fontFamily) ? input.fontFamily : "Arial";
  const socialLinks = Array.isArray(input.socialLinks)
    ? input.socialLinks.slice(0, 8).filter((link) => isRecord(link) && typeof link.label === "string" && secureHttpsUrl(link.href))
      .map((link) => ({ label: link.label.trim().slice(0, 80), href: secureHttpsUrl(link.href) }))
    : [];
  return {
    brandName: safeText("brandName", 120),
    logoUrl: secureHttpsUrl(input.logoUrl),
    primaryColor: color("primaryColor", "#2B2B2B"),
    accentColor: color("accentColor", "#D7F36A"),
    backgroundColor: color("backgroundColor", "#F3F4F6"),
    textColor: color("textColor", "#242424"),
    fontFamily,
    websiteUrl: secureHttpsUrl(input.websiteUrl),
    phone: safeText("phone", 80),
    address: safeText("address", 1000),
    footerText: safeText("footerText", 4000),
    socialLinks,
  };
}

function withLineBreaks(value) {
  return escapeHtml(value).replace(/\r\n|\n|\r/g, "<br />");
}

function renderBlockHtml(block, brand) {
  const align = block.align || "left";
  const spacingAfter = Number.isInteger(block.spacingAfter) ? block.spacingAfter : 16;
  if (block.type === "logo") {
    const src = block.src || brand.logoUrl;
    const alt = block.alt || brand.brandName;
    if (!src) return brand.brandName ? '<p style="margin:0 0 ' + spacingAfter + 'px;font-size:20px;font-weight:700;color:' + brand.textColor + ';text-align:' + align + ';">' + escapeHtml(brand.brandName) + "</p>" : "";
    return '<p style="margin:0 0 ' + spacingAfter + 'px;text-align:' + align + ';"><img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '" width="' + block.width + '" style="display:inline-block;border:0;outline:none;text-decoration:none;max-width:100%;height:auto;" /></p>';
  }
  if (block.type === "heading") {
    const sizes = { 1: 30, 2: 24, 3: 19 };
    const size = sizes[block.level];
    return "<h" + block.level + ' style="font-family:' + brand.fontFamily + ';font-size:' + size + "px;line-height:1.25;font-weight:700;color:" + brand.textColor + ';text-align:' + align + ';margin:0 0 ' + spacingAfter + 'px;">' + withLineBreaks(block.text) + "</h" + block.level + ">";
  }
  if (block.type === "paragraph") {
    return '<p style="font-family:' + brand.fontFamily + ';font-size:16px;line-height:1.65;color:' + brand.textColor + ';text-align:' + align + ';margin:0 0 ' + spacingAfter + 'px;">' + withLineBreaks(block.text) + "</p>";
  }
  if (block.type === "image") {
    return '<p style="margin:0 0 ' + spacingAfter + 'px;text-align:' + align + ';"><img src="' + escapeHtml(block.src) + '" alt="' + escapeHtml(block.alt) + '" width="' + block.width + '" style="display:inline-block;width:100%;max-width:' + block.width + "px;height:auto;border:0;outline:none;text-decoration:none;" + '" /></p>';
  }
  if (block.type === "button") {
    const buttonMargin = align === "center" ? "4px auto " + spacingAfter + "px" : align === "right" ? "4px 0 " + spacingAfter + "px auto" : "4px auto " + spacingAfter + "px 0";
    return '<table role="presentation" align="' + align + '" border="0" cellspacing="0" cellpadding="0" style="margin:' + buttonMargin + ';"><tbody><tr><td bgcolor="' + brand.primaryColor + '" style="border-radius:6px;"><a href="' + escapeHtml(block.href) + '" style="display:inline-block;padding:13px 20px;font-family:' + brand.fontFamily + ';font-size:15px;font-weight:700;line-height:1.2;color:#FFFFFF;text-decoration:none;border-radius:6px;">' + escapeHtml(block.label) + "</a></td></tr></tbody></table>";
  }
  if (block.type === "divider") {
    return '<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:12px 0 ' + spacingAfter + 'px;"><tbody><tr><td style="border-top:1px solid #D9DDE3;font-size:1px;line-height:1px;">&nbsp;</td></tr></tbody></table>';
  }
  if (block.type === "spacer") {
    return '<div style="height:' + block.height + "px;line-height:" + block.height + 'px;font-size:1px;margin-bottom:' + spacingAfter + 'px;">&nbsp;</div>';
  }
  if (block.type === "row") {
    const width = Math.floor(100 / block.columns.length);
    const cells = block.columns.map((column) => '<td class="abemail-row-column" width="' + width + '%" valign="top" style="width:' + width + '%;padding:0 8px 16px 0;">' + column.blocks.map((child) => renderBlockHtml(child, brand)).join("") + "</td>").join("");
    return '<table role="presentation" align="' + align + '" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%;margin-bottom:' + spacingAfter + 'px;text-align:' + align + ';"><tbody><tr>' + cells + "</tr></tbody></table>";
  }
  if (block.type === "social") {
    const links = block.links.map((link) => '<a href="' + escapeHtml(link.href) + '" style="font-family:' + brand.fontFamily + ';font-size:13px;color:' + brand.primaryColor + ';text-decoration:underline;">' + escapeHtml(link.label) + "</a>").join(" &nbsp;|&nbsp; ");
    return '<p style="margin:0 0 ' + spacingAfter + 'px;line-height:1.8;text-align:' + align + ';">' + links + "</p>";
  }
  if (block.type === "footer") {
    return '<p style="font-family:' + brand.fontFamily + ';font-size:12px;line-height:1.6;color:#6B7280;text-align:' + align + ';margin:0 0 ' + spacingAfter + 'px;">' + withLineBreaks(block.text) + "</p>";
  }
  if (block.type === "contact") {
    const lines = [];
    if (block.email) lines.push('<a href="mailto:' + escapeHtml(block.email) + '" style="color:' + brand.primaryColor + ';">' + escapeHtml(block.email) + "</a>");
    if (block.phone) lines.push(escapeHtml(block.phone));
    if (block.websiteUrl) lines.push('<a href="' + escapeHtml(block.websiteUrl) + '" style="color:' + brand.primaryColor + ';">' + escapeHtml(block.websiteUrl) + "</a>");
    if (block.address) lines.push(withLineBreaks(block.address));
    return '<p style="font-family:' + brand.fontFamily + ';font-size:13px;line-height:1.7;color:#6B7280;text-align:' + align + ';margin:0 0 ' + spacingAfter + 'px;">' + lines.join("<br />") + "</p>";
  }
  return "";
}

function renderBlockText(block, brand) {
  if (block.type === "logo") return brand.brandName || block.alt || "";
  if (block.type === "heading" || block.type === "paragraph" || block.type === "footer") return block.text;
  if (block.type === "image") return block.alt || block.src;
  if (block.type === "button") return block.label + ": " + block.href;
  if (block.type === "divider") return "----------------------------------------";
  if (block.type === "spacer") return "";
  if (block.type === "row") return block.columns.map((column) => column.blocks.map((child) => renderBlockText(child, brand)).filter(Boolean).join("\n")).filter(Boolean).join("    |    ");
  if (block.type === "social") return block.links.map((link) => link.label + ": " + link.href).join(" | ");
  if (block.type === "contact") return [block.email, block.phone, block.websiteUrl, block.address].filter(Boolean).join("\n");
  return "";
}

export function renderEmailDesign(content, brandProfile = {}) {
  const validated = validateEmailDesignContent(content);
  if (validated.error || !validated.data) throw new TypeError("Invalid email design: " + (validated.error || "unknown error"));
  const brand = normalizeBrandProfile(brandProfile);
  const htmlBlocks = validated.data.blocks.map((block) => renderBlockHtml(block, brand)).join("");
  const textBlocks = validated.data.blocks.map((block) => renderBlockText(block, brand)).filter(Boolean);
  const brandFooter = [brand.footerText, brand.brandName, brand.address, brand.phone, brand.websiteUrl].filter(Boolean).join("\n");
  const text = [...textBlocks, brandFooter].filter(Boolean).join("\n\n").trim();
  const title = escapeHtml(brand.brandName || "Email");
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>' + title + '</title><style type="text/css">@media only screen and (max-width:620px){.abemail-row-column{display:block!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important;padding:0 0 16px!important;}}</style></head><body style="margin:0;padding:0;background-color:' + brand.backgroundColor + ';font-family:' + brand.fontFamily + ';color:' + brand.textColor + ';">' +
    '<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="' + brand.backgroundColor + '" style="width:100%;background-color:' + brand.backgroundColor + ';"><tbody><tr><td align="center" style="padding:24px 12px;">' +
    '<table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background-color:#FFFFFF;border-collapse:collapse;"><tbody><tr><td style="padding:32px 28px;">' +
    htmlBlocks + '</td></tr><tr><td style="padding:0 28px 28px;border-top:1px solid #E5E7EB;color:#6B7280;font-size:12px;line-height:1.6;">' +
    (brand.brandName ? '<p style="font-family:' + brand.fontFamily + ';margin:16px 0 4px;font-weight:700;">' + escapeHtml(brand.brandName) + "</p>" : "") +
    (brand.footerText ? '<p style="font-family:' + brand.fontFamily + ';margin:0 0 8px;">' + withLineBreaks(brand.footerText) + "</p>" : "") +
    (brand.address ? '<p style="font-family:' + brand.fontFamily + ';margin:0 0 4px;">' + withLineBreaks(brand.address) + "</p>" : "") +
    (brand.phone ? '<p style="font-family:' + brand.fontFamily + ';margin:0 0 4px;">' + escapeHtml(brand.phone) + "</p>" : "") +
    (brand.websiteUrl ? '<p style="font-family:' + brand.fontFamily + ';margin:0 0 4px;"><a href="' + escapeHtml(brand.websiteUrl) + '" style="color:' + brand.primaryColor + ';">' + escapeHtml(brand.websiteUrl) + "</a></p>" : "") +
    "</td></tr></tbody></table></td></tr></tbody></table></body></html>";
  return { html, text };
}

export const EMAIL_DESIGN_SCHEMA_VERSION = VERSION;
export const SUPPORTED_EMAIL_BLOCK_TYPES = Object.freeze(["logo", "heading", "paragraph", "image", "button", "divider", "spacer", "row", "social", "footer", "contact"]);
