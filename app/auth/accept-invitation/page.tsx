import type { Metadata } from "next";
import InvitationAcceptanceForm from "@/components/auth/invitation-acceptance-form";

export const metadata: Metadata = { title: "Accept invitation" };

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token?.trim() ?? "";
  return <InvitationAcceptanceForm token={token} />;
}
