# Spec-Writing Guide for AI Agents

> This guide establishes best practices for writing, structuring, and consuming specification artifacts within the Jump Start framework. All agents should read this guide for awareness. The enforceable standards are codified in **Article XII** of `.jumpstart/roadmap.md`.

---

## 1. Start with a High-Level Vision, Then Expand

The Jump Start workflow already embodies this principle through its sequential phases: the Challenger captures the raw problem and reframes it (what/why), and downstream agents progressively expand it into detailed specifications.

**Key practices for agents:**

- **Phase 0–1 agents (Challenger, Analyst):** Focus specs on **what** and **why** — user needs, pain points, validation criteria, and outcomes. Do not prescribe implementation details.
- **Phase 2–3 agents (PM, Architect):** Expand the vision into structured requirements and technical blueprints. Every detail must trace upstream to a user need or validation criterion.
- **Phase 4 agent (Developer):** Consume the expanded specs faithfully. Do not improvise architecture or invent requirements.

**Goal-oriented specs:** Frame spec content around user outcomes and acceptance criteria, not technical to-do lists. Good: "Users can identify at-risk deals within 30 seconds." Bad: "Add a red badge to the dashboard table."

**Use Plan Mode thinking:** Before generating any spec artifact, agents should analyze existing context (upstream artifacts, codebase for brownfield) and draft a mental model of the spec's structure. Only then generate the full document. This prevents premature detail and structural drift.

---

## 2. Cover the Six Core Areas

Architecture and implementation plan specs must address six core areas to be considered complete. Missing areas lead to ambiguous implementations and agent confusion.

### Checklist

| Area | What to Include | Primary Spec Location |
|------|----------------|----------------------|
| **Commands** | Full executable commands with flags (build, test, lint, deploy, format) | `specs/architecture.md` → Technology Stack, `TODO.md` → Tech Manifest |
| **Testing** | Framework name, test file locations, coverage expectations, how to run tests | `specs/architecture.md` → Testing Strategy, `specs/prd.md` → NFRs |
| **Project Structure** | Directory layout with purpose annotations for every directory | `specs/architecture.md` → Directory Structure |
| **Code Style** | Naming conventions, formatting rules, one real code snippet per pattern | `specs/architecture.md` → Code Conventions, `TODO.md` → Canonical Code Patterns |
| **Git Workflow** | Branch naming, commit message format, PR requirements | `specs/architecture.md` → Git Workflow |
| **Boundaries** | Three-tier constraints: Always do / Ask first / Never do | `specs/architecture.md` → Boundaries, `TODO.md` → Agent Permissions |

### Three-Tier Boundary Format

Use this format consistently across all spec documents that define agent or developer constraints:

```markdown
## Boundaries

### ✅ Always Do
- Run tests before commits
- Follow naming conventions established in Code Style section
- Log errors to the monitoring service
- Validate inputs at system boundaries

### ⚠️ Ask First
- Database schema changes
- Adding new dependencies not in the Tech Manifest
- Changing CI/CD configuration
- Modifying API contracts

### 🚫 Never Do
- Commit secrets or API keys
- Edit `node_modules/`, `vendor/`, or lockfiles manually
- Remove a failing test without explicit approval
- Modify files in `.jumpstart/agents/` or `.jumpstart/templates/`
```

Place boundary sections **early** in architecture and implementation plan documents — agents process content sequentially, and boundaries encountered early constrain all subsequent work.

---

## 3. Modularity and Context Scoping

Large specs overwhelm agents. The "curse of instructions" means that as you pile more detailed rules into a single prompt or document, the agent's ability to follow all of them drops. The solution is modularity.

### Extended Table of Contents (Extended TOC)

When a spec artifact exceeds **500 lines** (or when `spec_authoring.extended_toc` is `true` in config), include an Extended TOC immediately after the YAML frontmatter. This provides a bird's-eye view with per-section summaries:

```markdown
## Extended Table of Contents

| Section | Lines | Summary |
|---------|-------|---------|
| Technology Stack | 45–82 | React 18 + TypeScript frontend, Node.js/Express backend, PostgreSQL with Prisma ORM |
| Component Design | 83–165 | 4 components: API Gateway, Auth Service, Core Service, Background Worker |
| Data Model | 166–230 | 5 entities: User, Project, Task, Comment, AuditLog with full field definitions |
| API Contracts | 231–380 | 18 REST endpoints across 4 resource groups, JWT auth on all except /health |
| Boundaries | 381–410 | Three-tier Always/Ask/Never constraints for the Developer agent |
| Implementation Plan | 411–580 | 24 tasks across 5 milestones, 3 parallel-eligible task groups |
```

**When consuming large specs:** Agents should reference the Extended TOC to locate relevant sections for the current task. Do not load the entire spec tree into working context for each individual task — scope context to what's needed.

### When to Decompose

If a single spec artifact exceeds **800 lines** (configurable via `spec_authoring.max_spec_lines`), consider decomposing it:

- Separate the API contracts into `specs/api-contracts.md` and link from the architecture doc
- Separate the data model into `specs/data-model.md` if it has >10 entities
- Separate deployment/infrastructure into `specs/deployment.md` for complex environments

Each sub-spec must be linked from the parent document with a clear cross-reference.

### Context Scoping During Implementation

The Developer agent should follow these context scoping rules:

