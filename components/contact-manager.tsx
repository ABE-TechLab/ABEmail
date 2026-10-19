"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Contact } from "@/lib/contacts/types";
import styles from "./contact-manager.module.css";

type ContactForm = {
  name: string;
  email: string;
  company: string;
  role: string;
  phone: string;
  notes: string;
  tags: string;
};

type ContactManagerProps = {
  organizationId: string;
  organizationName: string;
  userEmail: string;
};

const EMPTY_FORM: ContactForm = { name: "", email: "", company: "", role: "", phone: "", notes: "", tags: "" };
const TONES = ["green", "amber", "violet", "blue", "rose", "slate"] as const;

function initials(value: string) {
  return value.split(/[\s@._+-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "C";
}

function contactTone(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return TONES[Math.abs(hash) % TONES.length];
}

function toForm(contact: Contact): ContactForm {
  return {
    name: contact.name,
    email: contact.email,
    company: contact.company ?? "",
    role: contact.role ?? "",
    phone: contact.phone ?? "",
    notes: contact.notes ?? "",
    tags: (contact.tags ?? []).join(", "),
  };
}

function messageFromPayload(payload: unknown, fallback: string) {
  if (typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }
  return fallback;
}

export default function ContactManager({ organizationId, organizationName, userEmail }: ContactManagerProps) {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactCount, setContactCount] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [formData, setFormData] = useState<ContactForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setLoadError("");
      const search = query.trim();
      const url = "/api/organizations/" + organizationId + "/contacts" +
        (search ? "?q=" + encodeURIComponent(search) : "");
      void fetch(url, { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          const payload = await response.json() as { ok?: boolean; error?: string; contacts?: Contact[]; count?: number };
          if (!response.ok || !payload.ok) throw new Error(payload.error || "Contacts could not be loaded.");
          if (!active) return;
          const nextContacts = payload.contacts ?? [];
          setContacts(nextContacts);
          setContactCount(payload.count ?? nextContacts.length);
          setSelectedId((current) => current && nextContacts.some((contact) => contact.id === current)
            ? current
            : nextContacts[0]?.id ?? null);
        })
        .catch((error: unknown) => {
          if (!active || (error instanceof Error && error.name === "AbortError")) return;
          setLoadError(error instanceof Error ? error.message : "Contacts could not be loaded.");
          setContacts([]);
          setContactCount(0);
          setSelectedId(null);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 160);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [organizationId, query, refreshVersion]);

  const selected = useMemo(
    () => contacts.find((contact) => contact.id === selectedId) ?? contacts[0] ?? null,
    [contacts, selectedId],
  );

  function beginCreate() {
    setFormMode("create");
    setFormData(EMPTY_FORM);
    setFormError("");
    setNotice("");
  }

  function beginEdit(contact: Contact) {
    setFormMode("edit");
    setFormData(toForm(contact));
    setFormError("");
    setNotice("");
  }

  function closeForm() {
    if (saving) return;
    setFormMode(null);
    setFormError("");
  }

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError("");
    try {
      const endpoint = "/api/organizations/" + organizationId + "/contacts" +
        (formMode === "edit" && selected ? "/" + selected.id : "");
      const response = await fetch(endpoint, {
        method: formMode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          company: formData.company.trim(),
          role: formData.role.trim(),
          phone: formData.phone.trim(),
          notes: formData.notes.trim(),
          tags: formData.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        }),
      });
      const payload = await response.json() as { ok?: boolean; error?: string; contact?: Contact };
      if (!response.ok || !payload.ok || !payload.contact) {
        setFormError(messageFromPayload(payload, "Contact could not be saved."));
        return;
      }
      setFormMode(null);
      setQuery("");
      setSelectedId(payload.contact.id);
      setRefreshVersion((current) => current + 1);
      setNotice(formMode === "edit" ? "Contact changes saved." : "Contact saved to this workspace.");
    } catch {
      setFormError("The contacts service could not be reached. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact() {
    if (!selected || deleting) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/organizations/" + organizationId + "/contacts/" + selected.id, {
        method: "DELETE",
      });
      const payload = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setNotice(messageFromPayload(payload, "Contact could not be deleted."));
        setDeleteOpen(false);
        return;
      }
      setDeleteOpen(false);
      setSelectedId(null);
      setQuery("");
      setRefreshVersion((current) => current + 1);
      setNotice("Contact deleted.");
    } catch {
      setNotice("The contacts service could not be reached. Try again.");
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  const mailboxHref = "/dashboard/" + organizationId + "/mail";

  async function copyEmail(email: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(email);
      setNotice("Email address copied.");
    } catch {
      setNotice("Could not copy automatically. Email address: " + email);
    }
  }

  return (
      <>
        <header className="mail-topbar">
          <div className="mail-breadcrumb"><span>{organizationName}</span><span className="mail-breadcrumb-slash">/</span><strong>Contacts</strong></div>
          <label className="mail-search">
            <span className="mail-search-icon" aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search contacts or tags" aria-label="Search contacts or tags" />
            {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>×</button>}
            {!query && <kbd>Search</kbd>}
          </label>
          <div className="mail-topbar-right"><span className="mail-development-pill"><span /> Workspace</span><span className="mail-user-avatar" aria-label={userEmail || "Signed-in user"}>{initials(userEmail || organizationName)}</span></div>
        </header>

        <div className="contacts-page">
          <header className="contacts-heading">
            <div>
              <p className="mail-overline">WORKSPACE DIRECTORY</p>
              <h1>Contacts</h1>
              <p>Keep key people and their details close to your conversations.</p>
            </div>
            <button className="mail-primary-action" type="button" onClick={beginCreate}>＋ Add contact</button>
          </header>

          <div className="contacts-workspace">
            <section className="contacts-list-pane" aria-label="Contacts list">
              <div className="contacts-list-heading"><strong>All contacts</strong><span>{loading ? "Loading…" : contacts.length + " shown · " + contactCount + " total"}</span></div>
              <div className="contacts-list">
                {loading && contacts.length === 0 && (
                  <div className="mail-empty-list"><span>♙</span><strong>Loading contacts</strong><p>Fetching this workspace’s saved address book.</p></div>
                )}
                {!loading && loadError && (
                  <div className="mail-empty-list"><span>!</span><strong>Contacts unavailable</strong><p>{loadError}</p><button type="button" onClick={() => setRefreshVersion((current) => current + 1)}>Try again</button></div>
                )}
                {!loading && !loadError && contacts.map((contact) => {
                  const tone = contactTone(contact.email);
                  return (
                    <button className={selected?.id === contact.id ? "contacts-row selected" : "contacts-row"} type="button" key={contact.id} onClick={() => setSelectedId(contact.id)}>
                      <span className={"mail-avatar tone-" + tone}>{initials(contact.name)}</span>
                      <span className="contacts-row-copy"><strong>{contact.name}</strong><small>{contact.email}</small><em>{contact.company || "No company"}</em>{contact.tags?.length > 0 && <small className={styles.tagSummary}>{contact.tags.slice(0, 2).join(" · ")}{contact.tags.length > 2 ? " +" + (contact.tags.length - 2) : ""}</small>}</span>
                      <span className="contacts-row-arrow">›</span>
                    </button>
                  );
                })}
                {!loading && !loadError && contacts.length === 0 && (
                  <div className="mail-empty-list"><span>♙</span><strong>{query ? "No contacts found" : "Your address book is empty"}</strong><p>{query ? "Try a different name, email, company, or role." : "Add a contact once and it will be available across this workspace."}</p><button type="button" onClick={beginCreate}>＋ Add contact</button></div>
                )}
                {!loading && !loadError && contactCount > contacts.length && (
                  <p className={styles.listLimit}>Showing the first {contacts.length} contacts. Search to find more.</p>
                )}
              </div>
            </section>

            <section className="contacts-detail-pane" aria-label="Selected contact details">
              {selected ? (
                <div className="contacts-detail">
                  <div className="contacts-detail-top"><p className="mail-overline">CONTACT PROFILE</p><button type="button" className="mail-toolbar-button" aria-label="Refresh contact list" title="Refresh contacts" onClick={() => setRefreshVersion((current) => current + 1)}>↻</button></div>
                  <div className="contacts-profile">
                    <span className={"mail-avatar mail-avatar-large tone-" + contactTone(selected.email)}>{initials(selected.name)}</span>
                    <h2>{selected.name}</h2>
                    <p>{selected.role || "Contact"}</p>
                    <span className="contacts-company-chip">{selected.company || "No company"}</span>
                    {selected.tags?.length > 0 && <div className={styles.tagList} aria-label="Contact tags">{selected.tags.map((tag) => <span className={styles.tagChip} key={tag}>{tag}</span>)}</div>}
                  </div>
                  <div className="contacts-information">
                    <p className="mail-overline">CONTACT INFORMATION</p>
                    <div className="contacts-info-item"><span>✉</span><div><small>Email address</small><strong>{selected.email}</strong></div><button type="button" aria-label="Copy email address" title="Copy email address" onClick={() => void copyEmail(selected.email)}>▣</button></div>
                    <div className="contacts-info-item"><span>⌕</span><div><small>Phone</small><strong>{selected.phone || "Not added"}</strong></div></div>
                    <div className="contacts-info-item"><span>▦</span><div><small>Company</small><strong>{selected.company || "Not added"}</strong></div></div>
                    {selected.notes && <div className={styles.notes}><small>Notes</small><p>{selected.notes}</p></div>}
                  </div>
                  <div className={styles.detailActions}>
                    <button className="mail-primary-action contacts-email-button" type="button" onClick={() => router.push(mailboxHref + "?composeTo=" + encodeURIComponent(selected.email))}>✉ Compose email</button>
                    <button className="mail-secondary-action" type="button" onClick={() => beginEdit(selected)}>Edit contact</button>
                    <button className={styles.deleteButton} type="button" onClick={() => setDeleteOpen(true)}>Delete</button>
                  </div>
                  <p className="mail-demo-footnote"><span className="mail-demo-dot" /> Saved in {organizationName}</p>
                </div>
              ) : (
                <div className="mail-detail-empty"><span>♙</span><h2>{loadError ? "Contacts unavailable" : "Select a contact"}</h2><p>{loadError || "Choose someone from the list to view their saved details."}</p></div>
              )}
            </section>
          </div>

          {notice && <div className="mail-toast contacts-toast" role="status"><span>i</span>{notice}<button type="button" aria-label="Dismiss notice" onClick={() => setNotice("")}>×</button></div>}
        </div>

      {formMode && (
        <div className="mail-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
          <section className="mail-compose-modal contacts-add-modal" role="dialog" aria-modal="true" aria-labelledby="contact-form-heading">
            <header className="mail-compose-header"><h2 id="contact-form-heading">{formMode === "edit" ? "Edit contact" : "Add contact"}</h2><button type="button" aria-label="Close contact form" onClick={closeForm} disabled={saving}>×</button></header>
            <form onSubmit={saveContact}>
              <div className="contacts-form-grid">
                <label className="settings-field"><span>Full name</span><input required maxLength={160} autoFocus value={formData.name} onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))} placeholder="Contact name" disabled={saving} /></label>
                <label className="settings-field"><span>Email address</span><input required type="email" maxLength={254} value={formData.email} onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))} placeholder="name@company.com" disabled={saving} /></label>
                <label className="settings-field"><span>Company</span><input maxLength={160} value={formData.company} onChange={(event) => setFormData((current) => ({ ...current, company: event.target.value }))} placeholder="Company name" disabled={saving} /></label>
                <label className="settings-field"><span>Role</span><input maxLength={120} value={formData.role} onChange={(event) => setFormData((current) => ({ ...current, role: event.target.value }))} placeholder="Role or title" disabled={saving} /></label>
                <label className="settings-field"><span>Phone</span><input maxLength={80} value={formData.phone} onChange={(event) => setFormData((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone number" disabled={saving} /></label>
              </div>
              <label className={"settings-field " + styles.notesField}><span>Tags</span><input maxLength={600} value={formData.tags} onChange={(event) => setFormData((current) => ({ ...current, tags: event.target.value }))} placeholder="customer, lead, priority" aria-describedby="contact-tags-hint" disabled={saving} /><small id="contact-tags-hint">Comma-separated labels, up to 12. Use letters, numbers, hyphens or underscores.</small></label>
              <label className={"settings-field " + styles.notesField}><span>Notes</span><textarea rows={3} maxLength={5000} value={formData.notes} onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))} placeholder="Useful context about this person (optional)" disabled={saving} /></label>
              {formError && <p className={styles.formError} role="alert">{formError}</p>}
              <footer className="mail-compose-footer"><button className="mail-primary-action" type="submit" disabled={saving}>{saving ? "Saving…" : formMode === "edit" ? "Save changes" : "Save contact"}</button><button className="mail-secondary-action" type="button" onClick={closeForm} disabled={saving}>Cancel</button></footer>
            </form>
          </section>
        </div>
      )}

      {deleteOpen && selected && (
        <div className="mail-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeleteOpen(false); }}>
          <section className={"mail-compose-modal " + styles.confirmModal} role="alertdialog" aria-modal="true" aria-labelledby="delete-contact-heading">
            <header className="mail-compose-header"><h2 id="delete-contact-heading">Delete contact?</h2><button type="button" aria-label="Close delete confirmation" onClick={() => setDeleteOpen(false)} disabled={deleting}>×</button></header>
            <div className={styles.confirmBody}><p><strong>{selected.name}</strong> will be removed from {organizationName}’s address book. This cannot be undone.</p><footer className="mail-compose-footer"><button className={styles.deleteConfirm} type="button" onClick={() => void deleteContact()} disabled={deleting}>{deleting ? "Deleting…" : "Delete contact"}</button><button className="mail-secondary-action" type="button" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</button></footer></div>
          </section>
        </div>
      )}
      </>
  );
}
