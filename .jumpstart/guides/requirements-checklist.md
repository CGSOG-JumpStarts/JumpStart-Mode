# Brownfield PRD Question Checklist

A comprehensive, menu-style checklist of questions for building PRDs on brownfield (existing/legacy) software projects. Organized into sections that progress from strategic context through technical depth, operations, and organizational readiness.

Questions marked are additions beyond the original baseline list. Questions without the tag are carried forward from the original for completeness.

---

## 1. Context, Goals, and Scope

### Strategic alignment

- What is the current system supposed to do from a business perspective (not technically)?
- Who are the primary and secondary user personas today, and how will that change after this project?
- What business outcomes must this brownfield project achieve (revenue, cost, risk, compliance, NPS, cycle time)?
- Which KPIs or OKRs will we use to judge success, and what are their current baselines vs target values?
- What is the strategic rationale for modernizing now rather than continuing to maintain the current system?
- What is the cost of inaction -- what happens if we do nothing for another 12 to 24 months?
- How does this project rank relative to other initiatives competing for the same resources?
- Is there executive sponsorship with budget authority, and who is the single accountable decision-maker?
- What prior attempts have been made to modernize or replace this system, and why did they succeed or fail?
- Are there M&A, divestiture, or organizational restructuring plans that could affect this system's future?

### Scope definition

- Is this initiative a refactor, replatform, feature extension, or partial/full replacement of the existing system?
- What is explicitly in scope vs explicitly out of scope for this phase?
- What is the target "definition of done" for this release or increment (business and technical)?
- Are there regulatory, contractual, or audit deadlines that constrain scope or sequencing?
- What is the expected total number of phases, and what does the rough roadmap look like beyond this phase?
- Are there "sacred cows" -- features, behaviors, or design choices that are politically untouchable regardless of technical merit?
- What is the minimum viable scope that delivers measurable business value?
- If the project were cancelled after this phase, would the delivered increment still be useful on its own?
- Are there seasonal or cyclical business peaks that create blackout windows for releases?

---

## 2. Existing System Inventory and Behavior

### System landscape

- What systems, applications, and services are involved today (including shadow IT and spreadsheets)?
- What are the major modules or domains in the current system and how do they map to business capabilities?
- What is the current high-level architecture (monolith, SOA, microservices, hybrid) and how has it drifted from its original design?
- What programming languages, frameworks, and runtime versions does the current system use, and which are end-of-life or approaching end-of-life?
- What databases and data stores are in use (RDBMS, NoSQL, caches, search indexes, file systems)?
- What is the current infrastructure footprint (on-prem servers, VMs, containers, cloud services, CDNs)?
- Is there a current architecture diagram, and when was it last verified against reality?
- What third-party libraries, SDKs, and open-source components are embedded in the system, and what are their license types and maintenance statuses?
- Are there any components running on unsupported or unpatched operating systems or middleware?

### Documented vs tribal knowledge

- Which behaviors are well-documented today, and which exist only as "tribal knowledge"?
- What undocumented behaviors are considered critical by users (workarounds, hidden features, side effects)?
- Which existing features must be preserved exactly as-is, and which can change as long as outcomes are met?
- Are there known feature flags, configuration options, or environment-specific behaviors we must account for?
- Are there batch jobs, scripts, or manual data fixes that silently keep the system running?
- Who are the key individuals who hold institutional knowledge of the system, and what is the risk if they leave?
- Is there existing test coverage (unit, integration, E2E), and what percentage of the codebase does it cover?
- Are there runbooks, playbooks, or incident response procedures for the current system?
- What logging, monitoring, and alerting exists today, and what gaps have been identified?
- Are there configuration files, environment variables, or property files that vary per deployment target, and are they documented?
- What is the current state of API documentation (OpenAPI specs, Postman collections, WSDL files)?

---

## 3. Current Pain Points and Gaps

### User and stakeholder complaints

