import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  // A GET request must not mutate authentication state (for example, through
  // link prefetching). Actual sign-out is a same-origin POST.
  return NextResponse.redirect(new URL("/auth/sign-in", request.url));
}

export async function POST() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    return NextResponse.json({ error: "Unable to sign out. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
