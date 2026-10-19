import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type WorkspaceHomeRouteProps = {
  params: Promise<{ organizationId: string }>;
};

/** A workspace opens on its mailbox; all workspace routes share the parent shell. */
export default async function WorkspaceHomeRoute({ params }: WorkspaceHomeRouteProps) {
  const { organizationId } = await params;
  if (!UUID_PATTERN.test(organizationId)) notFound();
  redirect("/dashboard/" + organizationId + "/mail");
}
