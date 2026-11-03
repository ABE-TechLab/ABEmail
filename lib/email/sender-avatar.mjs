import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const SENDER_AVATAR_HEADER = "x-abemail-sender-avatar";
const SENDER_AVATAR_SIGNATURE_HEADER = "x-abemail-sender-avatar-signature";
const MAX_AVATAR_URL_LENGTH = 2048;

export function normalizeAvatarEmail(value) {
  if (typeof value !== "string" || value.length > 320) return null;
  const angleAddress = value.trim().match(/<\s*([^<>]+)\s*>/);
  const address = (angleAddress?.[1] ?? value).trim().replace(/^mailto:/i, "").toLowerCase();
  return EMAIL_PATTERN.test(address) ? address : null;
}

export function getGravatarAvatarUrl(value) {
  const address = normalizeAvatarEmail(value);
  if (!address) return null;
  const hash = createHash("sha256").update(address, "utf8").digest("hex");
  return `/api/mail/avatars/${hash}`;
}

export function isSafeSenderAvatarUrl(value) {
  if (typeof value !== "string" || value.length > MAX_AVATAR_URL_LENGTH) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    if (url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname.endsWith(".local")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function signingKey() {
  const encoded = process.env.ABEMAIL_CREDENTIALS_ENCRYPTION_KEY_V2?.trim();
  if (!encoded) return null;
  const rootKey = Buffer.from(encoded, "base64");
  if (rootKey.length !== 32) return null;
  // Domain-separate the avatar signature key from the provider-secret encryption key.
  return createHmac("sha256", rootKey).update("ABEmail sender avatar signature v1", "utf8").digest();
}

function readHeader(headers, name) {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) return null;
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target && typeof value === "string") return value.trim();
  }
  return null;
}

/** @returns {Record<string, string>} */
export function createSenderAvatarHeaders(fromAddress, avatarUrl) {
  const address = normalizeAvatarEmail(fromAddress);
  const safeUrl = isSafeSenderAvatarUrl(avatarUrl);
  const key = signingKey();
  if (!address || !safeUrl || !key) return {};

  const signature = createHmac("sha256", key)
    .update(address + "\n" + safeUrl, "utf8")
    .digest("base64url");

  return {
    "X-ABEmail-Sender-Avatar": safeUrl,
    "X-ABEmail-Sender-Avatar-Signature": "v1:" + signature,
  };
}

export function verifySenderAvatarHeaders(headers, fromAddress) {
  const address = normalizeAvatarEmail(fromAddress);
  const avatarUrl = isSafeSenderAvatarUrl(readHeader(headers, SENDER_AVATAR_HEADER));
  const signatureValue = readHeader(headers, SENDER_AVATAR_SIGNATURE_HEADER);
  const key = signingKey();
  if (!address || !avatarUrl || !signatureValue || !key) return null;
  if (!signatureValue.startsWith("v1:")) return null;

  const suppliedSignature = Buffer.from(signatureValue.slice(3), "base64url");
  const expectedSignature = createHmac("sha256", key)
    .update(address + "\n" + avatarUrl, "utf8")
    .digest();
  if (suppliedSignature.length !== expectedSignature.length) return null;
  return timingSafeEqual(suppliedSignature, expectedSignature) ? avatarUrl : null;
}
