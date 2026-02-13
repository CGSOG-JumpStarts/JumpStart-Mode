---
id: requirements-responses
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
  - specs/codebase-context.md
  - .jumpstart/guides/requirements-checklist.md
dependencies:
  - challenger-brief
risk_level: low
owners: []
sha256: null
---

# Requirements Responses

> **Phase:** 1 -- Analysis
> **Agent:** The Analyst (with Requirements Extractor subagent)
> **Status:** Draft
> **Created:** [DATE]
> **Updated:** [DATE]
> **Upstream References:** [specs/challenger-brief.md](challenger-brief.md), [requirements-checklist.md](../../.jumpstart/guides/requirements-checklist.md)
> **Companion Artifact:** [specs/product-brief.md](product-brief.md)

---

## Executive Summary

**Project Type:** [greenfield / brownfield]
**Domain:** [domain from config]
**Domain Complexity:** [low / medium / high]

**Coverage Statistics:**

| Metric | Value |
|--------|-------|
| Total checklist sections | 18 |
| Sections evaluated | [N] |
| Sections skipped | [N] |
| Total questions in scope | [N] |
| Pre-answered from upstream | [N] ([%]) |
| User-provided responses | [N] ([%]) |
| Deferred / Not applicable | [N] ([%]) |
| Remaining gaps | [N] ([%]) |

**Key Gaps:** [1-2 sentence summary of the most critical unanswered areas]

**Domain Flags:** [Any domain-specific compliance, safety, or regulatory concerns that must be addressed]

---

## Pre-Answered Items

Items below were extracted from upstream artifacts (Scout codebase analysis, Challenger Brief, Challenger Insights) without requiring user input. Each answer includes a source citation and confidence level.

### Section 1 — Context, Goals, and Scope

| # | Question | Answer | Source | Confidence |
|---|----------|--------|--------|------------|
| 1 | [Question from requirements checklist] | [Answer extracted from upstream data] | [Scout: §X] / [Challenger: Section Name] | High / Medium / Low |

### Section 2 — Existing System Inventory and Behavior

_[Brownfield only — omit for greenfield projects]_

| # | Question | Answer | Source | Confidence |
|---|----------|--------|--------|------------|
| 1 | | | | |

### Section 3 — Current Pain Points and Gaps

| # | Question | Answer | Source | Confidence |
|---|----------|--------|--------|------------|
| 1 | | | | |

### Section 4 — Functional Requirements

| # | Question | Answer | Source | Confidence |
|---|----------|--------|--------|------------|
| 1 | | | | |

### Section 5 — Non-Functional Requirements

| # | Question | Answer | Source | Confidence |
|---|----------|--------|--------|------------|
| 1 | | | | |

### Section 6 — Data, Integrations, and Migration

| # | Question | Answer | Source | Confidence |
|---|----------|--------|--------|------------|
| 1 | | | | |

### Section 7 — Backwards Compatibility and Cutover

_[Brownfield only — omit for greenfield projects]_

| # | Question | Answer | Source | Confidence |
|---|----------|--------|--------|------------|
| 1 | | | | |

### Section 8 — Users, UX, and Change Management

| # | Question | Answer | Source | Confidence |
|---|----------|--------|--------|------------|
| 1 | | | | |

### Section 9 — Governance, Risks, and Constraints

| # | Question | Answer | Source | Confidence |
|---|----------|--------|--------|------------|
| 1 | | | | |

### Section 10 — Releases, Acceptance, and Validation

| # | Question | Answer | Source | Confidence |
|---|----------|--------|--------|------------|
| 1 | | | | |

### Section 11 — Technical Architecture and Design Constraints

| # | Question | Answer | Source | Confidence |
|---|----------|--------|--------|------------|
| 1 | | | | |

### Section 12 — Cost, Budget, and Financial Constraints

| # | Question | Answer | Source | Confidence |
|---|----------|--------|--------|------------|
| 1 | | | | |

### Section 13 — Team, Staffing, and Organizational Readiness

| # | Question | Answer | Source | Confidence |
|---|----------|--------|--------|------------|
| 1 | | | | |

