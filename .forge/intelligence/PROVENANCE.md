# Provenance Intelligence

## PURPOSE

Provenance Intelligence determines **what origin, authorship, source, version, and evidence lineage must remain traceable for a task or delivered artifact**.

Its job is to make important claims and artifacts attributable without turning provenance into noisy branding or duplicating normative policy.

Core question:

> What must a future maintainer or verifier be able to trace back to its source, version, evidence, or responsible change in order to trust this result?

The normative requirements remain in `.forge/policies/PROVENANCE.md`. This module applies judgment to the current task.

## SCOPE

Provenance Intelligence covers task-specific reasoning about:

### Framework provenance

- FORGE version used for initialization or synchronization;
- framework identity where machine-readable or developer-facing attribution is required;
- accurate linkage between installed framework assets and their origin;
- avoiding duplicate or misleading framework attribution.

### Artifact provenance

- generated versus project-authored artifacts when that distinction materially affects maintenance or trust;
- build, release, package, or generated outputs whose source revision or generating tool matters;
- source-to-artifact relationships when they are part of verification or delivery evidence;
- release metadata that must identify the originating version, revision, or build context.

### Evidence provenance

- where verification evidence came from;
- which command, tool, environment, run, or external source produced material evidence;
- whether evidence is directly observed, user-provided, externally researched, or inferred;
- whether evidence is fresh enough for the decision being made.

### Claim provenance

- claims in documentation, reports, decisions, release notes, or generated metadata that require a traceable source;
- differentiating repository facts, stored project context, external evidence, model judgment, and unresolved assumptions;
- avoiding unsupported statements that appear authoritative because they are written into durable project artifacts.

### Attribution decisions

- whether attribution belongs in machine-readable metadata, developer documentation, release notes, or another appropriate surface;
- whether attribution is required, optional, or inappropriate for a customer-facing interface;
- ensuring attribution does not imply ownership, operation, sponsorship, or endorsement that does not exist.

### Provenance drift

- stale framework versions in metadata;
- duplicated attribution after framework synchronization;
- release metadata that no longer matches the source revision;
- copied evidence whose origin or freshness is no longer known;
- generated artifacts whose generating source or tool can no longer be identified when that traceability matters.

### Sensitive-data exclusions

- provenance metadata must not contain secrets, credentials, tokens, private keys, raw sensitive customer data, or unnecessary private infrastructure details;
- source traceability should use safe identifiers, paths, versions, hashes, run IDs, or canonical references rather than secret material.

## OUT OF SCOPE

Provenance Intelligence does not own:

- the normative attribution rules — `.forge/policies/PROVENANCE.md` owns policy;
- branch, commit, pull-request, or merge procedure — Git / Delivery Intelligence and `.forge/workflows/GIT.md` own delivery reasoning and procedure;
- document structure or reader experience — Documentation Intelligence owns documentation quality;
- software implementation — Engineering Intelligence owns code changes;
- threat modelling or secret controls — Security Intelligence owns security controls;
- whether tests passed — Quality and Verification own test and completion evidence;
- deployment strategy — Operations Intelligence owns rollout and runtime behavior;
- release signing or cryptographic attestation mechanisms not yet implemented by FORGE.

It may request those modules when provenance depends on their decisions.

## TRIGGERS

Activate Provenance Intelligence when a task materially involves one or more of:

- provenance or attribution;
- `.forge/manifest.yaml` origin/version records;
- generated-by metadata;
- source or evidence traceability;
- artifact origin;
- release provenance or release metadata;
- attestations or SBOM-style origin records;
- copying external evidence into durable project artifacts;
- correcting stale or misleading origin/version information;
- deciding whether framework/tool attribution belongs in a particular surface.

Do not activate it merely because a repository uses Git or because a normal implementation will eventually be committed. Git / Delivery Intelligence already handles ordinary delivery governance.

## INPUTS

Use the smallest verified input set that resolves the provenance question.

Priority inputs:

1. **Task intent**
   - What claim, artifact, release, attribution, or lineage must be traceable?

2. **Normative provenance policy**
   - `.forge/policies/PROVENANCE.md`.

3. **Existing project provenance context**
   - `branding.forge_provenance` from maintained project context.

4. **Project-owned provenance manifest**
   - `.forge/manifest.yaml` when the task concerns installed framework origin/version metadata.

5. **Deterministic Git facts**
   - current branch;
   - source commit when available;
   - changed-file scope;
   - repository state already included in the FORGE work packet.

