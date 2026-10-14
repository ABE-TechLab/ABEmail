# AI Efficiency & Reasoning Economy

FORGE is designed to maximize useful work per unit of AI computation, tokens, or credits. The agent should use model reasoning where judgment is valuable and deterministic tooling everywhere else.

## Core rule

> Do not spend model intelligence on work that FORGE, the repository, or a deterministic tool can establish reliably.

## Preprocess-before-model contract

Before an adapter calls an AI model, FORGE should do as much reliable preparation as the available deterministic tooling permits:

1. inspect repository facts and current Git state;
2. load verified project context and reusable decisions;
3. classify the task, risk, workflow, and required capabilities;
4. select only the files and framework modules material to the task;
5. discover available build, test, policy, and verification commands;
6. produce a compact work packet containing facts, constraints, unresolved decisions, expected outputs, and exit conditions.

The model should not be asked to rediscover facts already present in that packet. Adapters should send references, summaries, hashes, or bounded excerpts where possible instead of entire repositories or unchanged conversation history.

## Efficiency principles

- Load only the intelligence modules relevant to the task.
- Reuse verified project context, decisions, evidence, and previous analysis.
- Do not repeatedly rediscover unchanged repository facts.
- Prefer local inspection, parsing, validation, and tests before asking a model to reason about them.
- Use deterministic tools for deterministic questions.
- Avoid generating speculative implementation before requirements and constraints are sufficiently understood.
- Batch related reasoning when it is cheaper and clearer than repeated isolated calls.
- Escalate to deeper reasoning only when ambiguity, risk, novelty, or complexity justifies it.
- Use the smallest capable model or reasoning depth available when the execution environment supports model selection.
- Cache or persist reusable results when they remain valid.

## Deterministic-first examples

Prefer tooling for:

```text
Git status / diff             → Git
Repository structure          → filesystem + Tree-sitter
Package metadata              → package manager manifests
Syntax / parsing              → Tree-sitter
Configuration validation      → CUE
Policy evaluation             → Open Policy Agent (OPA) / Rego
Tests                         → project test runner
Builds                        → project build tooling
Browser behavior              → Playwright
Dependency facts              → lockfiles / package managers
Project state already known   → .forge/context + .forge/decisions
```

## Model-worthy work

Reserve substantive model effort for work such as:

- ambiguous product requirements;
- product and market reasoning;
- research synthesis;
- architectural trade-offs;
- design reasoning;
- novel debugging and root-cause analysis;
- security threat reasoning;
- prioritization and scope decisions;
- interpretation of conflicting evidence.

## Context economy

Project context is a persistent asset. Prefer concise structured records over repeatedly reconstructing the same information in conversation. Update context when a material decision changes; do not churn it for trivial events.

## Verification economy

Verification should be proportional to risk. Cheap deterministic checks should run early. Expensive or deep checks should be triggered when the affected surface, risk level, or release stage warrants them.

## Never optimize by weakening quality

Credit efficiency must never be achieved by skipping material security, testing, accessibility, correctness, or release checks. The goal is less wasted intelligence, not less engineering discipline.

## Local measurement

Every `forge prepare` invocation records a local, Git-ignored metric event with cache status, elapsed preparation time, bounded-context counts, task category, risk, model-tier hint, and deterministic-step count. `forge metrics` summarizes those events. Metrics must not contain task text, filenames, source, repository identity, Git metadata, or secrets.

Estimated tokens use a documented four-characters-per-token heuristic. This is useful for consistent local comparison but is not provider billing data. True assisted-versus-unassisted studies require opt-in provider usage and outcome data for the same task, repository, model, and provider.

## Future measurement

FORGE should eventually measure:

```text
model calls
input/output usage
provider-reported input/output usage
assisted versus unassisted baselines
reasoning escalations
deterministic tool usage
verification failures
completed work per model call
retries caused by missing or incorrect context
percentage of planning and verification resolved deterministically
```

The objective is to improve the amount of reliable product work achieved for each unit of AI usage. FORGE must not claim a fixed percentage saving without measuring the same task, repository, model, and provider against an unassisted baseline.
