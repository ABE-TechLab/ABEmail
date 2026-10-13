import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Authentication is not configured for this environment yet." },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("email" in payload) ||
    !("password" in payload) ||
    typeof payload.email !== "string" ||
    typeof payload.password !== "string" ||
    payload.email.length > 320 ||
    payload.password.length < 1 ||
    payload.password.length > 1024
  ) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  const loginEmail = payload.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  let authEmail = loginEmail;

  // Login aliases live in a private schema. Resolve them only server-side, using
  // a secret key; if the optional server secret is not configured, normal
  // primary-email sign-in still works while alternate aliases remain disabled.
  const admin = createAdminClient();
  if (admin) {
    const { data: resolvedEmail, error: aliasError } = await admin.rpc(
      "resolve_login_email_for_auth",
      { p_login_email: loginEmail },
    );
    if (!aliasError && typeof resolvedEmail === "string" && resolvedEmail.length > 0) {
      authEmail = resolvedEmail;
    }
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password: payload.password,
  });

  if (error) {
    // Keep the response generic so the endpoint doesn't disclose whether a
    // primary email or alias exists.
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