- Where does the current system fail to meet stakeholder expectations (missing functionality, UX issues, performance, security, compliance)?
- What are the top recurring complaints from end users, and how frequently do they occur?
- Which issues are considered "must fix in this phase" vs "can wait for later phases"?
- Are there specific workflows that users avoid because "the system gets in the way"?
- What is the average time to resolve production incidents, and what fraction are repeat issues?
- What is the current mean time between failures (MTBF) for the system or its critical components?
- Are there SLA violations or penalty payments being incurred due to system deficiencies?
- What is the current customer churn or abandonment rate attributable to system issues?

### Data and integrity issues

- Are there known data quality issues (duplicates, stale data, inconsistent fields, integrity problems)?
- Are there orphaned records, dangling references, or known referential integrity violations in production?
- How often is data manually corrected by operations or support staff, and is there a log of these corrections?
- Are there known discrepancies between the system's data and external systems of record?

### Systemic and business constraints

- What risks or incidents (outages, breaches, audit findings) has the current system caused in the past 1 to 3 years?
- Where does the system constrain the business (e.g., can't launch in new regions, can't support new products)?
- What is the current velocity of feature delivery, and how much of engineering effort goes to maintenance vs new capability?
- Are there vendor lock-in risks with the current system (proprietary formats, single-vendor dependencies, contractual constraints)?
- What is the current licensing cost of the legacy system, and how does it trend year over year?
- Are there known security vulnerabilities (CVEs, pen-test findings) that remain unpatched in the legacy system?

---

## 4. Functional Requirements (What It Must Do)

### Current workflow capture

- For each major workflow today, what are the exact steps users take, including workarounds and parallel tools?
- Which new workflows or variants are needed that do not exist today?
- For each existing feature, should the new behavior be "copy exactly," "copy but improve UX," or "rethink"?
- What are the preconditions, triggers, and outcomes for each core user scenario or story?
- For each workflow, what is the expected volume (transactions per hour/day), and how does it vary by time of day, week, or season?
- What are the error and exception paths for each workflow, and how are they handled today (auto-retry, manual intervention, silent failure)?
- Are there time-sensitive or SLA-bound workflows where processing must complete within a defined window?
- Which workflows involve human approvals, escalations, or multi-step review chains?
- Are there any workflows that span multiple systems where the legacy system acts as an orchestrator or intermediary?

### Business rules and logic

- What business rules, calculations, or validations must remain consistent with the legacy system?
- Are there complex rules encoded only in stored procedures, scripts, or reports that must be preserved or redesigned?
- Which functional changes would break downstream processes or regulatory expectations if altered?
- What reporting or analytics capabilities must the system support (including ad-hoc queries and exports)?
- Are there rounding rules, timezone handling conventions, or currency conversion methods embedded in the logic that must be exactly replicated?
- Are there business rules that vary by region, tenant, customer tier, or product line?
- What is the canonical source of truth for each business rule -- is it documented in policy, or only in code?
- Are there business rules that are known to be incorrect or outdated but are kept for backward compatibility?
- What notification, alerting, or messaging logic does the system handle (email, SMS, push, in-app)?
- What scheduling or calendar-based logic exists (recurring jobs, reminders, expiration dates, grace periods)?
- Are there search, filtering, or sorting behaviors that users rely on and expect to work identically?

### Multi-tenancy and configuration

- Is the system multi-tenant, and if so, how is tenant isolation enforced (shared DB, schema-per-tenant, DB-per-tenant)?
- Are there tenant-specific customizations, branding, or feature toggles that must be preserved?
- What administrative or back-office functions exist (user management, configuration, billing, audit)?
- Are there self-service capabilities that need to be preserved or introduced?

---

## 5. Non-Functional Requirements (NFRs)

### Performance

- What are the performance expectations (response times, throughput, batch windows) under normal and peak load?
- What is the current measured performance baseline (P50, P95, P99 latencies for critical endpoints)?
- Are there specific pages, APIs, or batch jobs that are known performance bottlenecks today?
- What is the expected growth in user base or transaction volume over the next 1 to 3 years?
- Are there real-time or near-real-time processing requirements (event streaming, websockets, live dashboards)?
- What are the acceptable cold-start or warm-up times after a deployment or restart?
- Are there specific database query performance thresholds that must be met?

