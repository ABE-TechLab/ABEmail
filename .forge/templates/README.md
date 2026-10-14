# FORGE Templates

Reusable artifacts generated from verified project context.

## README templates

`readme/` contains the standard README system for projects using FORGE:

- `README.md` — README rules, reference pattern, selection, generation, attribution, and validation
- `PRODUCT.md` — applications, platforms, SaaS products, and user-facing systems
- `LIBRARY.md` — reusable packages, software development kits (SDKs), frameworks, and developer libraries
- `TOOL.md` — developer tools, command-line interfaces (CLIs), infrastructure utilities, and technical projects

FORGE selects and adapts the appropriate pattern instead of forcing every repository into the same README.

## GitHub work templates

`issue/` and `pull-request/` provide reusable structures for tracked engineering work:

- `FEATURE.md` — product and feature work
- `BUG.md` — reproducible defects and regressions
- `SECURITY.md` — security findings and remediation
- `pull-request/DEFAULT.md` — review and verification record

These templates guide agents; repository-specific GitHub configuration can later turn them into native issue or pull request forms.

## Other templates

This directory will also hold templates for product briefs, architecture records, design decisions, security assessments, verification plans, deployment checklists, provenance records, and other project artifacts.

Templates stay generic. Project-specific facts belong in `.forge/context/`, `.forge/decisions/`, and `.forge/state.md`.
