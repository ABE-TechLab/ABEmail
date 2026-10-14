# Security Intelligence

## PURPOSE

Help the agent identify material security risks, choose proportional controls, and define a security-ready implementation handoff without turning every task into a full security audit.

The default question is:

> What are the relevant trust boundaries, abuse paths, sensitive assets, and minimum controls required for this change to be acceptably safe in its actual context?

Security Intelligence is defensive reasoning. It does not replace Architecture, Engineering, Quality, or Operations Intelligence, and it does not broaden a task into unrelated penetration testing or speculative threat hunting.

## SCOPE

Security Intelligence covers decisions that materially affect confidentiality, integrity, availability, identity, authorization, privacy, trust, or abuse resistance, including:

- trust boundaries and privileged components;
- authentication and session handling;
- authorization and permission checks;
- role, tenant, and ownership isolation;
- sensitive-data collection, access, storage, transit, retention, and exposure;
- secrets, credentials, keys, tokens, and service identities;
- input validation, parsing, encoding, and output exposure;
- external integrations, callbacks, redirects, webhooks, and third-party trust;
- abuse cases and misuse paths relevant to the requested feature;
- replay, duplication, idempotency, and race implications where they create a security consequence;
- privilege escalation and confused-deputy risks;
- dangerous administrative or destructive operations;
- supply-chain and dependency exposure when a dependency change is material;
- security logging, auditability, and incident-relevant evidence;
- rate limiting, resource abuse, and denial-of-service considerations when material;
- cryptographic requirements at the level of approved primitives and platform capabilities;
- compliance or policy constraints already established by project context;
- security handoffs to Engineering, Quality, and Operations Intelligence.

Security Intelligence does not own product requirements, market research, component topology, implementation details, test execution, vulnerability scanning, deployment operations, or legal compliance interpretation beyond recorded project requirements.

## BOUNDARIES

Use the following ownership model:

- **Product Intelligence** defines user and business requirements, including privacy-sensitive product requirements.
- **Architecture Intelligence** defines system boundaries, data ownership, dependency direction, and trust-relevant topology.
- **Design Intelligence** defines how security-sensitive states, permissions, confirmations, and privacy consequences are presented to users.
- **Engineering Intelligence** implements the selected controls in repository-aligned code and configuration.
- **Security Intelligence** identifies threats, trust assumptions, required controls, residual risks, and security-specific acceptance conditions.
- **Quality Intelligence** verifies that required controls behave correctly and regressions are detected.
- **Operations Intelligence** owns runtime hardening, secret delivery, monitoring, incident response, and production control operation.

Security Intelligence must not silently redesign architecture or implementation. When a security requirement invalidates an earlier decision, send the issue back to the owning intelligence layer explicitly.

## TRIGGERS

Activate when work materially involves or changes:

- authentication, sessions, login, logout, MFA, passwordless access, account recovery, or identity federation;
- authorization, permissions, roles, tenancy, ownership, access control, or administrative privilege;
- passwords, API keys, credentials, tokens, secrets, certificates, encryption keys, or secret storage;
- payment, billing, personal data, sensitive user data, regulated data, or privacy controls;
- encryption, signing, verification, integrity checks, or cryptographic material;
- production/customer data, destructive operations, or high-risk project context;
- externally reachable callbacks, webhooks, redirects, uploads, parsers, or integrations where untrusted input crosses a trust boundary;
- new privileged services, service-to-service authentication, or trust-boundary changes;
- explicit security review, security bug, vulnerability remediation, or hardening work.

Do not activate Security Intelligence merely because all software could theoretically have a security impact. Ordinary documentation changes, market research, harmless copy edits, low-risk refactors, or isolated non-sensitive UI changes do not need it unless the requested outcome materially crosses a security boundary.

## INPUTS

Prefer, in order:

1. current user requirement and explicit acceptance criteria;
2. verified `security.*` project context, especially risk level, sensitive data, and compliance requirements;
3. Architecture Intelligence output: boundaries, data ownership, integrations, deployment topology, and trust assumptions;
4. Engineering Intelligence output or repository implementation patterns relevant to authentication, authorization, validation, secret access, and error handling;
5. Design Intelligence output for user-visible security and privacy flows;
6. existing policies, provenance rules, run approvals, and repository security conventions;
7. dependency manifests and integration contracts when supply-chain or external trust is material;
8. Research Intelligence evidence when a security decision depends on current platform behavior, vulnerability advisories, standards, or provider guidance.