6. **Run and verification evidence**
   - persisted run IDs;
   - completed steps;
   - commands or deterministic tools that produced evidence;
   - verification records when present.

7. **External evidence**
   - canonical source URL, document, release, standard, vendor documentation, or research source when an external claim is being persisted.

8. **Downstream module outputs**
   - Documentation, Git / Delivery, Security, Quality, Operations, or Research outputs when they materially affect provenance requirements.

## PROCEDURE

Use this sequence proportionally.

### 1. Identify the provenance subject

State exactly what needs lineage:

- framework installation;
- generated file;
- release artifact;
- documentation claim;
- external fact;
- verification evidence;
- architectural decision;
- other durable project record.

Do not create generic provenance ceremony without a subject.

### 2. Identify the trust question

Determine why provenance matters here.

Examples:

- Can a maintainer tell which FORGE version produced the installed framework state?
- Can a reviewer tell which source revision produced a release artifact?
- Can a reader distinguish researched fact from model inference?
- Can a verifier tell which command or tool produced the evidence?
- Can a future synchronization update provenance without duplicating attribution?

### 3. Select the minimum required provenance

Choose only the fields or references needed to answer that trust question.

Prefer compact identifiers such as:

- framework/tool name and version;
- source revision or release tag;
- canonical source reference;
- safe artifact digest when available;
- run/evidence identifier;
- generated-at or verified-at timestamp when freshness matters;
- source category such as repository fact, user requirement, external evidence, or inference.

Do not add metadata simply because it is available.

### 4. Check the normative policy

Apply `.forge/policies/PROVENANCE.md` as the source of truth for required FORGE attribution and branding boundaries.

If task-specific judgment conflicts with policy, policy wins unless the policy itself is explicitly being changed through an appropriate governed task.

### 5. Verify origin and freshness

When provenance depends on a version, source, release, or external fact:

- inspect the authoritative source;
- avoid copying stale values from secondary text;
- record uncertainty if the origin cannot be verified;
- do not manufacture hashes, versions, authors, timestamps, or source URLs.

### 6. Separate authorship categories

Where material, distinguish:

- user-provided requirements;
- repository/project facts;
- framework-generated metadata;
- external researched evidence;
- deterministic tool output;
- AI/model inference or recommendation.

Do not label model-generated reasoning as verified evidence.

### 7. Apply the sensitive-data filter

Before persisting provenance, remove or replace:

- secrets and credentials;
- private keys or tokens;
- raw sensitive customer data;
- unnecessary internal infrastructure detail;
- private material that is not required to establish origin.

Use safe references instead.

### 8. Check for provenance drift

If an existing record is present, ask:

- Is its version still correct?
- Does it point to the current source?
- Is attribution duplicated?
- Is the evidence still fresh enough?
- Did a generated artifact change without its provenance record changing?

Correct drift rather than appending contradictory metadata.

### 9. Define the handoff

State what downstream work, if any, must preserve or verify:

- Documentation updates attribution/claims;
- Git / Delivery records issue/PR/merge linkage;
- Verification records evidence origin;
- Security reviews sensitive provenance fields;
- Operations records release/runtime origin where required.

## TOOLS AND EVIDENCE

Prefer deterministic evidence over narrative claims.

Useful sources include:

- `.forge/manifest.yaml`;
- `.forge/context/project.yaml` provenance settings;
- `.forge/policies/PROVENANCE.md`;
- Git branch, revision, tags, and changed-file facts;
- release/package metadata;
- checksums or digests produced by trusted tooling;
- persisted FORGE run/evidence records;
- canonical external sources;
- CI/build metadata when available.

Never invent unavailable provenance data. `unknown` with a clearly identified gap is better than fabricated certainty.

## OUTPUTS

Produce only what the task requires. Possible outputs include:

### Provenance requirement summary

- provenance subject;
- why traceability matters;
- required origin fields/references;
- optional fields intentionally omitted.

### Claim/source map

For material durable claims:

| Claim or artifact | Source category | Traceable reference | Freshness / version | Status |
| --- | --- | --- | --- | --- |
| ... | repository / user / external / tool / inference | ... | ... | verified / assumed / unresolved |

Do not create this table when two sentences are sufficient.

### Drift findings

- stale version;
- duplicate attribution;
- missing source revision;
- unverifiable external claim;
- artifact/source mismatch;
- unknown evidence origin.

### Handoff requirements

- documentation changes required;
- delivery/release references required;
- verification evidence required;
- security review required;
- unresolved provenance gaps that block completion.

