const AUDIT_KEYS = new Set([
  "from_role", "to_role", "from_status", "to_status", "from_enabled", "to_enabled",
  "domain_id", "mailbox_id", "member_id", "invitation_id", "template_id", "provider",
  "connection_status", "reason_code", "source", "changed_fields", "permission_changes",
  "message_count", "recipient_count", "mailbox_count", "role", "verification_status",
  "status", "delivery_status", "outcome", "logo_action",
]);

const USAGE_KEYS = new Set(["message_id", "schedule_id", "recipient_count", "source", "status", "reason_code"]);
const SAFE_CHANGED_FIELDS = new Set([
  "name", "display_name", "local_part", "domain_id", "brand_name", "primary_color",
  "accent_color", "background_color", "text_color", "font_family", "website_url",
  "phone", "address", "default_footer_text", "social_links", "subject", "description",
  "content_json", "mailbox_id", "member_id", "invitation_id", "template_id",
  "can_read", "can_send", "can_manage", "role", "status",
]);
const SAFE_PERMISSION_FIELDS = new Set(["can_read", "can_send", "can_manage", "role"]);

function sanitize(input, allowed) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.has(key)) continue;
    if (typeof value === "string") {
      const clean = value.trim().slice(0, 160);
      if (clean) output[key] = clean;
    } else if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) {
      output[key] = value;
    } else if (key === "changed_fields" && Array.isArray(value)) {
      output[key] = value.filter((item) => typeof item === "string" && SAFE_CHANGED_FIELDS.has(item)).slice(0, 12);
    } else if (key === "permission_changes" && Array.isArray(value)) {
      output[key] = value.filter((item) => typeof item === "string" && SAFE_PERMISSION_FIELDS.has(item)).slice(0, 8);
    }
  }
  return output;
}

export function sanitizeAuditMetadata(input) {
  return sanitize(input, AUDIT_KEYS);
}

export function sanitizeUsageMetadata(input) {
  return sanitize(input, USAGE_KEYS);
}

