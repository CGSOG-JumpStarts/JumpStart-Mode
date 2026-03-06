# Agent Access Reference: Subagents & Templates

This document explains how agents within the Jump Start framework access subagents and templates, how they know which ones to use, and provides a comprehensive reference mapping for developers building new components or onboarding to the framework.

## How Agents Access Subagents

In the Jump Start framework, phase agents (like Analyst, Architect, Developer) can invoke specialized advisory agents (like Security, QA, Performance) to assist with specific tasks. This is governed by the **Subagent Protocol**.

### The Mechanism
Agents do not have hardcoded, direct code dependencies on subagents. Instead, they access subagents dynamically using the **`agent` tool** provided by the AI assistant environment (e.g., Copilot, Claude Code). 

### How They Know Which to Use
1. **Explicit Instructions:** Each agent's persona file (located in `.jumpstart/agents/` or `.github/agents/`) contains specific instructions on *when* and *why* to invoke certain subagents.
2. **Conditional Invocation:** Agents do not automatically invoke subagents at every step. They evaluate project signals (domain complexity, configuration flags, artifact content) and invoke a subagent only when indicators suggest specialized review will add value.
3. **Scoped Queries:** When invoking a subagent, the parent agent provides a focused prompt describing exactly what needs to be reviewed and what context is relevant.
4. **Incorporation:** Subagent findings are returned to the parent agent and incorporated into the parent's artifact. Subagents do not write standalone artifacts or bypass phase gates.

## How Agents Access Templates

Templates ensure that the artifacts produced by agents follow a consistent, machine-readable, and human-verifiable structure.

### The Mechanism
All templates are stored in the `.jumpstart/templates/` directory. Agents access these templates by reading the file contents when generating their outputs.

### How They Know Which to Use
1. **Protocol Directives:** An agent's step-by-step protocol (defined in its `.jumpstart/agents/<agent>.md` file) explicitly dictates which template must be used for a given output. 
2. **Strict Adherence:** Agents are instructed *never* to invent new document formats. They must always populate artifacts using the specified templates.

---

## Agent Access Breakdown

Below is a detailed mapping of each agent in the Jump Start framework, the templates they are instructed to use, and the subagents they are explicitly authorized to invoke.

### Phase Agents

| Agent | Templates Used | Subagents Invoked |
| :--- | :--- | :--- |
| **Scout** (Pre-Phase) | `insights.md`, `codebase-context.md`, `insight-entry.md`, `session-briefing.md` | `Jump Start: Researcher`, `Jump Start: Security` |
| **Challenger** (Phase 0) | `needs-clarification.md`, `insights.md`, `challenger-log.md`, `challenger-brief.md`, `reasoning.md`, `insight-entry.md`, `wait-checkpoint.md`, `session-briefing.md` | `Jump Start: Researcher`, `Jump Start: Security`, `Jump Start: Adversary` |
| **Analyst** (Phase 1) | `needs-clarification.md`, `insights.md`, `persona-simulation.md`, `product-brief.md`, `requirements-responses.md`, `insight-entry.md`, `wait-checkpoint.md`, `persona-change.md`, `session-briefing.md`, `compliance-checklist.md`¹, `metrics.md`¹, `stakeholders.md`¹ | `Jump Start: Requirements Extractor`, `Jump Start: UI/UX Designer`, `Jump Start: Researcher`, `Jump Start: Security`, `Jump Start: Adversary` |
| **PM** (Phase 2) | `needs-clarification.md`, `insights.md`, `gherkin-guide.md`, `prd.md`, `insight-entry.md`, `wait-checkpoint.md`, `session-briefing.md`, `prd-index.md`¹ | `Jump Start: QA`, `Jump Start: Performance`, `Jump Start: Security`, `Jump Start: Scrum Master`, `Jump Start: Adversary` |
| **Architect** (Phase 3) | `needs-clarification.md`, `insights.md`, `adr.md`, `agents-md.md`, `branch-evaluation.md`, `documentation-audit.md`, `design-system.md`, `data-model.md`, `contracts.md`, `insight-entry.md`, `wait-checkpoint.md`, `session-briefing.md`, `architecture.md`, `implementation-plan.md`, `constraint-map.md`¹, `task-dependencies.md`¹, `tasks.md`¹, `traceability.md`¹ | `Jump Start: Security`, `Jump Start: Performance`, `Jump Start: Researcher`, `Jump Start: DevOps`, `Jump Start: Adversary`, `Jump Start: Scrum Master` |
| **Developer** (Phase 4) | `needs-clarification.md`, `insights.md`, `todo.md`, `agents-md.md`, `red-phase-report.md`, `test-failure-evidence.md`, `insight-entry.md`, `wait-checkpoint.md`, `session-briefing.md` | `Jump Start: QA`, `Jump Start: Refactor`, `Jump Start: Reviewer`, `Jump Start: Tech Writer`, `Jump Start: Maintenance`, `Jump Start: Retrospective` |

### Advisory & Utility Agents

