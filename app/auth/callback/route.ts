import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/dashboard";
  }
  return value;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = safeNextPath(requestUrl.searchParams.get("next"));

  if (!code) {
    const error = requestUrl.searchParams.get("error_description");
    const target = new URL("/auth/sign-in", requestUrl.origin);
    if (error) target.searchParams.set("error", error.slice(0, 180));
    return NextResponse.redirect(target);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const target = new URL("/auth/sign-in", requestUrl.origin);
    target.searchParams.set("error", "Authentication could not be completed. Please try again.");
    return NextResponse.redirect(target);
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
