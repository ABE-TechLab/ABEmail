export function canScheduledCreatorSend(membership, mailboxGrant) {
  if (!membership || membership.status !== "active") return false;
  if (membership.role === "owner" || membership.role === "admin") return true;
  return Boolean(mailboxGrant && mailboxGrant.status === "active" && mailboxGrant.can_send === true);
}