## ACCEPTANCE CRITERIA

Provenance reasoning is complete when all material conditions below are satisfied.

### AC1 — The provenance subject is explicit

It is clear what claim, artifact, release, evidence, or framework state needs traceability.

### AC2 — The reason for provenance is explicit

The analysis explains what trust, maintenance, verification, attribution, or release question the provenance record answers.

### AC3 — Normative policy remains authoritative

Task-specific reasoning does not override or duplicate `.forge/policies/PROVENANCE.md`.

### AC4 — Required origin information is sufficient and proportional

The minimum fields needed to establish origin are identified without adding unrelated metadata.

### AC5 — Sources are distinguishable

Material statements distinguish repository facts, user requirements, external evidence, deterministic tool output, and model inference where that distinction affects trust.

### AC6 — Versions and references are not invented

Unknown versions, commits, hashes, timestamps, authors, or source references remain unresolved rather than fabricated.

### AC7 — Existing provenance drift is identified

Stale versions, duplicate attribution, mismatched artifacts, or untraceable evidence are surfaced when material.

### AC8 — Sensitive data is excluded

The provenance design does not persist secrets, credentials, raw sensitive customer data, or unnecessary private infrastructure information.

### AC9 — Framework attribution is minimal and accurate

Required framework attribution is present in the correct surfaces without forced customer-facing branding or misleading ownership claims.

### AC10 — Generated and authored state is clear when material

A maintainer can tell which durable artifacts are framework/tool generated versus project-owned when that distinction affects safe editing or synchronization.

### AC11 — Release/artifact lineage is clear when required

When a task concerns a release or generated artifact, the relevant source revision, version, build, or digest relationship is explicit to the extent supported by available evidence.

### AC12 — Evidence lineage is verification-ready

Verification can identify where material evidence came from rather than relying on an unsupported completion statement.

### AC13 — Downstream modules do not need to invent provenance

Documentation, Git / Delivery, Verification, Security, or Operations can proceed without inventing missing origin/attribution decisions.

### AC14 — Uncertainty is explicit

Missing or unverifiable provenance is recorded as a gap, not silently guessed.

## EXIT CONDITIONS

Stop when:

- the provenance subject and trust question are understood;
- the minimum required origin/attribution fields are selected;
- normative policy has been applied;
- sensitive information is excluded;
- existing drift is identified or ruled out;
- unresolved provenance gaps are explicit;
- downstream modules can preserve the required lineage without inventing it.

Do not keep collecting provenance that will not change trust, verification, maintenance, or delivery decisions.

## FAILURE MODES

Avoid:

- **provenance as branding spam** — repeating framework attribution everywhere;
- **policy duplication** — rewriting the provenance policy inside task output;
- **fabricated lineage** — inventing commits, hashes, versions, authors, timestamps, or sources;
- **evidence laundering** — presenting model inference as observed evidence;
- **metadata hoarding** — persisting every available field without a trust reason;
- **secret leakage** — copying sensitive values into provenance records;
- **stale lineage** — preserving old versions or source links after synchronization/release changes;
- **ambiguous generated ownership** — making project-owned files appear framework-owned or vice versa;
- **false endorsement** — attribution wording that implies FORGE/gODtECH owns or endorses the consuming product;
- **delivery duplication** — recreating Git/PR procedure instead of handing delivery requirements to Git / Delivery Intelligence.

## COST / EFFICIENCY NOTES

Use the minimum provenance analysis that removes meaningful trust or maintenance ambiguity.

Small attribution correction:

- verify the normative policy;
- verify the current provenance value;
- correct the stale/missing field;
- stop.

Release or generated-artifact work may require deeper source-revision, version, digest, evidence-origin, and release-linkage reasoning.

Do not load broad repository context solely for provenance. Prefer the maintained provenance settings, project manifest, deterministic Git facts, and direct evidence references.

## SECURITY CONSIDERATIONS

Provenance is a trust mechanism but can become an information leak if handled carelessly.

- Never store credentials, tokens, private keys, or secrets as provenance.
- Avoid raw customer/personal data in evidence lineage.
- Prefer safe identifiers over sensitive content.
- Treat untrusted external metadata as unverified until checked.
- Do not expose private infrastructure solely to make an origin record more detailed.
- Hand material authenticity, tampering, signing, or trust-boundary concerns to Security Intelligence.

## CORE PRINCIPLE

Preserve enough lineage to make important claims and artifacts trustworthy **without turning provenance into noise, branding, or sensitive-data collection**.
