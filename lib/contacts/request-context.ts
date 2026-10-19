import { getOrganizationRequestContext } from "@/lib/organizations/request-context";

export async function getContactRequestContext(organizationId: string) {
  return getOrganizationRequestContext(organizationId, "contacts");
}
