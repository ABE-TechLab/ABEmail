import type { ContactInput } from "@/lib/contacts/types";

const EMAIL_PATTERN = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

function optionalText(value: unknown, label: string, maxLength: number): { value: string | null; error?: never } | { value?: never; error: string } {
  if (value === undefined || value === null) return { value: null };
  if (typeof value !== "string") return { error: label + " must be text." };
  const cleaned = value.trim();
  if (cleaned.length > maxLength) return { error: label + " must be " + maxLength + " characters or fewer." };
  return { value: cleaned || null };
}

export function parseContactInput(value: unknown): { data: ContactInput | null; error?: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { data: null, error: "Send a valid contact object." };
  }

  const record = value as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";

  if (!name || name.length > 160) {
    return { data: null, error: "Name is required and must be 160 characters or fewer." };
  }
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return { data: null, error: "Enter a valid email address." };
  }

  const company = optionalText(record.company, "Company", 160);
  const role = optionalText(record.role, "Role", 120);
  const phone = optionalText(record.phone, "Phone", 80);
  const notes = optionalText(record.notes, "Notes", 5000);
  for (const field of [company, role, phone, notes]) {
    if (field.error) return { data: null, error: field.error };
  }

  return {
    data: {
      name,
      email,
      company: company.value ?? null,
      role: role.value ?? null,
      phone: phone.value ?? null,
      notes: notes.value ?? null,
    },
  };
}