### Reliability and availability

- What are the reliability and availability targets (uptime SLAs, RPO/RTO, failover behavior)?
- What is the current actual uptime over the past 12 months, and what were the root causes of downtime?
- Is the system expected to support zero-downtime deployments?
- What is the disaster recovery strategy today, and does it need to change?
- Are there geographic redundancy or multi-region requirements?
- What is the acceptable data loss window in a catastrophic failure scenario?
- Are there circuit-breaker, retry, or graceful degradation patterns in the current system?

### Security

- What are the security requirements (authN/authZ models, encryption, secrets handling, audit logging)?
- Are there specific compliance standards (e.g., SOC, HIPAA, PCI, GDPR) that the system must meet?
- What is the current authentication mechanism (SAML, OIDC, LDAP, custom), and is it changing?
- What is the authorization model (RBAC, ABAC, ACLs), and how many roles and permission sets exist?
- Are there data residency or data sovereignty requirements (data must stay in specific countries or regions)?
- What is the encryption posture (at rest, in transit, field-level), and does it meet current standards?
- Are there requirements for secrets rotation, key management, or HSM usage?
- What is the current vulnerability scanning and penetration testing cadence, and what findings are outstanding?
- Are there data retention and deletion requirements (right to be forgotten, data purge schedules)?
- Is there a current threat model for the system, and does it need to be updated?
- What session management requirements exist (timeout, concurrent sessions, device limits)?
- Are there IP allowlisting, rate limiting, or DDoS protection requirements?

### Usability and accessibility

- What usability standards apply (accessibility targets, supported devices/browsers, localization)?
- What is the target WCAG conformance level (A, AA, AAA)?
- Which languages and locales must be supported, and is the current system internationalized?
- Are there right-to-left (RTL) language requirements?
- What are the minimum supported screen resolutions, and is responsive design required?
- Are there offline or low-connectivity scenarios the system must handle?

### Supportability and operations

- What are the supportability expectations (monitoring, logging, runbooks, on-call, L1/L2 handoff)?
- Are there explicit constraints on technology choices (approved stacks, licensed tools, cloud region rules)?
- How will we measure and test non-functional requirements in a way stakeholders accept as evidence?
- What observability stack is in use or planned (metrics, logs, traces, dashboards)?
- What are the expected log retention periods and log levels for production?
- Are there specific health check, readiness probe, or liveness probe requirements?
- What is the expected on-call rotation model, and what tooling supports it (PagerDuty, OpsGenie, etc.)?
- Are there requirements for synthetic monitoring or canary checks in production?

---

## 6. Data, Integrations, and Migration

### Data landscape

- What are the system-of-records for each key data domain today, and will that change post-project?
- What is the current data model (entities, relationships, key fields) and where is it already out of sync with reality?
- Which datasets must be migrated, transformed, or archived, and which can remain in legacy stores?
- What data volumes and growth patterns do we expect over the next 3 to 5 years?
- What is the total volume of data to be migrated (rows, GB/TB), and what is the estimated migration duration?
- Are there data type or encoding mismatches between legacy and target systems (character sets, date formats, numeric precision)?
- Are there temporal data concerns (historical records with different schema versions, backdated entries, audit timestamps)?
- What is the data archival policy, and are there records that must be retained but not migrated to the active store?
- Are there derived or computed fields in the legacy system that must be recalculated or carried over as-is?
- What is the strategy for handling data that fails validation during migration (reject, quarantine, flag for review)?
- Will the migration be one-time or incremental/continuous (trickle migration)?
- Are there synthetic or anonymized data sets available for testing the migration process?

### Integrations

