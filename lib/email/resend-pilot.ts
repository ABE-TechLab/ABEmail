import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const OTTAWA_PILOT_DOMAIN = "ottawasnowmatch.waste2light.com";
export const OTTAWA_PILOT_ADDRESS = "info@" + OTTAWA_PILOT_DOMAIN;
export const OTTAWA_PILOT_FROM = "Ottawa Snow Match <" + OTTAWA_PILOT_ADDRESS + ">";

export class ResendPilotError extends Error {
  readonly providerStatus: number | null;
  readonly code: string;

  constructor(code: string, providerStatus: number | null = null) {
    super(code);
    this.name = "ResendPilotError";
    this.code = code;
    this.providerStatus = providerStatus;
  }
}

// Resend offers sending-only keys (optionally domain-restricted) and full-access
// keys. Keep the restricted key on the outbound route. The receiving API currently
// requires full access, so isolate that elevated key to setup/inbound retrieval.
export function getPilotSendApiKey(): string | null {
  const key = process.env.ABEMAIL_RESEND_OTTAWA_SEND_API_KEY?.trim();
  return key || null;
}

export function getPilotReceiveApiKey(): string | null {
  const key = process.env.ABEMAIL_RESEND_OTTAWA_RECEIVE_API_KEY?.trim();
  return key || null;
}

export function getPilotWebhookSecret(): string | null {
  const secret = process.env.ABEMAIL_RESEND_OTTAWA_WEBHOOK_SECRET?.trim();
  return secret || null;
}

type ResendDomain = {
  name?: string;
  status?: string;
  capabilities?: { sending?: string; receiving?: string };
};

export async function checkPilotDomain(apiKey: string): Promise<ResendDomain> {
  const response = await fetch("https://api.resend.com/domains?limit=100", {
    method: "GET",
    headers: { Authorization: "Bearer " + apiKey, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new ResendPilotError(
      response.status === 401 || response.status === 403 ? "RESEND_DOMAIN_READ_FORBIDDEN" : "RESEND_DOMAIN_LOOKUP_FAILED",
      response.status,
    );
  }

  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null || !("data" in payload) || !Array.isArray(payload.data)) {
    throw new ResendPilotError("RESEND_DOMAIN_RESPONSE_INVALID");
  }

  const domain = (payload.data as ResendDomain[]).find(
    (item) => item.name?.toLowerCase() === OTTAWA_PILOT_DOMAIN,
  );
  if (!domain) throw new ResendPilotError("RESEND_PILOT_DOMAIN_NOT_FOUND");
  return domain;
}

export async function assertPilotDomainReady(apiKey: string): Promise<void> {
  const domain = await checkPilotDomain(apiKey);
  if (domain.status !== "verified") throw new ResendPilotError("RESEND_PILOT_DOMAIN_UNVERIFIED");
  if (domain.capabilities?.sending !== "enabled") throw new ResendPilotError("RESEND_PILOT_SENDING_DISABLED");
}

export function verifyResendWebhookSignature(input: {
  rawBody: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  secret: string;
  now?: number;
}): boolean {
  const { rawBody, id, timestamp, signature, secret } = input;
  if (!id || !timestamp || !signature || !secret.startsWith("whsec_")) return false;

  const timestampNumber = Number(timestamp);
  if (!Number.isSafeInteger(timestampNumber)) return false;
  const nowSeconds = Math.floor((input.now ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - timestampNumber) > 300) return false;

  let signingKey: Buffer;
  try {
    signingKey = Buffer.from(secret.slice("whsec_".length), "base64");
  } catch {
    return false;
  }
  if (!signingKey.length) return false;

  const expected = createHmac("sha256", signingKey)
    .update(id + "." + timestamp + "." + rawBody, "utf8")
    .digest("base64");

  return signature.split(" ").some((versionedSignature) => {
    const parts = versionedSignature.split(",");
    if (parts.length !== 2 || parts[0] !== "v1") return false;
    const candidate = Buffer.from(parts[1], "base64");
    const expectedBuffer = Buffer.from(expected, "base64");
    return candidate.length === expectedBuffer.length && timingSafeEqual(candidate, expectedBuffer);
  });
}

export async function sendPilotEmail(input: {
  apiKey: string;
  to: string | string[];
  subject: string;
  text: string;
  attachments?: Array<{ filename: string; contentType: string; content: string }>;
  idempotencyKey: string;
}): Promise<{ id: string }> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + input.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from: OTTAWA_PILOT_FROM,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      text: input.text,
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

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ResendPilotError(
      response.status === 429 ? "RESEND_RATE_LIMITED" : "RESEND_SEND_REJECTED",
      response.status,
    );
  }
  if (
    typeof payload !== "object" || payload === null ||
    !("id" in payload) || typeof payload.id !== "string" || payload.id.length < 1
  ) {
    throw new ResendPilotError("RESEND_SEND_RESPONSE_INVALID");
  }
  return { id: payload.id };
}

export type ReceivedEmailAttachment = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
};

