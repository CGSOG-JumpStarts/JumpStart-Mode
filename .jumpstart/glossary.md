# Terminology Dictionary (Glossary)

> **Canonical term definitions for consistent naming across specs and code**
>
> All agents MUST use terms as defined here. If a term is ambiguous or missing, add it. Never use synonyms that contradict this glossary.

---

## Framework Terms

| Term | Definition | Synonyms (Avoid) |
|---|---|---|
| **Agent** | An AI persona with a specific mandate, activated by a slash command | Bot, Assistant |
| **Artifact** | A specification document produced by an agent during a phase | Document, Output |
| **Phase** | A sequential stage in the development workflow (0-4) | Step, Stage |
| **Phase Gate** | An approval checkpoint at the end of each phase | Gate, Checkpoint |
| **Spec** | A specification artifact in the `specs/` directory | Document, Doc |
| **Roadmap** | The non-negotiable principles in `.jumpstart/roadmap.md` | Constitution, Rules |
| **Insight** | A recorded observation, decision, or trade-off in an insights file | Note, Comment |
| **ADR** | Architecture Decision Record in `specs/decisions/` | Decision Log |
| **Brownfield** | A project with existing code (vs. greenfield — new project) | Legacy, Existing |
| **Greenfield** | A new project with no existing code | New, Fresh |
| **Quick Flow** | An abbreviated 3-step workflow for minor changes | Fast Path, Shortcut |
| **Pit Crew** | Multi-agent advisory discussion session | Roundtable, Forum |
| **Sprint** | A time-boxed iteration of implementation work | Iteration, Cycle |

## Product Terms

| Term | Definition | Synonyms (Avoid) |
|---|---|---|
| **Epic** | A large user-facing capability composed of multiple stories | Feature, Module |
| **Story** | A user story with acceptance criteria (E{n}-S{n} format) | Ticket, Task, Issue |
| **Task** | An implementation unit from the implementation plan (T{nnn} format) | Work Item |
| **NFR** | Non-Functional Requirement (NFR-{category}{nn} format) | Quality Attribute |
| **AC** | Acceptance Criteria — conditions for story completion | Criteria, Requirements |
| **Persona** | A representative user archetype with goals and pain points | User Type, Role |
| **Stakeholder** | Anyone with an interest in or influence over the project | Interested Party |

## Technical Terms

| Term | Definition | Synonyms (Avoid) |
|---|---|---|
| **Validation Criterion** | A testable condition from Phase 0 (VC-{nn} format) | Success Criterion |
| **Cross-Reference** | A bidirectional link between spec artifacts | Link, Reference |
| **Traceability** | The ability to trace from requirement → story → task → test | Linkage |
| **Constraint Map** | NFR-to-architecture-to-task mapping | Requirement Matrix |
| **Reasoning Trace** | Raw Phase 0 reasoning before formal compression | Thought Process |
| **Correction Log** | Record of rejected proposals (COR-{nnn} format) | Error Log |

---

## Adding Terms

When adding a new term:
1. Check that it doesn't duplicate an existing entry
2. Include clear definition and any synonyms to avoid
3. Use the term consistently in all subsequent artifacts
4. Notify agents of the new term via the Q&A log if relevant
