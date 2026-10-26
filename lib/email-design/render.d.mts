export type EmailDesignBlock =
  | { id: string; type: "logo"; src?: string | null; alt?: string; width?: number }
  | { id: string; type: "heading"; text: string; level?: 1 | 2 | 3 }
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "image"; src: string; alt?: string; width?: number }
  | { id: string; type: "button"; label: string; href: string }
  | { id: string; type: "divider" }
  | { id: string; type: "spacer"; height?: number }
  | { id: string; type: "row"; columns: Array<{ id: string; blocks: EmailDesignBlock[] }> }
  | { id: string; type: "social"; links: Array<{ label: string; href: string }> }
  | { id: string; type: "footer"; text: string }
  | { id: string; type: "contact"; email?: string; phone?: string; websiteUrl?: string; address?: string };

export type EmailDesignContent = { version: 1; blocks: EmailDesignBlock[] };

export type EmailDesignBrandProfile = {
  brandName?: string;
  logoUrl?: string | null;
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  websiteUrl?: string | null;
  phone?: string;
  address?: string;
  socialLinks?: Array<{ label: string; href: string }>;
};

export type EmailDesignValidationResult =
  | { data: EmailDesignContent; error: null }
  | { data: null; error: string };

export function validateEmailDesignContent(value: unknown): EmailDesignValidationResult;
export function renderEmailDesign(content: unknown, brandProfile?: EmailDesignBrandProfile): { html: string; text: string };
export const EMAIL_DESIGN_SCHEMA_VERSION: 1;
export const SUPPORTED_EMAIL_BLOCK_TYPES: readonly string[];
