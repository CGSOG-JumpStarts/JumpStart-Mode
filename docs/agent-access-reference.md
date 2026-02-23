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
| **Analyst** (Phase 1) | `needs-clarification.md`, `insights.md`, `persona-simulation.md`, `product-brief.md`, `requirements-responses.md`, `insight-entry.md`, `wait-checkpoint.md`, `persona-change.md`, `session-briefing.md` | `Jump Start: Requirements Extractor`, `Jump Start: UX Designer`, `Jump Start: Researcher`, `Jump Start: Security`, `Jump Start: Adversary` |
| **PM** (Phase 2) | `needs-clarification.md`, `insights.md`, `gherkin-guide.md`, `prd.md`, `insight-entry.md`, `wait-checkpoint.md`, `session-briefing.md` | `Jump Start: QA`, `Jump Start: Performance`, `Jump Start: Security`, `Jump Start: Scrum Master`, `Jump Start: Adversary` |
| **Architect** (Phase 3) | `needs-clarification.md`, `insights.md`, `adr.md`, `agents-md.md`, `branch-evaluation.md`, `documentation-audit.md`, `design-system.md`, `data-model.md`, `contracts.md`, `insight-entry.md`, `wait-checkpoint.md`, `session-briefing.md`, `architecture.md`, `implementation-plan.md` | `Jump Start: Security`, `Jump Start: Performance`, `Jump Start: Researcher`, `Jump Start: DevOps`, `Jump Start: Adversary`, `Jump Start: Scrum Master` |
| **Developer** (Phase 4) | `needs-clarification.md`, `insights.md`, `todo.md`, `agents-md.md`, `red-phase-report.md`, `test-failure-evidence.md`, `insight-entry.md`, `wait-checkpoint.md`, `session-briefing.md` | `Jump Start: QA`, `Jump Start: Refactor`, `Jump Start: Reviewer`, `Jump Start: Tech Writer`, `Jump Start: Maintenance`, `Jump Start: Retrospective` |

### Advisory & Utility Agents

| Agent | Templates Used | Subagents Invoked |
| :--- | :--- | :--- |
| **Adversary** | `adversarial-review.md` | *None* |
| **DevOps** | `deploy.md` | `Jump Start: Security`, `Jump Start: Researcher` |
| **Diagram Verifier** | *None explicitly mentioned* | *None explicitly mentioned* |
| **Facilitator** | *None explicitly mentioned* | `Jump Start: QA`, `Jump Start: Security`, `Jump Start: Performance`, `Jump Start: Researcher`, `Jump Start: UX Designer`, `Jump Start: Refactor`, `Jump Start: Tech Writer`, `Jump Start: Scrum Master`, `Jump Start: DevOps`, `Jump Start: Adversary`, `Jump Start: Reviewer`, `Jump Start: Retrospective`, `Jump Start: Maintenance`, `Jump Start: Quick Dev` |
| **Maintenance** | *None explicitly mentioned* | *None explicitly mentioned* |
| **Performance** | *None explicitly mentioned* | `Jump Start: Researcher` |
| **QA** | *None explicitly mentioned* | `Jump Start: Security`, `Jump Start: Performance` |
| **Quick Dev** | `quickflow.md` | `Jump Start: QA`, `Jump Start: Reviewer` |
| **Refactor** | *None explicitly mentioned* | *None explicitly mentioned* |
| **Requirements Extractor** | *None explicitly mentioned* | `Jump Start: Researcher` |
| **Researcher** | *None explicitly mentioned* | *None explicitly mentioned* |
| **Retrospective** | `retrospective.md` | *None explicitly mentioned* |
| **Reviewer** | `peer-review.md` | *None explicitly mentioned* |
| **Scrum Master** | *None explicitly mentioned* | *None explicitly mentioned* |
| **Security** | *None explicitly mentioned* | `Jump Start: Researcher` |
| **Tech Writer** | `agents-md.md` | *None explicitly mentioned* |
| **UX Designer** | `design-system.md`, `ux-design.md` | *None explicitly mentioned* |

---
*Note: This document is intended as a reference guide. For the exact, up-to-date behavior of any specific agent, always refer to its source instruction file in the `.jumpstart/agents/` directory.*