import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  createSenderAvatarHeaders,
  getGravatarAvatarUrl,
  isSafeSenderAvatarUrl,
  normalizeAvatarEmail,
  verifySenderAvatarHeaders,
} from "./sender-avatar.mjs";

const ORIGINAL_KEY = process.env.ABEMAIL_CREDENTIALS_ENCRYPTION_KEY_V2;
const TEST_KEY = Buffer.alloc(32, 23).toString("base64");

test("normalizes mailbox addresses without retaining display names", () => {
  assert.equal(normalizeAvatarEmail("Ada Lovelace <Ada@Example.com>"), "ada@example.com");
  assert.equal(normalizeAvatarEmail("MAILTO:ADA@EXAMPLE.COM"), "ada@example.com");
  assert.equal(normalizeAvatarEmail("not-an-email"), null);
  assert.equal(normalizeAvatarEmail(""), null);
});

test("uses a SHA-256 email hash and never puts the address in the image URL", () => {
  const address = "ada@example.com";
  const hash = createHash("sha256").update(address).digest("hex");
  assert.equal(getGravatarAvatarUrl("Ada <ADA@example.com>"), "/api/mail/avatars/" + hash);
  assert.equal(getGravatarAvatarUrl("invalid"), null);
});

test("accepts only safe public HTTPS avatar URLs", () => {
  assert.equal(isSafeSenderAvatarUrl("https://cdn.example.com/logo.png"), "https://cdn.example.com/logo.png");
  assert.equal(isSafeSenderAvatarUrl("http://cdn.example.com/logo.png"), null);
  assert.equal(isSafeSenderAvatarUrl("https://user:pass@example.com/logo.png"), null);
  assert.equal(isSafeSenderAvatarUrl("https://localhost/logo.png"), null);
  assert.equal(isSafeSenderAvatarUrl("javascript:alert(1)"), null);
});

test("signs the workspace avatar for its exact sender address and rejects tampering", () => {
  process.env.ABEMAIL_CREDENTIALS_ENCRYPTION_KEY_V2 = TEST_KEY;
  try {
    const headers = createSenderAvatarHeaders(
      "Workspace <team@example.com>",
      "https://cdn.example.com/workspace-logo.png",
    );
    assert.ok(headers["X-ABEmail-Sender-Avatar"]);
    assert.equal(verifySenderAvatarHeaders(headers, "team@example.com"), "https://cdn.example.com/workspace-logo.png");
    assert.equal(verifySenderAvatarHeaders(headers, "attacker@example.com"), null);
    assert.equal(verifySenderAvatarHeaders({
      ...headers,
      "X-ABEmail-Sender-Avatar": "https://attacker.example.com/fake.png",
    }, "team@example.com"), null);
    assert.equal(verifySenderAvatarHeaders({
      ...headers,
      "X-ABEmail-Sender-Avatar-Signature": "v1:invalid",
    }, "team@example.com"), null);
  } finally {
    if (ORIGINAL_KEY === undefined) delete process.env.ABEMAIL_CREDENTIALS_ENCRYPTION_KEY_V2;
    else process.env.ABEMAIL_CREDENTIALS_ENCRYPTION_KEY_V2 = ORIGINAL_KEY;
  }
});

test("does not emit identity headers when the signing key is unavailable", () => {
  delete process.env.ABEMAIL_CREDENTIALS_ENCRYPTION_KEY_V2;
  try {
    assert.deepEqual(createSenderAvatarHeaders("team@example.com", "https://cdn.example.com/logo.png"), {});
    assert.equal(verifySenderAvatarHeaders({
      "X-ABEmail-Sender-Avatar": "https://cdn.example.com/logo.png",
      "X-ABEmail-Sender-Avatar-Signature": "v1:anything",
    }, "team@example.com"), null);
  } finally {
    if (ORIGINAL_KEY === undefined) delete process.env.ABEMAIL_CREDENTIALS_ENCRYPTION_KEY_V2;
    else process.env.ABEMAIL_CREDENTIALS_ENCRYPTION_KEY_V2 = ORIGINAL_KEY;
  }
});
