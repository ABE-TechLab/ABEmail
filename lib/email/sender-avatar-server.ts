import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import { isSafeSenderAvatarUrl } from "@/lib/email/sender-avatar.mjs";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

export async function getOrganizationSenderAvatarUrl(
  admin: AdminClient,
  organizationId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("organization_brand_profiles")
    .select("logo_url")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data) return null;
  return isSafeSenderAvatarUrl(data.logo_url);
}
