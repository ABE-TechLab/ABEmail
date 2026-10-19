"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import WorkspaceSidebar from "@/components/workspace-sidebar";

type Folder = "Inbox" | "Sent" | "Drafts" | "Scheduled" | "Snoozed" | "Archive" | "Trash" | "Spam";
type View = Folder | "Starred" | "Contacts";
type Tone = "green" | "amber" | "violet" | "blue" | "rose" | "slate";

type Mail = {
  id: string;
  from: string;
  email: string;
  to: string;
  subject: string;
  preview: string;
  body: string;
  date: string;
  time: string;
  folder: Folder;
  unread: boolean;
  starred: boolean;
  tone: Tone;
  attachments?: string[];
};

type Contact = { id: string; name: string; email: string; role: string; company: string; tone: Tone };

const DEMO_MAIL: Mail[] = [
  { id: "m1", from: "Maya Chen", email: "maya@northstar.design", to: "you@acmestudio.example", subject: "Project update and next steps", preview: "Sharing the latest notes for our team before tomorrow's review.", body: "Hi team,\n\nI've pulled together the latest project notes and decisions from this afternoon. The updated files are ready for review, and I've highlighted two questions we'd like to settle before tomorrow's session.\n\nPlease take a look when you have a moment. Looking forward to getting this over the line together.\n\nThanks,\nMaya", date: "Today", time: "10:42 AM", folder: "Inbox", unread: true, starred: true, tone: "green", attachments: ["Project-notes.pdf", "Sprint-plan.docx"] },
  { id: "m2", from: "James Okafor", email: "james@acmestudio.example", to: "you@acmestudio.example", subject: "Re: Product review", preview: "Thanks for sending this through. I've added a few notes.", body: "Hello,\n\nThanks for sending this through. I've added a few notes to the review document and left comments where we need a decision. The overall direction looks good to me.\n\nLet's run through the open items at the stand-up.\n\nJames", date: "Today", time: "9:18 AM", folder: "Inbox", unread: true, starred: false, tone: "amber" },
  { id: "m3", from: "People & Culture", email: "people@acmestudio.example", to: "you@acmestudio.example", subject: "Weekly team digest", preview: "Here's what is happening across the company this week.", body: "Hello everyone,\n\nHere is this week's team digest with upcoming events, important dates, and a few updates from across the company.\n\nPlease check the calendar for the updated schedule.\n\nPeople & Culture", date: "Yesterday", time: "4:32 PM", folder: "Inbox", unread: false, starred: false, tone: "violet" },
  { id: "m4", from: "Tunde Adebayo", email: "tunde@brightpath.co", to: "you@acmestudio.example", subject: "Invoice for October", preview: "Please find the October invoice attached for your records.", body: "Hello,\n\nPlease find the October invoice attached for your records. Let me know if you need anything adjusted or if your accounts team needs additional details.\n\nRegards,\nTunde", date: "Yesterday", time: "1:06 PM", folder: "Inbox", unread: false, starred: false, tone: "blue", attachments: ["Invoice-October.pdf"] },
  { id: "m5", from: "Nina Williams", email: "nina@fieldnotes.studio", to: "you@acmestudio.example", subject: "Workshop availability", preview: "Would Thursday afternoon work for the discovery workshop?", body: "Hi,\n\nWould Thursday afternoon work for the discovery workshop? We can keep it to 45 minutes and use the time to align on the priorities for the next sprint.\n\nBest,\nNina", date: "Mon", time: "11:24 AM", folder: "Inbox", unread: false, starred: true, tone: "rose" },
  { id: "m6", from: "You", email: "you@acmestudio.example", to: "partners@northstar.design", subject: "Notes from our planning session", preview: "Thanks again for the productive conversation today.", body: "Hello,\n\nThanks again for the productive conversation today. I've captured the key decisions and next steps so everyone has the same reference point.\n\nBest regards", date: "Today", time: "11:02 AM", folder: "Sent", unread: false, starred: false, tone: "slate" },
  { id: "m7", from: "Draft", email: "you@acmestudio.example", to: "", subject: "Q4 planning follow-up", preview: "A few thoughts on the priorities we discussed…", body: "A few thoughts on the priorities we discussed...", date: "Mon", time: "3:40 PM", folder: "Drafts", unread: false, starred: false, tone: "slate" },
  { id: "m8", from: "Scheduled message", email: "you@acmestudio.example", to: "maya@northstar.design", subject: "Workshop agenda", preview: "A draft agenda for next week's collaborative workshop.", body: "Hi Maya,\n\nHere is a proposed agenda for next week's workshop.\n\n1. Review goals\n2. Confirm open questions\n3. Agree on owners and next steps\n\nBest", date: "Tomorrow", time: "8:30 AM", folder: "Scheduled", unread: false, starred: false, tone: "slate" },
  { id: "m9", from: "Olivia Parker", email: "olivia@northstar.design", to: "you@acmestudio.example", subject: "Brand assets approved", preview: "The final set of brand assets has been approved.", body: "Hi,\n\nThe final set of brand assets has been approved. Thank you for the thoughtful work and quick turnaround.\n\nOlivia", date: "Oct 8", time: "2:14 PM", folder: "Archive", unread: false, starred: false, tone: "blue" },
  { id: "m10", from: "Sample notification", email: "notifications@example.test", to: "you@acmestudio.example", subject: "Example message in Trash", preview: "Sample data demonstrating the Trash view.", body: "This is illustrative sample content only.", date: "Oct 7", time: "8:11 AM", folder: "Trash", unread: false, starred: false, tone: "slate" },
  { id: "m11", from: "Product Bulletin", email: "bulletin@example.test", to: "you@acmestudio.example", subject: "Weekly product digest", preview: "Sample content demonstrating the Spam view.", body: "This is illustrative sample content only and is not connected to a mail server.", date: "Oct 6", time: "7:20 AM", folder: "Spam", unread: false, starred: false, tone: "slate" },
];

