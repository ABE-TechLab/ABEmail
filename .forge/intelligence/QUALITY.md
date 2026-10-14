# Quality Intelligence

## PURPOSE

Help the agent decide what must be tested, which regressions are plausible, and what evidence is needed to support confidence in the requested change without turning every task into exhaustive test expansion.

The default question is:

> What is the smallest proportionate set of checks that can show the requested behavior works, important existing behavior still works, and material failure paths are understood?

Quality Intelligence defines test intent, coverage priorities, risk-based depth, and evidence expectations. It does not replace Engineering implementation, Security control design, Operations runtime validation, or the final Verification stage.

## SCOPE

Quality Intelligence covers reasoning about:

- acceptance criteria and observable behavior;
- happy-path and failure-path validation;
- regression risk from changed contracts, state, control flow, data, dependencies, and configuration;
- unit, integration, contract, end-to-end, smoke, migration, compatibility, and static checks when relevant;
- edge cases, boundaries, invalid inputs, missing data, duplicate actions, retries, ordering, concurrency, and idempotency where material;
- data integrity and migration correctness;
- authorization/security-control verification handed off by Security Intelligence;
- accessibility, responsive, interaction-state, and user-flow checks handed off by Design Intelligence;
- deployment, health, recovery, and observability checks handed off by Operations Intelligence;
- deterministic checks already discoverable from repository manifests and tooling;
- test gaps and unverified assumptions;
- evidence quality and confidence boundaries;
- release-blocking defects versus non-blocking improvements.

Quality Intelligence does not own product scope, architecture, implementation design, production deployment, incident response, or final release approval.

## BOUNDARIES

Use the following ownership model:

- **Engineering Intelligence** implements the change and supplies implementation-specific risk information.
- **Security Intelligence** defines security controls and security-specific acceptance conditions.
- **Design Intelligence** defines experience behavior, accessibility requirements, responsive behavior, and user-visible states.
- **Operations Intelligence** defines runtime, deployment, recovery, health, and observability expectations.
- **Quality Intelligence** turns those requirements into proportionate test intent, regression coverage, and quality evidence.
- **Verification** evaluates objective evidence against exit conditions and determines whether the work is actually complete.

Quality Intelligence should answer **what should be checked and why**. Verification should answer **what evidence exists and whether it is sufficient**.

Do not use Quality Intelligence to redesign production code merely to make testing easier unless an explicit testability problem is handed back to Engineering Intelligence.

## TRIGGERS

Activate when the planner already selects the `quality` capability, including normal:

- feature implementation;
- bug fixes;
- refactors;
- security-sensitive implementation;
- infrastructure or deployment-related changes;
- other implementation work where regression risk must be assessed.

Do not activate Quality Intelligence merely because every software task could theoretically be tested. Lightweight documentation, market research, copy edits, and other non-implementation work should remain lightweight unless the planner explicitly activates quality.

## INPUTS

Prefer, in order:

1. current requested outcome and explicit acceptance criteria;
2. planner task kind, risk, activated capabilities, and ordered steps;
3. repository structure, manifests, discovered test/build/check commands, and current Git state;
4. Engineering Intelligence handoff describing changed behavior, contracts, data, dependencies, migrations, and known risks;
5. Security Intelligence acceptance conditions when security controls are involved;
6. Design Intelligence requirements for user-visible flows, states, accessibility, and responsive behavior;
7. Operations Intelligence requirements for runtime health, deployment, rollback, recovery, or observability;
8. existing tests near the affected code and established repository testing conventions;
9. verified project context already selected into the work packet;
10. Research Intelligence evidence only when a quality decision depends on current external behavior or standards.

Do not load unrelated repository areas simply to increase nominal coverage.

## PROCEDURE

