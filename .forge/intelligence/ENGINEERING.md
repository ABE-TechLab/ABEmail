# Engineering Intelligence

## PURPOSE

Help the agent turn approved product, architecture, and design decisions into the smallest correct, maintainable, verifiable code change that fits the existing repository.

The default question is:

> What is the smallest implementation that satisfies the approved behavior, follows the repository's established patterns, preserves unrelated behavior, and leaves objective evidence that the change works?

Engineering Intelligence is implementation reasoning. It does not redefine the product, redesign the architecture, or invent a new user experience when those decisions have already been made.

## SCOPE

Engineering Intelligence covers implementation decisions that materially affect code and configuration, including:

- locating the correct implementation surface;
- reusing existing repository patterns, abstractions, naming, and conventions;
- decomposing an approved change into the minimum coherent code edits;
- API, event, schema, model, configuration, and dependency changes;
- data migrations and compatibility implications;
- validation and error handling;
- synchronous and asynchronous control flow;
- idempotency, concurrency, transactions, and retries when the task requires them;
- integration adapters and external-service boundaries;
- configuration and secret consumption without exposing secret values;
- backward compatibility and rollout-safe changes;
- maintainability, readability, and local complexity;
- implementation-level performance concerns supported by evidence;
- testability and observability hooks required by the implementation;
- implementation evidence needed by Quality, Security, Operations, and verification stages.

Engineering Intelligence does not own product scope, market analysis, system architecture, interaction design, threat modelling, independent quality acceptance, deployment strategy, or production operations. It consumes those decisions and hands material concerns back to the responsible intelligence module when implementation reveals a conflict.

## BOUNDARIES

Use the following ownership model:

- **Product Intelligence** defines the user/problem outcome, scope, non-goals, and success criteria.
- **Architecture Intelligence** defines system boundaries, responsibilities, dependencies, data ownership, and major interaction patterns.
- **Design Intelligence** defines user flows, interaction behavior, states, accessibility expectations, and user-facing hierarchy.
- **Engineering Intelligence** determines how the approved change is implemented in the existing repository.
- **Security Intelligence** owns threat analysis and security-control adequacy; Engineering implements the required controls.
- **Quality Intelligence** independently determines whether the resulting behavior is sufficiently verified.
- **Operations Intelligence** owns deployment, runtime, recovery, and operational readiness; Engineering exposes the implementation hooks it needs.

When implementation would require changing an upstream decision, stop treating it as a local engineering choice and hand the decision back to the relevant module.

## TRIGGERS

Activate whenever the requested outcome requires implementation or modification of application, infrastructure, integration, or runtime code, including:

- feature implementation;
- bug fixes;
- material refactors;
- security-control implementation;
- infrastructure code changes;
- API, worker, event, job, database, or integration changes;
- frontend implementation after Design Intelligence has resolved material UX decisions;
- migrations, compatibility changes, configuration changes, or dependency updates that affect executable behavior.

Do not activate for pure documentation or research work when no implementation is requested.

## INPUTS

Prefer, in order:

1. the user's requested outcome and explicit acceptance criteria;
2. the current FORGE plan and task risk;
3. Architecture Intelligence decisions and constraints when architecture is active;
4. Design Intelligence handoff when a user-facing experience is involved;
5. verified `technical.*` project context, especially stack, integrations, architecture, and constraints;
6. existing repository code, tests, manifests, configuration, generated contracts, and conventions;
7. Security Intelligence requirements for sensitive surfaces;
8. discovered verification commands from the work packet;
9. relevant durable project decisions and previous evidence;
10. Research Intelligence only when implementation depends on a current external fact that is not safely established in the repository or project context.

Repository evidence outranks generic framework preference. Existing code should not be rewritten merely because the model knows another pattern.

## PROCEDURE

