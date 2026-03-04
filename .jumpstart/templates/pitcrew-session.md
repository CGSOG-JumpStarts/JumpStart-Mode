---
id: pitcrew-session
phase: advisory
agent: facilitator
status: draft
created: ""
updated: ""
version: "1.0.0"
approved_by: "N/A"
approval_date: ""
upstream_refs: []
dependencies: []
risk_level: low
owners: []
sha256: ""
---

# Pit Crew Session: {{Topic}}

> **Multi-Agent Collaborative Discussion**

## Session Metadata

| Field | Value |
|---|---|
| Topic | {{Discussion topic}} |
| Facilitator | AI Facilitator |
| Date | {{Date}} |
| Requested By | {{Human name}} |
| Duration | {{Estimated duration}} |
| Participating Agents | {{List of agents invited}} |

---

## 1. Agent Roster

| Agent | Phase | Expertise | Relevance to Topic |
|---|---|---|---|
| {{Agent Name}} | {{Phase N}} | {{Primary expertise}} | {{Why this agent's perspective matters}} |

---

## 2. Topic Context

### Problem Statement

{{Brief description of the topic or question being discussed}}

### Relevant Artifacts

| Artifact | Status | Key Points |
|---|---|---|
| {{specs/artifact.md}} | {{Approved / Draft}} | {{Summary of relevant content}} |

---

## 3. Discussion Rounds

### Round 1: Initial Perspectives

Each agent provides their initial perspective on the topic from their domain expertise.

#### {{Agent Name}} (Phase {{N}})

> {{Agent's perspective in their voice and communication style}}

**Key Points:**
- {{Point 1}}
- {{Point 2}}

**Concerns:**
- {{Concern 1}}

---

### Round 2: Cross-Examination

Agents respond to each other's perspectives, identifying conflicts, synergies, and gaps.

#### {{Agent A}} responds to {{Agent B}}

> {{Response}}

---

### Round 3: Synthesis

The Facilitator synthesises the discussion into actionable outcomes.

---

## 4. Decision Summary

| Decision ID | Topic | Resolution | Supporting Agents | Dissenting Agents | Rationale |
|---|---|---|---|---|---|
| D-001 | {{Decision topic}} | {{What was decided}} | {{Agents who agreed}} | {{Agents who disagreed}} | {{Why this resolution was chosen}} |

---

## 5. Action Items

| Action | Owner (Agent/Phase) | Priority | Deadline |
|---|---|---|---|
| {{Action description}} | {{Which agent/phase should handle this}} | High / Medium / Low | {{When}} |

---

## 6. Unresolved Questions

| Question | Raised By | Blocking? | Recommended Resolution Path |
|---|---|---|---|
| {{Question}} | {{Agent}} | Yes / No | {{How to resolve}} |

---

## 7. Key Insights

1. **{{Insight title}}** — {{Description of insight that emerged from multi-agent discussion}}
2. **{{Insight title}}** — {{Description}}

---

## Session Assessment

| Criterion | Rating (1-5) | Notes |
|---|---|---|
| All relevant perspectives heard | | |
| Decisions are actionable | | |
| Conflicts resolved or escalated | | |
| Action items are assignable | | |

---

## Linked Data

```json-ld
{
  "@context": { "js": "https://jumpstart.dev/schema/" },
  "@type": "js:SpecArtifact",
  "@id": "js:pitcrew-session",
  "js:phase": "advisory",
  "js:agent": "Facilitator",
  "js:status": "[STATUS]",
  "js:version": "[VERSION]",
  "js:upstream": [],
  "js:downstream": [],
  "js:traces": []
}
```
