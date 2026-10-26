import assert from "node:assert/strict";
import test from "node:test";
import { renderEmailDesign, validateEmailDesignContent } from "./render.mjs";

const brand = {
  brandName: "ABE TechLab",
  logoUrl: "https://assets.example.com/logo.png",
  primaryColor: "#222222",
  accentColor: "#D7F36A",
  backgroundColor: "#F3F4F6",
  textColor: "#242424",
  fontFamily: "Arial",
  websiteUrl: "https://example.com",
  phone: "+234 800 000 0000",
  address: "Lagos, Nigeria",
};

test("validates supported stable block types and IDs", () => {
  const parsed = validateEmailDesignContent({
    version: 1,
    blocks: [
      { id: "title", type: "heading", level: 1, text: "Welcome" },
      { id: "copy", type: "paragraph", text: "Thanks for joining." },
      { id: "cta", type: "button", label: "Open account", href: "https://example.com/account" },
    ],
  });
  assert.equal(parsed.error, null);
  assert.equal(parsed.data.blocks.length, 3);
});

test("rejects unsafe links, raw HTML block types, duplicate IDs, and unsupported versions", () => {
  assert.match(validateEmailDesignContent({ version: 1, blocks: [{ id: "cta", type: "button", label: "Go", href: "javascript:alert(1)" }] }).error, /HTTPS/);
  assert.match(validateEmailDesignContent({ version: 1, blocks: [{ id: "raw", type: "html", html: "<script>alert(1)</script>" }] }).error, /supported type|Unsupported/i);
  assert.match(validateEmailDesignContent({ version: 1, blocks: [{ id: "same", type: "paragraph", text: "One" }, { id: "same", type: "paragraph", text: "Two" }] }).error, /unique/);
  assert.match(validateEmailDesignContent({ version: 2, blocks: [] }).error, /version/);
});

test("renders email-safe HTML and a useful plain-text alternative", () => {
  const result = renderEmailDesign({
    version: 1,
    blocks: [
      { id: "title", type: "heading", level: 1, text: "Hello <customers>" },
      { id: "intro", type: "paragraph", text: "Welcome to our product." },
      { id: "cta", type: "button", label: "View invoice", href: "https://example.com/invoice/123" },
      { id: "divider", type: "divider" },
      { id: "footer", type: "footer", text: "You received this message from ABE TechLab." },
    ],
  }, brand);

  assert.match(result.html, /<!doctype html>/i);
  assert.match(result.html, /role="presentation"/);
  assert.match(result.html, /Hello &lt;customers&gt;/);
  assert.doesNotMatch(result.html, /<script/i);
  assert.match(result.html, /href="https:\/\/example.com\/invoice\/123"/);
  assert.match(result.text, /Hello <customers>/);
  assert.match(result.text, /View invoice: https:\/\/example.com\/invoice\/123/);
  assert.match(result.html, /Lagos, Nigeria/);
});

test("validates rows and escapes social/contact values", () => {
  const result = renderEmailDesign({
    version: 1,
    blocks: [
      {
        id: "row",
        type: "row",
        columns: [
          { id: "left", blocks: [{ id: "left-title", type: "heading", text: "Left" }] },
          { id: "right", blocks: [{ id: "right-copy", type: "paragraph", text: "Right" }] },
        ],
      },
      { id: "contact", type: "contact", email: "help@example.com", phone: "+234 800 000 0000", address: "Lagos\nNigeria" },
      { id: "social", type: "social", links: [{ label: "LinkedIn", href: "https://www.linkedin.com/company/example" }] },
    ],
  });
  assert.match(result.html, /<td width="50%"/);
  assert.match(result.html, /mailto:help@example.com/);
  assert.match(result.html, /Lagos<br \/>Nigeria/);
  assert.match(result.text, /LinkedIn: https:\/\/www.linkedin.com/);
});

test("caps the content payload and block count", () => {
  const tooMany = Array.from({ length: 101 }, (_, index) => ({ id: "block-" + index, type: "paragraph", text: "Hello" }));
  assert.match(validateEmailDesignContent({ version: 1, blocks: tooMany }).error, /100 blocks/);
  assert.match(validateEmailDesignContent({ version: 1, blocks: [{ id: "large", type: "paragraph", text: "x".repeat(270000) }] }).error, /256 KB/);
});

test("invalid brand values fall back to a safe palette and font", () => {
  const result = renderEmailDesign({ version: 1, blocks: [{ id: "title", type: "heading", text: "Safe" }] }, {
    brandName: "<img src=x>",
    primaryColor: "red; background:url(javascript:alert(1))",
    fontFamily: "Arial; color:red",
  });
  assert.match(result.html, /background-color:#F3F4F6/);
  assert.match(result.html, /font-family:Arial/);
  assert.match(result.html, /&lt;img src=x&gt;/);
  assert.doesNotMatch(result.html, /background:url/);
});

test("includes the shared default brand footer in HTML and plain-text fallback", () => {
  const result = renderEmailDesign({
    version: 1,
    blocks: [{ id: "title", type: "heading", level: 1, text: "Invoice ready" }],
  }, {
    brandName: "Example Company",
    footerText: "Registered business. Reply to this message for support.",
    websiteUrl: "https://example.com",
  });
  assert.match(result.html, /Registered business\. Reply to this message for support\./);
  assert.match(result.text, /Registered business\. Reply to this message for support\./);
  assert.match(result.text, /Example Company/);
  assert.match(result.text, /https:\/\/example.com/);
});