1. Restate the exact behavior that must be true when the work is complete.
2. Identify the changed surface: code path, contract, state transition, data model, migration, configuration, dependency, UI flow, security control, or infrastructure behavior.
3. Identify direct failure modes introduced by the change.
4. Identify nearby existing behavior that could plausibly regress because of shared code, contracts, state, or dependencies.
5. Inspect existing tests and repository conventions before inventing a new testing style.
6. Choose the lowest-cost test layer that can prove each material behavior reliably.
7. Add broader integration or end-to-end coverage only when lower-level checks cannot prove the cross-boundary behavior.
8. Define positive, negative, boundary, and failure-path cases proportional to the task.
9. For bug fixes, require a regression case that would have failed before the fix whenever practical.
10. For refactors, prove behavior preservation around the changed boundary rather than testing implementation details.
11. For migrations or data changes, define forward correctness, compatibility expectations, failure handling, and rollback or recovery evidence when material.
12. For security work, include unauthorized, invalid, expired, revoked, cross-user, cross-tenant, or fail-closed cases handed off by Security Intelligence where applicable.
13. For user-facing work, include key interaction states, error states, accessibility, and responsive checks handed off by Design Intelligence where applicable.
14. For infrastructure work, include configuration validation, deployment readiness, health/smoke checks, and recovery expectations handed off by Operations Intelligence where applicable.
15. Prefer discovered deterministic commands and existing tooling over bespoke model-driven inspection.
16. Record important untested assumptions or gaps that cannot be closed within scope.
17. Define which failures are release-blocking for this task.
18. Stop when the selected checks can distinguish a correct implementation from the material failures identified.

## TEST STRATEGY

Choose test depth according to the affected boundary.

### Unit-level checks

Prefer when behavior is local, deterministic, and can be proven without crossing process, network, database, filesystem, or framework boundaries.

Good targets include:

- pure transformations;
- parsing and validation;
- policy evaluation;
- isolated state transitions;
- local error handling;
- boundary conditions.

### Integration checks

Use when correctness depends on collaboration between modules or real infrastructure abstractions such as:

- database queries and persistence;
- API handlers and middleware;
- queues/events;
- authentication/authorization middleware;
- filesystem behavior;
- provider SDK boundaries;
- dependency wiring;
- serialization or schema contracts.

### Contract checks

Use when independent components depend on a stable shape or behavior:

- public APIs;
- events/messages;
- shared schemas;
- external integration payloads;
- CLI output consumed by automation;
- configuration contracts.

### End-to-end or browser checks

Use when the requested outcome depends on the assembled system or an important user journey that cannot be proven reliably at a lower layer.

Do not require end-to-end coverage for every code change.

### Smoke and deployment checks

Use when runtime startup, environment wiring, networking, migrations, health, or production-like behavior is part of the changed surface.

## REGRESSION REASONING

Look for regression risk where the change touches:

- shared utilities or middleware;
- public contracts;
- cross-module state;
- persistent data;
- schema migrations;
- authorization decisions;
- retry, timeout, concurrency, or ordering behavior;
- caching;
- feature flags or environment-specific configuration;
- dependency versions;
- deployment manifests;
- compatibility-sensitive interfaces.

Do not expand regression scope solely because a file has many consumers. Prioritize consumers whose behavior can plausibly change through the modified contract or control flow.

## EDGE AND FAILURE CASES

Consider, only when relevant:

- empty, missing, malformed, oversized, or unexpected input;
- zero, minimum, maximum, and boundary values;
- duplicates and repeated requests;
- retries and partial completion;
- timeout and downstream failure;
- stale state;
- race and ordering conditions;
- unauthorized or forbidden actions;
- unavailable dependencies;
- migration interruption;
- invalid configuration;
- feature-disabled behavior;
- compatibility with existing stored data or clients;
- user cancellation or interrupted flows;
- degraded but recoverable runtime states.

The goal is not exhaustive combinatorics. Select cases tied to credible failure modes.

## TOOLS AND EVIDENCE

Prefer deterministic repository evidence:

- discovered `test`, `check`, `lint`, `typecheck`, `build`, and `verify` commands;
- existing test suites and fixtures;
- compiler/type-checker output;
- static analysis already used by the project;
- schema validation;
- migration validation;
- contract tests;
- browser/accessibility tooling already established by the repository;
- deployment validation and smoke checks when relevant;
- prior run evidence and known regression tests.

Evidence should identify:

- command or check performed;
- result;
- relevant scope;
- failures or warnings;
- important coverage gaps;
- whether the evidence is deterministic, observed, inferred, or externally sourced.

A passing test suite is evidence that the executed tests passed; it is not proof that no defect exists.

## OUTPUTS

Produce only what the task needs. Possible outputs include:

- quality risk summary;
- acceptance-to-test mapping;
- regression-risk list;
- positive and negative test cases;
- edge/failure cases;
- selected test layers;
- deterministic commands to run;
- migration/data-integrity checks;
- security-control checks;
- accessibility/interaction checks;
- runtime/smoke checks;
- test gaps and unresolved assumptions;
- release-blocking criteria;
- verification handoff.

A compact handoff may use:

```text
Behavior to prove
Regression risks
Checks
Negative cases
Edge/failure cases
Commands
Known gaps
Release blockers
Verification evidence required
```

## ACCEPTANCE CRITERIA

Quality work is sufficient when all applicable conditions are true:

1. **The behavior under test is explicit.** Tests map to requested outcomes rather than vague coverage goals.
2. **Material regressions are identified.** Nearby behavior is included only where the change can plausibly affect it.
3. **Test layers are proportional.** The cheapest reliable layer is preferred, with broader tests added when needed for cross-boundary confidence.
4. **Failure behavior is covered.** Important invalid, unavailable, denied, interrupted, or degraded cases are tested where material.
5. **Bug fixes are guarded.** A regression case captures the defect whenever practical.
6. **Refactors prove preservation.** Tests focus on externally meaningful behavior rather than implementation details.
7. **Data changes protect integrity.** Migration and persistence changes include correctness and compatibility checks where relevant.
8. **Security handoffs are testable.** Required controls have concrete positive and negative verification cases where Security Intelligence is active.
9. **Experience handoffs are testable.** Important user flows, states, accessibility, and responsive requirements have objective checks where Design Intelligence is active.
10. **Runtime handoffs are testable.** Deployment, startup, health, recovery, and observability expectations have appropriate checks where Operations Intelligence is active.
11. **Repository tooling is reused.** Existing deterministic checks are preferred over unnecessary new machinery.
12. **Gaps are explicit.** Untested assumptions or unavailable environments are recorded rather than hidden.
13. **Release blockers are clear.** The work distinguishes failures that prevent delivery from optional future improvements.
14. **Verification has objective evidence.** The final Verification stage can evaluate concrete results rather than model confidence.

## EXIT CONDITIONS

Quality Intelligence is sufficient when:

- required behavior and material failure modes are mapped to checks;
- regression risk is proportionately covered;
- relevant positive and negative cases are defined;
- existing deterministic tooling has been selected where possible;
- known quality gaps are explicit;
- release-blocking conditions are clear;
- the `test` stage has a concrete plan;
- the `verify` stage knows what objective evidence to expect.

Stop when additional testing would add little confidence relative to cost and risk.

## FAILURE MODES

Avoid:

- maximizing line or branch coverage without linking it to behavior or risk;
- duplicating tests at every layer for the same behavior without a reason;
- writing only happy-path tests;
- testing private implementation details that make safe refactors harder;
- introducing large new test frameworks when existing tooling is adequate;
- treating snapshots as sufficient proof for behavior they do not meaningfully validate;
- relying on manual inspection when a deterministic check already exists;
- turning minor changes into exhaustive end-to-end suites;
- ignoring flaky tests or rerunning until green without understanding the cause;
- deleting or weakening failing tests merely to satisfy CI;
- assuming build success proves runtime correctness;
- assuming test success proves security, performance, availability, or production readiness beyond what was actually checked;
- hiding untested assumptions;
- merging when a task-specific release blocker is still red.

## COST / EFFICIENCY NOTES

Quality work should buy confidence, not test volume.

Start with existing repository tests and deterministic commands. Add the smallest new regression coverage that protects the changed behavior. Escalate from unit to integration to end-to-end only when the affected boundary requires it.

For low-risk changes, a small focused test plus existing checks may be enough. For security-sensitive, migration-heavy, cross-service, or infrastructure changes, broader negative and integration coverage may be justified.

Do not load or execute unrelated suites unless repository conventions or risk make them material.

## SECURITY CONSIDERATIONS

Quality Intelligence must preserve secure testing practices:

- never use real production secrets or credentials in tests;
- use synthetic or sanitized data for sensitive scenarios;
- do not expose tokens, keys, personal data, or protected payloads in fixtures, snapshots, logs, screenshots, or evidence;
- preserve Security Intelligence's fail-closed and authorization requirements in negative tests;
- do not weaken security controls to make tests easier;
- treat production-data testing, destructive validation, and privileged operations as governed actions subject to existing approval boundaries;
- distinguish a passing security test from proof that the system has no vulnerability.
