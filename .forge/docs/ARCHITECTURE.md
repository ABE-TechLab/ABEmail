# FORGE Architecture

FORGE has five separable concerns:

```text
Agent entry point
      ↓
Orchestration
      ↓
Intelligence + Workflows + Policies
      ↓
Project Context / Decisions / State
      ↓
Verification + external tooling
```

### Agent entry point
`/AGENTS.md` provides the small, discoverable contract an agent should read first. Tool-specific discovery files may live under `.github/` and similar integration locations.

### Orchestration
`.forge/core/` determines what context, workflows, policies, and intelligence modules are relevant to a task. It should remain lightweight and should not contain product-specific assumptions.

### Intelligence
`.forge/intelligence/` contains domain-specific reasoning guidance. Modules are activated selectively according to the task, product context, and risk profile.

### Workflows and policies
`.forge/workflows/` defines procedures and exit conditions. `.forge/policies/` contains cross-cutting guardrails that should not be weakened by project context.

### Project state
`.forge/context/`, `.forge/decisions/`, `.forge/state.md`, and `.forge/runs/` contain the living project-specific layer. The agent maintains these as material information changes. Workflow run records preserve plans, approvals, ordered step completion, timestamps, and evidence in portable YAML.

`.forge/cache/work-packets/` stores content-addressed preflight results. A packet is generated without an AI call and contains only bounded repository facts, selected context, relevant framework references, discovered commands, and routing hints. Adapters consume the packet and fetch additional source only when the task requires it.

### Verification
`.forge/verification/` defines checks and quality gates. Executable checks should be preferred over purely instructional rules. The approved FORGE stack uses TypeScript, Rust, Playwright, CUE, Open Policy Agent (OPA), WebAssembly (WASM), SQLite, GitHub Actions, and OpenTelemetry where their responsibilities justify them; Python and Temporal are available for specialized analysis and durable workflows.

### Integration model
FORGE should be usable as a repository template, an agent skill set, and eventually as a command-line and Model Context Protocol (MCP) interface. The implementation stack of FORGE must remain independent from the stack chosen by a project using it.

The root should remain intentionally small: `README.md`, `AGENTS.md`, optional tool-discovery files such as `.github/`, and the single `.forge/` system directory.