export async function fetchReceivedEmail(apiKey: string, emailId: string): Promise<{
  id?: string;
  from?: string;
  to?: string[];
  subject?: string;
  text?: string | null;
  html?: string | null;
  attachments: ReceivedEmailAttachment[];
}> {
  if (!/^[a-zA-Z0-9_-]{6,200}$/.test(emailId)) {
    throw new ResendPilotError("RESEND_INBOUND_ID_INVALID");
  }

  const response = await fetch(
    "https://api.resend.com/emails/receiving/" + encodeURIComponent(emailId),
    {
      headers: { Authorization: "Bearer " + apiKey, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    },
  );

  if (!response.ok) {
    throw new ResendPilotError(
      response.status === 401 || response.status === 403 ? "RESEND_INBOUND_READ_FORBIDDEN" : "RESEND_INBOUND_FETCH_FAILED",
      response.status,
    );
  }

  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null) {
    throw new ResendPilotError("RESEND_INBOUND_RESPONSE_INVALID");
  }
  const record = ("data" in payload && typeof payload.data === "object" && payload.data !== null)
    ? payload.data as Record<string, unknown>
    : payload as Record<string, unknown>;
  const attachments = Array.isArray(record.attachments) ? record.attachments.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const attachment = item as Record<string, unknown>;
    if (typeof attachment.id !== "string" || !/^[a-zA-Z0-9_-]{6,200}$/.test(attachment.id)) return [];
    return [{
      id: attachment.id,
      filename: typeof attachment.filename === "string" ? attachment.filename.slice(0, 255) : "attachment",
      contentType: typeof attachment.content_type === "string" ? attachment.content_type.slice(0, 160) : "application/octet-stream",
      sizeBytes: typeof attachment.size === "number" && Number.isSafeInteger(attachment.size) && attachment.size > 0 ? attachment.size : 0,
    }];
  }) : [];

  return {
    id: typeof record.id === "string" ? record.id : emailId,
    from: typeof record.from === "string" ? record.from : undefined,
    to: Array.isArray(record.to) ? record.to.filter((item): item is string => typeof item === "string") : undefined,
    subject: typeof record.subject === "string" ? record.subject.slice(0, 998) : "",
    text: typeof record.text === "string" ? record.text.slice(0, 500000) : null,
    html: typeof record.html === "string" ? record.html.slice(0, 500000) : null,
    attachments,
  };
}

export async function fetchReceivedAttachment(apiKey: string, emailId: string, attachmentId: string): Promise<{
  bytes: Buffer;
  filename: string;
  contentType: string;
}> {
  if (!/^[a-zA-Z0-9_-]{6,200}$/.test(emailId) || !/^[a-zA-Z0-9_-]{6,200}$/.test(attachmentId)) {
    throw new ResendPilotError("RESEND_ATTACHMENT_ID_INVALID");
  }
  const response = await fetch(
    "https://api.resend.com/emails/receiving/" + encodeURIComponent(emailId) + "/attachments/" + encodeURIComponent(attachmentId),
    {
      headers: { Authorization: "Bearer " + apiKey, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    },
  );
  if (!response.ok) {
    throw new ResendPilotError(
      response.status === 401 || response.status === 403 ? "RESEND_ATTACHMENT_READ_FORBIDDEN" : "RESEND_ATTACHMENT_FETCH_FAILED",
      response.status,
    );
  }
  const payload: unknown = await response.json().catch(() => null);
  if (typeof payload !== "object" || payload === null) throw new ResendPilotError("RESEND_ATTACHMENT_RESPONSE_INVALID");
  const record = ("data" in payload && typeof payload.data === "object" && payload.data !== null)
    ? payload.data as Record<string, unknown> : payload as Record<string, unknown>;
  if (typeof record.download_url !== "string") throw new ResendPilotError("RESEND_ATTACHMENT_URL_MISSING");
  let url: URL;
  try { url = new URL(record.download_url); } catch { throw new ResendPilotError("RESEND_ATTACHMENT_URL_INVALID"); }
  if (url.protocol !== "https:" || url.username || url.password) throw new ResendPilotError("RESEND_ATTACHMENT_URL_INVALID");
  const fileResponse = await fetch(url.toString(), { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!fileResponse.ok) throw new ResendPilotError("RESEND_ATTACHMENT_DOWNLOAD_FAILED", fileResponse.status);
  const declaredLength = Number(fileResponse.headers.get("content-length") || "0");
  if (declaredLength > 4 * 1024 * 1024) throw new ResendPilotError("RESEND_ATTACHMENT_TOO_LARGE", 413);
  const bytes = Buffer.from(await fileResponse.arrayBuffer());
  if (!bytes.length || bytes.length > 4 * 1024 * 1024) throw new ResendPilotError("RESEND_ATTACHMENT_TOO_LARGE", 413);
  return {
    bytes,
    filename: typeof record.filename === "string" ? record.filename.slice(0, 255) : "attachment",
    contentType: typeof record.content_type === "string" ? record.content_type.slice(0, 160) : "application/octet-stream",
  };
}
