# Market Intelligence

## PURPOSE

Help the agent understand the environment a product will enter so product decisions reflect real users, alternatives, geography, commercial constraints, and positioning rather than repository-only assumptions.

## SCOPE

Market Intelligence covers:

- target geography and market segment;
- customer and buyer context;
- direct and indirect alternatives;
- competitor capabilities and positioning when material;
- market expectations, constraints, and adoption friction;
- differentiation and positioning;
- pricing/business-model evidence when relevant to the decision;
- distribution, procurement, trust, infrastructure, or localization constraints;
- material market risks and unknowns.

It does not fabricate market size, revenue forecasts, pricing, competitor features, or demand evidence.

## TRIGGERS

Activate when:

- creating, launching, repositioning, or materially redefining a product;
- the user explicitly asks about market, competitors, pricing, differentiation, feasibility, geography, or go-to-market constraints;
- a product decision depends on external user/customer expectations;
- project context contains material market gaps or stale evidence.

Do not activate automatically for every narrow feature, bug fix, refactor, or infrastructure task.

## INPUTS

Use:

- product problem, users, value proposition, and scope;
- `market.*` project context;
- Research Intelligence evidence;
- user-provided business constraints;
- current product/repository state when relevant.

## PROCEDURE

1. Define the decision the market analysis needs to support.
2. Identify target geography, segment, buyer/user roles, and operating environment.
3. Identify current alternatives, including manual processes and adjacent tools, not only named competitors.
4. Compare only dimensions material to the product decision.
5. Identify expected baseline capabilities versus genuine differentiation.
6. Assess adoption constraints such as trust, connectivity, procurement, regulation, migration effort, skills, switching cost, or channel access when relevant.
7. Evaluate pricing/business-model norms only when the task requires them.
8. Separate evidence from interpretation and assumptions.
9. Record where evidence is weak, conflicting, geographically mismatched, or stale.
10. Feed only material conclusions back into Product Intelligence.

## TOOLS AND EVIDENCE

Market claims that may change over time should be researched rather than guessed.

Prefer:

1. first-party/official sources;
2. regulatory or government data;
3. credible industry/research sources;
4. company product/pricing documentation;
5. reputable reporting;
6. community evidence for lived experience, clearly identified as such.

Use multiple sources for consequential or contested claims. Record publication dates/geographies when they affect applicability.

## OUTPUTS

Possible outputs include:

- market/segment definition;
- competitor/alternative set;
- evidence-backed comparison dimensions;
- baseline market expectations;
- differentiation statement;
- adoption/distribution constraints;
- pricing/business-model observations;
- market risks and open questions;
- updates to `market.*` context and evidence references.

## EXIT CONDITIONS

Market work is sufficient when:

- the target market for the current decision is explicit;
- material alternatives and expectations are understood;
- differentiation is evidence-backed rather than aspirational;
- major adoption constraints are identified;
- Product Intelligence can make the needed scope/positioning decision without unsupported market assumptions.

## FAILURE MODES

Avoid:

- exhaustive competitor catalogs with no decision purpose;
- copying competitor roadmaps into the product;
- treating global evidence as automatically representative of a local market;
- presenting SEO pages or marketing claims as independent evidence;
- inventing TAM/SAM/SOM or willingness-to-pay numbers;
- continuing research after additional sources are unlikely to change the decision.

## COST / EFFICIENCY NOTES

Research only dimensions that can change the decision. Reuse fresh evidence already recorded in project context. Prefer a small high-quality evidence set to broad low-value browsing.

## SECURITY CONSIDERATIONS

Market research may surface regulatory, identity, payment, healthcare, financial, child-safety, or other sensitive requirements. Treat these as signals for Security/Compliance work rather than converting them directly into unsupported compliance claims.
