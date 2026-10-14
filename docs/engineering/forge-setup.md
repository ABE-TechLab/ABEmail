# gODtECH FORGE in ABEmail

ABEmail uses the **complete gODtECH FORGE 0.7.0 portable operating framework**, pinned to [source commit 976a19af7ade19551f464c218e6d5535735f6c29](https://github.com/gODtECH-Ctl-Create/gODtECH-FORGE/commit/976a19af7ade19551f464c218e6d5535735f6c29). The full `.forge/` tree carries the upstream intelligence modules, lifecycle/Git workflows, policies, schemas, examples, templates, and verification guidance. ABEmail's context/state are project-owned and must be preserved on framework upgrades.

The FORGE command-line interface (CLI) and Model Context Protocol (MCP) server are separate tools by design; they are not copied into the Next.js app or installed as a runtime dependency. Root `.mcp.json` expects `forge` on `PATH`.

## Install CLI in an agent/developer environment
The upstream README says the npm registry channel is not published, so use the canonical source/release instructions:
```bash
git clone https://github.com/gODtECH-Ctl-Create/gODtECH-FORGE.git
cd gODtECH-FORGE
npm ci
npm run build
npm link
forge --version
```

## Use a governed task from ABEmail
```bash
forge doctor
forge validate --strict
forge context
forge prepare --task "Complete authentication email delivery setup"
forge plan --task "Complete authentication email delivery setup"
forge run start --task "Complete authentication email delivery setup"
forge run status
```

Select only relevant modules:
- Auth, tokens, RLS, mailbox access: `.forge/intelligence/SECURITY.md` and `.forge/workflows/GIT.md`.
- Domains, SMTP, DNS, provider/deployment: `.forge/intelligence/OPERATIONS.md` and `.forge/workflows/DOMAIN-AND-MAIL.md`.
- UI: `.forge/intelligence/DESIGN.md` plus ABE TechLab Design System.
- Engineering/tests: `.forge/intelligence/ENGINEERING.md` and `.forge/intelligence/QUALITY.md`.
- Handover/status: `.forge/context/handover.md`, `.forge/context/project.yaml`, and `.forge/state.md`.

## MCP integration
`.mcp.json` declares local stdio server `forge` using `forge mcp serve`. It works only when the CLI is installed and the client accepts this convention. Some AI clients need equivalent user/project registration; do not assume all clients auto-discover it.

MCP prepares context/plans/metrics and exposes workflow status. It does not approve human gates or replace branch/PR/CI rules.

## Source and updates
- Framework-owned rules live in the vendored `.forge/` system.
- ABEmail-owned facts live in `.forge/context/project.yaml`, `.forge/context/handover.md`, `.forge/decisions/`, and `.forge/state.md`.
- Update README, roadmap, state, context, handover, and `.godtech/project.yml` when verified reality changes.
- Pin and review future framework updates; do not overwrite project-owned files with initializer defaults.
- `.forge/cache/` and `.forge/metrics/` are ignored local runtime state.

Built with gODtECH FORGE — Framework for Orchestrated Reasoning, Governance & Engineering.
