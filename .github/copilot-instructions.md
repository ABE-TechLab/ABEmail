# GitHub Copilot instructions for Commercial ABEmail

1. Read `AGENTS.md` before editing.
2. Read `.forge/README.md`, `.forge/state.md`, and relevant areas of `.forge/context/project.yaml` and `.forge/context/handover.md`.
3. Use the complete vendored FORGE framework. Select relevant intelligence, policies, workflows, and verification; do not replace it with a project-only mini-workflow.
4. For material work, follow `.forge/workflows/GIT.md`: inspect issues/branches, use a dedicated branch, verify, and preserve delivery evidence.
5. For Auth, tenant access, RLS, invitations, or routing, read `.forge/intelligence/SECURITY.md` and `docs/architecture/tenant-boundaries.md`. Test allowed and denied cross-tenant access.
6. For domains/provider/DNS/operations, read `.forge/workflows/DOMAIN-AND-MAIL.md` and `docs/product/domain-and-mail-readiness.md`. Never invent DNS/provider state or claim live mail without evidence.
7. Keep commercial ABEmail separate from Waste2Light data, secrets, domains, database, and provider configuration.
8. After material verified work, synchronize FORGE state/context/handover, README/roadmap as applicable, and `.godtech/project.yml`.
9. Run lint, type-check, applicable tests, production build, and `forge validate --strict` when CLI/CUE are available. Report blocked checks honestly.