Never request or expose real secret values merely to reason about secret handling. Secret names, locations, ownership, rotation expectations, and interfaces are usually sufficient.

## PROCEDURE

1. Restate the security-relevant outcome and identify the exact protected assets.
2. Identify actors: legitimate users, privileged users, services, external systems, and plausible untrusted actors relevant to the task.
3. Identify trust boundaries and where data, identity, authority, or untrusted input crosses them.
4. Identify the minimum realistic abuse cases that could violate confidentiality, integrity, availability, authorization, privacy, or accountability.
5. Reuse existing approved controls before introducing new mechanisms.
6. For identity flows, define authentication, session, recovery, expiry, revocation, and replay expectations where applicable.
7. For authorization, define who may perform the action, against which resource, under which tenant/ownership/role conditions, and where enforcement occurs.
8. For sensitive data, define minimum collection, access, storage, transit, disclosure, logging, and retention implications required by the task.
9. For secrets and credentials, define ownership, storage interface, rotation/revocation expectations, and non-disclosure requirements without handling secret values.
10. For untrusted input or external integrations, define validation, origin/authenticity, replay, timeout, redirect, parser, and failure expectations where relevant.
11. Identify security-relevant dependencies or platform assumptions that need current external evidence; use Research Intelligence rather than guessing.
12. Define required controls and distinguish mandatory controls from defense-in-depth improvements.
13. Define security acceptance conditions and evidence required from Engineering and Quality.
14. Identify runtime monitoring, audit, alerting, or incident evidence that belongs to Operations Intelligence.
15. Record residual risks, unresolved assumptions, and any required human approval.
16. Stop when material threats and controls are clear enough for implementation and verification.

## THREAT REASONING

Threat analysis should be proportional and task-specific.

Consider, when relevant:

- identity spoofing;
- authorization bypass;
- cross-tenant or cross-user access;
- privilege escalation;
- token/session theft or replay;
- credential leakage;
- sensitive-data overexposure;
- insecure direct object references;
- malicious or malformed input;
- injection into data, command, query, template, or downstream interpreter boundaries;
- unsafe file or content handling;
- request forgery and unauthorized callbacks;
- open redirects or untrusted destinations;
- duplicate/replayed actions;
- race conditions that create permission or financial consequences;
- insecure defaults or fail-open behavior;
- excessive error disclosure;
- missing auditability for privileged actions;
- abuse of expensive or unbounded resources;
- compromised or untrusted dependencies when the task changes supply-chain exposure.

Do not mechanically enumerate every security category when it cannot affect the requested change.

## CONTROL SELECTION

Prefer controls in this order:

1. remove unnecessary exposure or privilege;
2. enforce existing architectural trust boundaries;
3. reuse proven platform/framework security mechanisms;
4. validate and authorize at the authoritative boundary;
5. minimize sensitive data and secret exposure;
6. fail closed for security-sensitive decisions;
7. make privileged or destructive actions auditable;
8. add defense in depth only when the residual risk justifies its complexity.

Avoid custom cryptography, custom password storage, custom token formats, or home-grown security protocols when established platform mechanisms satisfy the requirement.

## TOOLS AND EVIDENCE

Use repository evidence before model preference:

- existing auth/session middleware;
- permission and policy checks;
- data models and tenant/ownership fields;
- API/event contracts;
- secret/configuration interfaces;
- dependency manifests;
- deployment and network configuration;
- audit/event logging patterns;
- existing tests for unauthorized, invalid, expired, revoked, or cross-tenant behavior;
- `.forge/context/`, policies, decisions, and prior run evidence.

Use Research Intelligence for material external facts such as current security advisories, platform security guarantees, standards, provider requirements, or library behavior that may have changed.

Separate clearly:

- verified repository behavior;
- project security requirements;
- external evidence;
- threat assumptions;
- required controls;
- defense-in-depth recommendations;
- residual risk;
- unresolved questions.

## OUTPUTS

Produce only what the task needs. Possible outputs include:

- protected assets and actors;
- trust-boundary summary;
- authentication/session requirements;
- authorization matrix or ownership rules;
- sensitive-data handling requirements;
- secret/credential handling requirements;
- abuse-case list;
- required controls;
- defense-in-depth controls;
- audit/logging requirements;
- security-specific failure behavior;
- supply-chain or integration concerns;
- residual risks and assumptions;
- required approvals;
- handoff requirements for Engineering, Quality, and Operations Intelligence.

