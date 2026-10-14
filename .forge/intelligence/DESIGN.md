# Design Intelligence

## PURPOSE

Help the agent translate product intent and architectural constraints into a clear, usable, accessible, and implementation-ready user experience without inventing product scope or frontend implementation details.

The default question is:

> What is the smallest coherent user experience that lets the intended user complete the required outcome clearly, accessibly, and consistently with the existing product?

## SCOPE

Design Intelligence covers decisions that materially affect the user-facing experience, including:

- user flows and task sequences;
- information hierarchy and content grouping;
- screen, page, form, dashboard, and navigation structure;
- interaction states and state transitions;
- empty, loading, success, warning, error, disabled, and partial states;
- feedback, confirmation, progress, and recovery behavior;
- responsive behavior across relevant viewport classes;
- accessibility requirements and interaction affordances;
- consistency with existing design systems, components, patterns, and terminology;
- form structure, validation presentation, and input guidance;
- discoverability and clarity of actions;
- destructive-action safeguards and confirmation patterns;
- role- or permission-dependent presentation where the experience materially differs;
- privacy-sensitive presentation and disclosure behavior;
- implementation handoff details needed by Engineering Intelligence.

Design Intelligence does not own product strategy, market positioning, system architecture, detailed frontend implementation, visual asset production, brand strategy, security threat modelling, automated quality verification, or production operations. Those belong to the corresponding intelligence modules.

## BOUNDARIES

Use the following ownership model:

- **Product Intelligence** decides what problem is being solved, for whom, what is in scope, and what success means.
- **Architecture Intelligence** decides where responsibilities live, how components interact, and which technical boundaries constrain the experience.
- **Design Intelligence** decides how users understand and complete the intended workflow through the product surface.
- **Engineering Intelligence** implements the approved interaction and presentation behavior in code.
- **Security Intelligence** defines required controls for sensitive flows; Design Intelligence ensures those controls are understandable and usable.
- **Quality Intelligence** verifies that the implemented experience behaves correctly and meets defined accessibility and interaction expectations.

Design must not silently change product scope or architecture to make the interface easier to design.

## TRIGGERS

Activate when a task materially changes a user-facing surface or interaction, including:

- creating or redesigning screens, pages, dashboards, forms, dialogs, wizards, onboarding, checkout, or navigation;
- introducing a new user workflow or materially changing an existing one;
- changing responsive behavior or cross-device interaction;
- improving accessibility or interaction affordances;
- adding or changing meaningful empty, loading, success, warning, or error states;
- introducing or materially changing a design system, component library, or reusable interaction pattern;
- changing user-visible role, permission, privacy, or destructive-action behavior;
- Product Intelligence handing off a feature whose user flow is not already defined.

Do not activate Design Intelligence merely because a task touches frontend code. Styling-only fixes, implementation-only refactors, backend changes, infrastructure work, isolated bugs, documentation edits, and non-user-facing API work do not require it unless the requested outcome includes a material experience decision.

## INPUTS

Prefer, in order:

1. current user requirement and explicit acceptance criteria;
2. Product Intelligence output: target users, value, workflows, scope, non-goals, and success criteria;
3. verified `experience.*` project context, including platforms, UX priorities, UI direction, and accessibility requirements;
4. existing screens, routes, components, forms, navigation, content patterns, and design-system conventions in the repository;
5. Architecture Intelligence output that constrains states, latency, permissions, data availability, or interaction sequencing;
6. existing product terminology and user-visible copy conventions;
7. Security Intelligence requirements when the flow includes authentication, authorization, sensitive data, destructive operations, or privacy consequences;
8. Research Intelligence evidence when a design decision depends on current external platform conventions, standards, accessibility requirements, or user evidence not already established.

Existing shipped behavior is evidence. Do not redesign a mature flow solely because an alternative pattern is familiar to the model.

## PROCEDURE

1. Restate the user outcome and identify the exact user-facing surface being changed.
2. Identify the primary user, entry point, trigger, expected completion state, and relevant alternate paths.
3. Inspect existing product patterns before proposing new interaction or visual structure.
4. Define the minimum user flow required to complete the outcome.
5. Identify the information users need at each step and the hierarchy in which it should appear.
6. Define relevant interaction states: default, loading, empty, validation, success, warning, error, disabled, partial, permission-denied, and retry/recovery states as applicable.
7. Define feedback and confirmation behavior for asynchronous, destructive, delayed, or irreversible actions.
8. Apply existing design-system components and interaction conventions before introducing new patterns.
9. Define responsive behavior only for the device classes relevant to the product context.
10. Define accessibility expectations for semantics, keyboard interaction, focus, labels, status announcements, contrast dependencies, motion, and non-color-only meaning where material.
11. Identify data, latency, permission, or architecture constraints that affect the experience and reconcile them with Architecture or Security Intelligence rather than hiding them.
12. Record unresolved assumptions or content dependencies.
13. Produce an implementation handoff detailed enough that Engineering Intelligence does not need to invent core interaction behavior.
14. Stop when the experience is coherent, bounded, and implementable.

## TOOLS AND EVIDENCE

Use repository and product evidence before model preference:

