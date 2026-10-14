# Git / Delivery Intelligence

## PURPOSE

Help the agent reason about how a scoped change should move through version control and review safely, clearly, and with enough evidence to be auditable without turning Git mechanics into unnecessary ceremony.

The default question is:

> What is the smallest reviewable delivery path that preserves scope, history, evidence, and recovery while respecting the repository's existing workflow?

Git / Delivery Intelligence provides delivery judgment. It does not replace the procedural rules in `.forge/workflows/GIT.md`, implementation reasoning from Engineering Intelligence, verification, provenance recording, or production rollout planning.

## SCOPE

Git / Delivery Intelligence covers reasoning about:

- whether work is material enough to require a tracked issue;
- mapping requested work to the correct issue or tracker item;
- branch purpose, branch naming, and branch/base selection;
- keeping one branch focused on one coherent unit of work;
- detecting unrelated edits or accidental scope growth;
- deciding sensible commit boundaries;
- writing meaningful commit intent without manufacturing history;
- preparing a pull request that explains what changed, why, risk, verification, and limitations;
- distinguishing implementation completion from merge readiness;
- respecting protected branches and repository safeguards;
- avoiding force-pushes or history rewriting that hides shared work;
- recognizing when a branch is stale or based on outdated assumptions;
- handling merge conflicts without silently discarding valid changes;
- deciding when a hotfix requires a minimal emergency path;
- identifying delivery-sensitive rollback or reversibility concerns;
- ensuring issue, roadmap, state, README, and other tracked status are synchronized after verified merge;
- recording unresolved follow-up work instead of hiding it inside a completed change.

Git / Delivery Intelligence does not own:

- feature design or code implementation;
- architecture decisions;
- product scope;
- test design or execution;
- security control design;
- production deployment execution;
- release provenance or authorship claims;
- repository-host configuration or branch-protection administration.

## BOUNDARIES

Use the following ownership model:

- **Engineering Intelligence** decides how the code change should be implemented.
- **Quality Intelligence** determines what should be tested and what regressions matter.
- **Security Intelligence** defines security-sensitive controls and security verification needs.
- **Operations Intelligence** defines rollout, rollback, recovery, and runtime evidence when deployment is involved.
- **Documentation Intelligence** keeps human-facing project documentation accurate.
- **Provenance Intelligence** determines how origin, authorship, generated material, evidence lineage, and release provenance should be represented.
- **Git / Delivery Intelligence** decides how the completed change should be packaged into reviewable version-control units and moved through issue → branch → commit → PR → merge → synchronized state.
- **`.forge/workflows/GIT.md`** remains the authoritative procedural workflow for Git and delivery actions.
- **Verification** determines whether objective evidence is sufficient to claim completion.

Do not copy the Git workflow into this module. Use this module for judgment when the procedure leaves choices open.

## TRIGGERS

Activate whenever the planner selects the existing `git-delivery` capability.

FORGE currently treats Git/delivery governance as a cross-cutting capability for governed repository work because even lightweight changes need a safe path from intent to reviewable state.

The depth of reasoning must still be proportional:

- a typo may need only a tiny branch and one coherent commit;
- a feature may require issue linkage, multiple coherent commits, a structured PR, and roadmap/state updates;
- a production hotfix may require a minimal emergency branch, exact verification evidence, rollback awareness, and post-merge follow-up.

Do not create a separate task kind merely for Git operations unless the user's requested outcome is itself explicitly about repository history or delivery configuration.

## INPUTS

Prefer, in order:

1. user-requested outcome and explicit delivery instructions;
2. planner task kind, risk, activated capabilities, ordered steps, and approval checkpoints;
3. current Git facts from deterministic inspection: branch, commit, dirty state, and changed paths;
4. `.forge/workflows/GIT.md`;
5. repository-specific contribution, branch, PR, release, or review rules;
6. linked implementation issue, roadmap item, milestone, or incident record when available;
7. changed-file scope and implementation handoff from Engineering Intelligence;
8. verification evidence and known gaps from Quality / Verification;
9. security or operations constraints that affect merge or release readiness;
10. documentation/state changes required to keep repository reality synchronized;
11. provenance requirements when authorship, generated artifacts, release evidence, or external-source lineage matters.

Do not infer repository-host settings, approvals, reviewers, branch protection, or CI state when they can be inspected deterministically.

## PROCEDURE

