# Product Intelligence

## PURPOSE

Help the agent determine what should be built, for whom, why it matters, and what is deliberately outside scope before architecture or implementation expands.

## SCOPE

Product Intelligence covers:

- problem and desired outcome;
- users, buyers, operators, administrators, and other material stakeholders;
- value proposition;
- goals and non-goals;
- primary workflows and use cases;
- MVP boundaries and phased scope;
- assumptions, dependencies, and open questions;
- measurable product success criteria.

It does not perform market research itself, choose technical architecture, or invent requirements unsupported by project context or evidence.

## TRIGGERS

Activate when:

- the task creates or materially changes a product, platform, application, service, or user-facing capability;
- a feature requires clarification of users, value, scope, workflow, or non-goals;
- the project is in discovery/planning and product decisions are still material;
- Market or Research Intelligence identifies evidence that changes product scope.

Do not force a full product-discovery exercise for a narrow implementation task whose product intent is already recorded and stable.

## INPUTS

Prefer, in order:

1. current user request;
2. verified `.forge/context/project.yaml` product fields;
3. existing decisions/specifications/README;
4. relevant market/research evidence;
5. repository behavior when it reflects already-shipped product reality.

## PROCEDURE

1. State the user or business outcome in plain language.
2. Identify the primary users and any materially different stakeholders.
3. Confirm the problem being solved and current alternative/workaround when known.
4. Define the value proposition without marketing exaggeration.
5. Separate goals from non-goals.
6. Describe the smallest end-to-end workflows needed to deliver the value.
7. Distinguish MVP, later scope, and explicitly deferred ideas.
8. Record assumptions and unresolved questions; do not silently turn assumptions into requirements.
9. Define observable success criteria appropriate to the maturity of the product.
10. Check that proposed work still maps to the intended outcome before handing off to architecture/design/engineering.

## TOOLS AND EVIDENCE

Use stored project context and existing product documents before external research.

Use Research Intelligence when a product decision depends on an external fact, user expectation, market condition, regulation, competitor behavior, pricing norm, or other evidence not established in the repository.

Mark clearly whether a statement is:

- verified project context;
- external evidence;
- user-provided requirement;
- model inference;
- unresolved assumption.

## OUTPUTS

Product Intelligence should produce only what is material to the task, such as:

- problem statement;
- user/stakeholder definition;
- value proposition;
- goals/non-goals;
- workflow/use-case summary;
- MVP or scope boundary;
- product assumptions/open questions;
- success criteria;
- updates to durable project context or a decision record when appropriate.

## EXIT CONDITIONS

Product work is sufficient when:

- the intended outcome and primary users are clear;
- scope and non-goals are explicit enough to prevent accidental expansion;
- the next architecture/design/engineering step can proceed without inventing product requirements;
- material assumptions are either evidenced, accepted, or recorded as unresolved.

## FAILURE MODES

Avoid:

- solution-first feature lists without a defined user outcome;
- treating every idea as MVP;
- inventing personas, metrics, pricing, or adoption claims;
- silently resolving disagreements between source documents;
- repeating product discovery when verified context already answers the question;
- letting technical convenience redefine product requirements without recording the trade-off.

## COST / EFFICIENCY NOTES

Reuse durable product context. Re-evaluate only fields affected by the current task. Escalate to Market or Research Intelligence only when an external decision genuinely matters.

## SECURITY CONSIDERATIONS

Product scope can create security and privacy obligations. Flag workflows involving identity, permissions, payments, regulated data, sensitive user information, destructive actions, or high-impact automation so Security Intelligence can be activated.
