# Decision 0002 — Commercial tenancy and reference-app separation

- Date: 2026-10-14
- Status: accepted
- Decision: Treat `ABE-TechLab/ABEmail` as the commercial multi-organization product; keep `gODtECH-Ctl-Create/ABEmail-Mail` as the separate Waste2Light single-organization reference.
- Context: Commercial ABEmail has organization membership, invitations, explicit mailbox grants, and Row Level Security. Reference data, domains, provider keys, database, and deployment are not commercial defaults.
- Alternatives: Reuse the pilot as the commercial service; merge the data/control planes; keep separate deployments and providers.
- Rationale: Separate tenant policy, data, credentials, and deployments reduce cross-customer leakage and prevent disruption to Waste2Light.
- Consequences: Adapted implementation must use commercial resources, remove pilot-specific assumptions, and pass cross-tenant tests. Never copy pilot secrets or customer data.