- What are the inbound and outbound integrations today (APIs, file drops, queues, ETL, webhooks)?
- Which integrations are fragile or manually maintained and need redesign in this project?
- What are the data quality, lineage, and auditability expectations in the target state?
- Will there be a coexistence period where legacy and new systems run in parallel, and how will data consistency be maintained?
- What are the SLAs and expected response times for each integration partner?
- What authentication and authorization mechanisms do integration partners use?
- Are there message format or protocol constraints imposed by partners (SOAP, REST, GraphQL, gRPC, FTP, AS2, EDI)?
- What is the error handling and retry strategy for each integration (dead-letter queues, idempotency, compensating transactions)?
- Are there rate limits, throttling, or quota constraints on third-party APIs we consume?
- Which integrations are synchronous vs asynchronous, and does this need to change?
- Are there event-driven integrations (Kafka, RabbitMQ, SNS/SQS, EventBridge), and what are the ordering and delivery guarantees?
- What integration testing environments do partners provide, and what are their availability windows?
- Are there data sharing agreements, DPAs, or BAAs that govern what data can flow through each integration?

---

## 7. Backwards Compatibility and Cutover

### Compatibility contracts

- Which external systems or clients expect the current APIs, file formats, or event contracts to remain unchanged?
- Are we required to maintain backward-compatible interfaces, and for how long?
- How will we manage versioning of APIs and integrations during the transition?
- Are there published API contracts (Swagger/OpenAPI, WSDL, Protobuf) that external consumers depend on?
- What is the deprecation policy for legacy APIs -- how much notice must be given, and who must be notified?
- Are there SDKs, client libraries, or plugins that depend on the current system's interface?
- Are there webhook consumers or event subscribers that expect a specific payload schema?
- What URL patterns, deep links, or bookmarked paths must continue to resolve correctly?
- Are there embedded iframes, widgets, or integrations on partner sites that depend on the current UI?

### Cutover strategy

- What is the cutover strategy (big bang, phased rollout, canary, pilot users)?
- Will we run old and new systems in parallel for comparison or shadow testing, and how will discrepancies be handled?
- What is the rollback strategy if cutover fails, and what conditions trigger it?
- Which stakeholders must sign off on cutover and decommissioning decisions?
- What is the maximum acceptable downtime during cutover?
- How will in-flight transactions be handled during cutover (drain, replay, dual-write)?
- What is the DNS, load balancer, or routing strategy for traffic migration?
- What is the plan for cache warming or preloading in the new system before cutover?
- Are there scheduled downstream jobs or reports that must be coordinated with the cutover window?
- What is the communication and escalation plan if issues arise during cutover (war room, stakeholder hotline)?
- How long after cutover will the legacy system remain accessible in read-only mode for reference?
- What are the criteria for decommissioning the legacy system entirely (data verified, integrations migrated, support period elapsed)?

---

## 8. Users, UX, and Change Management

### User research

- Who are the real day-to-day users, and how do their roles differ (power users, casual users, administrators)?
- How have users adapted their workflows around current system limitations, and which adaptations are essential vs harmful?
- What UX changes would be considered "breaking" for users who have muscle memory in the legacy UI?
- Are there accessibility gaps in the current system we must close?
- What is the current user base size, and how is it distributed across roles, geographies, and usage frequency?
- Are there internal vs external user groups with different expectations and support models?
- Have we conducted user interviews, journey mapping, or usability testing on the current system?
- What keyboard shortcuts, bulk operations, or power-user features exist that a subset of users depends on?
- Are there users who interact with the system solely through APIs or integrations rather than the UI?

### Change management and adoption

- What training, documentation, and in-app guidance will users need to adopt the new behavior?
- How will we gather ongoing feedback (beta programs, pilots, feature flags, surveys) during rollout?
- What communication plan is needed so users know what is changing, when, and why?
- Who are the change champions or super-users in each department who can drive adoption?
- What is the expected learning curve, and is there a productivity dip budget (time allowed for users to get up to speed)?
- Will there be a parallel run period where users can fall back to the old system if they get stuck?
- How will we handle users who resist the change or refuse to adopt the new system?
- Are there union agreements, works council requirements, or other labor considerations around changing tools?
- What is the plan for updating all downstream documentation, SOPs, and training materials that reference the legacy system?
- Will customer-facing support teams need separate training or updated scripts?

---

## 9. Governance, Risks, and Constraints

