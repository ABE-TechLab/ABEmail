import "server-only";

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const RESEND_API = "https://api.resend.com";
const WEBHOOK_EVENTS = [
  "email.received",
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.suppressed",
] as const;

export type ResendDomainRecord = {
  record?: string;
  name?: string;
  type?: string;
  ttl?: string;
  value?: string;
  priority?: number;
  status?: string;
};

export type ResendDomain = {
  id?: string;
  name?: string;
  status?: string;
  capabilities?: { sending?: string; receiving?: string };
  records?: ResendDomainRecord[];
  region?: string;
};

type ResendWebhook = {
  id?: string;
  endpoint?: string;
  events?: string[] | null;
  status?: string;
  signing_secret?: string;
};

export class ResendProviderError extends Error {
  readonly code: string;
  readonly providerStatus: number | null;

  constructor(code: string, providerStatus: number | null = null) {
    super(code);
    this.name = "ResendProviderError";
    this.code = code;
    this.providerStatus = providerStatus;
  }
}

function encryptionKey(): Buffer {
  const value = process.env.ABEMAIL_CREDENTIALS_ENCRYPTION_KEY_V2?.trim();
  if (!value) throw new ResendProviderError("CREDENTIAL_ENCRYPTION_NOT_CONFIGURED");
  let key: Buffer;
  try {
    key = Buffer.from(value, "base64");
  } catch {
    throw new ResendProviderError("CREDENTIAL_ENCRYPTION_KEY_INVALID");
  }
  if (key.length !== 32) throw new ResendProviderError("CREDENTIAL_ENCRYPTION_KEY_INVALID");
  return key;
}

export function encryptProviderSecret(plaintext: string): string {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptProviderSecret(value: string): string {
  const parts = value.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new ResendProviderError("CREDENTIAL_CIPHERTEXT_INVALID");
  }
  const key = encryptionKey();
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(parts[1], "base64"));
    decipher.setAuthTag(Buffer.from(parts[2], "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[3], "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new ResendProviderError("CREDENTIAL_DECRYPTION_FAILED");
  }
}

export function fingerprintProviderKey(apiKey: string): string {
  return createHmac("sha256", encryptionKey()).update(apiKey, "utf8").digest("hex");
}

async function resendRequest<T>(
  apiKey: string,
  path: string,
  options: { method?: "GET" | "POST" | "PATCH"; body?: Record<string, unknown> } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(RESEND_API + path, {
      method: options.method ?? "GET",
      headers: {
        Authorization: "Bearer " + apiKey,
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new ResendProviderError("RESEND_API_UNAVAILABLE");
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = response.status === 401
      ? "RESEND_API_KEY_INVALID"
      : response.status === 403
        ? "RESEND_API_KEY_PERMISSION_DENIED"
        : response.status === 409
          ? "RESEND_RESOURCE_CONFLICT"
          : response.status === 429
            ? "RESEND_RATE_LIMITED"
            : "RESEND_API_REQUEST_FAILED";
    throw new ResendProviderError(code, response.status);
  }
  if (typeof payload !== "object" || payload === null) {
    throw new ResendProviderError("RESEND_API_RESPONSE_INVALID");
  }
  return payload as T;
}

export async function listResendDomains(apiKey: string): Promise<ResendDomain[]> {
  const result = await resendRequest<{ data?: ResendDomain[] }>(apiKey, "/domains?limit=100");
  return result.data ?? [];
}

export async function validateResendApiKey(apiKey: string): Promise<void> {
  if (!/^re_[A-Za-z0-9_-]{10,}$/.test(apiKey)) {
    throw new ResendProviderError("RESEND_API_KEY_FORMAT_INVALID");
  }
  // Reading domains requires account-management access; a sending-only key is not
  // sufficient for the automated domain and receiving setup offered by ABEmail.
  await resendRequest<{ data?: unknown[] }>(apiKey, "/domains?limit=1");
}

export async function ensureResendWebhook(apiKey: string, endpoint: string): Promise<{ id: string; signingSecret: string }> {
  const list = await resendRequest<{ data?: ResendWebhook[] }>(apiKey, "/webhooks?limit=100");
  let webhook = (list.data ?? []).find((item) => item.endpoint === endpoint && item.status !== "disabled");

  if (webhook?.id && !WEBHOOK_EVENTS.every((event) => webhook?.events?.includes(event))) {
    await resendRequest(apiKey, "/webhooks/" + encodeURIComponent(webhook.id), {
      method: "PATCH",
      body: { events: [...WEBHOOK_EVENTS] },
    });
    const refreshed = await resendRequest<ResendWebhook>(apiKey, "/webhooks/" + encodeURIComponent(webhook.id));
    webhook = refreshed;
  }

  if (!webhook?.id) {
    webhook = await resendRequest<ResendWebhook>(apiKey, "/webhooks", {
      method: "POST",
      body: { endpoint, events: [...WEBHOOK_EVENTS] },
    });
  }

  if (!webhook.id) throw new ResendProviderError("RESEND_WEBHOOK_CREATE_FAILED");
  let signingSecret = webhook.signing_secret;
  if (!signingSecret) {
    const detail = await resendRequest<ResendWebhook>(apiKey, "/webhooks/" + encodeURIComponent(webhook.id));
    signingSecret = detail.signing_secret;
  }
  if (!signingSecret?.startsWith("whsec_")) throw new ResendProviderError("RESEND_WEBHOOK_SECRET_UNAVAILABLE");
  return { id: webhook.id, signingSecret };
}

export async function createResendDomain(apiKey: string, name: string): Promise<ResendDomain> {
  const domain = await resendRequest<ResendDomain>(apiKey, "/domains", {
    method: "POST",
    body: { name, capabilities: { sending: "enabled", receiving: "enabled" } },
  });
  if (!domain.id || !domain.name) throw new ResendProviderError("RESEND_DOMAIN_CREATE_RESPONSE_INVALID");
  return domain;
}

export async function verifyResendDomain(apiKey: string, providerDomainId: string): Promise<void> {
  if (!providerDomainId || providerDomainId.length > 200) throw new ResendProviderError("RESEND_DOMAIN_ID_INVALID");
  await resendRequest(apiKey, "/domains/" + encodeURIComponent(providerDomainId) + "/verify", { method: "POST" });
}

export async function getResendDomain(apiKey: string, providerDomainId: string): Promise<ResendDomain> {
  if (!providerDomainId || providerDomainId.length > 200) throw new ResendProviderError("RESEND_DOMAIN_ID_INVALID");
  return resendRequest<ResendDomain>(apiKey, "/domains/" + encodeURIComponent(providerDomainId));
}

export type ResendAttachmentInput = { filename: string; contentType: string; content: string };

export async function sendResendEmail(input: {
  apiKey: string;
  from: string;
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: ResendAttachmentInput[];
  idempotencyKey: string;
}): Promise<{ id: string }> {
  let response: Response;
  try {
    response = await fetch(RESEND_API + "/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + input.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        from: input.from,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
        ...(input.attachments?.length ? {
          attachments: input.attachments.map((attachment) => ({
            filename: attachment.filename,
            content: attachment.content,
            content_type: attachment.contentType,
          })),
        } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ResendProviderError("RESEND_SEND_OUTCOME_UNKNOWN");
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ResendProviderError(
      response.status === 429 ? "RESEND_RATE_LIMITED" : "RESEND_SEND_REJECTED",
      response.status,
    );
  }
  if (typeof payload !== "object" || payload === null || !("id" in payload) || typeof payload.id !== "string") {
    throw new ResendProviderError("RESEND_SEND_RESPONSE_INVALID");
  }
  return { id: payload.id };
}
