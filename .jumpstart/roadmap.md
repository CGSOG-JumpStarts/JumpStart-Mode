# Project Roadmap

> This document defines the non-negotiable principles that govern all AI agent behavior in this project. Roadmap principles supersede agent-specific protocols — no agent may violate a Core Principle, regardless of phase or task context.

---

## Core Principles

### I. Sequential Phase Integrity

Phases are strictly sequential. No phase may begin until the previous phase's artifact is explicitly approved by the human operator. Agents must never skip, combine, or reorder phases. The workflow order is inviolable:

```
[Scout] → Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4
```

An artifact is only "approved" when its Phase Gate Approval section has all checkboxes checked and "Approved by" is not "Pending".

### II. Template Compliance

All output artifacts must be generated using the markdown templates in `.jumpstart/templates/`. Agents must not invent new document formats, omit required template sections, or leave bracket placeholders (e.g., `[DATE]`, `[description]`) in final artifacts. Template structure ensures cross-phase consistency and machine-readability.

### III. Test-First Development

**Enforcement level:** Governed by `roadmap.test_drive_mandate` in `.jumpstart/config.yaml`.

When **enabled** (`test_drive_mandate: true`):
- The Developer agent MUST write the test suite for each task **before** writing any implementation code.
- Tests MUST be run to confirm they fail (Red phase).
- The failing test list MUST be presented to the human for approval.
- Only after human approval of the failing tests may the Developer write implementation code (Green phase).
- After tests pass, the Developer SHOULD refactor if needed (Refactor phase).
- **Violation of this principle is a hard stop.** The Developer must not write source code for a task until its tests exist and the human has confirmed them.

When **disabled** (`test_drive_mandate: false`):
- The Developer SHOULD write tests before or alongside implementation code, but is not required to obtain human approval of failing tests before proceeding.
- All other testing requirements (coverage, acceptance criteria mapping) remain in effect.

### IV. Upstream Traceability

Every downstream artifact must demonstrably trace to its upstream source:
- PRD user stories → Product Brief capabilities → Challenger Brief validation criteria
- Architecture decisions → PRD requirements → Product Brief scope
- Implementation tasks → Architecture components → PRD stories

No orphan requirements are permitted. If a requirement cannot be traced upstream, it must be flagged and justified or removed. Agents must not hallucinate requirements that contradict upstream documents.

### V. Human Gate Authority

No agent may mark a phase as complete or approve its own output. All phase transitions require explicit human approval via the Phase Gate Approval section. The human operator is the sole authority on artifact acceptance.

Agents must always ask: *"Does this meet your expectations?"* before considering their work complete. Self-approval is a roadmapal violation.

---

## Additional Constraints

- **Stay in Lane:** Each agent operates strictly within its defined phase. The Challenger never suggests solutions. The Analyst never writes code. The Developer never changes architecture. Violations must be flagged, not silently accommodated.
- **Living Insights:** Every agent must maintain its phase's insights file. Reasoning, trade-offs, and discarded alternatives must be captured as they occur, not reconstructed after the fact.
- **Ambiguity Handling:** When an agent encounters ambiguous, vague, or underspecified input, it must seek clarification from the human rather than making assumptions. Vague adjectives ("fast", "secure", "robust") without measurable criteria must be flagged with `[NEEDS CLARIFICATION]` markers.

---

## Development Workflow

- **Artifact Location:** All specification documents go in `specs/`. Architecture decisions go in `specs/decisions/`. The Q&A decision log lives at `specs/qa-log.md`. For **greenfield** projects, source code goes in `src/` and tests go in `tests/`. For **brownfield** projects, the Developer agent writes to the existing codebase structure discovered by the Scout.
- **Configuration Authority:** `.jumpstart/config.yaml` is the single source of truth for framework settings. Agents must read it at the start of every phase.
- **Template Authority:** `.jumpstart/templates/` contains the canonical structure for all artifacts. Agents must use these templates without modification to their structure.

---

## Engineering Articles

> These articles establish **engineering standards** that shape the quality, structure, and maintainability of the system being built. They complement the Core Principles above.

### Article I — Library-First

Every new feature **must** start as a standalone, self-contained library module before being integrated into the application layer. This means:

1. **Isolation first:** New functionality is implemented as a module with a clear public API, no side effects on import, and no coupling to the application's HTTP layer, framework, or UI.
2. **Testability:** The library module must be independently testable without bootstrapping the full application.
3. **Composition:** The application layer (routes, controllers, CLI handlers) consumes the library — never the reverse.
4. **Documentation:** Each library module must document its purpose, public API, and dependencies.

**Rationale:** Library-first design prevents "framework lock-in at the function level," makes code reusable across contexts (CLI, API, worker, test), and forces clear interface boundaries that reduce coupling.