1. Identify the unit of work being delivered and the user-visible or system-visible outcome it represents.
2. Confirm whether an existing issue or tracker item already owns the work before creating another one.
3. Determine the correct base branch from repository policy and current project state.
4. Confirm the working branch represents one coherent unit of work and is not a protected branch.
5. Inspect changed paths and separate intended changes from unrelated edits, generated artifacts, secrets, local files, and accidental modifications.
6. Compare the branch scope with the issue and acceptance criteria. If the implementation has materially diverged, update the tracked intent rather than hiding the change.
7. Decide commit boundaries around coherent reasoning units, not arbitrary file counts.
8. Preserve meaningful history. Do not rewrite shared history merely to make the timeline look cleaner.
9. Before PR creation, confirm the implementation is complete enough for review and that required verification evidence exists or blocked checks are explicitly documented.
10. Prepare the PR narrative: what changed, why, linked issue, architecture/data impact, security impact, verification, limitations, follow-ups, and tracker relationship when relevant.
11. Confirm the branch is mergeable against the intended base and resolve conflicts by understanding both sides rather than mechanically choosing one.
12. For high-risk, production, destructive, migration, or hotfix work, confirm rollback/recovery implications handed off by Operations or Security Intelligence.
13. Merge only through the repository's accepted path and only after required checks/approvals are satisfied.
14. After merge, synchronize issue state, roadmap checkboxes, `.forge/state.md`, decisions, README, and other tracked project reality when applicable.
15. Delete completed branches when safe and repository policy expects cleanup.
16. Record follow-up work explicitly rather than smuggling unfinished work into a closed issue.
17. Stop when the change is reviewable, verified, traceable, merged through the correct path, and tracked state reflects repository reality.

## DELIVERY JUDGMENT

### Issue discipline

Create or link an issue when work is material, including:

- features;
- bugs/regressions;
- security work;
- architecture/database changes;
- meaningful refactors;
- infrastructure/deployment work;
- investigations that produce implementation decisions.

A tiny typo or formatting-only correction may use a lighter path when repository policy allows it.

Do not open duplicate issues when an existing issue already owns the work.

### Branch discipline

A branch should communicate purpose and remain bounded to one coherent outcome.

Prefer branch names that connect intent and tracking, for example:

```text
feat/issue-123-user-auth
fix/issue-124-login-loop
security/issue-125-token-scope
chore/issue-126-docs-refresh
```

Do not treat naming style as more important than repository convention.

### Commit discipline

A useful commit is:

- coherent;
- reviewable;
- understandable without reconstructing chat history;
- free of secrets and accidental artifacts;
- honest about what it changes.

Avoid:

- `update`, `fix stuff`, or similarly meaningless messages;
- mixing unrelated cleanup with feature behavior;
- splitting every file into a separate commit without a reasoning boundary;
- rewriting shared history to conceal mistakes;
- committing generated credentials, local environment files, or sensitive artifacts.

### Pull-request discipline

A useful PR should let a reviewer answer:

- What outcome is this delivering?
- Why was this approach taken?
- Which issue/tracker owns the work?
- What architecture/data/security/runtime impact exists?
- What verification actually ran?
- What did not run, and why?
- What limitations or follow-ups remain?

Do not claim merge readiness solely because code was edited successfully.

### Merge readiness

Merge readiness normally requires:

- scope matches tracked intent;
- required approvals are resolved;
- applicable deterministic checks are green;
- material review comments are addressed;
- no known release-blocking defect remains;
- documentation/state that would become false after merge is updated;
- merge target is current enough to avoid knowingly integrating stale assumptions.

If repository rules are stricter, follow them.

## SCOPE CONTAINMENT

Before delivery, compare:

```text
Requested outcome
    ↓
Tracked issue / acceptance criteria
    ↓
Changed files
    ↓
Behavioral changes
    ↓
Verification evidence
```

Investigate mismatches such as:

- changed files unrelated to the issue;
- dependency upgrades not required by the task;
- broad refactors hidden inside a feature;
- documentation claiming features not implemented;
- generated files that should not be committed;
- security-sensitive changes not reflected in the issue or PR;
- infrastructure changes with no rollout/recovery note;
- roadmap boxes checked before merge and verification.

Scope can legitimately evolve. When it does, update the tracked intent rather than pretending the original scope never changed.

## CONFLICT HANDLING

A merge conflict is evidence that two histories touch the same region; it is not permission to choose one side blindly.

When conflicts occur:

1. identify the semantic intent of both sides;
2. determine whether upstream changed assumptions used by the branch;
3. preserve valid behavior from both where appropriate;
4. rerun affected verification;
5. update the PR if the resolution materially changes risk or scope.

Do not use `ours`/`theirs` mechanically for substantive conflicts.

## HOTFIXES

Emergency work still needs traceability.

Use the smallest safe path:

```text
INCIDENT → HOTFIX BRANCH → MINIMAL SAFE CHANGE → VERIFY → PR → MERGE → DEPLOY → POST-DEPLOY CHECK → FOLLOW-UP
```

For hotfixes:

- reduce scope aggressively;
- preserve rollback or recovery options where possible;
- do not bundle cleanup;
- document skipped checks explicitly;
- create follow-up work for root-cause analysis or deferred hardening.

Urgency may shorten ceremony; it does not make untraceable direct writes safe.

## TOOLS AND EVIDENCE

Prefer deterministic evidence from:

- Git branch/current commit inspection;
- working-tree status;
- changed-file lists and diffs;
- issue and PR metadata;
- compare/mergeability results;
- CI/check status;
- review status;
- repository rules and contribution documentation;
- release/deployment evidence when relevant;
- exact merge commit or squash commit after completion.

Evidence should distinguish:

- observed repository state;
- repository policy;
- user instruction;
- model recommendation;
- unresolved limitation.

Do not fabricate reviewers, approvals, check results, branch protection, merge status, commit IDs, or release state.

## OUTPUTS

Produce only what the task needs. Possible outputs include:

- issue/tracker linkage;
- branch/base recommendation;
- scope-containment assessment;
- commit plan;
- PR content requirements;
- merge-readiness assessment;
- conflict-resolution considerations;
- hotfix delivery path;
- rollback/recovery delivery notes;
- post-merge synchronization checklist;
- delivery risks or blockers;
- unresolved follow-up work;
- exact repository evidence needed before completion.

A compact delivery handoff may use:

```text
Tracked intent
Branch / base
Scope
Commit boundaries
PR requirements
Verification status
Merge blockers
Post-merge updates
Follow-ups
```

## ACCEPTANCE CRITERIA

Git/delivery reasoning is sufficient when all applicable conditions are true:

1. **Tracked intent is clear.** The change maps to the correct issue, tracker, incident, or documented intent.
2. **Branch scope is coherent.** The branch represents one understandable unit of work.
3. **Protected-branch safety is preserved.** Direct writes, force-pushes, or bypasses are not used merely for convenience.
4. **Changed scope is understood.** Unrelated edits and accidental artifacts are removed or explicitly separated.
5. **Commit structure is reviewable.** Commits communicate coherent change intent without manufactured history.
6. **PR context is sufficient.** Reviewers can understand outcome, rationale, risk, verification, and limitations.
7. **Verification is not confused with editing.** Merge readiness depends on required checks/evidence, not only successful file modification.
8. **Conflicts are resolved semantically.** Valid upstream and branch intent are reconciled and affected checks rerun.
9. **High-risk delivery is recovery-aware.** Production, migration, destructive, security, or hotfix work carries the necessary rollback/recovery context.
10. **Repository reality is synchronized after merge.** Issues, roadmap items, state, decisions, and README are updated when they changed.
11. **Unfinished work remains visible.** Follow-ups and blocked checks are not hidden by closing the main issue.
12. **Delivery evidence is traceable.** Branch, PR, checks, merge state, and completion claims can be tied to observable repository evidence.

## EXIT CONDITIONS

Stop Git / Delivery Intelligence when:

- the tracked intent and branch scope match;
- commit/PR structure is clear enough for review;
- merge blockers and required evidence are known;
- the correct delivery path is established;
- post-merge synchronization requirements are identified;
- no unresolved delivery decision remains that Engineering, Security, Quality, Operations, Documentation, Provenance, or Verification must answer first.

Do not continue optimizing Git history or process aesthetics after the delivery path is already safe and reviewable.

## FAILURE MODES

Avoid:

- process theater for trivial changes;
- direct writes to protected branches for convenience;
- duplicate issues;
- unrelated cleanup inside feature branches;
- branch names that hide intent;
- meaningless commit messages;
- force-pushing shared history to hide mistakes;
- mechanical conflict resolution;
- PRs that omit failed or skipped verification;
- merging stale assumptions without revalidation;
- treating CI green as proof that scope is correct;
- treating review approval as proof that tests passed;
- ticking roadmap work before verified merge;
- leaving tracker/state/README reality stale after merge;
- using Git / Delivery Intelligence to duplicate Provenance Intelligence.

## COST / EFFICIENCY NOTES

Delivery reasoning should be proportional to risk and change size.

For a tiny documentation correction, the useful output may be only:

- correct branch;
- one coherent commit;
- lightweight review/merge path.

For a large feature or production hotfix, deeper reasoning may include:

- issue/roadmap synchronization;
- branch/base validation;
- scope audit;
- commit boundaries;
- PR evidence;
- approvals;
- rollback implications;
- post-merge state updates.

Reuse deterministic Git and repository-host facts. Do not spend model reasoning rediscovering branch names, changed files, check status, or merge state that tools can report directly.

## SECURITY CONSIDERATIONS

Git and delivery paths can expose sensitive information or bypass controls.

Always consider:

- secret-like files and credentials in changed paths;
- accidental inclusion of `.env`, keys, tokens, dumps, or local artifacts;
- force-push or history rewriting that could conceal unsafe changes;
- protected branch bypass;
- unreviewed security-sensitive changes;
- production hotfixes that weaken controls under urgency;
- CI logs, PR descriptions, or commit messages that leak secrets;
- dependency or infrastructure changes hidden inside unrelated work.

Detailed threat/control analysis belongs to Security Intelligence. Provenance and authorship integrity belongs to Provenance Intelligence.