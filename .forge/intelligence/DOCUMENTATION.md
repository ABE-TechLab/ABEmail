# Documentation Intelligence

## PURPOSE

Help the agent produce and maintain documentation that is accurate, audience-appropriate, source-grounded, easy to navigate, and consistent with the repository's actual behavior without turning documentation work into speculative product writing.

The default question is:

> What does this audience need to understand or do, and what verified project evidence supports every material claim, command, example, state, and limitation we document?

Documentation Intelligence owns documentation reasoning and handoff quality. It does not own product scope, implementation, Git delivery mechanics, provenance policy, or final verification.

## SCOPE

Documentation Intelligence covers reasoning about:

- documentation audience and purpose;
- source-of-truth selection;
- factual accuracy and claim support;
- information architecture and navigation;
- task-oriented, reference, conceptual, explanatory, and troubleshooting content;
- project README content and structure;
- installation, setup, configuration, environment, API, CLI, architecture, security, operations, and troubleshooting documentation when relevant;
- examples, commands, paths, configuration keys, API shapes, and expected outputs;
- version, release, status, support, and capability accuracy;
- assumptions, prerequisites, limitations, warnings, and known gaps;
- stale or contradictory documentation detection;
- terminology and naming consistency;
- cross-linking between related project documents;
- documentation evidence required for verification.

Documentation Intelligence does not invent product features, architecture, commands, APIs, metrics, compatibility promises, deployment state, links, or operational guarantees.

## BOUNDARIES

Use the following ownership model:

- **Product Intelligence** defines users, value, scope, workflows, success criteria, and non-goals. Documentation explains those verified decisions to the appropriate audience.
- **Architecture Intelligence** defines system boundaries, responsibilities, dependencies, and trade-offs. Documentation represents those decisions accurately; it does not redesign them.
- **Engineering Intelligence** implements code, APIs, configuration, migrations, and behavior. Documentation records the resulting verified interfaces and usage.
- **Security Intelligence** defines security boundaries and controls. Documentation communicates required security behavior without exposing secrets or weakening controls.
- **Quality Intelligence** defines checks for implemented behavior. Documentation Intelligence defines documentation-specific accuracy and completeness expectations.
- **Operations Intelligence** defines runtime, deployment, recovery, observability, and ownership expectations. Documentation turns those verified operational decisions into usable runbooks/reference material where needed.
- **Git / Delivery Intelligence** will own issue, branch, commit, pull-request, release, and delivery reasoning. Documentation Intelligence does not replace that workflow.
- **Provenance Intelligence** will own origin, attribution, integrity, and provenance-specific reasoning. Documentation may display required provenance, but it does not define provenance policy.
- **Verification** checks objective evidence and determines whether the documented result is sufficiently supported.

Documentation should explain repository reality; it must not become an alternate source of product or implementation truth.

## TRIGGERS

Activate when the planner selects the existing `documentation` capability, including:

- README creation or maintenance;
- documentation, docs, copy, wording, comment, or typo work classified as documentation;
- research work whose output must be documented;
- other workflows that explicitly activate documentation because a durable written artifact is required.

Do not activate Documentation Intelligence merely because every implementation could theoretically benefit from more documentation. Normal feature, bug, security, infrastructure, and refactor work should not pay this context cost unless the planner explicitly activates documentation.

## INPUTS

Prefer, in order:

1. the user's requested documentation outcome;
2. the intended audience and task the reader must complete;
3. planner task kind, risk, capabilities, and ordered steps;
4. verified repository files, manifests, code, configuration, scripts, schemas, tests, and current Git state;
5. current README and related project documentation;
6. project identity and other bounded project context already selected by FORGE;
7. outputs from Product, Research, Architecture, Design, Engineering, Security, Quality, or Operations Intelligence when they materially support the document;
8. decisions and project state recorded under `.forge/`;
9. external sources only when the documentation depends on current facts not verifiable from the repository.

Do not treat old documentation as authoritative when executable repository evidence contradicts it.

## PROCEDURE