**Enforcement:** The Architect agent must structure components as library modules in the Architecture Document. The Developer agent must implement features as library modules before wiring them into the application layer. Violations are flagged during code review.

---

### Article II — CLI-First IO

All internal tools and scripts **must** accept input via stdin/arguments and emit output via stdout in structured JSON format. This enables:

1. **Agent piping:** Tools can be chained together by agents without manual intervention.
2. **Automation:** CI/CD pipelines, pre-commit hooks, and other automation can invoke tools programmatically.
3. **Testability:** Tool output is machine-parseable and assertions can be written against it.
4. **Portability:** No dependency on specific UI frameworks or interactive prompts for core functionality.

**Rationale:** CLI-first IO contracts ensure that every tool in the framework can be composed, tested, and automated without human interaction.

---

### Article III — Executable Specs

All specification artifacts **must** include machine-readable metadata blocks (YAML frontmatter) that enable automated processing, validation, and querying. Metadata includes:

1. **Identity:** Unique ID, phase, agent, status, version.
2. **Lineage:** Upstream references, downstream dependents.
3. **Governance:** Approval status, approver, approval date, content hash.
4. **Classification:** Risk level, domain, priority.

**Rationale:** Machine-readable metadata transforms specifications from passive documents into an active, queryable knowledge base that supports automated validation, traceability, and drift detection.

---

### Article IV — Strict Power Inversion

Specifications are the **source of truth**; code is derived. If a mismatch exists between a spec and the codebase:

1. **Update the spec first** if the change is intentional and approved.
2. **Regenerate the code** to match the spec.
3. **Never silently update code** without updating the corresponding spec.

**Rationale:** Power inversion prevents "code drift" — where the implementation gradually diverges from the documented design until the specs become fiction. By treating specs as the master record, the framework ensures that the documentation always reflects reality.

**Enforcement:** A spec-drift check runs before build phases. The Developer agent must not make architectural changes without updating upstream specs. Deviations are logged and flagged.

---

### Article V — Schema Enforcement

All core artifacts (PRD, ADR, Architecture, Implementation Plan, etc.) **must** validate against JSON schemas before being accepted. This prevents:

1. **Vibe-coding:** Loosely structured documents that lack required sections.
2. **Template drift:** Agents generating non-standard document formats.
3. **Phase gate bypass:** Incomplete artifacts passing through approval gates.

**Rationale:** Schema enforcement ensures structural consistency across all artifacts, enables automated validation, and prevents agents from skipping required sections.

---

### Article VI — Simplicity Gate

Implementation plans that exceed **3 top-level project directories** (excluding standard config directories like `node_modules/`, `.git/`, `.jumpstart/`, `specs/`) without explicit written justification are automatically flagged for review. Plans must justify additional structural complexity.

**Rationale:** Complexity is a cost. Simple directory structures are easier to navigate, understand, and maintain. Forcing justification for additional structure prevents premature decomposition and over-engineering.

---

### Article VII — Anti-Abstraction

Wrapper code that obscures native framework capabilities **must** be justified with an ADR. Specifically:

1. **No thin wrappers:** Do not wrap framework APIs in custom abstractions that add no value beyond renaming.
2. **No premature abstraction:** Do not create abstraction layers "for future flexibility" without a concrete current need.
3. **Framework conventions first:** Use the framework's built-in patterns, middleware, and conventions before inventing custom ones.

**Rationale:** Unnecessary abstraction layers increase cognitive load, hide framework capabilities from developers, and create maintenance burden. Every abstraction should earn its existence.

---

### Article VIII — Multi-Layer Testing

Specification artifacts **must** pass the 5-layer automated quality gate before Phase Gate approval. The layers are cumulative — each layer builds on the previous.

1. **Layer 1 — Schema & Formatting:** Every artifact must validate against its JSON Schema (frontmatter fields, required sections, ID formats). Enforced by `validator.js`.
2. **Layer 2 — Handoff Contracts:** Phase transitions must validate against handoff schemas (`pm-to-architect`, `architect-to-dev`, `dev-to-qa`). No phantom requirements allowed — every downstream reference must trace to an upstream source.
3. **Layer 3 — Unit Tests for English:** Prose quality checks on ambiguity (vague adjectives without metrics), passive voice (unclear ownership), metric coverage (≥80% of stories with quantified criteria), terminology drift, and spec smells (hedge words, dangling references, unbounded lists). Enforced by `spec-tester.js` and `smell-detector.js`.
4. **Layer 4 — LLM-as-a-Judge (Opt-in):** The Adversary agent stress-tests artifacts for violations. The Reviewer agent scores across completeness, consistency, traceability, and quality. Enabled via `testing.adversarial_required` in config.
5. **Layer 5 — Regression Golden Masters:** Framework changes must not degrade artifact quality. Structural diff against verified golden master artifacts must achieve ≥85% similarity.

