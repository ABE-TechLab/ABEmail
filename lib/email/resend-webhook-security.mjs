import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyResendWebhookSignature(input) {
  const { rawBody, id, timestamp, signature, secret } = input;
  if (!id || !timestamp || !signature || typeof secret !== "string" || !secret.startsWith("whsec_")) return false;

  const timestampNumber = Number(timestamp);
  if (!Number.isSafeInteger(timestampNumber)) return false;
  const nowSeconds = Math.floor((input.now ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - timestampNumber) > 300) return false;

  let signingKey;
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

/**
 * Shared HTTP boundary used by the Next.js webhook route and its integration tests.
 * Signature verification always happens before JSON parsing.
 */
export function verifyAndParseResendWebhook(input) {
  const verified = verifyResendWebhookSignature(input);
  if (!verified) return { ok: false, status: 401, error: "Invalid webhook signature." };

  let event;
  try {
    event = JSON.parse(input.rawBody);
  } catch {
    return { ok: false, status: 400, error: "Invalid webhook payload." };
  }

  const eventId = input.id;
  if (!eventId || eventId.length > 255 || !event || typeof event !== "object" ||
      typeof event.type !== "string" || !event.type || event.type.length > 120) {
    return { ok: false, status: 400, error: "Webhook event identity is invalid." };
  }

  return { ok: true, event, eventId };
}
