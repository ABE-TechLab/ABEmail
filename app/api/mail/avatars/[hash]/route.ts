import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MAX_AVATAR_BYTES = 512 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

export async function GET(_request: Request, context: { params: Promise<{ hash: string }> }) {
  const { hash } = await context.params;
  if (!HASH_PATTERN.test(hash)) return new NextResponse(null, { status: 404 });

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return new NextResponse(null, { status: 401 });

  try {
    const upstream = await fetch(`https://gravatar.com/avatar/${hash}?s=128&r=g&d=404`, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif" },
    });
    if (!upstream.ok) return new NextResponse(null, { status: 404 });
    const contentType = (upstream.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const contentLength = Number(upstream.headers.get("content-length") ?? "0");
    if (!IMAGE_TYPES.has(contentType) || (contentLength > 0 && contentLength > MAX_AVATAR_BYTES)) {
      return new NextResponse(null, { status: 404 });
    }
    const bytes = new Uint8Array(await upstream.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_AVATAR_BYTES) return new NextResponse(null, { status: 404 });
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
