# Operations Intelligence

## PURPOSE

Help the agent make runtime, deployment, observability, recovery, and production-readiness decisions that are proportional to the requested change without turning every task into a platform redesign.

The default question is:

> What operational behavior, rollout controls, observability, recovery path, and runtime evidence are required for this change to be safely operated in its real environment?

Operations Intelligence focuses on how software behaves after implementation leaves the developer workstation. It does not replace Architecture, Engineering, Security, Quality, or Verification Intelligence.

## SCOPE

Operations Intelligence covers decisions that materially affect runtime behavior, delivery, or production support, including:

- deployment targets and runtime environments;
- environment-specific configuration;
- secret and credential delivery interfaces;
- rollout and release strategy;
- rollback and forward-fix strategy;
- health, readiness, and liveness behavior;
- runtime dependencies and failure propagation;
- observability requirements: logs, metrics, traces, events, dashboards, and correlation;
- alerting and actionable thresholds;
- capacity, concurrency, scaling, quotas, and resource limits;
- startup, shutdown, draining, and graceful termination;
- migration sequencing during deployment;
- background workers, queues, schedulers, and recurring jobs;
- backup, restore, retention, and disaster-recovery implications;
- retry, timeout, circuit-breaker, and degradation behavior where operationally material;
- maintenance windows and operational procedures;
- runbooks, ownership, escalation, and incident-relevant evidence;
- deployment smoke checks and post-release validation;
- operational handoffs to Security, Quality, and Verification.

Operations Intelligence does not own product scope, architecture boundaries, code implementation, security policy, exhaustive test execution, or final release approval. It turns existing technical decisions into an operable runtime plan.

## BOUNDARIES

Use this ownership model:

- **Architecture Intelligence** defines runtime topology, component boundaries, dependency direction, and major failure domains.
- **Engineering Intelligence** implements application and infrastructure behavior.
- **Security Intelligence** defines security controls, trust boundaries, secret-handling requirements, and privileged operational constraints.
- **Quality Intelligence** determines what should be tested and which operational failure paths require validation.
- **Operations Intelligence** defines deployment, rollout, observability, runtime protection, recovery, and operational ownership.
- **Verification** determines whether objective evidence is sufficient to call the operational outcome complete.

Operations Intelligence must not silently rewrite architecture or implementation. If an operational requirement invalidates an earlier decision, send the decision back to the owning intelligence layer explicitly.

## TRIGGERS

Activate when work materially involves or changes:

- infrastructure, Kubernetes, containers, Terraform, cloud resources, pipelines, or CI/CD;
- deployment, release, rollout, rollback, promotion, or production configuration;
- production, customer-data, or live-environment impact;
- observability, monitoring, metrics, tracing, logging, dashboards, or alerts;
- health checks, readiness, liveness, startup, shutdown, or graceful termination;
- autoscaling, capacity, resource limits, quotas, concurrency, or throughput;
- background workers, queues, scheduled jobs, or long-running runtime processes;
- backup, restore, disaster recovery, retention, or failover;
- runbooks, operational ownership, incident response, or on-call procedures;
- runtime migrations or deployment sequencing with data/state implications.

Do not activate Operations Intelligence merely because all software eventually runs somewhere. Lightweight documentation, market research, harmless copy changes, and ordinary local code changes do not need operational analysis unless the requested outcome materially affects runtime or delivery.

## INPUTS

Prefer, in order:

1. current user requirement and explicit acceptance criteria;
2. verified `operations.*` project context, especially deployment target, environments, and observability requirements;
3. Architecture Intelligence output: topology, dependencies, failure domains, persistence, queues, and runtime boundaries;
4. Engineering Intelligence output: changed services, processes, configuration, migrations, resource behavior, and runtime contracts;
5. Security Intelligence output: secret delivery, privileged operations, audit requirements, production constraints, and incident evidence;
6. Quality Intelligence output: failure paths, smoke checks, migration checks, compatibility risks, and release blockers;
7. existing deployment manifests, infrastructure code, workflows, service definitions, dashboards, alerts, and runbooks;
8. Research Intelligence evidence when provider/runtime behavior or limits are current and material.

