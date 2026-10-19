export type Contact = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  role: string | null;
  phone: string | null;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type ContactInput = {
  name: string;
  email: string;
  company: string | null;
  role: string | null;
  phone: string | null;
  notes: string | null;
  tags: string[];
};

export const CONTACT_FIELDS = "id, name, email, company, role, phone, notes, tags, created_at, updated_at";