### Section 14 — Documentation and Knowledge Transfer

| # | Question | Answer | Source | Confidence |
|---|----------|--------|--------|------------|
| 1 | | | | |

### Section 15 — AI-Assisted Components

_[Conditional — include only if AI/ML signals detected]_

| # | Question | Answer | Source | Confidence |
|---|----------|--------|--------|------------|
| 1 | | | | |

### Section 16 — Compliance, Legal, and Regulatory

_[Conditional — include only if regulated domain or compliance signals detected]_

| # | Question | Answer | Source | Confidence |
|---|----------|--------|--------|------------|
| 1 | | | | |

### Section 17 — Observability, Incident Management

| # | Question | Answer | Source | Confidence |
|---|----------|--------|--------|------------|
| 1 | | | | |

### Section 18 — Vendor and Third-Party Management

| # | Question | Answer | Source | Confidence |
|---|----------|--------|--------|------------|
| 1 | | | | |

---

## User Responses

Items below were answered by the human during the Analyst's Requirements Deep Dive probing round. Each response includes the date captured and areas of downstream impact.

### Section 1 — Context, Goals, and Scope

| # | Question | User Response | Date | Impact Areas |
|---|----------|--------------|------|-------------|
| 1 | [Question asked] | [User's answer] | [YYYY-MM-DD] | architecture / data / testing / compliance / scope |

[Repeat section structure for each applicable section]

---

## Deferred and Not Applicable

Questions below were either deferred (relevant but low-priority for this phase) or marked not applicable (wrong project type, domain mismatch, or explicitly out of scope).

| # | Section | Question | Status | Rationale |
|---|---------|----------|--------|-----------|
| 1 | [Section #] | [Question] | Deferred / Not Applicable | [Brief rationale] |

---

## Coverage Dashboard

| Section | Relevance | Total Qs | Pre-Answered | User-Provided | Deferred | N/A | Gap% |
|---------|-----------|----------|-------------|---------------|----------|-----|------|
| 1 — Context, Goals | [HIGH/MED/LOW] | [N] | [N] | [N] | [N] | [N] | [%] |
| 2 — System Inventory | | | | | | | |
| 3 — Pain Points | | | | | | | |
| 4 — Functional Reqs | | | | | | | |
| 5 — NFRs | | | | | | | |
| 6 — Data & Integration | | | | | | | |
| 7 — Compatibility | | | | | | | |
| 8 — Users & UX | | | | | | | |
| 9 — Governance & Risk | | | | | | | |
| 10 — Releases | | | | | | | |
| 11 — Tech Architecture | | | | | | | |
| 12 — Cost & Budget | | | | | | | |
| 13 — Team & Staffing | | | | | | | |
| 14 — Documentation | | | | | | | |
| 15 — AI Components | | | | | | | |
| 16 — Compliance | | | | | | | |
| 17 — Observability | | | | | | | |
| 18 — Vendors | | | | | | | |
| **Totals** | | **[N]** | **[N]** | **[N]** | **[N]** | **[N]** | **[%]** |

---

## Downstream Impact Notes

### For PM (Phase 2)

Gaps that affect user story writing, acceptance criteria, and prioritisation:

- [Gap description and which stories/epics it affects]

### For Architect (Phase 3)

Gaps that affect system design, data modelling, API contracts, and deployment strategy:

- [Gap description and which architectural decisions it affects]

### For Developer (Phase 4)

Gaps that affect implementation, testing strategy, and deployment:

- [Gap description and which tasks or test areas it affects]

---

## Linked Data

```json-ld
{
  "@context": { "js": "https://jumpstart.dev/schema/" },
  "@type": "js:SpecArtifact",
  "@id": "js:requirements-responses",
  "js:phase": 1,
  "js:agent": "Analyst",
  "js:status": "[STATUS]",
  "js:version": "[VERSION]",
  "js:upstream": [
    { "@id": "js:challenger-brief" },
    { "@id": "js:codebase-context" }
  ],
  "js:downstream": [
    { "@id": "js:product-brief" },
    { "@id": "js:prd" },
    { "@id": "js:architecture" }
  ],
  "js:traces": []
}
```