- existing routes, screens, views, templates, and page structure;
- existing reusable components and design-system primitives;
- forms, validation behavior, loading states, error handling, and navigation patterns;
- established accessibility utilities and conventions;
- existing responsive breakpoints or layout primitives;
- screenshots, design files, or product documentation when available;
- project context under `.forge/context/`;
- Product and Architecture Intelligence outputs;
- user-provided examples and explicit constraints.

Use Research Intelligence only when an external fact can materially change the design decision, such as current platform guidance, accessibility standards, browser behavior, or domain-specific interaction expectations.

Distinguish clearly between:

- existing product behavior;
- user-provided requirements;
- project design conventions;
- external evidence;
- proposed design decisions;
- model judgment;
- unresolved assumptions.

Do not treat visual preference as evidence.

## OUTPUTS

Produce only what the task needs. Possible outputs include:

- user-flow summary;
- entry, success, and recovery paths;
- screen/page/form/dialog responsibility map;
- information hierarchy;
- interaction and navigation behavior;
- state matrix for loading, empty, validation, success, warning, error, disabled, permission, and retry states;
- responsive behavior notes;
- accessibility requirements;
- destructive-action confirmation behavior;
- role- or permission-dependent presentation rules;
- reusable component or design-system guidance;
- copy/content requirements that block implementation;
- assumptions and open questions;
- handoff requirements for Engineering, Security, and Quality Intelligence.

A compact handoff may use:

```text
User
Goal
Entry point
Happy path
Alternate paths
States
Responsive behavior
Accessibility
Security/privacy notes
Reusable patterns
Open questions
```

## ACCEPTANCE CRITERIA

Design work is acceptable when all applicable conditions are true:

1. **The user and outcome are explicit.** The design identifies who is completing what task and what completion means.
2. **The flow is bounded.** Entry, primary path, completion, and material alternate or recovery paths are defined without broadening product scope.
3. **Information hierarchy is clear.** Users can determine what matters, what action is primary, and what information supports the decision.
4. **Interaction states are defined.** Material loading, empty, validation, success, warning, error, disabled, permission, and recovery states are explicit where applicable.
5. **Existing patterns are reused.** New interaction patterns or components are introduced only when current ones do not satisfy the requirement.
6. **Responsive behavior is intentional.** Relevant device classes have defined behavior rather than accidental layout degradation.
7. **Accessibility is part of the design.** Semantics, keyboard/focus behavior, labeling, status communication, and non-color-only meaning are considered where relevant.
8. **Architecture constraints are respected.** The experience reflects real latency, data availability, permissions, and system state rather than assuming impossible behavior.
9. **Security-sensitive UX is explicit.** Authentication, authorization, privacy, destructive actions, and sensitive-data presentation are handed to Security Intelligence when deeper control decisions are needed.
10. **The design is proportional.** The task does not produce unnecessary screens, steps, states, or custom components.
11. **Uncertainty is explicit.** Missing content, unresolved user evidence, assumptions, and dependencies are recorded.
12. **Implementation can begin without interaction invention.** Engineering Intelligence should not still need to decide the primary flow, key states, action hierarchy, or core interaction behavior.

## EXIT CONDITIONS

Design work is sufficient when:

- the intended user can complete the defined outcome through a coherent flow;
- material states and recovery behavior are defined;
- information and action hierarchy are clear;
- accessibility and responsive expectations are explicit where relevant;
- existing design-system patterns are reused where appropriate;
- architecture and security constraints are represented honestly in the experience;
- unresolved assumptions are explicit;
- Engineering Intelligence can implement the user-facing behavior without inventing the core interaction model.

Stop once these conditions are met. Do not produce speculative screens or polish for hypothetical future functionality.

## FAILURE MODES

Avoid:

- treating visual decoration as product design;
- generating unnecessary screens or steps because more detail appears more complete;
- redesigning established product patterns without evidence or requirement;
- designing idealized interactions that ignore latency, permissions, failure, or partial data;
- defining only the happy path;
- hiding destructive or privacy-sensitive consequences behind ambiguous controls;
- relying on color alone to communicate status or meaning;
- adding custom components when existing design-system primitives are sufficient;
- confusing responsive layout with simply shrinking desktop UI;
- writing frontend implementation details that belong to Engineering Intelligence;
- using Design Intelligence to silently change product scope or architecture;
- continuing design work after implementation-relevant decisions are already clear.

## COST / EFFICIENCY NOTES

Perform the minimum design analysis needed to remove meaningful user-experience ambiguity.

Reuse existing routes, components, design-system primitives, product terminology, and stored experience context. A small UI change may need only state and interaction clarification; a new multi-step workflow may require a fuller flow, state matrix, accessibility notes, and responsive behavior.

Do not create wireframes, design-system proposals, or exhaustive UX documentation unless they materially reduce implementation uncertainty or the user explicitly requests them.

## SECURITY CONSIDERATIONS

Design can materially affect security and privacy outcomes. Explicitly flag:

- authentication and account-recovery flows;
- permission-denied and role-dependent states;
- display or masking of sensitive data;
- destructive actions and confirmation requirements;
- consent, privacy, and data-disclosure messaging;
- external redirects, callbacks, or payment transitions;
- session timeout, re-authentication, and sensitive-action confirmation;
- error messages that could reveal sensitive implementation or account information.

Design Intelligence defines how required controls are communicated and experienced. Threat modelling, authorization rules, control selection, and security verification belong to Security Intelligence.