**Thresholds (configurable in `config.yaml`):**
- Ambiguity: < 5 vague adjectives without metrics per document
- Passive voice: < 10 instances per document
- Metric coverage: ≥ 80%
- Smell density: < 5.0 per 100 prose lines
- Spec quality score: ≥ 70/100
- Story-to-task coverage: 100%

**Rationale:** Specification defects propagate exponentially downstream. A vague requirement in Phase 2 becomes an ambiguous component in Phase 3 and a bug in Phase 4. Automated quality gates catch defects at the source.

---

### Article IX — Specialized Agent Intelligence

The framework provides **specialized advisory agents** that extend the core phase workflow with domain-specific expertise. These agents do not gate phases — they provide structured analysis that informs human decisions.

**Principles:**
1. **Advisory, not authoritative.** Specialized agents produce reports and recommendations. The human decides whether to act on them. Only the core phase agents (Challenger → Analyst → PM → Architect → Developer) gate the workflow.
2. **Invocable at any time.** Unlike phase agents, specialized agents can be invoked whenever their expertise is needed, not just at a specific phase boundary.
3. **Stay in lane.** Each specialized agent has a clearly scoped mandate. The Security Architect does not write code. The Refactoring Agent does not change behaviour. The QA Agent does not approve releases.
4. **Structured output.** Every specialized agent produces artifacts using templates from `.jumpstart/templates/`. Ad hoc advice without structured documentation is not acceptable.
5. **Evidence over opinion.** Specialized agents must ground their findings in verifiable evidence — OWASP standards, measured complexity metrics, verified documentation, test results — not subjective assessments.

**Available Specialized Agents:**
- **UI/UX Designer** (`/jumpstart.ux-design`): Emotional response mapping, information architecture, accessibility review
- **QA Agent** (`/jumpstart.qa`): Test strategy, requirement traceability, release readiness assessment
- **Scrum Master** (`/jumpstart.sprint`): Sprint planning, dependency mapping, blocker detection
- **Security Architect** (`/jumpstart.security`): STRIDE threat modelling, OWASP Top 10 audit, invariant compliance
- **Performance Analyst** (`/jumpstart.performance`): NFR quantification, load profiles, bottleneck analysis
- **Technical Writer** (`/jumpstart.docs`): Documentation freshness audit, README maintenance, AGENTS.md files
- **Domain Researcher** (`/jumpstart.research`): Context7-verified technology evaluation, version pinning
- **Requirements Extractor** (subagent only): Cross-references Scout + Challenger data against the exhaustive PRD requirements checklist to curate prioritised question batches for the Analyst's user elicitation. Also invocable by the PM (targeted functional/governance questions) and Architect (targeted NFR/integration/architecture questions)
- **Refactoring Agent** (`/jumpstart.refactor`): Complexity analysis, code smell detection, structural improvement
- **Maintenance Agent** (`/jumpstart.maintenance`): Dependency drift, spec drift, technical debt inventory
- **Quick Developer** (`/jumpstart.quick`): Abbreviated 3-step workflow for bug fixes and tiny features
- **Retrospective Agent** (`/jumpstart.retro`): Post-build implementation learnings, plan vs reality analysis

**Rationale:** Complex projects require more than the five core phases can provide. Rather than overloading phase agents with orthogonal concerns (security, performance, UX), specialized agents provide focused analysis that can be invoked precisely when needed.

---

## Article X: Workflow Orchestration

All agents must support the framework's workflow orchestration capabilities:

1. **Adaptive Planning Depth:** The framework adapts elicitation depth (quick/standard/deep) based on project complexity scoring. Agents must respect the configured depth and adjust their thoroughness accordingly.
2. **Human-in-the-Loop Checkpoints:** At high-impact decision points, agents must pause and present a structured checkpoint (`.jumpstart/templates/wait-checkpoint.md`) for human review before proceeding. Agents must never auto-continue past a checkpoint.
3. **State Persistence:** Workflow state is persisted to `.jumpstart/state/state.json`. Agents must update state after completing protocol steps, enabling resume-from-checkpoint after interruptions.
4. **Auto-Handoff:** After artifact approval, the framework automatically initialises the next phase's context. Agents must verify approval markers before transitioning.
5. **Conflict Detection:** When multiple agents may operate concurrently (e.g., Pit Crew), agents must acquire file locks before writing to shared artifacts and release them when done.
6. **Quick Flow:** Minor changes (≤5 files, ≤200 LOC) may use the abbreviated Quick Flow path (`/jumpstart.quick`) instead of the full 5-phase workflow, subject to scope guard validation.
7. **Rollback Safety:** Before overwriting any approved artifact, the framework archives the current version to `.jumpstart/archive/` with timestamp and metadata.