1. **Per-task context:** When working on task M3-T05, load only:
   - The task definition from `TODO.md`
   - The referenced story's acceptance criteria from `specs/prd.md`
   - The relevant component design section from `specs/architecture.md`
   - The relevant API contract (if the task involves an endpoint)
   - Applicable ADRs

2. **Per-milestone context:** At milestone boundaries, load the milestone overview and its task list, not the full implementation plan.

3. **Use summaries as indices:** The Extended TOC and `TODO.md` Progress Summary serve as indices — scan them to determine what to load in full.

---

## 4. Self-Verification Protocol

Every agent must perform a self-verification pass before presenting an artifact for human approval. This catches omissions, inconsistencies, and spec drift early.

### How to Self-Verify

After generating or updating a spec artifact:

1. **List all requirements that the spec must satisfy** (from upstream artifacts, config settings, and the phase gate checklist).
2. **Walk through each requirement** and confirm the spec addresses it. Mark each as:
   - ✅ **Satisfied** — the spec clearly addresses this requirement
   - ⚠️ **Partial** — the spec addresses this but may be incomplete
   - ❌ **Missing** — the spec does not address this requirement
3. **For any ⚠️ or ❌ items**, either:
   - Fix the spec before presenting, or
   - Explicitly flag the gap when presenting for approval

### Phase-Specific Self-Verification

**Phase 0 (Challenger):** Before presenting the brief, verify:
- Every validation criterion is observable, testable, and solution-agnostic
- The reframed problem statement names the affected stakeholder
- At least one constraints/boundaries section exists

**Phase 1 (Analyst):** Before presenting the Product Brief, verify:
- Every Must Have capability traces to a Phase 0 validation criterion
- Every High-impact stakeholder has a corresponding persona
- The scope section uses clear tier labels (Must/Should/Could/Won't)

**Phase 2 (PM):** Before presenting the PRD, verify:
- Every epic has at least one user story
- Every Must Have story has ≥2 testable acceptance criteria
- NFRs have measurable thresholds (no vague qualifiers like "fast" or "secure")
- Success metrics map to Phase 0 validation criteria
- Task breakdown covers 100% of Must Have stories

**Phase 3 (Architect):** Before presenting the architecture, verify:
- All six core areas are covered (Commands, Testing, Project Structure, Code Style, Git Workflow, Boundaries)
- Every PRD story maps to at least one implementation task
- Every NFR is addressed by the architecture
- ADRs exist for all significant technical decisions
- Technology versions are pinned and verified

**Phase 4 (Developer):** After completing each task, verify:
- All acceptance criteria for the referenced story are satisfied
- Error handling covers enumerated failure modes
- Done-when criteria are met and testable
- Tests pass and cover the acceptance criteria

### Self-Verification in Practice

Include the self-verification results when presenting for approval:

> "Self-verification complete: 18/18 requirements satisfied, 0 partial, 0 missing. The architecture covers all six core areas, all 12 PRD stories map to implementation tasks, and all 5 NFRs are addressed. Ready for review."

If gaps exist:

> "Self-verification found 2 gaps: (1) NFR-03 (accessibility) lacks a specific implementation task — I recommend adding M4-T15 for WCAG audit. (2) Story E3-S4 maps to a task but acceptance criterion AC-3 ('error response includes correlation ID') is not reflected in the API contract. Shall I address these before you review?"

---

## 5. Iterative Refinement

Specs are living documents. The Jump Start framework already supports this through several mechanisms:

### Existing Mechanisms

- **`archive_on_restart`:** When re-running a phase, existing artifacts are archived with date suffixes before regeneration
- **Spec-drift checks:** `bin/lib/spec-drift.js` validates code-to-spec alignment before build milestones
- **Power Inversion (Article IV):** Specs are the source of truth. Update the spec first, then regenerate code — never silently alter code to diverge from specs
- **Living insights:** Every phase maintains an insights file capturing reasoning, trade-offs, and discoveries as they happen

### Additional Practices

- **Update specs when decisions change.** If the human cuts a feature, approves a tech stack change, or resolves an ambiguity, reflect it in the spec immediately. Do not wait until the end of the phase.
- **Version-control the spec.** Commit spec files to the repository alongside code. This enables `git diff` to trace what changed and why.
- **Resync after changes.** When a spec is updated mid-phase, explicitly notify downstream consumers: "I updated the spec to clarify X and add requirement Y. Refactor the plan/code accordingly."
- **Conformance testing.** For critical contracts (API specs, data models), define expected inputs/outputs that any implementation must pass. Reference conformance criteria in the spec's success section.

---

## Summary: What Jump Start Already Does Well vs. What This Guide Adds

| Principle | Jump Start Status | What This Guide Adds |
|-----------|------------------|---------------------|
| High-level vision first | ✅ Phases 0–1 capture what/why before how | Goal-oriented framing guidance, plan-mode thinking |
| Structured PRD format | ✅ Templates enforce structure | Six core areas checklist for completeness validation |
| Modularity & context scoping | ⚠️ Partial — subagents exist, but no explicit scoping guidance | Extended TOC, decomposition thresholds, per-task context scoping rules |
| Self-checks & constraints | ⚠️ Partial — three-tier boundaries and adversarial review exist | Explicit self-verification protocol per phase |
| Iterative refinement | ✅ Archive, drift checks, Power Inversion, living insights | Conformance testing, explicit resync protocol |

---

**Governed by:** Article XII (Spec Authoring Quality) in `.jumpstart/roadmap.md`
**Config:** `spec_authoring.*` in `.jumpstart/config.yaml`
