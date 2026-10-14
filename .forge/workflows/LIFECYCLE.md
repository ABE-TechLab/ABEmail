# FORGE Lifecycle

The default product-development flow is:

```text
IDEA → DISCOVER → RESEARCH → DEFINE → ARCHITECT → DESIGN → BUILD → SECURE → TEST → VERIFY → DEPLOY → IMPROVE
```

Each stage has four parts:

1. Inputs: what must already be known.
2. Actions: what the agent should do.
3. Outputs: what becomes project context or an implementation artifact.
4. Exit conditions: what must be true before moving forward.

## Delivery protocol

Implementation work also follows `.forge/workflows/GIT.md` unless the repository's own policy is stricter.

```text
MATERIAL WORK
    ↓
ISSUE / TRACKED INTENT
    ↓
DEDICATED BRANCH
    ↓
IMPLEMENT
    ↓
VERIFY
    ↓
PULL REQUEST
    ↓
REVIEW + CI
    ↓
MERGE
    ↓
UPDATE CONTEXT / README / STATE / ROADMAP TRACKERS
```

When material work belongs to a master roadmap or tracking issue, keep the tracker item unchecked while work is in progress. After the implementation is merged and required verification passes, update the linked implementation issue and tick the exact completed tracker item. If scope changes, update the tracker rather than silently diverging from it.

## Reasoning economy

At every stage, follow `.forge/policies/AI-EFFICIENCY.md`: use stored context and deterministic tooling before spending model effort, load only relevant intelligence, and escalate reasoning when uncertainty or risk justifies it.

## Readme initialization

For a new product, the README should be initialized during the early planning/architecture stage from verified product context and the appropriate `.forge/templates/readme/` pattern. It is then maintained as product reality changes.

## Proportionality

FORGE may shorten or expand the lifecycle for a task. It must not skip a stage silently when that stage contains a material product, market, technical, security, design, or quality decision.
