# Architecture Intelligence

## PURPOSE

Help the agent determine how a system or change should be structured before implementation begins so technical decisions are proportional, compatible with the existing system, explicit about trade-offs, and clear enough for Engineering Intelligence to implement without inventing major architecture.

The default question is:

> What is the smallest robust architecture change that satisfies the requirement, respects the existing system, exposes its trade-offs, and leaves implementation clear?

## SCOPE

Architecture Intelligence covers decisions that materially affect:

- system, service, module, domain, ownership, and trust boundaries;
- component responsibilities and dependency direction;
- data ownership, persistence boundaries, consistency, caching, queues, and events;
- synchronous versus asynchronous communication;
- internal and third-party integration patterns;
- runtime and deployment topology when structurally relevant;
- scalability dimensions supported by evidence or explicit requirements;
- reliability, failure isolation, recovery, retries, timeouts, and idempotency;
- architectural security boundaries and privileged components;
- observability requirements created by the architecture;
- technology selection when a concrete architectural decision requires it;
- safe evolution of an existing architecture and material architectural debt.

It does not own product requirements, market analysis, UI/interaction design, detailed implementation, full threat modelling, test execution, or production operations. Those belong to the corresponding intelligence modules. Architecture may trigger them when a material decision crosses domains.

## TRIGGERS

Activate when:

- a task creates or materially changes system structure or component boundaries;
- a feature needs a non-trivial placement, responsibility, dependency, or communication decision;
- adding or changing databases, caches, queues, event buses, workers, services, serverless functions, or infrastructure topology;
- integrating a consequential internal or external service;
- introducing multi-tenancy, asynchronous processing, distributed state, or new trust boundaries;
- refactoring materially coupled modules or dependency direction;
- security work changes architectural boundaries or privileged flows;
- infrastructure work changes runtime topology or service relationships;
- Product Intelligence hands off a new product or major capability whose structure is not already established.

Do not force deep architecture analysis for narrow documentation edits, styling changes, isolated test updates, simple validation fixes, or other work whose architectural placement and boundaries are already clear.

## INPUTS

Prefer, in order:

1. current user requirement and explicit constraints;
2. Product Intelligence output: users, workflows, scope, non-goals, and success criteria;
3. verified `technical.*`, `security.*`, and `operations.*` project context;
4. existing repository structure, modules, services, packages, manifests, configuration, and dependency patterns;
5. existing ADRs, architecture documents, API contracts, diagrams, deployment documentation, and shipped behavior;
6. current integrations, databases, messaging systems, cloud services, and infrastructure;
7. security context: sensitive data, authentication, authorization, secrets, trust boundaries, and compliance constraints;
8. operational constraints such as deployment targets, environments, team capacity, availability expectations, latency, throughput, data volume, and cost;
9. Research Intelligence evidence when a decision depends on current external platform behavior, service limits, technical standards, or other facts not established in project context.

Architecture must not silently redefine product requirements to fit technical convenience.

## PROCEDURE

1. Restate the architectural problem rather than merely repeating the feature request.
2. Inspect the existing architecture and identify the affected components, boundaries, dependencies, data, integrations, and runtime topology.
3. Capture material constraints, including compatibility, security, operational capacity, deployment, cost, latency, reliability, and team constraints when known.
4. Identify the decisions that implementation would otherwise have to invent: ownership, placement, data source of truth, communication style, consistency, runtime responsibility, or dependency direction.
5. Generate only the small set of viable approaches that could materially change the decision.
6. Compare their relevant trade-offs: complexity, coupling, reliability, security, operability, maintainability, migration cost, reversibility, and fit with the current system.
7. Prefer the smallest robust option that satisfies the requirement and preserves existing architecture unless deviation is justified.
8. Define affected component responsibilities, dependency direction, data flow, and integration contracts at the level needed for implementation.
9. Consider material failure behavior for networked, asynchronous, or stateful flows: unavailable dependencies, retries, timeouts, duplicates, partial failure, recovery, and idempotency.
10. Identify security and operational consequences and hand them to Security or Operations Intelligence when deeper treatment is required.
11. Record a durable architecture decision when it materially affects future work; avoid ADR ceremony for trivial choices.
12. Stop when downstream implementation can proceed without inventing major system structure.

## TOOLS AND EVIDENCE

Use deterministic repository evidence before model inference:

- directory/module/service structure;
- manifests and dependency declarations;
- configuration and infrastructure files;
- API/event/database contracts;
- existing ADRs and architecture documentation;
- Git history when it explains a current architectural constraint;
- project context under `.forge/context/`.

Use Research Intelligence for current external facts such as provider limits, framework/runtime behavior, managed-service guarantees, standards, or vendor constraints when they can change the architecture decision.

Distinguish clearly between:

- verified existing architecture;
- user-provided constraints;
- external evidence;
- proposed architecture decisions;
- model inference;
- unresolved assumptions.

