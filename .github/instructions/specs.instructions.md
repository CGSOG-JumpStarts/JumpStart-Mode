---
applyTo: "specs/**/*.md"
---

# Jump Start Spec Artifact Guidelines

When editing or generating files in the `specs/` directory:

1. Always use the corresponding template from `.jumpstart/templates/` as the starting structure.
2. Never leave bracket placeholders like `[DATE]` or `[description]` in the final version. Replace them with real content.
3. Every artifact must have a populated Phase Gate Approval section at the bottom.
4. Maintain traceability: every Must Have item should reference upstream artifacts (e.g., a PRD story references a Product Brief capability, which references a Challenger Brief validation criterion).
5. Use Markdown tables for structured data. Keep tables readable.
6. Do not introduce content that belongs in a different phase's artifact.
7. For brownfield projects, `specs/codebase-context.md` uses the template from `.jumpstart/templates/codebase-context.md`. C4 diagrams use Mermaid syntax.
8. For greenfield projects, per-directory `AGENTS.md` files use the template from `.jumpstart/templates/agents-md.md`.
9. Every `specs/architecture.md` must cover the six core areas: Commands (build/test/lint/deploy with full flags), Testing (framework, location, coverage expectations), Project Structure (directory layout with purpose annotations), Code Style (naming conventions, formatting rules, code examples), Git Workflow (branching, commit format, PR requirements), and Boundaries (three-tier: Always do / Ask first / Never do). Missing areas should be flagged during review.
10. For specs exceeding 500 lines, include an Extended Table of Contents section with per-section summaries (max 2 sentences each) immediately after the YAML frontmatter. This helps agents and humans quickly locate relevant sections. See `.jumpstart/guides/spec-writing.md` §3 for the format.
11. Agents consuming specs must self-verify their output against the spec's acceptance criteria before presenting for approval. Any unaddressed spec items must be explicitly listed. See `.jumpstart/guides/spec-writing.md` §4 for the self-verification protocol.
12. Spec boundaries must use the three-tier system (Always do / Ask first / Never do). Place boundary sections early in architecture and implementation plan documents so agents encounter constraints before implementation details.
13. When a single spec artifact exceeds 800 lines, consider decomposing it into sub-specs (e.g., separate API contract spec, data model spec) and linking them from the parent document with clear cross-references.
