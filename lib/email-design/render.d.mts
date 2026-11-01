export type EmailDesignLayout = { align?: "left" | "center" | "right"; spacingAfter?: number };
export type EmailDesignBlock =
  | ({ id: string; type: "logo"; src?: string | null; alt?: string; width?: number } & EmailDesignLayout)
  | ({ id: string; type: "heading"; text: string; level?: 1 | 2 | 3 } & EmailDesignLayout)
  | ({ id: string; type: "paragraph"; text: string } & EmailDesignLayout)
  | ({ id: string; type: "image"; src: string; alt?: string; width?: number } & EmailDesignLayout)
  | ({ id: string; type: "button"; label: string; href: string } & EmailDesignLayout)
  | ({ id: string; type: "divider" } & EmailDesignLayout)
  | ({ id: string; type: "spacer"; height?: number } & EmailDesignLayout)
  | ({ id: string; type: "row"; columns: Array<{ id: string; blocks: EmailDesignBlock[] }> } & EmailDesignLayout)
  | ({ id: string; type: "social"; links: Array<{ label: string; href: string }> } & EmailDesignLayout)
  | ({ id: string; type: "footer"; text: string } & EmailDesignLayout)
  | ({ id: string; type: "contact"; email?: string; phone?: string; websiteUrl?: string; address?: string } & EmailDesignLayout);

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
  footerText?: string;
  socialLinks?: Array<{ label: string; href: string }>;
};

export type EmailDesignValidationResult =
  | { data: EmailDesignContent; error: null }
  | { data: null; error: string };

export function validateEmailDesignContent(value: unknown): EmailDesignValidationResult;
export function renderEmailDesign(content: unknown, brandProfile?: EmailDesignBrandProfile): { html: string; text: string };
export const EMAIL_DESIGN_SCHEMA_VERSION: 1;
export const SUPPORTED_EMAIL_BLOCK_TYPES: readonly string[];