1. Identify the exact audience: adopter, contributor, operator, developer, end user, reviewer, maintainer, or another explicit reader.
2. Identify the reader outcome: understand a concept, install, configure, call an API, operate the system, troubleshoot a failure, contribute, or evaluate project status.
3. Inspect the repository and existing documentation before writing.
4. Identify the strongest source of truth for each material claim.
5. Separate verified repository facts, user-provided requirements, external evidence, model inference, and unresolved assumptions.
6. Choose the smallest documentation shape that satisfies the reader outcome.
7. Reuse established terminology, product identity, path names, command style, and documentation conventions.
8. Organize content in the order readers need it rather than the order the implementation was discovered.
9. Verify commands, file paths, configuration keys, package names, API names, versions, and examples against repository evidence whenever practical.
10. Describe prerequisites before steps that depend on them.
11. Put warnings and irreversible or security-sensitive conditions before the action they qualify.
12. Distinguish current behavior from planned, experimental, deprecated, or unavailable behavior.
13. State limitations and unsupported cases explicitly when material.
14. Avoid duplicating large bodies of information when a stable canonical document can be linked instead.
15. Check related documentation for contradictions introduced by the change.
16. Define the evidence needed to verify documentation accuracy.
17. Stop when the target audience can complete the intended task or understand the intended concept without material ambiguity.

## DOCUMENTATION SHAPES

Choose the shape according to reader intent.

### Task-oriented guidance

Use for readers trying to perform an action.

Prefer:

- prerequisites;
- ordered steps;
- exact verified commands or UI actions;
- expected result;
- common failure/recovery guidance when material.

Do not bury required prerequisites after the procedure.

### Reference documentation

Use for stable facts readers need to look up:

- CLI commands and flags;
- configuration keys;
- API endpoints and schemas;
- environment variables;
- supported versions;
- file/folder conventions;
- status and capability matrices.

Reference material should optimize for correctness and scanability rather than narrative.

### Conceptual or explanatory documentation

Use for architecture, workflows, reasoning, terminology, and trade-offs.

Explain:

- what the concept is;
- why it exists;
- where its boundary is;
- how it relates to neighboring concepts;
- what it does not imply.

Do not replace concrete implementation/reference material with high-level prose when readers need actionable details.

### Troubleshooting documentation

Organize around observable symptoms and deterministic checks:

```text
Symptom
Likely scope
Checks
Evidence
Safe remediation
Escalation / unresolved condition
```

Do not prescribe destructive remediation without explicit safety context and recovery requirements.

## README GUIDANCE

For README work, use the repository's README-generation workflow and product-specific identity rather than producing a generic template.

A README should represent current repository reality, including only relevant sections such as:

- product purpose and identity;
- current status;
- capabilities actually implemented;
- installation and quick start;
- verified commands;
- architecture when useful to adopters/contributors;
- integration or usage examples;
- safety/security notes;
- development workflow;
- roadmap status;
- licensing and provenance where required.

Do not claim a release, package, benchmark result, production deployment, compatibility level, customer adoption, or performance property without evidence.

## SOURCE-OF-TRUTH RULES

Prefer executable or maintained evidence over descriptive claims.

Examples:

- package/version → package manifest or release metadata;
- CLI command → CLI implementation/help/tests;
- API shape → route/schema/type/contract implementation;
- configuration key → configuration parser/schema/example environment file;
- build/test command → repository manifest/workflow;
- deployment target → infrastructure/configuration and verified project context;
- roadmap status → canonical roadmap/tracker plus merged repository state;
- architecture → current architecture decision/context plus repository structure;
- feature availability → implementation plus tests/evidence;
- security behavior → implemented controls plus security documentation/policy.

When sources disagree, do not silently choose the more convenient statement. Resolve the contradiction or record it.

## EXAMPLES AND COMMANDS

Examples are executable claims.

Before publishing an example, check when practical:

- command name and flags;
- package manager;
- working directory;
- filenames and paths;
- ports and URLs;
- configuration keys;
- request/response shape;
- example output;
- platform-specific differences;
- required permissions or credentials;
- destructive or irreversible side effects.

Use placeholders for secrets and environment-specific values. Never place real credentials, private tokens, personal data, or secret material into documentation.

## VERSION AND STATUS ACCURACY

Explicitly distinguish:

- implemented;
- released;
- available only from source;
- experimental;
- planned;
- deprecated;
- removed;
- unsupported;
- unknown/unverified.

A merged implementation is not automatically a published release. A roadmap item is not an available feature. A local experiment is not production support.

## TOOLS AND EVIDENCE

Prefer deterministic evidence from:

- repository files and manifests;
- CLI help/output and tests;
- schemas and types;
- CI workflows;
- release metadata;
- package metadata;
- architecture/project context;
- verified examples and commands;
- current roadmap/tracker state;
- existing documentation link checks or doc tooling when available.