### Risk management

- What are the biggest perceived risks of touching this legacy system (technical, organizational, contractual)?
- Are there areas of the codebase or infrastructure that are considered too fragile to change without extra controls?
- What constraints exist around environments (number of envs, data masking, test data availability)?
- What is the risk register for this project, and who owns each risk's mitigation?
- Are there single points of failure (people, technology, vendors) that could stall the project?
- What is the contingency plan if a critical third-party vendor fails to deliver on time?
- Are there intellectual property or licensing risks associated with the legacy codebase (e.g., copyleft licenses in the dependency tree)?
- What is the plan if the project runs over budget or over schedule -- what gets descoped first?
- Are there political or organizational risks (team restructuring, leadership changes, competing initiatives) that could affect the project?

### Governance and process

- What is the agreed RACI for decisions about scope, design, and trade-offs?
- What is the change control process for modifying requirements once the PRD is baselined?
- How will we track requirements traceability from stakeholder needs through design, build, and testing?
- What assumptions must hold true for this plan to succeed, and how will we monitor them?
- What is the escalation path when the team cannot reach consensus on a design or scope decision?
- How frequently will the PRD be reviewed and updated (living document cadence)?
- What artifacts will be produced alongside the PRD (architecture decision records, design docs, data flow diagrams)?
- Are there architectural review boards, security review gates, or compliance checkpoints that must be passed?
- What is the cadence for stakeholder demos or progress reviews?
- How will we handle scope creep -- what is the process for evaluating and approving new requests mid-flight?

---

## 10. Releases, Acceptance, and Validation

### Release planning

- How will work be broken into increments or releases, and what is the prioritization framework (must/should/could)?
- What are the explicit release criteria across functionality, usability, reliability, performance, and supportability?
- What is the branching and release strategy (trunk-based, GitFlow, release trains)?
- What is the expected release cadence once the system is in production (weekly, bi-weekly, monthly)?
- Are there feature flag or gradual rollout mechanisms planned for controlling exposure?
- What are the environment promotion steps (dev, QA, staging, pre-prod, prod), and what gates exist between them?

### Acceptance and sign-off

- How will stakeholders formally accept features and releases (criteria, sign-off process, evidence required)?
- Who has veto authority on a release, and what constitutes a release-blocking issue?
- What evidence package is required for regulatory or compliance sign-off (test reports, audit logs, penetration test results)?
- Is there a formal acceptance period (e.g., 30-day warranty window) after each release?

### Testing strategy

- What testing levels are required (unit, integration, E2E, regression, UAT, performance, security, compliance)?
- Are we expected to replicate legacy behavior including known bugs, or fix them as part of the scope?
- Will we create a "golden dataset" of legacy system inputs and outputs to validate equivalence of the new system?
- What is the strategy for regression testing across legacy features that are not being changed?
- Are there contract tests or consumer-driven contract tests for API integrations?
- What is the load and stress testing plan (tools, target load, duration, environment)?
- Are there chaos engineering or resilience testing requirements?
- What is the strategy for testing data migration (dry runs, row counts, checksums, reconciliation reports)?
- How will we handle test data management (synthetic generation, production clones, anonymization)?
- Are there specific browser, device, or OS compatibility testing requirements?
- What is the accessibility testing plan (automated scans, manual testing, assistive technology testing)?

### Post-release validation

- What metrics and dashboards will we use post-release to confirm the system is meeting the PRD's intent?
- Under what conditions will we consider the legacy system fully decommissionable?
- What is the post-release monitoring plan for the first 24 hours, 7 days, and 30 days?
- What is the process for triaging and addressing post-release defects (severity classification, response SLAs)?
- Will there be a formal post-implementation review (PIR) or retrospective, and when?
- How will we measure whether the business outcomes defined in section 1 are actually being achieved?

---

## 11. Technical Architecture and Design Constraints

### Target architecture

