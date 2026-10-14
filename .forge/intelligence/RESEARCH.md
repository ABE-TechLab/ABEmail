# Research Intelligence

## PURPOSE

Provide bounded, evidence-aware research that answers material project questions without turning browsing into open-ended exploration or mixing facts with model inference.

## SCOPE

Research Intelligence covers:

- defining answerable research questions;
- finding current and relevant external evidence;
- assessing source authority, freshness, geography, and applicability;
- distinguishing fact, source claim, inference, and assumption;
- handling conflicting evidence;
- recording limitations and unresolved uncertainty;
- deciding when enough evidence exists to proceed.

It supports other intelligence modules rather than owning the product or technical decision.

## TRIGGERS

Activate when:

- the task explicitly asks to research, investigate, compare, validate, or assess feasibility;
- Product/Market/Architecture/Security/Operations work depends on external facts;
- relevant project evidence is absent, stale, contested, or geographically mismatched;
- a consequential decision would otherwise rely on model memory or guesswork.

## INPUTS

- explicit decision or question;
- existing project context and evidence;
- known constraints such as geography, user segment, time horizon, and product stage;
- source freshness requirements implied by the question.

## PROCEDURE

1. Convert the need into one or more decision-focused research questions.
2. Check whether verified project context already answers them.
3. Define what evidence would materially change the decision.
4. Gather the smallest useful evidence set from appropriate sources.
5. Record source identity, date/freshness, geography/population, and relevant limitations.
6. Separate:
   - directly supported facts;
   - attributed source claims;
   - synthesis/inference;
   - unresolved assumptions.
7. Investigate material disagreement rather than averaging incompatible claims.
8. Stop when additional research is unlikely to change the decision or when evidence limits prevent a stronger conclusion.
9. Pass conclusions and limitations to the consuming intelligence module.

## SOURCE QUALITY

Prefer sources according to the question, generally:

- primary/official documentation and data;
- laws, regulators, standards bodies, and public institutions;
- peer-reviewed or established research;
- credible industry data;
- direct company documentation for company-specific claims;
- reputable journalism for current events and market developments;
- community/user reports for experience signals, clearly labeled and not treated as authoritative fact.

A source can be authoritative for one claim and weak for another.

## OUTPUTS

Research outputs should include:

- question/decision being supported;
- concise findings;
- source/evidence references;
- freshness/applicability notes;
- conflicts or uncertainty;
- inference separated from fact;
- explicit limitations;
- recommendation to proceed, research further, or leave unresolved when appropriate.

## EXIT CONDITIONS

Research is sufficient when:

- each material question has enough evidence for the consuming decision, or is explicitly marked unresolved;
- consequential claims are traceable to suitable sources;
- freshness/geography limitations are visible;
- no major conclusion depends on an unstated assumption;
- further browsing is unlikely to materially alter the decision.

## FAILURE MODES

Avoid:

- researching without a decision question;
- collecting sources as a substitute for synthesis;
- using stale facts for current decisions;
- treating search snippets as evidence when the underlying source is available;
- hiding conflicting evidence;
- filling evidence gaps with model memory;
- continuing until a predetermined conclusion is supported.

## COST / EFFICIENCY NOTES

Use a decision-first search strategy. Start with the highest-authority likely sources, batch related questions, stop when evidence saturation is reached, and reuse recorded evidence while it remains fresh and applicable.

## SECURITY CONSIDERATIONS

Do not expose repository secrets, credentials, private customer data, personal data, or proprietary source content to external research systems. Research queries should contain only the minimum context needed to answer the question.
