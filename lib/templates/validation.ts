export type EmailTemplateInput = {
  name: string;
  subject: string;
  body_text: string;
};

type ParseResult =
  | { data: EmailTemplateInput; error: null }
  | { data: null; error: string };

export function parseEmailTemplateInput(value: unknown): ParseResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { data: null, error: "Send a valid template." };
  }

  const input = value as Record<string, unknown>;
  if (typeof input.name !== "string" || typeof input.subject !== "string" || typeof input.bodyText !== "string") {
    return { data: null, error: "Template name, subject, and message are required fields." };
  }

  const name = input.name.trim().replace(/\s+/g, " ");
  const subject = input.subject.trim();
  const body_text = input.bodyText.trim();

  if (!name || name.length > 120) {
    return { data: null, error: "Name your template (up to 120 characters)." };
  }
  if (subject.length > 998) {
    return { data: null, error: "The subject must be 998 characters or fewer." };
  }
  if (body_text.length > 80000) {
    return { data: null, error: "The message must be 80,000 characters or fewer." };
  }
  if (!subject && !body_text) {
    return { data: null, error: "Add a subject or a message before saving this template." };
  }

  return { data: { name, subject, body_text }, error: null };
}
