# FORGE Stack

FORGE is intentionally polyglot: each technology has a bounded role, and none of these choices constrain the application stack of a project using FORGE.

## Approved baseline

| Technology | FORGE role |
|---|---|
| Rust | Core engine and high-confidence local/system tooling |
| TypeScript + Node.js | CLI, orchestration glue, integrations, developer tooling |
| Python | Research, analysis, scoring, and experimental intelligence tooling |
| CUE | Strong configuration modeling and validation |
| Tree-sitter | Structural source-code analysis across languages |
| Open Policy Agent (OPA) + Rego | Executable policy, security, and governance rules |
| WebAssembly (WASM) | Portable execution boundary for selected policies and checks |
| Model Context Protocol (MCP) | Agent-facing tools, resources, and prompts |
| SQLite | Local project memory, state, evidence, and verification data |
| Playwright | Browser, interaction, responsive, and visual verification |
| GitHub Actions | Continuous Integration (CI), automated quality gates, and repository workflows |
| OpenTelemetry | Traces, metrics, and logs for FORGE operations |
| Temporal | Optional durable workflow orchestration when long-running stateful workflows justify it |

## Stack principles

1. Use the simplest component that satisfies the responsibility.
2. Keep the intelligence model independent of implementation language.
3. Prefer portable, inspectable formats and deterministic validation where practical.
4. Do not add a technology only because it is impressive; every component must earn its operational cost.
5. Keep project-facing integration lightweight even when FORGE internals are sophisticated.

## Target-project independence

A project using FORGE may use any reasonable application stack. FORGE should understand and verify the target stack rather than impose Rust, TypeScript, Python, or any other FORGE implementation technology on it.
