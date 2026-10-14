# FORGE installation and distribution

FORGE now has a source-installable TypeScript CLI. It is not yet published to a public package registry, so registry installation commands remain release targets rather than current claims.

## Current source installation

```bash
git clone https://github.com/gODtECH-Ctl-Create/gODtECH-FORGE.git
cd gODtECH-FORGE
npm ci
npm run build
npm link
forge --help
```

Users interact with the neutral `forge` command. The repository URL and an eventual registry scope may carry the owner name where provenance or registry ownership requires it.

## Supported adoption modes

| Mode | Intended user | Status | Trade-off |
| --- | --- | --- | --- |
| CLI: `forge init` | Existing or new repositories | Implemented from source | Safe initialization, validation, diagnostics, and version tracking |
| Repository template | New projects | Usable after template hardening | Fast start, but weaker upgrade behavior |
| Fork FORGE itself | FORGE contributors | Usable now | Appropriate for framework development, not ordinary product adoption |
| Manual copy of `.forge/` + `AGENTS.md` | Early adopters | Usable now | No automated conflict handling or upgrades |

## Current commands

```bash
forge init
forge init --dry-run
forge doctor
forge validate
forge validate --strict
forge context
forge context set --key product.problem --value "Describe the problem"
forge plan --task "Implement account authentication"
forge prepare --task "Implement account authentication"
forge metrics
forge mcp serve
forge run start --task "Implement account authentication"
forge run status
forge run approve --id <run-id> --checkpoint <checkpoint-id> --by <identity>
forge run advance --id <run-id> --evidence "Describe the completed result"
forge --version
```

Commands support `--cwd <directory>` and `--json`. Initialization aborts before writing when a framework-owned file conflicts, unless the user explicitly supplies `--force`. Project-owned context, state, and manifest files are preserved during repeated initialization.

Workflow runs are stored as readable YAML under `.forge/runs/`. The runner records the original deterministic plan, approvals, completed steps, timestamps, and evidence. High-risk work cannot advance until every required human checkpoint has been approved. This release records and validates work; it does not execute arbitrary project commands.

`forge prepare` performs a bounded, model-free repository preflight and caches the result under `.forge/cache/work-packets/`. It detects languages, allowlisted manifests, Git state, relevant project context, verification commands, framework references, risk, and a provider-neutral model-tier hint. Dependency/build folders and FORGE's own installed files do not pollute the application inventory, while secret-like paths and values are excluded from packet output.

`forge metrics` summarizes privacy-preserving events stored under `.forge/metrics/`. It reports cache reuse, preparation duration, deterministic steps, tier routing, and estimated context reduction. Events contain no task text, filenames, source, repository identity, Git metadata, or secrets. Token estimates use an approximate four-characters-per-token heuristic; they are not provider billing data or guaranteed credit savings.

## AI coding clients

`forge mcp serve` starts a local stdio Model Context Protocol server using the current official TypeScript server package. It exposes five provider-neutral tools:

| Tool | Purpose |
| --- | --- |
| `forge_prepare` | Complete bounded repository discovery before model reasoning |
| `forge_plan` | Classify risk and produce a proportional execution plan |
| `forge_context` | Read the installed project's maintained context |
| `forge_run_status` | Read the latest or a named resumable workflow run |
| `forge_metrics` | Read local aggregate preparation-efficiency measurements |

These tools do not call a model, execute discovered project commands, edit application source, or approve human checkpoints. `forge_prepare` may update its deterministic cache under `.forge/cache/`.

MCP-compatible clients can launch the server with this common configuration shape:

```json
{
  "mcpServers": {
    "forge": {
      "command": "forge",
      "args": ["mcp", "serve"]
    }
  }
}
```

A validated Codex plugin and local marketplace live under `forge/codex/`. After the source install above:

```bash
codex plugin marketplace add ./forge/codex
codex plugin add forge@personal
```

Start a new Codex thread after installation. Other MCP clients use their own configuration UI or file; provider-specific installers remain future adapters rather than current compatibility claims.

## Installation boundary

`forge init`:

1. inspects the target before writing;
2. packages the portable framework and agent-discovery file;
3. creates a provenance manifest;
4. initializes project context and state;
5. preserves existing project-owned records;
6. supports a no-write dry run;
7. reports every created, updated, unchanged, preserved, or conflicting file.

It does not select the consuming application's stack, store credentials, or silently replace existing content.

## Source repository layout

The repository keeps its reusable implementation under one `forge/` directory:

```text
forge/
├── assets/       # README and distribution presentation assets
├── src/          # CLI and orchestration code
├── test/         # executable regression tests
├── scripts/      # build and packaging helpers
├── framework/    # assets installed into consuming projects
├── codex/        # local plugin marketplace and validated plugin
└── internal/     # contributor planning material
```

Only package metadata, the project README and license, GitHub automation, and the agent-discovery entry point remain at the repository root. Installed projects receive the portable `.forge/` workspace and `AGENTS.md`; they do not receive FORGE's source, tests, or internal planning files.

## Planned commands

```bash
forge upgrade
forge eject
forge plugin install <provider>
```

## Packaging direction

- Confirm the available npm package identifier before public publishing.
- Publish versioned release archives and checksums on GitHub.
- Keep the portable framework usable without the CLI.
- Add Homebrew, Scoop, and standalone binaries only after the CLI contract stabilizes.
- Sign releases and verify checksums before installation.
