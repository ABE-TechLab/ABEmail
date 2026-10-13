"use client";

import { useMemo, useState, type FormEvent } from "react";
import WorkspaceSidebar from "@/components/workspace-sidebar";

type Contact = {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  phone: string;
  tone: "green" | "amber" | "violet" | "blue" | "rose" | "slate";
};

const starterContacts: Contact[] = [
  { id: "c1", name: "Maya Chen", email: "maya@northstar.design", role: "Project lead", company: "Northstar Design", phone: "+1 415 555 0103", tone: "green" },
  { id: "c2", name: "James Okafor", email: "james@acmestudio.example", role: "Product manager", company: "Acme Studio", phone: "+234 803 555 0182", tone: "amber" },
  { id: "c3", name: "Nina Williams", email: "nina@fieldnotes.studio", role: "Creative director", company: "Fieldnotes Studio", phone: "+44 20 7946 0315", tone: "rose" },
  { id: "c4", name: "Tunde Adebayo", email: "tunde@brightpath.co", role: "Accounts", company: "Brightpath", phone: "+234 809 555 0144", tone: "blue" },
  { id: "c5", name: "Olivia Parker", email: "olivia@northstar.design", role: "Brand designer", company: "Northstar Design", phone: "+1 212 555 0124", tone: "violet" },
];

function initials(value: string) {
  return value.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>(starterContacts);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>("c1");
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [notice, setNotice] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return contacts.filter((contact) => [contact.name, contact.email, contact.company, contact.role].join(" ").toLowerCase().includes(term));
  }, [contacts, query]);
  const selected = filtered.find((contact) => contact.id === selectedId) ?? filtered[0] ?? null;

  function createContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const newContact: Contact = {
      id: `c-${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      company: company.trim() || "No company",
      role: role.trim() || "Contact",
      phone: "Not added",
      tone: "slate",
    };
    if (contacts.some((contact) => contact.email.toLowerCase() === newContact.email)) {
      setNotice("A contact with this email already exists in the sample list.");
      return;
    }
    setContacts((current) => [newContact, ...current]);
    setSelectedId(newContact.id);
    setName("");
    setEmail("");
    setCompany("");
    setRole("");
    setAddOpen(false);
    setNotice("Contact added in this browser session only. It has not been saved to a database.");
  }

  return (
    <main className="mail-app">
      <WorkspaceSidebar />
      <section className="mail-main">
        <header className="mail-topbar">
          <div className="mail-breadcrumb"><span>Workspace</span><span className="mail-breadcrumb-slash">/</span><strong>Contacts</strong></div>
          <label className="mail-search"><span className="mail-search-icon" aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search contacts" aria-label="Search contacts" />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>×</button>}{!query && <kbd>Search</kbd>}</label>
          <div className="mail-topbar-right"><span className="mail-development-pill"><span /> Demo mode</span><span className="mail-user-avatar" aria-label="Sample user">AR</span></div>
        </header>

        <div className="contacts-page">
          <header className="contacts-heading"><div><p className="mail-overline">WORKSPACE DIRECTORY</p><h1>Contacts</h1><p>Keep key people and their details close to your conversations.</p></div><button className="mail-primary-action" type="button" onClick={() => setAddOpen(true)}>＋ Add contact</button></header>
          <div className="contacts-workspace">
            <section className="contacts-list-pane" aria-label="Contacts list">
              <div className="contacts-list-heading"><strong>All contacts</strong><span>{filtered.length} of {contacts.length}</span></div>
              <div className="contacts-list">
                {filtered.map((contact) => <button className={selected?.id === contact.id ? "contacts-row selected" : "contacts-row"} type="button" key={contact.id} onClick={() => setSelectedId(contact.id)}>
                  <span className={`mail-avatar tone-${contact.tone}`}>{initials(contact.name)}</span><span className="contacts-row-copy"><strong>{contact.name}</strong><small>{contact.email}</small><em>{contact.company}</em></span><span className="contacts-row-arrow">›</span>
                </button>)}
                {filtered.length === 0 && <div className="mail-empty-list"><span>♙</span><strong>No contacts found</strong><p>Try another search or add a contact.</p><button type="button" onClick={() => setAddOpen(true)}>＋ Add contact</button></div>}
              </div>
            </section>

            <section className="contacts-detail-pane" aria-label="Selected contact details">
              {selected ? <div className="contacts-detail">
                <div className="contacts-detail-top"><p className="mail-overline">CONTACT PROFILE</p><button type="button" className="mail-toolbar-button" aria-label="Contact actions" onClick={() => setNotice("More contact actions will be implemented with database persistence.")}>•••</button></div>
                <div className="contacts-profile">
                  <span className={`mail-avatar mail-avatar-large tone-${selected.tone}`}>{initials(selected.name)}</span><h2>{selected.name}</h2><p>{selected.role}</p><span className="contacts-company-chip">{selected.company}</span>
                </div>
                <div className="contacts-information"><p className="mail-overline">CONTACT INFORMATION</p><div className="contacts-info-item"><span>✉</span><div><small>Email address</small><strong>{selected.email}</strong></div><button type="button" aria-label="Copy email address" onClick={() => { void navigator.clipboard?.writeText(selected.email).then(() => setNotice("Email address copied."), () => setNotice(selected.email)); }}>▣</button></div><div className="contacts-info-item"><span>⌕</span><div><small>Phone</small><strong>{selected.phone}</strong></div></div><div className="contacts-info-item"><span>▦</span><div><small>Company</small><strong>{selected.company}</strong></div></div></div>
                <button className="mail-primary-action contacts-email-button" type="button" onClick={() => setNotice(`Compose will open for ${selected.email} when the mailbox composer is connected across routes.`)}>✉ Email contact</button>
                <p className="mail-demo-footnote"><span className="mail-demo-dot" /> Sample contact · changes are local to this browser session</p>
              </div> : <div className="mail-detail-empty"><span>♙</span><h2>Select a contact</h2><p>Choose someone from the list to view details.</p></div>}
            </section>
          </div>
          {notice && <div className="mail-toast contacts-toast" role="status"><span>i</span>{notice}<button type="button" aria-label="Dismiss notice" onClick={() => setNotice("")}>×</button></div>}
        </div>
      </section>

      {addOpen && <div className="mail-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddOpen(false); }}><section className="mail-compose-modal contacts-add-modal" role="dialog" aria-modal="true" aria-labelledby="add-contact-heading"><header className="mail-compose-header"><h2 id="add-contact-heading">Add contact</h2><button type="button" aria-label="Close add contact" onClick={() => setAddOpen(false)}>×</button></header><form onSubmit={createContact}><div className="contacts-form-grid"><label className="settings-field"><span>Full name</span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Contact name" /></label><label className="settings-field"><span>Email address</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" /></label><label className="settings-field"><span>Company</span><input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Company name" /></label><label className="settings-field"><span>Role</span><input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Role or title" /></label></div><div className="mail-compose-warning"><span>i</span> Contacts are sample data and will not be saved to a server.</div><footer className="mail-compose-footer"><button className="mail-primary-action" type="submit">Add contact</button><button className="mail-secondary-action" type="button" onClick={() => setAddOpen(false)}>Cancel</button></footer></form></section></div>}
    </main>
  );
}
