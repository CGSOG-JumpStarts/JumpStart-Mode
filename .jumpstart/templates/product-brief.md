---
id: product-brief
phase: 1
agent: Analyst
status: Draft
created: "[DATE]"
updated: "[DATE]"
version: "1.0.0"
approved_by: null
approval_date: null
upstream_refs:
  - specs/challenger-brief.md
dependencies:
  - challenger-brief
risk_level: low
owners: []
sha256: null
---

# Product Brief

> **Phase:** 1 -- Analysis
> **Agent:** The Analyst
> **Status:** Draft
> **Created:** [DATE]
> **Approval date:** [DATE or "Pending"]
> **Approved by:** [Human's name or "Pending"]
> **Upstream Reference:** [specs/challenger-brief.md](challenger-brief.md)

---

## Problem Reference

**Reframed Problem Statement (from Phase 0):**

> [Copy the approved problem statement from the Challenger Brief]

**Validation Criteria (from Phase 0):**
1. [Criterion 1]
2. [Criterion 2]

---

## Vision Statement

> [One to two sentences describing the desired end state. What does the world look like when this problem is solved? This should be aspirational but grounded.]

---

## User Personas

### Persona 1: [Name], [Role]

| Attribute | Detail |
|-----------|--------|
| **Goals** | [What they are trying to accomplish, 2-3 items] |
| **Frustrations** | [What currently blocks or slows them, 2-3 items] |
| **Technical Proficiency** | Low / Medium / High |
| **Relevant Context** | [Environmental, organisational, or situational factors] |
| **Current Workaround** | [How they cope with the problem today] |
| **Representative Quote** | "[A fictional but realistic one-sentence quote capturing their perspective]" |

### Persona 2: [Name], [Role]

| Attribute | Detail |
|-----------|--------|
| **Goals** | |
| **Frustrations** | |
| **Technical Proficiency** | |
| **Relevant Context** | |
| **Current Workaround** | |
| **Representative Quote** | |

[Add additional personas as needed]

> **Persona Evolution:** When new user behaviours or feedback emerge post-approval, create a Persona Change Proposal using `.jumpstart/templates/persona-change.md` and present it for approval before modifying personas.

---

## User Journeys

### Current-State Journey (Primary Persona: [Name])

| Step | Action | Thinking | Feeling | Pain Point (Severity) |
|------|--------|----------|---------|----------------------|
| 1 | [What the user does] | [What they are thinking] | [Emotional state] | [Friction or failure, if any] (Critical / Moderate / Minor) |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

### Future-State Journey (Primary Persona: [Name])

| Step | Action | Thinking | Feeling | Improvement |
|------|--------|----------|---------|-------------|
| 1 | [What the user does with the solution] | [What they are thinking] | [Emotional state] | [What is better vs. current state] |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

---

## Value Proposition

**Structured Format:**

- **For** [target persona]
- **Who** [statement of need or opportunity]
- **The** [product concept name or description]
- **Is a** [product category]
- **That** [key benefit or reason to use]
- **Unlike** [current alternative or competitor]
- **Our approach** [primary differentiator]

**Narrative Version:**

> [One paragraph explaining the value proposition in plain language, suitable for a non-technical stakeholder.]

---

## Competitive Landscape

| Alternative | Type | Strengths | Weaknesses | Relevance |
|-------------|------|-----------|------------|-----------|
| [Name] | Direct Competitor / Indirect Substitute / DIY Workaround | [What it does well] | [Where it falls short] | [How directly it competes] |
| | | | | |
| | | | | |

**Key Insight:** [One sentence summarising the most important takeaway from the competitive analysis]

> _Note: This section is [based on web research / based on human's domain knowledge / speculative and should be validated]. Populated per `include_competitive_analysis` config setting._

---

## Scope Recommendation

### Must Have (MVP)

These capabilities are required to validate the problem is being solved. Each traces to a Phase 0 validation criterion.

| # | Capability | Validation Criterion Served | Rationale |
|---|-----------|---------------------------|-----------|
| 1 | [What the product must be able to do] | [Which criterion from Phase 0] | [Why this is essential for validation] |
| 2 | | | |
| 3 | | | |

### Should Have

These capabilities significantly improve the experience but are not required for initial validation.

| # | Capability | Rationale |
|---|-----------|-----------|
| 1 | [Capability description] | [Why it matters but can wait] |
| 2 | | |

### Could Have

Nice-to-have capabilities that can clearly wait for a later release.

| # | Capability | Rationale |
|---|-----------|-----------|
| 1 | [Capability description] | [Why it is lower priority] |
| 2 | | |

### Won't Have (This Release)

Capabilities explicitly excluded from this effort. Documenting these is as important as documenting what is included.

| # | Capability | Reason for Exclusion |
|---|-----------|---------------------|
| 1 | [Capability description] | [Why it is out of scope] |
| 2 | | |

### Constraints and Boundaries

Explicit boundary statements that define the scope limits for this project. These are validated by `bin/lib/boundary-check.js` against the implementation plan to prevent scope drift.

- [Boundary statement 1 — e.g., "This system will not handle payment processing"]
- [Boundary statement 2 — e.g., "No mobile app in this release"]
- [Boundary statement 3 — e.g., "Maximum 1,000 concurrent users for MVP"]

---

## Open Questions

### Resolved (from Phase 0)
- [Question from Phase 0]: [Resolution found during analysis]

### New Questions (for Phase 2)
- [Question raised during analysis that needs resolution before or during planning]

### Deferred
- [Question explicitly deferred]: [Rationale for deferral and when it should be revisited]

---

## Requirements Coverage Summary

Coverage of the exhaustive PRD requirements checklist (`.jumpstart/guides/requirements-checklist.md`), based on upstream data extraction and user responses collected during the Requirements Deep Dive.

| Section | Relevance | Coverage | Key Gaps |
|---------|-----------|----------|----------|
| 1 — Context, Goals | [HIGH/MED/LOW] | [%] | [Brief description of remaining gaps, or "—" if fully covered] |
| 2 — System Inventory | | | |
| 3 — Pain Points | | | |
| 4 — Functional Reqs | | | |
| 5 — NFRs | | | |
| 6 — Data & Integration | | | |
| 7 — Compatibility | | | |
| 8 — Users & UX | | | |
| 9 — Governance & Risk | | | |
| 10 — Releases | | | |
| 11 — Tech Architecture | | | |
| 12 — Cost & Budget | | | |
| 13 — Team & Staffing | | | |
| 14 — Documentation | | | |
| 15 — AI Components | | | |
| 16 — Compliance | | | |
| 17 — Observability | | | |
| 18 — Vendors | | | |

> **Full requirements responses:** [specs/requirements-responses.md](requirements-responses.md)

_Note: Sections with HIGH relevance and >50% gap are flagged with `[NEEDS CLARIFICATION]` markers for downstream agents (PM, Architect)._

---

## Risks to the Product Concept

| Risk | Impact | Probability | Mitigation |
|------|--------|------------|------------|
| [Description of risk to the product concept, not technical risk] | High / Medium / Low | High / Medium / Low | [Proposed mitigation] |
| | | | |

---

## Insights Reference

**Companion Document:** [specs/insights/product-brief-insights.md](insights/product-brief-insights.md)

This artifact was informed by ongoing insights captured during Analysis. Key insights that shaped this document:

1. **[Brief insight title]** - [One sentence summary]
2. **[Brief insight title]** - [One sentence summary]
3. **[Brief insight title]** - [One sentence summary]

See the insights document for complete decision rationale, alternatives considered, and questions explored.

---

## Stakeholder Map

> **Stakeholder Mapping:** Maintain a living stakeholder registry using `.jumpstart/templates/stakeholders.md`. The stakeholder map informs elicitation depth (who to involve in which decisions) and shapes acceptance criteria. Link stakeholder concerns to NFRs and user stories.

---

## Phase Gate Approval

- [ ] Human has reviewed this brief
- [ ] At least one user persona is defined
- [ ] User journeys are mapped (if configured)
- [ ] MVP scope is populated
- [ ] Every Must Have capability traces to a Phase 0 validation criterion
- [ ] All open questions are resolved or explicitly deferred with rationale
- [ ] Human has explicitly approved this brief for Phase 2 handoff

**Approved by:** [Human's name or "Pending"]
**Approval date:** [Date or "Pending"]
**Status:** Draft

---

## Linked Data

```json-ld
{
  "@context": { "js": "https://jumpstart.dev/schema/" },
  "@type": "js:SpecArtifact",
  "@id": "js:product-brief",
  "js:phase": 1,
  "js:agent": "Analyst",
  "js:status": "[STATUS]",
  "js:version": "[VERSION]",
  "js:upstream": [
    { "@id": "js:challenger-brief" }
  ],
  "js:downstream": [
    { "@id": "js:prd" }
  ],
  "js:traces": []
}
```
