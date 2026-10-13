"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./auth-form.module.css";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type AuthMode = "sign-in" | "sign-up" | "forgot-password" | "update-password";

type AuthFormProps = {
  mode: AuthMode;
  nextPath?: string;
  initialError?: string;
};

function callbackUrl(nextPath: string) {
  const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
}

const COPY: Record<AuthMode, { title: string; description: string; submit: string }> = {
  "sign-in": {
    title: "Welcome back",
    description: "Sign in to your ABEmail account to access your assigned workspaces and mailboxes.",
    submit: "Sign in",
  },
  "sign-up": {
    title: "Create your account",
    description: "Start with an email address you can access. You can connect a business mailbox after your organization is set up.",
    submit: "Create account",
  },
  "forgot-password": {
    title: "Reset your password",
    description: "We'll send a password-reset link to the email address on your account.",
    submit: "Send reset link",
  },
  "update-password": {
    title: "Choose a new password",
    description: "Set a password for your ABEmail account. It is separate from your Google password.",
    submit: "Update password",
  },
};

export default function AuthForm({ mode, nextPath = "/dashboard", initialError = "" }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState("");
  const copy = COPY[mode];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!isSupabaseConfigured()) {
      setError("Authentication is not configured for this environment yet.");
      return;
    }

    if (mode === "sign-up" && password.length < 10) {
      setError("Use a password with at least 10 characters.");
      return;
    }

    if ((mode === "sign-up" || mode === "update-password") && password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();

      if (mode === "sign-in") {
        const response = await fetch("/api/auth/password-sign-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(result.error || "Unable to sign in.");
        router.replace(nextPath);
        router.refresh();
        return;
      }

      if (mode === "sign-up") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { emailRedirectTo: callbackUrl(nextPath === "/dashboard" ? "/onboarding" : nextPath) },
        });
        if (authError) throw authError;
        if (data.session) {
          router.replace(nextPath === "/dashboard" ? "/onboarding" : nextPath);
          router.refresh();
          return;
        }
        setNotice("Check your inbox to verify your email. After verification, you'll continue to organization setup.");
        return;
      }

      if (mode === "forgot-password") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: callbackUrl("/auth/update-password"),
        });
        if (authError) throw authError;
        setNotice("If an account exists for that address, a password-reset email has been sent.");
        return;
      }

      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;
      setNotice("Your ABEmail password has been updated.");
      setPassword("");
      setConfirmPassword("");
      window.setTimeout(() => router.replace(nextPath), 900);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function continueWithGoogle() {
    setError("");
    setBusy(true);
    try {
      if (!isSupabaseConfigured()) throw new Error("Authentication is not configured for this environment yet.");
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl(nextPath) },
      });
      if (authError) throw authError;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Google Sign-In could not be started.");
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <Link className={styles.wordmark} href="/welcome" aria-label="ABEmail home">
        <span className={styles.mark}>A</span>
        <span>AB<span>Email</span></span>
      </Link>
      <section className={styles.card}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>ABE TECHLAB · BUSINESS EMAIL</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>

        {(mode === "sign-in" || mode === "sign-up") && (
          <>
            <button className={styles.googleButton} type="button" onClick={continueWithGoogle} disabled={busy}>
              <span className={styles.googleG} aria-hidden="true">G</span>
              Continue with Google
            </button>
            <div className={styles.separator}><span />or use email and password<span /></div>
          </>
        )}

        <form className={styles.form} onSubmit={submit}>
          {mode !== "update-password" && (
            <label>
              <span>Email address</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                required
                disabled={busy || mode === "update-password"}
              />
            </label>
          )}

          {mode !== "forgot-password" && (
            <label>
              <span>{mode === "update-password" ? "New password" : "Password"}</span>
              <input
                type="password"
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === "sign-in" ? "Enter your password" : "At least 10 characters"}
                minLength={mode === "sign-in" ? 1 : 10}
                required
                disabled={busy}
              />
            </label>
          )}

          {(mode === "sign-up" || mode === "update-password") && (
            <label>
              <span>Confirm password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Enter the password again"
                minLength={10}
                required
                disabled={busy}
              />
            </label>
          )}

          {error && <p className={styles.error} role="alert">{error}</p>}
          {notice && <p className={styles.notice} role="status">{notice}</p>}

          <button className={styles.submit} type="submit" disabled={busy}>
            {busy ? "Please wait…" : copy.submit}
          </button>
        </form>

        <nav className={styles.links} aria-label="Authentication">
          {mode === "sign-in" && (
            <>
              <Link href="/auth/forgot-password">Forgot password?</Link>
              <span>New to ABEmail? <Link href="/auth/sign-up">Create an account</Link></span>
            </>
          )}
          {mode === "sign-up" && <span>Already have an account? <Link href="/auth/sign-in">Sign in</Link></span>}
          {mode === "forgot-password" && <Link href="/auth/sign-in">Back to sign in</Link>}
          {mode === "update-password" && <Link href="/dashboard">Back to workspace</Link>}
        </nav>
      </section>
      <p className={styles.footer}>Your login identity and business mailbox are separate. Access is granted by organization and mailbox permissions.</p>
    </main>
  );
}