Do not invent production architecture from generic best practices when repository and project context already establish how the system is operated.

## PROCEDURE

1. Identify the exact runtime or delivery change and the environments it affects.
2. Confirm the deployment target and existing operational model before proposing new infrastructure.
3. Identify changed runtime components, dependencies, state, configuration, secrets, ports, jobs, queues, and external services.
4. Determine whether the change affects startup, readiness, traffic acceptance, shutdown, draining, retries, or failure propagation.
5. Define rollout strategy proportional to risk: ordinary rollout, rolling update, phased/canary release, blue-green, maintenance window, or another existing project mechanism.
6. Define rollback or forward-fix conditions, including compatibility constraints that could make rollback unsafe.
7. For schema/data changes, define deployment and migration sequencing, backward compatibility, and recovery implications.
8. Define minimum observability needed to know whether the change is healthy after release.
9. Define actionable failure signals and alerts only where someone can respond meaningfully.
10. Evaluate capacity, resource limits, scaling, concurrency, queue depth, or quotas when the change can affect load or saturation.
11. Define operational failure behavior: dependency outage, partial deployment, unavailable secret/configuration, failed migration, worker crash, backlog, timeout, or degraded external service as relevant.
12. Identify backup, restore, retention, or DR implications when state or recoverability materially changes.
13. Define deployment smoke checks and post-release evidence.
14. Identify required runbook, ownership, escalation, maintenance, or incident-response updates.
15. Confirm human approvals for production, customer-data, destructive, or otherwise high-risk changes remain explicit.
16. Stop when the change can be deployed, observed, recovered, and supported without major operational invention during release.

## DEPLOYMENT AND ROLLOUT

Choose the smallest rollout mechanism that fits the risk and existing platform.

Consider, when relevant:

- rolling update;
- staged environment promotion;
- canary or partial traffic exposure;
- blue-green deployment;
- feature-flagged activation;
- maintenance-window deployment;
- one-time migration job;
- controlled worker or scheduler enablement.

Do not introduce sophisticated rollout infrastructure for low-risk changes unless the project already uses it or the risk clearly justifies it.

A rollout plan should identify:

- deployment order;
- prerequisites;
- traffic or workload transition;
- health criteria;
- stop/rollback criteria;
- post-release observation period when material.

## ROLLBACK AND RECOVERY

Rollback planning must account for state and compatibility.

Ask:

- Can the previous version still read data written by the new version?
- Does rollback require reversing a migration?
- Are queued messages or events compatible with both versions?
- Are configuration changes backward compatible?
- Will secret/key rotation break the old version?
- Is forward-fix safer than rollback?

A rollback statement such as "redeploy the previous version" is insufficient when state, schemas, events, or credentials have changed.

## OBSERVABILITY

Observability should answer operational questions, not merely produce telemetry.

Define only the signals needed to detect and diagnose material outcomes, such as:

- request/error/latency metrics;
- queue depth and processing delay;
- worker success/failure counts;
- saturation or resource pressure;
- dependency failures;
- deployment/version identity;
- health/readiness state;
- migration progress/failure;
- security/audit events handed off by Security Intelligence;
- business-critical completion/failure events where appropriate.

Prefer structured logs and stable dimensions. Avoid logging secrets, credentials, raw tokens, or unnecessary sensitive payloads.

## ALERTING

Alerts should represent actionable conditions.

A useful alert defines:

- what failed or degraded;
- why it matters;
- threshold or trigger;
- expected owner;
- immediate diagnostic evidence;
- likely remediation or runbook path.

Avoid alerting on every transient anomaly. Prefer symptoms tied to user impact, durability risk, security risk, or sustained saturation.

## HEALTH AND READINESS

When relevant, distinguish:

- **liveness** — whether the process should be restarted;
- **readiness** — whether it should receive traffic/work;
- **startup** — whether initialization is still progressing.