External research is appropriate only when documentation materially depends on current external facts, standards, provider behavior, or third-party APIs.

Documentation evidence should record, as relevant:

- source inspected;
- claim or example validated;
- command/check performed;
- result;
- unresolved mismatch;
- stale documentation discovered;
- limitation not verified.

## OUTPUTS

Produce only the documentation artifacts or handoff required by the task. Possible outputs include:

- documentation audience and purpose;
- source-of-truth map;
- information architecture;
- README updates;
- setup/installation guide;
- configuration reference;
- API/CLI reference;
- architecture explanation;
- operations/runbook documentation;
- troubleshooting guide;
- examples;
- migration/upgrade notes;
- status/roadmap updates;
- stale-content findings;
- contradiction list;
- documentation verification handoff.

A compact handoff may use:

```text
Audience
Reader outcome
Sources of truth
Document changes
Claims/examples verified
Known limitations
Stale/contradictory content
Verification evidence required
```

## ACCEPTANCE CRITERIA

Documentation work is sufficient when all applicable conditions are true:

1. **Audience is explicit.** The document is shaped for a real reader rather than a generic audience.
2. **Reader outcome is clear.** The content helps the reader perform a task or understand a defined concept.
3. **Material claims are source-grounded.** Important statements can be traced to repository evidence, user requirements, or identified external evidence.
4. **Commands and examples are accurate.** Material examples match the current repository and do not invent behavior.
5. **Status is truthful.** Implemented, released, planned, experimental, deprecated, and unsupported states are not conflated.
6. **Terminology is consistent.** Names, concepts, paths, and interfaces match the project.
7. **Prerequisites and limitations are visible.** Readers are not expected to infer material conditions.
8. **Security-sensitive content is safe.** No real secrets, private data, insecure defaults, or control-bypassing instructions are introduced.
9. **Related docs remain coherent.** Material contradictions created by the change are resolved or explicitly recorded.
10. **Scope is proportional.** The task does not trigger unnecessary rewriting of unrelated documentation.
11. **Verification is possible.** A reviewer can identify which claims/examples were checked and what remains unverified.
12. **Neighboring intelligence boundaries are respected.** Documentation does not invent Product, Architecture, Engineering, Security, Operations, Git/Delivery, or Provenance decisions.

## EXIT CONDITIONS

Stop when:

- the target audience and reader outcome are satisfied;
- material claims and examples are grounded in appropriate sources;
- current/planned/released state is accurately represented;
- relevant contradictions or stale content are resolved or recorded;
- safety-sensitive documentation is handled appropriately;
- verification has enough information to check the documented outcome.

Do not continue polishing wording after additional editing is unlikely to improve correctness, usability, or reader comprehension.

## FAILURE MODES

Avoid:

- documenting features that do not exist;
- treating planned work as shipped work;
- copying generic README boilerplate over product-specific information;
- trusting stale docs over executable repository evidence;
- inventing commands, flags, URLs, packages, metrics, versions, or links;
- mixing contributor workflow with end-user guidance without clear separation;
- hiding prerequisites or limitations;
- duplicating canonical information until copies drift;
- writing examples that expose secrets or private data;
- using documentation to redefine architecture or security policy;
- describing CI success that was not observed;
- claiming benchmark or efficiency results beyond measured evidence;
- polishing prose while factual contradictions remain unresolved.

## COST / EFFICIENCY NOTES

Documentation analysis should be proportional to the artifact.

For a typo or wording correction:

- inspect the local context;
- confirm the replacement remains accurate;
- avoid broad repository analysis.

For a README, API reference, installation guide, architecture document, or runbook:

- inspect the relevant implementation and project context;
- verify material examples and commands;
- check nearby canonical documentation for contradictions.

Prefer existing project context and deterministic repository evidence over repeated model exploration. Do not load unrelated intelligence modules merely to produce polished prose.

## SECURITY CONSIDERATIONS

Documentation can create security risk even without changing code.

Check for:

- exposed credentials, secrets, tokens, keys, private endpoints, or personal data;
- insecure copy/paste defaults;
- instructions that bypass approval, authentication, authorization, TLS, validation, or repository safeguards;
- destructive commands without target/recovery context;
- internal-only architecture or operational details that should not be public;
- examples that normalize unsafe permissions or secret handling;
- misleading security claims.

When secure documentation requires a material security decision, hand the decision to Security Intelligence rather than guessing.
