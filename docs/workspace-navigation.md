# ABEmail Workspace Navigation Contract

This document is the fixed navigation contract for the authenticated, organization-scoped ABEmail workspace.

## Non-negotiable shell rule

- Within authenticated, organization-scoped routes, `app/dashboard/[organizationId]/layout.tsx` is the only place that mounts `WorkspaceSidebar`. The public `/demo` route may reuse the component in demo mode, but it is outside the signed-in workspace and must not define or replace the production navigation map.
- Workspace route components render page content only. They must not import or render `WorkspaceSidebar`, or create their own `.mail-app` shell.
- `components/workspace-sidebar.tsx` is the single source of truth for the permanent navigation map and active-route behavior.
- Page-specific CSS modules must not style `.mail-sidebar`, `.mail-nav`, `.mail-nav-item`, the brand row, or the Compose control.
- Adding a feature means adding its canonical route/content and wiring that destination into the existing navigation map. It does not create a second sidebar, change global sidebar styling, or insert page-specific navigation into it.
- Settings subsections stay inside Settings content and never appear as children of the global sidebar.
- The root organization chooser is outside an active organization workspace and is not a second workspace shell.

## Locked global sidebar

### Mailbox

1. Inbox — `/dashboard/:organizationId/mail`
2. Starred — `/dashboard/:organizationId/mail?view=Starred`
3. Sent — `/dashboard/:organizationId/mail?view=Sent`
4. Drafts — `/dashboard/:organizationId/mail?view=Drafts`
5. Scheduled — `/dashboard/:organizationId/mail?view=Scheduled`
6. Snoozed — `/dashboard/:organizationId/mail?view=Snoozed`
7. Archive — `/dashboard/:organizationId/mail?view=Archive`
8. Trash — `/dashboard/:organizationId/mail?view=Trash`
9. Spam — `/dashboard/:organizationId/mail?view=Spam`

The existing mailbox list, query-based active states, collapse behavior, mobile drawer, and dimensions are shared across all workspace routes. Snoozed is reserved in the navigation contract; the snooze lifecycle itself remains a distinct feature implementation.

### Workspace

1. Contacts — `/dashboard/:organizationId/contacts`
2. Templates — `/dashboard/:organizationId/templates`
3. Reminders — `/dashboard/:organizationId/reminders`
4. Labels — `/dashboard/:organizationId/labels`
5. Analytics — `/dashboard/:organizationId/analytics`
6. Settings — `/dashboard/:organizationId/settings`

Templates includes the roadmap for reusable canned responses, the Brand Profile, and the branded-email visual designer. Reminders includes one-time reminders and follow-up nudges. Labels and Analytics are reserved for their Phase 2 roadmap work. The destinations exist in the fixed map so future implementations add page functionality without reshaping the sidebar.

### Settings navigation (inside the Settings page)

- General — `/settings`
- Appearance — `/settings/appearance`
- Mail & compose — `/settings/mail`
- Notifications — `/settings/notifications`
- Team & access — `/settings/team`
- Domains — `/settings/domains`
- Mailboxes & aliases — `/settings/mailboxes`
- Security — `/settings/security`
- Rules & filters — `/settings/rules`
- Out-of-office — `/settings/out-of-office`
- Brand profile — `/settings/branding`
- Integrations — `/settings/integrations`

These subsection links are rendered within the Settings page layout, never inside the global sidebar. Placeholder/roadmap destinations must describe their current capability honestly and must not use disabled “Soon” pills in the sidebar.

## Roadmap placement decisions

| Roadmap feature | Navigation destination |
| --- | --- |
| Snooze / Follow Up Later | Mailbox → Snoozed |
| Templates / Canned Responses | Workspace → Templates |
| Branded Email Templates & Visual Email Designer | Workspace → Templates, with Brand Profile at Settings → Brand profile |
| Reminders / Follow-up Nudges | Workspace → Reminders |
| Labels / Custom Folders | Workspace → Labels |
| Rules / Incoming Filters | Settings → Rules & filters |
| Out-of-Office / Vacation Responder | Settings → Out-of-office |
| Email Aliases | Settings → Mailboxes & aliases |
| Shared Mailboxes / Delegation | Settings → Team & access and Mailboxes & aliases; mailbox-specific actions stay in the mailbox experience |
| Improved Conversation / Thread View | Existing message reader, not a new global tab |
| Advanced Search | Existing search control and search results, not a new global tab |
| Delivery Analytics | Workspace → Analytics |
| Calendar, CRM, cloud storage | Settings → Integrations |
| AI summaries, reply suggestions, task extraction, smart follow-up intelligence | Contextual actions in the reader, composer, and Reminders; no extra global tabs |

## Review checklist for future PRs

- [ ] The sidebar is rendered only by the organization layout.
- [ ] All page destinations work under the selected organization and preserve membership checks.
- [ ] Active mailbox state derives from the route/query, not page-specific props.
- [ ] Compose has the same control, label, and route everywhere.
- [ ] No “Coming soon”/“Soon” badges or disabled route links are added to the sidebar.
- [ ] No page-specific stylesheet changes global sidebar dimensions, typography, gaps, icons, or interactions.
- [ ] Settings subsections remain within Settings content.
- [ ] Desktop, collapsed, and mobile states have been checked before merging.
