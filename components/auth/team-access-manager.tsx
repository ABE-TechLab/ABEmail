"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import SignOutButton from "@/components/auth/sign-out-button";
import { useRouter } from "next/navigation";
import styles from "./team-access-manager.module.css";
import { createClient } from "@/lib/supabase/client";

type Organization = { id: string; name: string; slug: string; role: "owner" | "admin" };
type Mailbox = { id: string; address: string; display_name: string; status: string };
type Invitation = {
  id: string;
  invite_email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  expired: boolean;
};

function createInviteToken() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const bytes = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function TeamAccessManager({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [selectedMailboxIds, setSelectedMailboxIds] = useState<string[]>([]);
  const [aliasMailboxIds, setAliasMailboxIds] = useState<string[]>([]);
  const [inviteLink, setInviteLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadOrganizations() {
      try {
        const supabase = createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          router.replace("/auth/sign-in?next=/settings/team");
          return;
        }

        const { data: memberships, error: membershipError } = await supabase
          .from("organization_memberships")
          .select("organization_id, role")
          .eq("user_id", user.id)
          .eq("status", "active");

        if (membershipError) throw membershipError;
        const adminMemberships = (memberships ?? []).filter((item) => item.role === "owner" || item.role === "admin");
        if (!adminMemberships.length) {
          if (!cancelled) setError("Only organization owners and administrators can manage team invitations.");
          return;
        }

        const { data: orgRows, error: orgError } = await supabase
          .from("organizations")
          .select("id, name, slug")
          .in("id", adminMemberships.map((item) => item.organization_id))
          .eq("status", "active");
        if (orgError) throw orgError;

        const orgs: Organization[] = (orgRows ?? []).map((org) => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          role: adminMemberships.find((item) => item.organization_id === org.id)?.role as "owner" | "admin",
        }));
        if (!cancelled) {
          setOrganizations(orgs);
          setOrganizationId((current) => current && orgs.some((org) => org.id === current) ? current : (orgs[0]?.id ?? ""));
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load team access.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadOrganizations();
    return () => { cancelled = true; };
  }, [router]);

  const loadOrganizationData = useCallback(async (id: string) => {
    if (!id) return;
    const supabase = createClient();
    const [mailboxResult, invitationResult] = await Promise.all([
      supabase.from("mailboxes").select("id, address, display_name, status").eq("organization_id", id).eq("status", "active").order("address"),
      supabase.from("organization_invitations").select("id, invite_email, role, expires_at, accepted_at, revoked_at, created_at").eq("organization_id", id).order("created_at", { ascending: false }).limit(20),
    ]);
    if (mailboxResult.error) throw mailboxResult.error;
    if (invitationResult.error) throw invitationResult.error;
    setMailboxes(mailboxResult.data ?? []);
    setInvitations((invitationResult.data ?? []).map((invitation) => ({ ...invitation, expired: new Date(invitation.expires_at).getTime() < Date.now() })));
    setSelectedMailboxIds([]);
    setAliasMailboxIds([]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await loadOrganizationData(organizationId);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load this organization's mailboxes and invitations. Apply the reviewed database migrations first.");
      }
    }
    if (organizationId) void load();
    return () => { cancelled = true; };
  }, [loadOrganizationData, organizationId]);

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setInviteLink("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!organizationId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address and choose an organization.");
      return;
    }
    if (aliasMailboxIds.some((id) => !selectedMailboxIds.includes(id))) {
      setError("A login alias must also be an assigned mailbox.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const token = createInviteToken();
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Your session has expired. Sign in again.");

      const { data: invitation, error: insertError } = await supabase
        .from("organization_invitations")
        .insert({
          organization_id: organizationId,
          invite_email: normalizedEmail,
          role,
          token_hash: await sha256(token),
          invited_by: user.id,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      if (selectedMailboxIds.length) {
        const grants = selectedMailboxIds.map((mailboxId) => ({
          organization_id: organizationId,
          invitation_id: invitation.id,
          mailbox_id: mailboxId,
          use_as_login_alias: aliasMailboxIds.includes(mailboxId),
        }));
        const { error: grantError } = await supabase.from("organization_invitation_mailboxes").insert(grants);
        if (grantError) {
          await supabase.from("organization_invitations").delete().eq("id", invitation.id);
          throw grantError;
        }
      }

      setInviteLink(`${window.location.origin}/auth/accept-invitation?token=${token}`);
      setNotice("Invitation created. Copy the secure link and send it to the invited person. The link expires in 7 days.");
      setEmail("");
      await loadOrganizationData(organizationId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create the invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function copyInviteLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setNotice("Invitation link copied.");
    } catch {
      setNotice("Copy is unavailable in this browser. Select and copy the invitation link manually.");
    }
  }

  async function revokeInvitation(id: string) {
    setError("");
    const supabase = createClient();
    const { error: revokeError } = await supabase
      .from("organization_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .is("accepted_at", null)
      .is("revoked_at", null);
    if (revokeError) {
      setError(revokeError.message);
      return;
    }
    setNotice("Invitation revoked.");
    await loadOrganizationData(organizationId);
  }

  function toggleMailbox(id: string) {
    setSelectedMailboxIds((current) => {
      const adding = !current.includes(id);
      if (!adding) setAliasMailboxIds((aliases) => aliases.filter((value) => value !== id));
      return adding ? [...current, id] : current.filter((value) => value !== id);
    });
  }

  if (loading) return embedded ? <div className={styles.embeddedPage}><p>Loading organization access…</p></div> : <main className={styles.page}><p>Loading organization access…</p></main>;

  return (
    <main className={embedded ? styles.embeddedPage : styles.page}>
      {!embedded && <header className={styles.header}>
        <Link className={styles.wordmark} href="/dashboard"><span className={styles.mark}>A</span><span>AB<span>Email</span></span></Link>
        <nav><Link href="/dashboard">Workspace</Link><Link href="/settings/account">Account</Link><SignOutButton className="auth-signout-control" /></nav>
      </header>}

      <section className={styles.intro}>
        <p className={styles.eyebrow}>WORKSPACE ADMINISTRATION</p>
        <h1>Team and mailbox access</h1>
        <p>Invite people using an email address they can access, then assign their ABEmail mailbox separately. An invite never grants access to mailboxes you haven&apos;t selected.</p>
      </section>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}

      {organizations.length > 1 && (
        <label className={styles.orgPicker}>
          <span>Organization</span>
          <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
            {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name} · {organization.role}</option>)}
          </select>
        </label>
      )}

      <div className={styles.grid}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div><p className={styles.eyebrow}>INVITE A TEAMMATE</p><h2>Create invitation</h2></div>
            <span className={styles.expiry}>7-day link</span>
          </div>
          <form className={styles.form} onSubmit={createInvitation}>
            <label><span>Personal or business email they can access</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="james.personal@gmail.com" required maxLength={320} disabled={busy || !organizationId} /></label>
            <label><span>Organization role</span><select value={role} onChange={(event) => setRole(event.target.value as "member" | "admin")} disabled={busy || !organizationId}><option value="member">Member — assigned mailboxes only</option><option value="admin">Administrator — manage team and workspace</option></select></label>

            <div className={styles.mailboxSection}>
              <div><strong>Assign mailboxes</strong><p>Only active mailboxes can be assigned. You can invite a teammate before their mailbox is ready.</p></div>
              {mailboxes.length ? mailboxes.map((mailbox) => {
                const checked = selectedMailboxIds.includes(mailbox.id);
                return (
                  <div className={styles.mailboxItem} key={mailbox.id}>
                    <label className={styles.checkboxRow}>
                      <input type="checkbox" checked={checked} onChange={() => toggleMailbox(mailbox.id)} disabled={busy} />
                      <span><strong>{mailbox.display_name || mailbox.address}</strong><small>{mailbox.address}</small></span>
                    </label>
                    {checked && (
                      <label className={styles.aliasRow}>
                        <input type="checkbox" checked={aliasMailboxIds.includes(mailbox.id)} onChange={(event) => setAliasMailboxIds((current) => event.target.checked ? [...current, mailbox.id] : current.filter((value) => value !== mailbox.id))} disabled={busy} />
                        <span>Also allow password sign-in using this mailbox address</span>
                      </label>
                    )}
                  </div>
                );
              }) : <p className={styles.emptyMailboxes}>No active mailboxes yet. Domain verification and mailbox provisioning need to be completed before mailbox access can be assigned.</p>}
            </div>

            <button className={styles.primary} type="submit" disabled={busy || !organizationId}>{busy ? "Creating link…" : "Create invitation link"}</button>
          </form>

          {inviteLink && (
            <div className={styles.inviteLink}>
              <label><span>Share this one-time invitation link</span><input readOnly value={inviteLink} onFocus={(event) => event.currentTarget.select()} /></label>
              <button className={styles.secondary} type="button" onClick={() => void copyInviteLink()}>Copy invitation link</button>
            </div>
          )}
          <p className={styles.disclaimer}>This environment creates secure, expiring invitation links. Automatic invitation email delivery will be enabled after the production email sender is configured.</p>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div><p className={styles.eyebrow}>INVITATION HISTORY</p><h2>Recent invitations</h2></div>
            <span className={styles.count}>{invitations.length}</span>
          </div>
          {invitations.length ? (
            <div className={styles.invitationList}>
              {invitations.map((invitation) => {
                const expired = invitation.expired;
                const status = invitation.accepted_at ? "Accepted" : invitation.revoked_at ? "Revoked" : expired ? "Expired" : "Pending";
                return (
                  <article className={styles.invitationRow} key={invitation.id}>
                    <div><strong>{invitation.invite_email}</strong><p>{invitation.role === "admin" ? "Administrator" : "Member"} · expires {new Date(invitation.expires_at).toLocaleDateString()}</p></div>
                    <span className={status === "Pending" ? styles.pending : styles.status}>{status}</span>
                    {status === "Pending" && <button type="button" className={styles.revoke} onClick={() => void revokeInvitation(invitation.id)}>Revoke</button>}
                  </article>
                );
              })}
            </div>
          ) : <p className={styles.emptyMailboxes}>No invitations created for this organization yet.</p>}
        </section>
      </div>
    </main>
  );
}