Do not justify architecture with unsupported scale claims or technology popularity.

## OUTPUTS

Produce only what the task needs. Possible outputs include:

- architectural problem statement;
- affected component and boundary map;
- selected architecture summary;
- component responsibilities and dependency direction;
- source-of-truth and data ownership decisions;
- relevant request, event, job, or data flows;
- synchronous/asynchronous communication decisions;
- API, event, queue, or integration contract boundaries;
- runtime/deployment topology when material;
- alternatives considered and decision trade-offs;
- reliability and failure-model implications;
- architecture risks, constraints, assumptions, and open questions;
- handoff requirements for Design, Engineering, Security, Quality, and Operations Intelligence;
- an ADR or decision record for material, durable choices.

A compact decision record may use:

```text
Context
Decision
Alternatives
Reason
Consequences
Status
```

## ACCEPTANCE CRITERIA

Architecture work is acceptable when all applicable conditions are true:

1. **Affected architecture is understood.** Existing components and boundaries affected by the change are identified.
2. **The architectural problem is explicit.** The output states what structural decision is required rather than restating the feature request.
3. **Material constraints are captured.** Existing stack, infrastructure, security, runtime, operational, compatibility, or team constraints that can change the decision are recorded.
4. **A viable architecture is defined.** Affected components, responsibilities, dependencies, and interaction/data flow are clear enough for implementation.
5. **Meaningful alternatives are evaluated when they exist.** The selected approach explains its material trade-offs without requiring exhaustive option matrices for trivial decisions.
6. **The solution is proportional.** Every new major component or technology has a concrete reason to exist; speculative complexity is rejected.
7. **Existing architecture is respected.** The proposal follows current conventions or explicitly justifies a deviation.
8. **Data ownership and flow are clear when data is affected.** Source of truth, writers, readers, transformations, and consistency expectations are explicit where material.
9. **Failure behavior is considered where relevant.** Networked, asynchronous, distributed, or stateful changes address material dependency failures, retries, timeouts, duplicates, recovery, or partial failure.
10. **Security boundaries are identified.** Sensitive trust boundaries or privileged flows are explicit and handed to Security Intelligence when deeper analysis is required.
11. **Operational implications are identified.** New runtime components, infrastructure, dependencies, or observability needs are explicit.
12. **Implementation can begin without architectural invention.** Engineering Intelligence should not still need to decide major placement, ownership, source-of-truth, communication, or service-boundary questions.
13. **Uncertainty is explicit.** Assumptions, missing evidence, unresolved decisions, and limitations are recorded rather than silently guessed.
14. **Material decisions are traceable.** Durable architecture choices are recorded when they are likely to affect future work.

## EXIT CONDITIONS

Architecture work is sufficient when:

- the architectural impact of the task is understood;
- the smallest robust approach has been selected;
- major boundaries, responsibilities, dependencies, and data flows are clear;
- important trade-offs and material failure modes are recorded;
- security and operational handoffs are identified;
- unresolved assumptions are explicit;
- Engineering Intelligence can begin without inventing major system structure.

Stop once these conditions are met. Do not continue designing hypothetical future systems that do not affect the current outcome.

## FAILURE MODES

Avoid:

- overengineering small tasks with microservices, event buses, service meshes, Kubernetes, caches, or other infrastructure without a requirement;
- architecture by trend or technology familiarity;
- greenfield bias that ignores the existing system and redraws it from scratch;
- premature internet-scale assumptions without evidence;
- undefined component or data ownership;
- distributed monoliths with separate deployments but tight synchronous coupling and shared ownership;
- adding asynchronous or networked behavior without failure, retry, timeout, duplicate, and recovery analysis;
- introducing infrastructure without acknowledging operational burden;
- treating diagrams or technology lists as architecture reasoning;
- using architecture work to silently expand product scope;
- continuing analysis after the decisions needed for implementation are already clear.

## COST / EFFICIENCY NOTES

Perform the minimum architecture analysis needed to remove meaningful implementation uncertainty.

Reuse durable architecture context and existing decisions. A small change may need only a few explicit decisions; a new system, distributed workflow, or infrastructure change may need component boundaries, data flow, topology, security boundaries, and failure analysis.

Do not generate large architecture documents merely because the module activated. Escalate to Research Intelligence only when an external fact can materially change the decision.

## SECURITY CONSIDERATIONS

Architecture determines trust boundaries and can create security obligations. Explicitly flag:

- authentication and authorization boundaries;
- privileged services or administrative paths;
- secrets and credential flow;
- sensitive data ownership, storage, transfer, and exposure;
- service-to-service trust;
- public/private network boundaries;
- multi-tenant isolation;
- destructive or high-impact operations;
- externally reachable integrations and callbacks.

Architecture Intelligence identifies these boundaries and structural risks. Detailed threat modelling, control selection, abuse-case analysis, and security verification belong to Security Intelligence.
