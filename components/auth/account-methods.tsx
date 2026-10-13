"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./auth-form.module.css";
import { createClient } from "@/lib/supabase/client";

export default function AccountMethods({ primaryEmail }: { primaryEmail: string }) {
  const router = useRouter();
  const [providers, setProviders] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadIdentities() {
      const supabase = createClient();
      const { data, error: identityError } = await supabase.auth.getUserIdentities();
      if (!cancelled) {
        if (identityError) setError("Unable to load your sign-in methods.");
        else setProviders((data.identities ?? []).map((identity) => identity.provider));
      }
    }
    void loadIdentities();
    return () => { cancelled = true; };
  }, []);

  async function setAccountPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (password.length < 10) {
      setError("Use a password with at least 10 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword("");
      setConfirmPassword("");
      setNotice("Password saved. You can now use the same ABEmail password with your primary email or any assigned business-email login alias.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update your password.");
    } finally {
      setBusy(false);
    }
  }

  async function connectGoogle() {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: linkError } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/settings/account")}` },
      });
      if (linkError) throw linkError;
    } catch (caught) {
      setError(caught instanceof Error
        ? caught.message
        : "Unable to connect Google. Check that Google OAuth and identity linking are enabled in Supabase.");
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <a className={styles.wordmark} href="/dashboard"><span className={styles.mark}>A</span><span>AB<span>Email</span></span></a>
      <section className={styles.card}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>ACCOUNT SECURITY</p>
          <h1>Sign-in methods</h1>
          <p>Your login identity is separate from each mailbox you can access. Connecting Google or adding an ABEmail password keeps the same account and permissions.</p>
        </div>

        <div className={styles.accountSummary}>
          <span className={styles.accountLabel}>Primary sign-in email</span>
          <strong>{primaryEmail}</strong>
          <span className={styles.accountLabel}>Connected methods</span>
          <div className={styles.providerList}>
            {providers.map((provider) => <span key={provider} className={styles.providerPill}>{provider === "google" ? "Google" : provider === "email" ? "Email and password" : provider}</span>)}
            {!providers.length && <span className={styles.providerPill}>Loading methods…</span>}
          </div>
        </div>

        {!providers.includes("google") && (
          <button className={styles.googleButton} type="button" onClick={connectGoogle} disabled={busy}>
            <span className={styles.googleG} aria-hidden="true">G</span>
            Connect Google account
          </button>
        )}
        {providers.includes("google") && <p className={styles.notice}>Google is connected to this ABEmail account.</p>}

        <form className={styles.form} onSubmit={setAccountPassword}>
          <div className={styles.accountSectionHeading}>
            <h2>{providers.includes("email") ? "Change ABEmail password" : "Add an ABEmail password"}</h2>
            <p>This password is not your Google password. It is used for password-based sign-in.</p>
          </div>
          <label><span>{providers.includes("email") ? "New password" : "Create password"}</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} autoComplete="new-password" required disabled={busy} placeholder="At least 10 characters" /></label>
          <label><span>Confirm password</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={10} autoComplete="new-password" required disabled={busy} /></label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          {notice && <p className={styles.notice} role="status">{notice}</p>}
          <button className={styles.submit} type="submit" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
        </form>
        <nav className={styles.links}><a href="/dashboard">Back to workspace</a><a href="/settings/team">Manage team access</a><a href="/auth/sign-out">Sign out</a></nav>
      </section>
      <p className={styles.footer}>Alternate business-email sign-in only works after an administrator assigns an active mailbox as your login alias. Google OAuth and identity linking must also be enabled in the Supabase project settings.</p>
    </main>
  );
}
