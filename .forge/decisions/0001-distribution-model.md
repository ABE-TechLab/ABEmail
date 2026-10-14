# Decision 0001: FORGE distribution model

- Status: Accepted
- Date: 2026-09-10
- Risk: Medium
- Issue: #3

## Context

The repository contains a portable `.forge/` framework but no executable installer. Forking works for framework contributors, while ordinary product teams need a safe way to add FORGE to existing repositories and receive upgrades.

## Decision

FORGE will be distributed through three supported modes:

1. an installable cross-platform TypeScript CLI as the recommended interface;
2. a FORGE-enabled repository template for new projects;
3. a documented manual copy path for early adopters and constrained environments.

The CLI will install and manage versioned framework-owned files while preserving project-owned context and decisions. User-facing commands and generated project code use the neutral `forge` / `FORGE` identity; the origin name is retained only where provenance or registry ownership requires it. The future Rust core remains an implementation detail behind the CLI, not a prerequisite for users.

## Consequences

- Installation, validation, upgrade, and ejection become explicit CLI capabilities.
- A provenance manifest must record the installation mode and framework version.
- Mixed-ownership files require conflict-aware updates.
- The repository template cannot be the only distribution mechanism.
- Package names and registry ownership must be confirmed before the first public release.
- Provenance is minimal and must not become a prefix applied to ordinary commands, links, identifiers, or generated application code.
