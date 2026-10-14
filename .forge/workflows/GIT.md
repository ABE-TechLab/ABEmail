# FORGE Git & Delivery Workflow

FORGE treats version control as part of engineering quality. The agent must preserve a clean, reviewable history and must not bypass repository safeguards for convenience.

## Default flow

```text
REQUEST
  ↓
CLASSIFY WORK
  ↓
ISSUE (when material)
  ↓
FEATURE BRANCH
  ↓
INSPECT + PLAN
  ↓
IMPLEMENT
  ↓
VERIFY
  ↓
COMMIT
  ↓
PUSH
  ↓
PULL REQUEST
  ↓
CI / REVIEW
  ↓
MERGE
  ↓
CLEAN UP + UPDATE STATE / TRACKERS
```

## Branch protection

- Never commit directly to `main` or another protected release branch.
- Never force-push a protected branch.
- Do not rewrite shared history to hide mistakes.
- Before starting meaningful work, inspect the current branch and working tree.
- Start from the current target branch unless the repository's workflow specifies another base.

## Work classification

An issue should normally exist for:

- features and product changes;
- bugs and regressions;
- security work;
- architecture and database changes;
- meaningful refactors;
- performance, infrastructure, or deployment work;
- investigation that produces an implementation decision.

A trivial typo, formatting-only change, or similarly tiny correction may use a branch without a separate issue when repository policy permits it.

## Roadmap and tracker synchronization

When work implements an item from a master roadmap, milestone, or tracking issue:

1. Reference the tracker from the implementation issue.
2. Reference both the implementation issue and the relevant tracker in the pull request when practical.
3. Keep the tracker item unchecked while work is only planned, in progress, or awaiting verification.
4. Tick the exact tracker checklist item only after the implementation is merged and required verification has passed.
5. Update the implementation issue and tracker together when completion changes documented project reality.
6. If the implementation scope changes, update the tracker rather than silently completing a different outcome.

The tracker is a status record, not a planning shortcut. A checked item must correspond to merged, verified repository state.

## Branch naming

Prefer descriptive names such as:

```text
feat/issue-123-user-auth
fix/issue-124-login-loop
refactor/issue-125-data-layer
security/issue-126-access-control
chore/issue-127-dependency-update
hotfix/issue-128-production-failure
```

## Scope discipline

- One branch should represent one coherent unit of work.
- Do not bundle unrelated features, cleanup, dependency upgrades, and redesigns together.
- Inspect related issues, branches, and open pull requests before duplicating work.
- Avoid unrelated file changes.

## Commit discipline

- Commit coherent, reviewable units.
- Use messages that explain the change rather than vague messages such as `update` or `fix stuff`.
- Do not commit secrets, generated credentials, local environment files, or accidental artifacts.

## Pull requests

A pull request should make the work auditable. Include:

- what changed;
- why it changed;
- linked issue when applicable;
- linked roadmap/tracker item when the work advances one;
- architecture or data impact;
- security impact;
- verification performed;
- known limitations or follow-up work.

Do not treat a successful local edit as sufficient evidence for merge.

## Verification gate

Before requesting merge, run the applicable project checks, including when relevant:

```text
lint
format validation
type checking
unit/integration tests
production build
security checks
migration validation
accessibility checks
responsive/visual checks
end-to-end checks
```

Failed checks must be investigated and fixed at the root cause. Do not disable, bypass, or weaken a check merely to obtain a passing result.

## Merge and cleanup

After approval and passing required checks:

1. Merge through the repository's normal review process.
2. Verify the target branch after merge when the workflow calls for it.
3. Delete the completed feature branch when safe.
4. Close or update the linked issue.
5. If the work completed a roadmap/tracker item, tick that exact item only now, after merge and verification.
6. Update `.forge/state.md`, decisions, project context, and README when the product's documented reality changed.

## Production hotfixes

Emergency work still uses a branch and verification path:

```text
INCIDENT → HOTFIX BRANCH → MINIMAL SAFE CHANGE → VERIFY → PR → MERGE → DEPLOY → POST-DEPLOY CHECK → RECORD
```

Use the smallest safe change. Follow with a proper root-cause investigation when the incident is not fully understood.