const DEMO_CONTACTS: Contact[] = [
  { id: "c1", name: "Maya Chen", email: "maya@northstar.design", role: "Project lead", company: "Northstar Design", tone: "green" },
  { id: "c2", name: "James Okafor", email: "james@acmestudio.example", role: "Product manager", company: "Acme Studio", tone: "amber" },
  { id: "c3", name: "Nina Williams", email: "nina@fieldnotes.studio", role: "Creative director", company: "Fieldnotes Studio", tone: "rose" },
  { id: "c4", name: "Tunde Adebayo", email: "tunde@brightpath.co", role: "Accounts", company: "Brightpath", tone: "blue" },
  { id: "c5", name: "Olivia Parker", email: "olivia@northstar.design", role: "Brand designer", company: "Northstar Design", tone: "violet" },
];

const FOLDERS: { name: View; icon: string }[] = [
  { name: "Inbox", icon: "▤" },
  { name: "Starred", icon: "☆" },
  { name: "Sent", icon: "↗" },
  { name: "Drafts", icon: "▧" },
  { name: "Scheduled", icon: "◷" },
  { name: "Snoozed", icon: "◴" },
  { name: "Archive", icon: "▱" },
  { name: "Trash", icon: "⌫" },
  { name: "Spam", icon: "⊘" },
];

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Mail[]>(DEMO_MAIL);
  const [activeView, setActiveView] = useState<View>("Inbox");

  const [selectedId, setSelectedId] = useState<string | null>("m1");
  const [selectedContactId, setSelectedContactId] = useState("c1");
  const [query, setQuery] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [toast, setToast] = useState("");
  useEffect(() => {
    const requestedView = searchParams.get("view");
    const matchingFolder = FOLDERS.find((folder) => folder.name === requestedView);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Mirror route state in the interactive sample.
    if (matchingFolder) setActiveView(matchingFolder.name);
    else if (requestedView === "Starred") setActiveView("Starred");

    if (searchParams.get("compose") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Open compose from the sidebar's URL action.
      setComposeOpen(true);
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete("compose");
      router.replace(currentUrl.pathname + currentUrl.search, { scroll: false });
    }
  }, [searchParams, router]);

  const visibleMessages = useMemo(() => {
    if (activeView === "Contacts") return [];
    const list = messages.filter((message) => activeView === "Starred" ? message.starred && message.folder !== "Trash" : message.folder === activeView);
    const term = query.trim().toLowerCase();
    return term ? list.filter((message) => [message.from, message.email, message.to, message.subject, message.preview, message.body].join(" ").toLowerCase().includes(term)) : list;
  }, [activeView, messages, query]);
  const selectedMessage = visibleMessages.find((message) => message.id === selectedId) ?? visibleMessages[0] ?? null;
  const visibleContacts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return DEMO_CONTACTS.filter((contact) => [contact.name, contact.email, contact.company, contact.role].join(" ").toLowerCase().includes(term));
  }, [query]);
  const selectedContact = visibleContacts.find((contact) => contact.id === selectedContactId) ?? visibleContacts[0] ?? null;

  function notify(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 3000);
  }

  function openMessage(message: Mail) {
    setSelectedId(message.id);
    if (message.unread) setMessages((current) => current.map((item) => item.id === message.id ? { ...item, unread: false } : item));
  }

  function toggleStar(id: string) {
    setMessages((current) => current.map((message) => message.id === id ? { ...message, starred: !message.starred } : message));
  }

  function moveMessage(message: Mail, folder: "Archive" | "Trash") {
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, folder } : item));
    setSelectedId(null);
    notify(folder === "Archive" ? "Moved to Archive for this demo session." : "Moved to Trash for this demo session.");
  }

  function compose(to = "", subject = "", body = "") {
    setComposeTo(to);
    setComposeSubject(subject);
    setComposeBody(body);
    setComposeOpen(true);
  }

  function reply(message: Mail) {
    compose(message.email, message.subject.toLowerCase().startsWith("re:") ? message.subject : `Re: ${message.subject}`, `\n\n—\nOn ${message.date}, ${message.from} wrote:\n> ${message.preview}`);
  }

  function saveDraft() {
    const draft: Mail = {
      id: `draft-${Date.now()}`, from: "Draft", email: "you@acmestudio.example", to: composeTo,
      subject: composeSubject || "(no subject)", preview: composeBody || "No message content", body: composeBody,
      date: "Just now", time: "Now", folder: "Drafts", unread: false, starred: false, tone: "slate",
    };
    setMessages((current) => [draft, ...current]);
    setComposeOpen(false);
    setActiveView("Drafts");
    setSelectedId(draft.id);
    notify("Draft saved in this browser session only.");
  }

  function requestSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    notify("Sending is not connected yet. Your message has not been sent.");
  }

  return (
    <main className="mail-app">
      <WorkspaceSidebar
        composeHref="/demo?compose=1"
        homeHref="/demo"
        mailboxBaseHref="/demo"
        workspaceName="ABEmail demo"
        workspaceDescription="Sample workspace"
        workspaceBaseHref="/demo"
        workspaces={[]}
        activeWorkspaceId=""
        showWorkspaceLinks={false}
      />

      <section className="mail-main">
        <header className="mail-topbar">
          <div className="mail-breadcrumb"><span>Workspace</span><span className="mail-breadcrumb-slash">/</span><strong>{activeView}</strong></div>
          <label className="mail-search"><span className="mail-search-icon" aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={activeView === "Contacts" ? "Search contacts..." : "Search mail"} aria-label={activeView === "Contacts" ? "Search contacts" : "Search mail"} />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>×</button>}{!query && <kbd>⌘ K</kbd>}</label>
          <div className="mail-topbar-right"><span className="mail-development-pill"><span /> Demo mode</span><button className="mail-icon-button" type="button" aria-label="Notifications" onClick={() => notify("Notifications will be connected to platform events later.")}>♧</button><button className="mail-user-avatar" type="button" aria-label="Account menu" onClick={() => notify("Sign in to manage your workspace account.")}>AR</button></div>
        </header>

        <div className="mail-content-layout">
          <section className="mail-list-pane" aria-label={activeView === "Contacts" ? "Contacts list" : `${activeView} messages`}>
            <div className="mail-list-heading"><div><p className="mail-overline">{activeView === "Contacts" ? "ADDRESS BOOK" : "YOUR MAIL"}</p><h1>{activeView}</h1><p className="mail-list-subtitle">{activeView === "Contacts" ? `${visibleContacts.length} sample contacts` : `${visibleMessages.length} messages in this view`}</p></div>{activeView === "Contacts" ? <button className="mail-small-action" type="button" onClick={() => notify("Add contact will be enabled with contact persistence.")}>＋ Add contact</button> : <button className="mail-icon-button" type="button" aria-label="Refresh list" onClick={() => notify("You're viewing sample data; there is no mail server to refresh yet.")}>↻</button>}</div>

            {activeView !== "Contacts" && <div className="mail-list-toolbar"><label className="mail-select-all"><input type="checkbox" aria-label="Select all visible messages" onChange={() => notify("Bulk actions will be enabled with persistent mailbox storage.")} /><span /></label><span className="mail-toolbar-label">Recent</span><span className="mail-toolbar-spacer" /><button type="button" aria-label="Sort messages" className="mail-toolbar-button" onClick={() => notify("Sample messages are shown in demo order.")}>⇅</button></div>}

            {activeView === "Contacts" ? <div className="mail-message-list">
              {visibleContacts.map((contact) => <button className={selectedContact?.id === contact.id ? "mail-contact-row selected" : "mail-contact-row"} key={contact.id} onClick={() => setSelectedContactId(contact.id)} type="button"><span className={`mail-avatar tone-${contact.tone}`}>{initials(contact.name)}</span><span className="mail-contact-copy"><strong>{contact.name}</strong><small>{contact.email}</small><em>{contact.company}</em></span></button>)}
              {visibleContacts.length === 0 && <div className="mail-empty-list"><span>♙</span><strong>No matching contacts</strong><p>Try another name or email address.</p></div>}
            </div> : <div className="mail-message-list">
              {visibleMessages.map((message) => <article className={selectedMessage?.id === message.id ? "mail-message-row selected" : message.unread ? "mail-message-row unread" : "mail-message-row"} key={message.id}>
                <button className="mail-message-open" onClick={() => openMessage(message)} type="button" aria-label={`Open ${message.subject}`}><span className={`mail-avatar tone-${message.tone}`}>{initials(message.from)}</span><span className="mail-message-copy"><span className="mail-message-row-top"><strong>{message.from}</strong><time>{message.date === "Today" ? message.time.replace(" AM", "").replace(" PM", "") : message.date}</time></span><span className="mail-message-subject">{message.subject || "(no subject)"}</span><span className="mail-message-preview">{message.preview}</span>{message.attachments && <span className="mail-attachment-mini">▧ {message.attachments.length} attachment{message.attachments.length > 1 ? "s" : ""}</span>}</span></button>
                <button type="button" className={message.starred ? "mail-star-button starred" : "mail-star-button"} aria-label={message.starred ? "Remove star" : "Star message"} onClick={() => toggleStar(message.id)}>{message.starred ? "★" : "☆"}</button>{message.unread && <span className="mail-unread-dot" aria-label="Unread" />}
              </article>)}
              {visibleMessages.length === 0 && <div className="mail-empty-list"><span>▤</span><strong>{query ? "No matching messages" : `No messages in ${activeView}`}</strong><p>{query ? "Try another search term." : "Messages for this view will appear here."}</p>{activeView === "Inbox" && !query && <button type="button" onClick={() => compose()}>Compose a message</button>}</div>}
            </div>}
          </section>

          <section className="mail-detail-pane" aria-label={activeView === "Contacts" ? "Contact details" : "Message details"}>
            {activeView === "Contacts" ? selectedContact ? <div className="mail-contact-detail"><div className="mail-detail-actions"><span className="mail-overline">CONTACT CARD</span><button type="button" className="mail-toolbar-button" aria-label="More contact actions" onClick={() => notify("Additional contact actions will follow.")}>•••</button></div><div className="mail-contact-profile"><span className={`mail-avatar mail-avatar-large tone-${selectedContact.tone}`}>{initials(selectedContact.name)}</span><h2>{selectedContact.name}</h2><p>{selectedContact.role}</p><span className="mail-contact-company">{selectedContact.company}</span></div><div className="mail-contact-detail-section"><p className="mail-overline">CONTACT INFORMATION</p><span className="mail-detail-field-label">Email address</span><strong>{selectedContact.email}</strong></div><button className="mail-primary-action mail-contact-email" type="button" onClick={() => compose(selectedContact.email)}>✉ Email contact</button><p className="mail-demo-footnote">Sample contact record · Not saved to a database</p></div> : <div className="mail-detail-empty"><span>♙</span><h2>Select a contact</h2><p>Choose a contact to view details.</p></div> : selectedMessage ? <div className="mail-message-detail">
              <div className="mail-detail-actions"><div className="mail-detail-action-group"><button type="button" className="mail-toolbar-button" aria-label="Archive message" onClick={() => moveMessage(selectedMessage, "Archive")}>▱</button><button type="button" className="mail-toolbar-button" aria-label="Move message to Trash" onClick={() => moveMessage(selectedMessage, "Trash")}>⌫</button><span className="mail-action-divider" /><button type="button" className="mail-toolbar-button" aria-label={selectedMessage.unread ? "Mark as read" : "Mark as unread"} onClick={() => setMessages((current) => current.map((item) => item.id === selectedMessage.id ? { ...item, unread: !item.unread } : item))}>{selectedMessage.unread ? "●" : "○"}</button></div><div className="mail-detail-action-group"><button type="button" className={selectedMessage.starred ? "mail-toolbar-button starred" : "mail-toolbar-button"} aria-label={selectedMessage.starred ? "Remove star" : "Star message"} onClick={() => toggleStar(selectedMessage.id)}>{selectedMessage.starred ? "★" : "☆"}</button><button type="button" className="mail-toolbar-button" aria-label="More message actions" onClick={() => notify("More actions will follow with persistent mailbox workflows.")}>•••</button></div></div>
              <div className="mail-detail-scroll"><div className="mail-subject-line"><h2>{selectedMessage.subject || "(no subject)"}</h2>{selectedMessage.starred && <span className="mail-detail-star">★</span>}</div><div className="mail-message-meta"><span className={`mail-avatar tone-${selectedMessage.tone}`}>{initials(selectedMessage.from)}</span><div className="mail-sender-info"><strong>{selectedMessage.from}</strong><span>{selectedMessage.folder === "Sent" ? `to ${selectedMessage.to}` : selectedMessage.email}</span></div><time>{selectedMessage.date}, {selectedMessage.time}</time></div>
                <div className="mail-message-body">{selectedMessage.body.split("\n").map((line, index) => line ? <p key={index}>{line}</p> : <div key={index} className="mail-body-spacer" />)}</div>
                {selectedMessage.attachments && <div className="mail-attachments"><p className="mail-overline">ATTACHMENTS <span>· {selectedMessage.attachments.length} files</span></p><div className="mail-attachment-list">{selectedMessage.attachments.map((file) => <div className="mail-attachment" key={file}><span>▧</span><div><strong>{file}</strong><small>Sample attachment · preview only</small></div><button type="button" aria-label={`Download ${file}`} onClick={() => notify("Sample attachments cannot be downloaded.")}>↓</button></div>)}</div></div>}
                <div className="mail-reply-actions"><button type="button" className="mail-primary-action" onClick={() => reply(selectedMessage)}>↶ Reply</button><button type="button" className="mail-secondary-action" onClick={() => compose("", `Fwd: ${selectedMessage.subject}`, `\n\n---------- Forwarded message ----------\nFrom: ${selectedMessage.from} <${selectedMessage.email}>\nSubject: ${selectedMessage.subject}\n\n${selectedMessage.body}`)}>↗ Forward</button></div><div className="mail-demo-footnote"><span className="mail-demo-dot" /> Illustrative sample data · Email is not connected</div>
              </div>
            </div> : <div className="mail-detail-empty"><span>✉</span><h2>Select a message</h2><p>Choose a message from the list to read it here.</p></div>}
          </section>
        </div>
      </section>

      {composeOpen && <div className="mail-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setComposeOpen(false); }}><section className="mail-compose-modal" role="dialog" aria-modal="true" aria-labelledby="compose-heading"><header className="mail-compose-header"><h2 id="compose-heading">New message</h2><button type="button" aria-label="Close compose" onClick={() => setComposeOpen(false)}>×</button></header><form onSubmit={requestSend}><label className="mail-compose-field"><span>To</span><input value={composeTo} onChange={(event) => setComposeTo(event.target.value)} type="email" placeholder="name@company.com" /></label><label className="mail-compose-field"><span>Subject</span><input value={composeSubject} onChange={(event) => setComposeSubject(event.target.value)} placeholder="Add a subject" /></label><label className="mail-compose-body-label"><span className="mail-sr-only">Message body</span><textarea autoFocus value={composeBody} onChange={(event) => setComposeBody(event.target.value)} placeholder="Write your message..." rows={9} /></label><div className="mail-compose-warning"><span>i</span> Demo mode: messages cannot be sent yet.</div><footer className="mail-compose-footer"><button className="mail-primary-action" type="submit">Send <span>↗</span></button><button className="mail-secondary-action" type="button" onClick={saveDraft}>Save draft</button><button className="mail-compose-discard" type="button" onClick={() => setComposeOpen(false)}>Discard</button></footer></form></section></div>}
      {toast && <div className="mail-toast" role="status"><span>i</span>{toast}</div>}
    </main>
  );
}
