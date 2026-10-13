"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./auth-form.module.css";
import { createClient } from "@/lib/supabase/client";

type InvitationDetails = {
  organization_name: string;
  invite_email: string;
  invite_role: string;
  expires_at: string;
};

function callbackUrl(token: string) {
  const next = `/auth/accept-invitation?token=${encodeURIComponent(token)}`;
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export default function InvitationAcceptanceForm({ token }: { token: string }) {
  const router = useRouter();
  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"sign-in" | "create-account">("sign-in");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentEmail, setCurrentEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const acceptForCurrentUser = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setCurrentEmail("");
        return;
      }
      setCurrentEmail(user.email ?? "");
      if ((user.email ?? "").toLowerCase() !== (details?.invite_email ?? "").toLowerCase()) {
        setError(`This invitation is for ${details?.invite_email}. Sign out and use that account to accept it.`);
        return;
      }

      const { error: acceptError } = await supabase.rpc("accept_organization_invitation", {
        p_token: token,
      });
      if (acceptError) throw acceptError;
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't accept this invitation.");
    } finally {
      setBusy(false);
    }
  }, [details, router, token]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token || token.length > 256) {
        setError("This invitation link is incomplete or invalid.");
        setLoading(false);
        return;
      }
      try {
        const supabase = createClient();
        const { data, error: invitationError } = await supabase.rpc(
          "get_organization_invitation_details",
          { p_token: token },
        );
        const row = Array.isArray(data) ? data[0] : data;
        if (invitationError || !row) {
          if (!cancelled) setError("This invitation has expired, was revoked, or has already been used.");
          return;
        }
        if (!cancelled) setDetails(row as InvitationDetails);
      } catch {
        if (!cancelled) setError("Invitation details couldn't be loaded. Please try again later.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    async function checkCurrentSession() {
      if (loading || !details) return;
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!cancelled && user) setCurrentEmail(user.email ?? "");
      } catch {
        // A missing session is expected for a new invitee; show the sign-in form.
      }
    }
    void checkCurrentSession();
    return () => { cancelled = true; };
  }, [details, loading]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!details) return;
    if (mode === "create-account" && password.length < 10) {
      setError("Use a password with at least 10 characters.");
      return;
    }
    if (mode === "create-account" && password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();

      if (mode === "create-account") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: details.invite_email,
          password,
          options: {
            emailRedirectTo: callbackUrl(token),
          },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setNotice("Check the invited email address to verify the account, then reopen this invitation link.");
          return;
        }
      } else {
        const response = await fetch("/api/auth/password-sign-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: details.invite_email, password }),
        });
        if (!response.ok) {
          const result = (await response.json()) as { error?: string };
          throw new Error(result.error || "Unable to sign in.");
        }
      }

      await acceptForCurrentUser();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to continue. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setError("");
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl(token) },
      });
      if (authError) throw authError;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Google Sign-In could not be started.");
      setBusy(false);
    }
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setCurrentEmail("");
    setError("");
    setNotice("Signed out. Sign in with the email address shown on the invitation.");
  }

  return (
    <main className={styles.page}>
      <a className={styles.wordmark} href="/welcome"><span className={styles.mark}>A</span><span>AB<span>Email</span></span></a>
      <section className={styles.card}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>TEAM INVITATION</p>
          <h1>Join a workspace</h1>
          {loading ? <p>Checking your invitation…</p> : details ? (
            <p>You have been invited to <strong>{details.organization_name}</strong> as an <strong>{details.invite_role}</strong>. Accept with the invited sign-in email below.</p>
          ) : <p>We couldn&apos;t validate this invitation link.</p>}
        </div>

        {details && !currentEmail && (
          <>
            <p className={styles.notice}>Invitation for <strong>{details.invite_email}</strong></p>
            <button className={styles.googleButton} type="button" onClick={googleSignIn} disabled={busy}>
              <span className={styles.googleG} aria-hidden="true">G</span>
              Continue with Google
            </button>
            <div className={styles.separator}><span />or use email and password<span /></div>
            <div className={styles.links}>
              <span>
                <button type="button" className={styles.switchMode} onClick={() => { setMode(mode === "sign-in" ? "create-account" : "sign-in"); setError(""); }}>
                  {mode === "sign-in" ? "New to ABEmail? Create your login" : "Already have an ABEmail login? Sign in"}
                </button>
              </span>
            </div>
            <form className={styles.form} onSubmit={submit}>
              <label>
                <span>Invitation email</span>
                <input type="email" value={details.invite_email} disabled />
              </label>
              <label>
                <span>{mode === "sign-in" ? "Password" : "Create password"}</span>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={mode === "sign-in" ? 1 : 10} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} required disabled={busy} />
              </label>
              {mode === "create-account" && (
                <label>
                  <span>Confirm password</span>
                  <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={10} autoComplete="new-password" required disabled={busy} />
                </label>
              )}
              {error && <p className={styles.error} role="alert">{error}</p>}
              {notice && <p className={styles.notice} role="status">{notice}</p>}
              <button className={styles.submit} type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "sign-in" ? "Sign in and accept" : "Create account and accept"}</button>
            </form>
          </>
        )}

        {currentEmail && (
          <div className={styles.form}>
            <p className={styles.notice}>Signed in as <strong>{currentEmail}</strong>.</p>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button className={styles.submit} type="button" onClick={() => void acceptForCurrentUser()} disabled={busy}>{busy ? "Accepting…" : "Accept invitation"}</button>
            <button className={styles.googleButton} type="button" onClick={() => void signOut()} disabled={busy}>Sign out and switch account</button>
          </div>
        )}
      </section>
      <p className={styles.footer}>An invitation only grants the organization role and specific mailboxes selected by its administrator.</p>
    </main>
  );
}
