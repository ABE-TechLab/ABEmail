# README Generation Workflow

The README is initialized as part of product setup, not after implementation.

## Trigger

When a product has enough initial context to enter planning or architecture, the agent should create or replace the project README using the appropriate FORGE README template.

Do not wait for the product to be fully built.

## Required sequence

```text
PRODUCT INTENT
    ↓
INITIAL CONTEXT
    ↓
SELECT README TYPE
    ↓
GENERATE PRODUCT-SPECIFIC README
    ↓
BUILD
    ↓
VERIFY + REFRESH README
```

## Generation rules

1. Read `.forge/context/`, relevant decisions, and current project state.
2. Inspect the real repository, package metadata, planned architecture, and known product scope.
3. Determine whether the project is best represented by `PRODUCT.md`, `LIBRARY.md`, or `TOOL.md`.
4. Generate a README that reflects the product's own identity, users, problem, value, workflows, design language, architecture, stack, and current state.
5. Never copy another project's branding, wording, assets, screenshots, claims, or product identity.
6. Use placeholders only when the information genuinely cannot yet be known. Do not invent facts.
7. Add the required FORGE provenance attribution.
8. Prefer real visual evidence when available. Do not manufacture screenshots, metrics, demos, or production claims.
9. Validate links, images, badges, diagrams, code blocks, commands, and Markdown structure.

## During development

The README is a living product document. Update it when meaningful changes affect:

- product capabilities;
- user workflows;
- architecture;
- technology;
- security posture;
- deployment model;
- status;
- roadmap;
- visual presentation.

Do not rewrite the README for trivial code changes.

## Before release

Perform a README accuracy pass alongside release verification. The document must distinguish what works now from what is planned and must not describe stale architecture or obsolete commands.