Do not make health checks depend on every downstream service unless losing that dependency truly means the process cannot safely serve any work.

## CAPACITY AND RESOURCE BEHAVIOR

Evaluate capacity only when the change can materially alter workload or resource demand.

Consider:

- CPU/memory requests and limits;
- connection pools;
- queue depth;
- worker concurrency;
- rate limits;
- storage growth;
- API/provider quotas;
- autoscaling signals;
- scheduled-job overlap;
- retry amplification.

Avoid speculative internet-scale sizing without evidence.

## CONFIGURATION AND SECRETS

Operations Intelligence defines delivery and lifecycle, not secret values.

For runtime configuration, identify:

- source of configuration;
- environment ownership;
- required/default/optional behavior;
- validation at startup or deploy time;
- restart/reload requirements;
- backward compatibility.

For secrets, use Security Intelligence requirements and define only:

- secret source/interface;
- workload identity/access path;
- rotation/revocation behavior;
- restart/reload implications;
- operational failure behavior if unavailable.

Never place real secret values in prompts, evidence, logs, or runbooks.

## DATA AND MIGRATION OPERATIONS

For schema or stateful changes, define:

- pre-deploy checks;
- migration order;
- backward/forward compatibility;
- lock or downtime implications;
- batching for large datasets;
- retry/resume behavior;
- backup or restore requirements;
- rollback constraints;
- post-migration validation.

Prefer expand-and-contract patterns when zero-downtime compatibility is required and justified.

## FAILURE AND DEGRADATION

Consider only realistic failure paths, including:

- dependency unavailable;
- configuration missing or invalid;
- secret unavailable/expired;
- partial rollout;
- unhealthy new version;
- queue backlog;
- worker crash;
- migration failure;
- rate-limit/quota exhaustion;
- storage pressure;
- network timeout;
- external provider degradation.

For each material failure, define whether the system should retry, degrade, stop accepting work, fail closed, roll back, or require operator intervention.

## RUNBOOKS AND OWNERSHIP

A runbook is warranted when a material operational condition requires non-obvious human action.

Useful runbook content may include:

- symptom;
- impact;
- first checks;
- relevant dashboards/log queries;
- safe remediation;
- rollback/recovery path;
- escalation owner;
- conditions requiring broader incident handling.

Do not create large runbooks for trivial or self-explanatory changes.

## TOOLS AND EVIDENCE

Prefer repository evidence over generic assumptions:

- deployment manifests;
- Terraform/CloudFormation or equivalent infrastructure code;
- Kubernetes resources, Helm charts, or compose files;
- CI/CD workflows;
- environment/configuration schemas;
- process managers and service definitions;
- health endpoints;
- logging/metrics/tracing configuration;
- dashboards and alerts;
- migration scripts;
- backup/restore configuration;
- runbooks and incident docs;
- `.forge/context/`, prior decisions, and run evidence.

Use Research Intelligence for material external facts such as current cloud limits, Kubernetes/provider behavior, managed-service guarantees, runtime versions, or vendor quotas.

Separate clearly:

- verified runtime facts;
- project operational requirements;
- external provider facts;
- assumptions;
- required rollout controls;
- optional improvements;
- unresolved operational risk.

## OUTPUTS

Produce only what the task needs. Possible outputs include:

- deployment target and affected environments;
- changed runtime components;
- configuration/secret delivery requirements;
- rollout plan;
- rollback/forward-fix plan;
- migration sequence;
- health/readiness expectations;
- observability plan;
- alerting requirements;
- capacity/resource implications;
- failure/degradation behavior;
- backup/restore or DR implications;
- smoke/post-release checks;
- runbook/ownership changes;
- production approval requirements;
- residual operational risks;
- Quality and Verification handoffs.

A compact handoff may use:

```text
Runtime target
Affected environments
Rollout
Rollback / forward-fix
Configuration and secrets
Health
Observability
Capacity
Failure behavior
Migration / state
Smoke checks
Runbook / owner
Residual risk
Verification evidence
```

