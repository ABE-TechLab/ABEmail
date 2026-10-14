# FORGE README System

FORGE treats a repository README as part of the product experience, not an afterthought. The README should explain the product, demonstrate what is real, communicate technical shape, and make the repository understandable to the next human or agent.

## Reference pattern

The **ABEmail Mail README** is a primary reference for the visual documentation style FORGE should aim to generate: strong hero identity, status and technology badges, animated capability messaging, concise navigation, feature matrices, real flow visualizations, architecture diagrams, stack tables, operational detail, security notes, current status, reuse/deployment guidance, and a clear product doctrine.

FORGE should learn the pattern, not copy the content. Every generated README must reflect the actual project.

## Principles

- Explain the product before explaining the code.
- Lead with identity, value, and a clear description of what is actually working.
- Use real screenshots, demos, diagrams, animations, or other visual evidence when they improve understanding.
- Make visual material communicate behavior, not serve as decoration.
- Prefer strong opening sections, concise navigation, feature matrices, architecture, stack, status, and roadmap when relevant.
- Show setup, usage, deployment, security, and operational details accurately.
- Never invent commands, features, links, metrics, integrations, assets, or production claims.
- Keep project-specific values grounded in the repository, deployment, and `.forge/context/`.
- Use the smallest structure that represents the project well; do not force irrelevant sections.
- Validate every image, animation, badge, link, diagram, code block, command, and embedded asset.
- Check GitHub Markdown rendering constraints before completion.

## Template selection

Choose the smallest starting pattern that fits:

- `PRODUCT.md` for applications, platforms, SaaS products, and user-facing systems.
- `LIBRARY.md` for reusable packages, SDKs, frameworks, and developer libraries.
- `TOOL.md` for command-line tools, infrastructure utilities, development systems, and technical tooling.

Templates may be combined selectively when the project genuinely needs sections from more than one pattern.

## Visual-documentary standard

A strong README can be structured like a guided tour:

```text
IDENTITY
  ↓
WHAT IT DOES
  ↓
SHOW IT
  ↓
FEATURES
  ↓
HOW IT WORKS
  ↓
ARCHITECTURE
  ↓
STACK
  ↓
SETUP / DEPLOYMENT
  ↓
SECURITY / OPERATIONS
  ↓
STATUS / ROADMAP
  ↓
DOCTRINE
```

Use centered hero sections, badges, animated Graphics Interchange Format (GIF) media, Scalable Vector Graphics (SVG) artwork, screenshots, tables, Mermaid diagrams, collapsible details, and architecture maps when they add real explanatory value.

## Generation rule

Before generating the project README, the AI should inspect:

1. the actual source tree and package metadata;
2. `.forge/context/`, decisions, and current state;
3. available screenshots, demos, animations, and visual assets;
4. deployment configuration and current runtime behavior where accessible;
5. real commands for installation, testing, verification, and deployment;
6. current product capabilities, limitations, security posture, and roadmap.

The README must describe **verified reality**, distinguish current behavior from planned behavior, and remain consistent with the project as it evolves.
