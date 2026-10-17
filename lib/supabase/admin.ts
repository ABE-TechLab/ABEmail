import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * The Supabase secret key is server-only. This client is used only for the
 * server-side operations that perform explicit tenant authorization before using privileged access.
 * Never use this client as a substitute for validating the signed-in actor and tenant.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) return null;

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