| Agent | Templates Used | Subagents Invoked |
| :--- | :--- | :--- |
| **Adversary** | `adversarial-review.md` | *None* |
| **DevOps** | `deploy.md`, `ci-cd.yml`¹ | `Jump Start: Security`, `Jump Start: Researcher` |
| **Diagram Verifier** | *None — uses CLI tooling, not templates* | *None* |
| **Facilitator** | `pitcrew-session.md`¹ | `Jump Start: QA`, `Jump Start: Security`, `Jump Start: Performance`, `Jump Start: Researcher`, `Jump Start: UI/UX Designer`, `Jump Start: Refactor`, `Jump Start: Tech Writer`, `Jump Start: Scrum Master`, `Jump Start: DevOps`, `Jump Start: Adversary`, `Jump Start: Reviewer`, `Jump Start: Retrospective`, `Jump Start: Maintenance`, `Jump Start: Quick Dev` |
| **Maintenance** | `drift-report.md`¹ | *None* |
| **Performance** | `nfrs.md`¹ | `Jump Start: Researcher` |
| **QA** | `test-plan.md`¹, `test-report.md`¹ | `Jump Start: Security`, `Jump Start: Performance` |
| **Quick Dev** | `quickflow.md` | `Jump Start: QA`, `Jump Start: Reviewer` |
| **Refactor** | `refactor-report.md`¹ | *None* |
| **Requirements Extractor** | *None — produces inline findings incorporated by parent agent* | `Jump Start: Researcher` |
| **Researcher** | `research.md`¹, `stack-metadata.md`¹ | *None* |
| **Retrospective** | `retrospective.md` | *None* |
| **Reviewer** | `peer-review.md` | *None* |
| **Scrum Master** | `sprint-status.yaml`¹, `sprint-planning.md`¹, `sprint.yaml`¹ | *None* |
| **Security** | `security-review.md`¹ | `Jump Start: Researcher` |
| **Tech Writer** | `agents-md.md`, `doc-update-checklist.md`¹ | *None* |
| **UI/UX Designer** | `design-system.md`, `ux-design.md` | *None explicitly mentioned* |

---

> ¹ Template reference added during connectivity remediation — wired into the agent's protocol with explicit `.jumpstart/templates/` path.

## System & Cross-Cutting Templates

The following templates are **intentionally standalone** — they are consumed by the CLI tooling, framework infrastructure, or shared across all agents via common protocols (e.g., `AGENTS.md`) rather than being owned by a single agent.

| Template | Purpose | Consumed By |
| :--- | :--- | :--- |
| `agent-template.md` | Meta-template for creating new agent persona files | Skill creator / manual authoring |
| `config-proposal.md` | Configuration change proposal format | CLI / framework runtime |
| `consistency-report.md` | Cross-artifact consistency check output | CLI validation tooling |
| `context-summary.md` | Compressed context for session handoffs | CLI / context summarizer |
| `correction-entry.md` | Entry format for `correction-log.md` | All agents (self-correction protocol) |
| `coverage-report.md` | Test coverage report format | CLI / coverage tooling |
| `diff-summary.md` | Summary of changes between artifact versions | CLI / diff tooling |
| `dry-run-report.md` | Dry-run simulation output format | CLI / dry-run tooling |
| `gate-checklist.json` | Phase gate machine-readable checklist | CLI / gate validation |
| `insights.md` | Living insight log shell | All phase & advisory agents |
| `insight-entry.md` | Individual insight log entry format | All agents (via insights protocol) |
| `jsonld.block.md` | JSON-LD structured data block format | CLI / structured output |
| `model-map.md` | Data model relationship map | CLI / model tooling |
| `module-manifest.json` | Module metadata manifest schema | CLI / module tooling |
| `needs-clarification.md` | Ambiguity tagging format | All agents (Item 69 protocol) |
| `phase-gate.md` | Phase gate approval section template | All phase agents (gate protocol) |
| `project-context.md` | Project-level context document | CLI / project init |
| `qa-log.md` | Q&A decision log entry format | All agents (when `workflow.qa_log` is true) |
| `session-briefing.md` | Session resumption briefing | All agents (Item 39+ protocol via `AGENTS.md`) |
| `spec-checklist.md` | Specification completeness checklist | CLI / spec validation |
| `status.md` | Project status dashboard template | CLI / dashboard |
| `wait-checkpoint.md` | Checkpoint pause format | All phase agents |

## Question Carousel Files

The `.jumpstart/templates/questions/` directory contains structured JSON files used by the interactive question carousel UI system. These are **not agent-owned templates** but data files consumed by the framework's question routing logic.

| File | Description |
| :--- | :--- |
| `challenger-questions.json` | Question bank for Challenger phase |
| `analyst-questions.json` | Question bank for Analyst phase |
| `pm-questions.json` | Question bank for PM phase |
| `architect-questions.json` | Question bank for Architect phase |

---
*Note: This document is intended as a reference guide. For the exact, up-to-date behavior of any specific agent, always refer to its source instruction file in the `.jumpstart/agents/` directory.*