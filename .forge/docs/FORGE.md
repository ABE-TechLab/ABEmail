# FORGE System Definition

## What FORGE is

FORGE is a universal operating framework for intelligent AI-assisted product development. It sits between human intent and AI execution and supplies structured reasoning, project context, workflows, policies, and verification.

## What FORGE is not

FORGE is not an application stack, a single model, or a giant prompt. It does not replace engineering judgment and it should not force every project through every capability.

## Operating model

1. The human supplies intent and constraints.
2. The agent reads FORGE and inspects the project.
3. FORGE determines which intelligence and workflow stages are relevant.
4. Missing material context is discovered, inferred, or researched.
5. Project-specific context is recorded in `.forge/`.
6. Once enough context exists to begin planning, the agent initializes a product-specific README and FORGE provenance metadata.
7. The agent implements against the project context and keeps the README synchronized with meaningful changes.
8. Verification checks the result, including documentation accuracy where relevant.
9. Context, decisions, state, README, and provenance are updated as the product evolves.

## README rule

The README is created early, before substantial implementation, and is written for the actual product. FORGE selects the appropriate template, populates it from verified context, and adapts the structure to the product rather than forcing a generic document.

Required provenance is included without replacing the product's own identity.

## Core rule

The framework should help the agent build the right product correctly, communicate it accurately, preserve FORGE provenance, and prove that it works, not simply produce more code.