- What is the target architecture pattern (monolith, modular monolith, microservices, serverless, hybrid)?
- What are the key architectural decision records (ADRs) that have already been made, and which are still open?
- What is the target technology stack (languages, frameworks, databases, infrastructure), and what drove these choices?
- Are there approved patterns or reference architectures from the enterprise architecture team?
- What is the API design strategy (REST, GraphQL, gRPC, event-driven) and what are the conventions?
- How will the system handle cross-cutting concerns (logging, tracing, auth, rate limiting, configuration)?
- What is the caching strategy (CDN, application cache, database cache, invalidation approach)?
- What is the state management approach (stateless services, session stores, distributed state)?

### DevOps and CI/CD

- What is the current CI/CD pipeline, and what changes are needed for the target system?
- What is the target deployment model (blue/green, canary, rolling, immutable infrastructure)?
- What infrastructure-as-code tooling is in use or planned (Terraform, Pulumi, CloudFormation, CDK)?
- What container orchestration platform is in use or planned (Kubernetes, ECS, Cloud Run)?
- What is the artifact management strategy (container registries, package repositories, binary stores)?
- What are the build time and deployment time targets?
- What is the source code management strategy (mono-repo, multi-repo, code ownership model)?

### Scalability and capacity

- What are the horizontal and vertical scaling requirements and limits?
- What auto-scaling policies are needed (CPU, memory, queue depth, custom metrics)?
- What are the expected peak-to-trough traffic ratios, and do we need to handle sudden spikes (flash sales, viral events)?
- What is the database scaling strategy (read replicas, sharding, partitioning, connection pooling)?

---

## 12. Cost, Budget, and Financial Constraints


- What is the approved budget for this phase, and how is it allocated (engineering, infrastructure, licensing, consulting)?
- What is the current total cost of ownership (TCO) of the legacy system (infrastructure, licensing, support staff, incident costs)?
- What is the projected TCO of the target system, and what is the expected payback period?
- Are there cloud cost guardrails or FinOps practices that the target system must follow?
- What is the expected infrastructure cost delta during the coexistence period when both systems run in parallel?
- Are there licensing costs that can be retired once the legacy system is decommissioned, and when can those savings be realized?
- What is the cost of delay -- how much does each month of slippage cost the business?
- Are there approved vendors or procurement constraints that affect technology choices?
- What is the budget for external consultants, contractors, or specialized expertise (e.g., legacy language specialists)?

---

## 13. Team, Staffing, and Organizational Readiness


- What is the current team composition (roles, headcount, tenure), and are there gaps?
- Does the team have the skills needed for the target architecture, or is training/hiring required?
- Are there dependencies on teams outside the core project team (platform, security, DBA, network)?
- What is the expected allocation of existing team members (full-time on this project vs split with BAU)?
- Who is responsible for maintaining the legacy system during the project (separate team or same team)?
- Are there key-person dependencies, and what is the bus factor for critical knowledge areas?
- What is the onboarding plan for new team members who are unfamiliar with the legacy system?
- Are there timezone, language, or cultural considerations for distributed teams?
- What collaboration tools and practices will the team use (agile ceremonies, async communication, documentation standards)?
- Is there a dedicated product owner or business analyst embedded with the team?

---

## 14. Documentation and Knowledge Transfer


- What documentation exists today (architecture docs, API specs, data dictionaries, user manuals, SOPs)?
- What is the gap between existing documentation and what is needed to safely make changes?
- What documentation standards and tools will be used for the target system (Confluence, Notion, docs-as-code)?
- Will the project produce updated architecture diagrams, data flow diagrams, and sequence diagrams?
- What is the plan for maintaining documentation as the system evolves post-launch (who owns it, review cadence)?
- Are there knowledge transfer sessions planned between legacy system experts and the project team?
- What internal wikis, Slack channels, or knowledge bases contain informal system knowledge that should be formalized?
- Will the project produce decision logs that capture why key choices were made?

---

## 15. AI-Assisted or Modernized Components (If Relevant)

### Strategic fit

- Are there areas where we plan to introduce AI/ML (e.g., recommendations, classification, natural-language interfaces)?
- What specific business problems will these AI components solve, and how will we measure their added value?
- Is the AI component a core differentiator, or a cost-reduction measure, or an experimental addition?
- What is the fallback if the AI component does not meet accuracy or quality thresholds -- can the feature launch without it?