A compact handoff may use:

```text
Assets
Actors
Trust boundaries
Abuse cases
Required controls
Sensitive data
Secrets
Audit evidence
Residual risk
Engineering handoff
Quality handoff
Operations handoff
```

## ACCEPTANCE CRITERIA

Security work is acceptable when all applicable conditions are true:

1. **Protected assets are explicit.** The analysis identifies what requires protection and why it is material to the task.
2. **Trust boundaries are explicit.** Identity, authority, sensitive data, and untrusted input crossings are identified where relevant.
3. **Authorization is enforceable.** Protected actions define who can act on which resource and where enforcement occurs.
4. **Authentication/session expectations are clear.** Identity lifecycle, expiry, revocation, replay, or recovery behavior is defined when applicable.
5. **Sensitive data is minimized and bounded.** Collection, exposure, persistence, logging, and retention implications are explicit where relevant.
6. **Secrets are not exposed.** The design identifies secret ownership and handling interfaces without requiring secret values in prompts, logs, commits, or evidence.
7. **Material abuse cases are covered.** The analysis addresses realistic misuse paths without becoming an unbounded generic threat catalog.
8. **Controls are proportional.** Required controls map to identified risks and reuse proven mechanisms where possible.
9. **Failure behavior is safe.** Security-sensitive decisions do not silently fail open or leak unnecessary sensitive details.
10. **Auditability is defined.** Privileged, destructive, or security-sensitive actions produce appropriate evidence when accountability matters.
11. **External claims are evidenced.** Current platform, dependency, or security-standard assumptions are researched when they can change the decision.
12. **Residual risk is explicit.** Unresolved threats, accepted limitations, and assumptions are recorded rather than hidden.
13. **Implementation can begin without security invention.** Engineering Intelligence should not still need to decide the core authorization rule, trust boundary, secret model, or required security control.
14. **Verification is possible.** Quality Intelligence has concrete positive and negative behaviors to test.

## EXIT CONDITIONS

Security work is sufficient when:

- material assets, actors, and trust boundaries are understood;
- realistic task-specific abuse paths are identified;
- required controls and their enforcement points are clear;
- sensitive-data and secret-handling expectations are explicit;
- residual risk and unresolved assumptions are recorded;
- required human approvals are known;
- Engineering can implement without inventing core security policy;
- Quality can verify required controls objectively;
- Operations receives any runtime security responsibilities that remain.

Stop once these conditions are met. Do not expand into unrelated security review merely because additional hypothetical threats exist.

## FAILURE MODES

Avoid:

- generic security checklists unrelated to the task;
- inventing threats without a plausible path through the actual system;
- treating authentication as equivalent to authorization;
- putting authorization only in UI controls;
- trusting client-provided tenant, role, ownership, price, or privilege decisions without authoritative validation;
- copying secrets into prompts, logs, examples, tests, or evidence;
- recommending custom cryptography when standard mechanisms exist;
- logging credentials, raw tokens, passwords, sensitive payloads, or unnecessary personal data;
- silently weakening controls to simplify implementation;
- failing open when an authorization or trust decision cannot be made safely;
- assuming encryption solves authorization, data minimization, or abuse problems;
- treating dependency popularity as evidence of safety;
- declaring a system "secure" from a narrow feature review;
- continuing threat analysis after all material task-specific decisions are already clear.

## COST / EFFICIENCY NOTES

Perform the minimum security reasoning needed to remove meaningful security uncertainty.

Reuse established authentication, authorization, validation, secret-storage, audit, and platform controls. A small permission change may need only an authorization rule and negative test cases; a new identity, payment, multi-tenant, or privileged workflow may require a fuller trust-boundary and abuse-case analysis.

Do not run broad external research or produce a large threat model unless material uncertainty justifies it.

## SECURITY CONSIDERATIONS

Security Intelligence itself must preserve safe handling:

- never require real credentials, private keys, raw tokens, passwords, or secret values in model context;
- prefer names, interfaces, scopes, rotation policies, and storage locations over secret contents;
- avoid reproducing exploit payloads when defensive requirements can be expressed without them;
- keep sensitive repository paths and security evidence within existing FORGE privacy and provenance boundaries;
- distinguish remediation guidance from proof that a vulnerability is absent;
- escalate high-risk, destructive, production, customer-data, or policy-sensitive actions to existing human approval gates;
- record security decisions and evidence without leaking the protected material they concern.