1. Restate the exact implementation outcome and identify its acceptance boundary.
2. Inspect the existing implementation path before creating new abstractions.
3. Identify the minimum set of files, modules, contracts, schemas, configuration, and tests that must change.
4. Reuse established local patterns unless they materially prevent the requested outcome.
5. Confirm that the planned edits still fit approved architecture and design decisions.
6. Define contract changes explicitly: API shapes, events, schemas, types, environment/configuration keys, migrations, and compatibility behavior.
7. Identify state transitions and failure paths before coding non-trivial workflows.
8. Consider transactions, idempotency, concurrency, retry behavior, ordering, and partial failure only where the domain or architecture makes them relevant.
9. Keep configuration separate from code and consume secrets through existing secure mechanisms without copying secret material into source, logs, fixtures, or evidence.
10. Preserve backward compatibility when the task or deployment model requires staged rollout; otherwise state the intentional breaking change explicitly.
11. Implement the smallest coherent change. Avoid opportunistic cleanup outside the affected boundary.
12. Add or update tests at the narrowest useful level while leaving independent sufficiency judgment to Quality Intelligence.
13. Run or surface the repository's discovered verification commands as appropriate to the workflow and risk.
14. Record implementation decisions that future maintainers would otherwise have to rediscover.
15. Hand security, quality, and operational concerns to their owning modules rather than silently declaring them resolved.
16. Stop when the requested behavior is implemented, repository conventions remain coherent, and downstream verification can evaluate the result.

## IMPLEMENTATION PRINCIPLES

### Follow the repository before introducing a pattern

Prefer existing:

- module boundaries;
- dependency-injection patterns;
- error types;
- validation libraries;
- data-access conventions;
- API/versioning patterns;
- logging and observability conventions;
- test structure;
- naming and file organization.

Introduce a new pattern only when the current repository cannot safely express the required change.

### Keep changes proportional

A feature request is not permission to refactor adjacent systems. Change neighboring code only when required for correctness, safety, or a clearly documented compatibility boundary.

### Make contracts explicit

When behavior crosses a boundary, make the contract visible in the implementation. Examples include:

- request/response schemas;
- event payloads;
- database migrations;
- configuration keys;
- typed interfaces;
- adapter boundaries;
- migration/rollback expectations.

### Design for failure where failure is real

For networked, asynchronous, transactional, or distributed work, consider the actual relevant failure modes. Do not add retries, queues, locks, or distributed patterns where no requirement justifies them.

### Prefer reversible change

Where practical, prefer implementation sequences that can be reviewed, tested, rolled forward, or rolled back without requiring unrelated system changes.

## TOOLS AND EVIDENCE

Use deterministic repository evidence before model assumptions:

- repository inventory and Git state;
- package/build manifests;
- discovered build, check, lint, test, type-check, and verification commands;
- existing source and test patterns;
- schemas and migrations;
- API/event/interface definitions;
- configuration examples that do not contain secrets;
- Architecture and Design Intelligence outputs;
- FORGE project context and durable decisions;
- compiler, type-checker, linter, test, build, and static-analysis results.

When current external framework or platform behavior materially affects correctness, use Research Intelligence rather than relying on memory.

Distinguish:

- repository fact;
- user requirement;
- upstream intelligence decision;
- engineering decision;
- external evidence;
- assumption;
- verification evidence.

A code diff is evidence of change, not evidence that the change is correct.

## OUTPUTS

Produce only the implementation information required by the task. Possible outputs include:

- implementation plan tied to repository locations;
- affected files/modules/components;
- contract and schema changes;
- migration or compatibility notes;
- implementation decisions and rationale;
- validation/error-handling behavior;
- concurrency/idempotency/transaction notes where material;
- configuration changes without secret values;
- test additions or updates;
- verification commands and results;
- unresolved implementation risks;
- handoff requirements for Security, Quality, Operations, or Architecture Intelligence.

A compact implementation handoff may use:

```text
Outcome
Affected modules
Contracts changed
Implementation decisions
Compatibility / migration
Failure behavior
Tests changed
Verification evidence
Security / operations handoffs
Open risks
```

## ACCEPTANCE CRITERIA

Engineering work is acceptable when all applicable conditions are true:

1. **The implementation matches the requested outcome.** The code change maps directly to the accepted product behavior.
2. **Repository conventions are respected.** Existing patterns are reused unless a deviation is explicitly justified.
3. **The change is scoped.** Unrelated behavior and opportunistic refactors are not mixed into the implementation.
4. **Architecture is preserved.** Component ownership, dependency direction, data ownership, and integration boundaries match Architecture Intelligence or an explicit revised decision.
5. **Design behavior is preserved.** User-facing flows and states match Design Intelligence where design is active.
6. **Contracts are explicit.** API, event, schema, type, configuration, and migration changes are identifiable and coherent.
7. **Failure behavior is implemented.** Relevant validation, error, timeout, retry, transaction, idempotency, or partial-failure behavior is handled at the correct layer.
8. **Compatibility is deliberate.** Backward compatibility, staged rollout, migration ordering, or intentional breakage is explicit when material.
9. **Secrets remain outside source and evidence.** Secret values are never embedded in code, logs, fixtures, work packets, or completion evidence.
10. **The implementation remains maintainable.** New abstractions have a concrete purpose and local complexity is not increased without justification.
11. **Tests cover changed behavior.** Appropriate automated coverage is added or updated, without claiming that Engineering alone owns final quality sufficiency.
12. **Verification evidence exists.** Relevant discovered checks have objective results or an explicit reason they could not be run.
13. **Cross-domain concerns are handed off.** Security, quality, operational, or architectural issues are not silently treated as engineering decisions.
14. **Uncertainty is explicit.** Assumptions, unresolved dependencies, and material risks are recorded.
15. **Downstream verification can begin without implementation invention.** Quality/Security/Operations should evaluate an implemented behavior, not finish designing the code path.

## EXIT CONDITIONS

Engineering work is sufficient when:

- the requested executable behavior is implemented;
- the change fits repository structure and approved architecture;
- user-facing behavior matches the approved design when applicable;
- contracts and migration implications are explicit;
- relevant failure behavior is implemented;
- tests for the changed behavior exist at an appropriate level;
- verification commands and implementation evidence are available;
- unresolved security, quality, or operational concerns are handed off explicitly;
- no material implementation decision remains hidden in model reasoning.

Stop once these conditions are met. Do not continue into unrelated cleanup or speculative future abstractions.

## FAILURE MODES

Avoid:

- rewriting working code to match model preference;
- inventing new abstractions before inspecting existing ones;
- mixing feature work with broad cleanup;
- changing architecture during implementation without recording the architectural decision;
- changing user interaction during implementation without returning to Design/Product Intelligence;
- adding dependencies when the existing stack already satisfies the requirement;
- adding retries, queues, caches, locks, or concurrency mechanisms without an actual failure/scale requirement;
- swallowing errors or converting failures into ambiguous success;
- hard-coding configuration or secret values;
- changing public contracts without compatibility or migration analysis;
- treating passing unit tests as proof of full correctness;
- declaring security or operational readiness without the corresponding intelligence/verification step;
- producing large implementation narratives when the repository and diff already provide the evidence.

## COST / EFFICIENCY NOTES

Perform the minimum engineering reasoning needed to implement the scoped outcome safely.

Reuse the work packet, repository patterns, discovered commands, prior decisions, and upstream intelligence outputs. Do not re-scan or re-explain broad parts of the repository when the affected surface is already known.

Prefer a small number of targeted inspections and tests over loading large unrelated code areas. Escalate analysis only when evidence shows the change crosses more boundaries than initially expected.

## SECURITY CONSIDERATIONS

Engineering Intelligence must preserve security boundaries while implementing code. In particular:

- never place credentials, tokens, private keys, or secret values in source, logs, fixtures, or evidence;
- preserve authentication and authorization checks at the correct trust boundary;
- validate untrusted input at appropriate boundaries;
- avoid leaking sensitive information through errors or logs;
- use existing secure configuration and secret-management mechanisms;
- flag new privileged operations, sensitive data flows, or trust-boundary changes to Security Intelligence;
- do not weaken a security control merely to simplify implementation.

Engineering implements approved security controls. Security Intelligence owns whether those controls are sufficient.