### Data and model requirements

- What data is required to train or prompt these components, and do we have the rights and quality to use it?
- Will we use pre-trained models, fine-tuned models, or build from scratch?
- What is the model serving infrastructure (managed service, self-hosted, edge)?
- What is the expected latency budget for AI inference in the critical path?
- How will we handle model versioning, A/B testing, and rollback of model deployments?
- What is the data pipeline for ongoing model training or fine-tuning (batch, streaming, human-in-the-loop)?

### Safety and governance

- What accuracy, safety, and explainability thresholds are acceptable to stakeholders and regulators?
- How will AI outputs be validated by users or downstream systems, and what is the fallback behavior on low confidence?
- What bias detection and fairness testing will be performed?
- What is the plan for monitoring model drift and degradation over time?
- Are there specific AI/ML governance or responsible-AI policies that apply?
- What audit trail is required for AI-driven decisions (especially in regulated industries)?
- How will we handle user consent and transparency around AI-generated outputs?

---

## 16. Compliance, Legal, and Regulatory Deep Dive


- What specific regulations apply to this system (GDPR, CCPA, HIPAA, PCI-DSS, SOX, DORA, NIS2)?
- Are there data classification requirements (public, internal, confidential, restricted)?
- What audit logging requirements exist, and how long must audit logs be retained?
- Are there e-discovery or litigation hold requirements that affect data retention?
- What consent management requirements exist for user data collection and processing?
- Are there cross-border data transfer restrictions (e.g., EU-US data flows, Schrems II compliance)?
- What is the process for conducting a Data Protection Impact Assessment (DPIA) if required?
- Are there export control or sanctions screening requirements for the system's users or data?
- What contractual obligations (SLAs with customers, vendor agreements) constrain system behavior or availability?
- Are there open-source license compliance requirements that must be verified in the target system?

---

## 17. Observability, Incident Management, and Operational Readiness


- What SLIs (service level indicators) and SLOs (service level objectives) will be defined for the target system?
- What dashboards are needed for operations, business, and executive audiences?
- What alerting rules and thresholds will be configured, and who receives each alert?
- What is the incident classification scheme (severity levels, response times, escalation paths)?
- What is the post-incident review (blameless postmortem) process?
- What is the on-call schedule, and are there follow-the-sun or after-hours support requirements?
- What runbooks will be created for common operational scenarios (restarts, failovers, data fixes, scaling)?
- What is the process for emergency patches or hotfixes in production?
- How will we conduct operational readiness reviews before each major release?
- What is the plan for capacity planning and periodic performance reviews?

---

## 18. Vendor and Third-Party Management


- What third-party services, SaaS products, or managed services does the current system depend on?
- What are the contractual terms, renewal dates, and exit clauses for each vendor?
- Are there vendor APIs that are being deprecated or changing in ways that affect the project timeline?
- What is the vendor's support model (SLA, support tiers, escalation process)?
- Are there alternative vendors identified in case of vendor failure or unacceptable terms?
- What data does each vendor have access to, and what are the data processing agreements in place?
- Are there open-source alternatives to current paid vendors that should be evaluated?
- What is the process for onboarding new vendors (security review, procurement, legal)?

---

## Appendix: Meta-Questions for the PRD Process Itself

These questions help ensure the PRD process is well-run, not just the PRD content.

- Who is the intended audience for this PRD (engineering, product, executives, external partners)?
- What level of detail is expected -- high-level strategic or detailed enough for engineering to build from?
- How will this PRD relate to other artifacts (technical design docs, architecture diagrams, user stories)?
- What is the review and approval workflow for the PRD itself?
- How will conflicting stakeholder requirements be resolved during the PRD process?
- What workshops, interviews, or discovery sessions are planned to fill gaps in this PRD?
- Is there a PRD template or standard format that must be followed for organizational consistency?
- What is the timeline for completing the PRD, and are there dependencies on its completion?