# Intelligence

FORGE intelligence is modular domain guidance. Modules are activated by task and project context rather than loaded wholesale.

## Static phase status

The static Intelligence module set is complete. Product, Market, Research, Architecture, Design, Engineering, Security, Quality, Operations, Documentation, Git / Delivery, and Provenance Intelligence now form the shipped reasoning layer. The next Intelligence milestone is adaptive module selection informed by measured outcomes; that work must improve selection without making every task load every module.

## Module contract

Every mature intelligence module defines:

- PURPOSE
- SCOPE
- TRIGGERS
- INPUTS
- PROCEDURE
- TOOLS AND EVIDENCE
- OUTPUTS
- EXIT CONDITIONS
- FAILURE MODES
- COST / EFFICIENCY NOTES
- SECURITY CONSIDERATIONS

Modules may add domain-specific acceptance criteria when a precise handoff boundary is useful.

This contract keeps intelligence composable. The orchestrator selects modules; the modules provide domain reasoning guidance; deterministic tooling provides facts and verification where possible.

## Static module registry

| Capability | Portable module |
| --- | --- |
| `product` | `.forge/intelligence/PRODUCT.md` |
| `market` | `.forge/intelligence/MARKET.md` |
| `research` | `.forge/intelligence/RESEARCH.md` |
| `architecture` | `.forge/intelligence/ARCHITECTURE.md` |
| `design` | `.forge/intelligence/DESIGN.md` |
| `engineering` | `.forge/intelligence/ENGINEERING.md` |
| `security` | `.forge/intelligence/SECURITY.md` |
| `quality` | `.forge/intelligence/QUALITY.md` |
| `operations` | `.forge/intelligence/OPERATIONS.md` |
| `documentation` | `.forge/intelligence/DOCUMENTATION.md` |
| `git-delivery` | `.forge/intelligence/GIT_DELIVERY.md` |
| `provenance` | `.forge/intelligence/PROVENANCE.md` |

This registry is the completed static set. Regression coverage verifies that clean initialization ships every listed module and that representative prepared tasks can reach every capability-to-module mapping without broadening narrow work packets.

## Available modules

- [Product Intelligence](./PRODUCT.md) — problem, users, value, scope, workflows, MVP boundaries, and success criteria.
- [Market Intelligence](./MARKET.md) — geography, segments, alternatives, positioning, adoption constraints, and evidence-backed differentiation.
- [Research Intelligence](./RESEARCH.md) — bounded evidence gathering, source quality, freshness, uncertainty, and stop conditions.
- [Architecture Intelligence](./ARCHITECTURE.md) — system boundaries, responsibilities, dependency direction, data/integration flows, topology, failure implications, and proportional architecture decisions.
- [Design Intelligence](./DESIGN.md) — user flows, information hierarchy, interaction states, accessibility, responsive behavior, design-system reuse, and implementation-ready experience handoff.
- [Engineering Intelligence](./ENGINEERING.md) — repository-aligned implementation reasoning, contract and migration changes, failure behavior, compatibility, maintainability, and verification-ready code handoff.
- [Security Intelligence](./SECURITY.md) — trust boundaries, identity, authorization, sensitive data, secrets, abuse cases, proportional controls, residual risk, and security verification handoff.
- [Quality Intelligence](./QUALITY.md) — acceptance-to-test mapping, regression risk, positive/negative paths, proportional test layers, test gaps, release blockers, and verification-ready quality evidence.
- [Operations Intelligence](./OPERATIONS.md) — deployment/runtime targets, rollout and rollback, observability, health, capacity, failure recovery, migrations, runbooks, operational ownership, and production evidence.
- [Documentation Intelligence](./DOCUMENTATION.md) — audience and reader outcomes, source-of-truth selection, factual accuracy, information architecture, examples/commands, status accuracy, stale-content detection, and verification-ready documentation evidence.
- [Git / Delivery Intelligence](./GIT_DELIVERY.md) — tracked intent, branch/scope discipline, commit and PR structure, merge readiness, conflict handling, hotfix delivery, and post-merge synchronization.
- [Provenance Intelligence](./PROVENANCE.md) — framework/artifact origin, attribution, evidence lineage, source/claim traceability, provenance drift, safe metadata, and downstream provenance handoff.

## Activation rules

- Load only modules activated by the plan.
- A normal feature may activate Product + Architecture + Engineering without automatically requiring Market or Research Intelligence.
- Material UI/UX work activates Design Intelligence before Engineering; backend-only features and non-user-facing changes do not pay that design-context cost.
- New-product, product-definition, market, competitor, pricing, feasibility, and explicit research work may activate Product + Market + Research together; Architecture joins when structural technical decisions are required, Design joins only when a material user-facing surface is in scope, and Engineering joins when implementation is actually requested.
- Feature, bug, refactor, security, and infrastructure implementation work can activate Engineering directly according to the planner's existing capability model.
- Sensitive identity, permission, secret, payment, personal-data, production, destructive, and high-risk work activates Security Intelligence according to the planner's existing risk/capability model.
- Feature, bug, refactor, security, and infrastructure work activates Quality Intelligence through the planner's existing `quality` capability; lightweight documentation and research work do not pay that quality-context cost.
- Infrastructure, production-impact, deployment, observability, health, rollback, runbook, capacity, backup/restore, and other material runtime work activates Operations Intelligence through the existing `operations` capability.
- Documentation and research/report work activates Documentation Intelligence through the existing `documentation` capability; ordinary implementation work does not pay that documentation-context cost unless the planner explicitly activates documentation.
- Git / Delivery Intelligence follows the existing cross-cutting `git-delivery` capability. It provides delivery judgment, while `.forge/workflows/GIT.md` remains the procedural source of truth for issue, branch, PR, merge, and cleanup actions.
- Provenance Intelligence activates only for provenance, attribution, generated-by/source traceability, evidence-origin, release-metadata, attestation/SBOM-style origin, or `.forge/manifest.yaml` work. `.forge/policies/PROVENANCE.md` remains the normative provenance policy.
- Security, infrastructure, and material refactor work may activate Architecture directly without Product Intelligence.
- A module may request another module when a material decision depends on evidence or another domain.
- Do not use module activation as permission to broaden scope beyond the user's outcome.

## Evidence boundary

Intelligence must distinguish:

- verified project context;
- user-provided requirements;
- external evidence;
- model inference;
- unresolved assumptions.

External facts that may be current, contested, geographic, regulatory, commercial, or otherwise consequential should be researched rather than guessed.

## Efficiency rule

FORGE should not load every intelligence file into every task. Reuse stored context, select the smallest relevant module set, and stop research/reasoning when additional work is unlikely to change the decision.
