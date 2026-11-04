import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const worker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

assert.match(worker, /request\.method !== "GET"/, "non-GET requests must not be intercepted");
assert.match(worker, /url\.origin !== self\.location\.origin/, "cross-origin requests must bypass the worker");
assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\) \|\| url\.pathname\.startsWith\("\/auth\/"\)/, "API and auth routes must remain network-only");
assert.match(worker, /request\.mode === "navigate"[\s\S]*?fetch\(request\)\.catch/, "navigations must be network-only with an offline fallback");
assert.match(worker, /function isPublicStaticAsset\(pathname\)/, "static cache allowlist must be explicit");
assert.match(worker, /pathname\.startsWith\("\/_next\/static\/"\)/, "only versioned Next static files may be cached");
assert.match(worker, /pathname\.startsWith\("\/branding\/"\)/, "public brand assets may be cached");
assert.match(worker, /pathname\.startsWith\("\/icons\/"\)/, "public app icons may be cached");
assert.match(worker, /pathname === "\/favicon\.svg"/, "only the explicit favicon may be cached");
assert.match(worker, /cache\.put\(request, response\.clone\(\)\)/, "cache writes must be limited to the allowlisted static-asset handler");
assert.match(worker, /response\.ok && response\.type === "basic"/, "only successful same-origin static responses may be cached");
assert.doesNotMatch(worker, /caches\.match\(request\)\s*\|\|\s*fetch\(request\)/, "there must be no generic cache-first handler");

console.log("PWA cache policy checks passed.");
