# FORGE schemas

These CUE schemas are the stable Phase 1 data boundary shared by future runtimes, the CLI, policies, adapters, and verification tooling.

## Contracts

| Schema | Purpose |
| --- | --- |
| `taxonomy.cue` | Shared lifecycle, capability, risk, status, and evidence vocabularies |
| `project-context.cue` | Product-specific living context |
| `module.cue` | Selectively activated intelligence and tooling modules |
| `workflow.cue` | Ordered procedures, approvals, outputs, and exit conditions |
| `decision-evidence.cue` | Durable decisions and their supporting evidence |
| `verification.cue` | Deterministic check results and release decisions |
| `workflow-run.cue` | Persisted plans, approvals, progress, and evidence |
| `work-packet.cue` | Bounded deterministic repository and AI handoff facts |
| `efficiency-metric.cue` | Privacy-preserving local preparation measurements |
| `manifest.cue` | FORGE installation and provenance metadata |

All schema files contain definitions, so the directory composes as one package. Contracts use semantic versions. Backward-compatible additions increment the minor version; incompatible field or meaning changes require a major version. Unknown integration-specific data belongs under `extensions`.

## Validation

Install the CUE CLI, then run:

```bash
cue vet -d '#ProjectContext' ./.forge/schemas ./.forge/context/project.yaml
cue vet -d '#ModuleDocument' ./.forge/schemas ./.forge/schemas/examples/valid/module.yaml
cue vet -d '#WorkflowDocument' ./.forge/schemas ./.forge/schemas/examples/valid/workflow.yaml
cue vet -d '#DecisionRecord' ./.forge/schemas ./.forge/schemas/examples/valid/decision.yaml
cue vet -d '#VerificationDocument' ./.forge/schemas ./.forge/schemas/examples/valid/verification.yaml
cue vet -d '#WorkflowRun' ./.forge/schemas ./.forge/schemas/examples/valid/workflow-run.yaml
cue vet -d '#WorkPacket' ./.forge/schemas ./.forge/schemas/examples/valid/work-packet.yaml
cue vet -d '#PrepareMetricEvent' ./.forge/schemas ./.forge/schemas/examples/valid/efficiency-metric.yaml
```

The fixture under `examples/invalid/` is intentionally invalid and must cause `cue vet -d '#ModuleDocument'` to exit non-zero.