## ACCEPTANCE CRITERIA

Operations work is acceptable when all applicable conditions are true:

1. **Runtime target is explicit.** The deployment environment and affected runtime components are known.
2. **Rollout is defined.** Deployment order, activation, and health criteria are clear enough to execute safely.
3. **Rollback is realistic.** State, schema, event, configuration, and credential compatibility are considered where relevant.
4. **Configuration is controlled.** Required configuration and secret-delivery interfaces are defined without exposing secret values.
5. **Health behavior is clear.** Readiness/liveness/startup expectations are defined when applicable.
6. **Observability is sufficient.** Operators can determine whether the change is healthy and diagnose material failures.
7. **Alerts are actionable.** New alerts are tied to meaningful conditions and ownership when alerts are needed.
8. **Capacity risk is addressed.** Resource, concurrency, quota, storage, or queue implications are evaluated when material.
9. **Failure behavior is explicit.** Relevant dependency, rollout, migration, backlog, or provider failure modes have defined behavior.
10. **Stateful changes are operable.** Migration, backup, restore, and recovery implications are explicit where relevant.
11. **Production approvals remain explicit.** High-risk, production, customer-data, or destructive work does not bypass human gates.
12. **Post-release evidence is defined.** Smoke checks and runtime evidence can show the change is operating as intended.
13. **Ownership is clear.** Material operational failures have a known owner or escalation path.
14. **Verification can finish objectively.** The final Verification stage has concrete operational evidence to evaluate.

## EXIT CONDITIONS

Operations work is sufficient when:

- the deployment/runtime target is understood;
- rollout and rollback/forward-fix behavior are clear;
- configuration and secret delivery are defined;
- material health and observability requirements are known;
- realistic runtime failure paths have appropriate behavior;
- migrations/state changes can be deployed and recovered safely;
- required approvals are identified;
- post-release checks and evidence are defined;
- operational ownership is clear enough for support;
- Verification can judge completion without inventing operational criteria.

Stop once these conditions are met. Do not redesign the entire platform merely because additional operational improvements are possible.

## FAILURE MODES

Avoid:

- generic production-readiness checklists unrelated to the task;
- introducing Kubernetes, service meshes, canaries, or multi-region deployment without a concrete need;
- treating deployment success as proof of application health;
- assuming rollback is safe after incompatible data/schema changes;
- making liveness checks fail because a non-essential downstream dependency is unavailable;
- logging sensitive data or secrets for observability;
- alerts without owners or actionable responses;
- retry policies that amplify outages or duplicate side effects;
- autoscaling without an appropriate load/saturation signal;
- unbounded worker concurrency;
- destructive migrations without recovery planning;
- treating backups as valid without restore expectations;
- producing dashboards with no operational question to answer;
- bypassing production approval because automation exists;
- continuing operational analysis after the deployment and recovery path is already clear.

## COST / EFFICIENCY NOTES

Perform the minimum operational reasoning required to remove meaningful runtime uncertainty.

Reuse existing deployment platforms, dashboards, alerts, health conventions, and runbooks. A small configuration change may need only a rollout and smoke check; a stateful production migration may require sequencing, compatibility, rollback, backup, observability, and approval analysis.

Do not perform broad cloud research unless an unresolved provider fact can materially change the operational decision.

## SECURITY CONSIDERATIONS

Operations Intelligence must preserve security boundaries:

- never request or expose real credentials, private keys, passwords, or raw tokens;
- use approved secret stores and workload identity mechanisms already established by the project;
- avoid logging sensitive payloads or security material;
- preserve least privilege for deployment and runtime identities;
- keep production/customer-data/destructive operations behind existing approval gates;
- preserve audit evidence for privileged or sensitive operational changes when required;
- coordinate key/credential rotation and incident-sensitive telemetry with Security Intelligence;
- treat operational convenience as insufficient reason to weaken security controls.