---

## Article XI: Project Memory

The framework maintains institutional memory that persists across sessions and phases:

1. **Living Insights:** Every agent must record significant decisions, discoveries, and trade-offs using the standardised insight entry format (`.jumpstart/templates/insight-entry.md`). Every entry must have an ISO 8601 UTC timestamp.
2. **Bidirectional Cross-References:** Spec artifacts must maintain bidirectional links. If document A references document B, document B must reference document A. Validate with `bin/lib/crossref.js`.
3. **Reasoning Traces:** Phase 0 discovery sessions should preserve raw reasoning traces (`.jumpstart/templates/reasoning.md`), explicitly labelled as non-normative.
4. **Self-Correction Log:** When a human rejects an agent's proposal, the agent must record the rejection in `.jumpstart/correction-log.md` with the constraint learned. Agents must check this log before generating proposals in affected areas.
5. **Terminology Consistency:** All agents must use terms as defined in `.jumpstart/glossary.md`. Inconsistent terminology is a specification smell.
6. **Traceability:** Every requirement must trace forward to at least one test. Every test must trace back to at least one requirement. Validate with `bin/lib/traceability.js`.
7. **Version Pinning:** Technology versions mentioned in specs must be exact and verified via Context7 or official documentation. No hallucinated versions.

---

### Article XII — Spec Authoring Quality

Specification artifacts must meet authoring quality standards that ensure agents can reliably consume and implement them. This article codifies the practices from `.jumpstart/guides/spec-writing.md`.

1. **Six Core Areas:** Every `specs/architecture.md` must address six core areas: **Commands** (build, test, lint, deploy with full flags), **Testing** (framework, file locations, coverage expectations), **Project Structure** (directory layout with purpose annotations), **Code Style** (naming conventions, formatting rules, at least one code example per pattern), **Git Workflow** (branch naming, commit message format, PR requirements), and **Boundaries** (three-tier: Always do / Ask first / Never do). The Architect agent must include a Six Core Areas Coverage checklist in the architecture document. Incomplete coverage must be flagged before Phase Gate approval.

2. **Extended TOC for Large Specs:** When `spec_authoring.extended_toc` is `true` in config and a spec artifact exceeds the configured line threshold (default: 500 lines), the generating agent must include an Extended Table of Contents immediately after the YAML frontmatter. The Extended TOC provides per-section line ranges and 1–2 sentence summaries, enabling downstream agents and humans to quickly locate relevant content without reading the full document.

3. **Self-Verification:** Every agent must perform a self-verification pass against the spec's requirements before presenting an artifact for human approval. The agent enumerates all requirements the artifact must satisfy (from upstream artifacts, phase gate checklists, and config settings), marks each as Satisfied / Partial / Missing, and reports the results when presenting. Gaps must be explicitly disclosed — not silently ignored.

4. **Context Scoping:** When consuming specs for implementation, agents must ingest only the sections relevant to the current task rather than loading the entire spec tree. The Extended TOC and `TODO.md` Progress Summary serve as indices for locating needed context. This prevents context window exhaustion and the "curse of instructions" where excessive context degrades agent performance.

5. **Boundary Placement:** Three-tier boundaries (Always do / Ask first / Never do) must appear in every architecture and implementation plan document. These boundaries must be placed **early** in the document — before implementation details — so agents encounter constraints before they begin generating code.

6. **Decomposition Threshold:** When a single spec artifact exceeds the configured line limit (default: 800 lines, governed by `spec_authoring.max_spec_lines`), agents should consider decomposing it into linked sub-specs (e.g., separate API contract spec, data model spec). Each sub-spec must be cross-referenced from the parent document.

**Enforcement:** Governed by `spec_authoring.*` in `.jumpstart/config.yaml`. The six core areas check and self-verification are validated by the spec-checklist. Extended TOC generation is triggered automatically by the generating agent when the threshold is exceeded.

**Rationale:** Agent performance degrades when specs are vague, excessively long, or missing key areas. By enforcing completeness (six core areas), manageability (Extended TOC, decomposition), quality (self-verification), and efficiency (context scoping), this article ensures specs remain effective guidance documents regardless of project size.

---

## Governance

This Roadmap supersedes all other agent protocols and practices. In the event of a conflict between a Roadmap principle and an agent-specific instruction, the Roadmap prevails.

**Amendments require:**
1. A written proposal with rationale for the change
2. Explicit human approval
3. A migration plan for any affected artifacts or in-progress work

Roadmap violations must always be reported to the human, never silently ignored or worked around. An agent that detects a potential violation in its own planned actions must halt and report before proceeding.

---

**Version**: 1.5.0 | **Ratified**: 2026-02-08 | **Last Amended**: 2026-02-08
