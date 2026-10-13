"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./auth-form.module.css";
import { createClient } from "@/lib/supabase/client";

function makeSlug(value: string) {
  return value.trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 55);
}

export default function OrganizationOnboardingForm({ email }: { email: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function changeName(value: string) {
    setName(value);
    if (!slugEdited) setSlug(makeSlug(value));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (name.trim().length < 2) {
      setError("Organization name must contain at least 2 characters.");
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setError("Use lowercase letters, numbers, and single hyphens in the workspace address.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error: createError } = await supabase.rpc("create_organization_with_owner", {
        p_name: name.trim(),
        p_slug: slug,
      });
      if (createError) throw createError;
      if (typeof data !== "string") throw new Error("The organization was not created. Please try again.");
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      setError(message.includes("organizations_slug_key") || message.toLowerCase().includes("duplicate")
        ? "That workspace address is already in use. Choose another."
        : message || "We couldn't create the organization. Verify your email and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <a className={styles.wordmark} href="/welcome"><span className={styles.mark}>A</span><span>AB<span>Email</span></span></a>
      <section className={styles.card}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>ORGANIZATION SETUP</p>
          <h1>Create your workspace</h1>
          <p>You are signing in as <strong>{email}</strong>. This account will become the organization owner. You can verify your domain and set up business mailboxes after this step.</p>
        </div>
        <form className={styles.form} onSubmit={submit}>
          <label>
            <span>Organization name</span>
            <input value={name} onChange={(event) => changeName(event.target.value)} placeholder="ABE TechLab" minLength={2} maxLength={120} required disabled={busy} />
          </label>
          <label>
            <span>Workspace address</span>
            <input value={slug} onChange={(event) => { setSlugEdited(true); setSlug(makeSlug(event.target.value)); }} placeholder="abe-techlab" maxLength={55} required disabled={busy} />
          </label>
          <p className={styles.footer}>Address preview: <strong>{slug || "your-workspace"}</strong>. This is an ABEmail workspace identifier, not your email domain.</p>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.submit} type="submit" disabled={busy}>{busy ? "Creating workspace…" : "Create workspace"}</button>
        </form>
        <nav className={styles.links}><a href="/auth/sign-out">Sign out</a></nav>
      </section>
    </main>
  );
}
