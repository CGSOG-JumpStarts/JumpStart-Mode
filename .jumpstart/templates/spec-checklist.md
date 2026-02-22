---
schema: spec-checklist
version: 1.0.0
description: Quality checklist for specification artifacts
---

# Spec Quality Checklist

> Run with `jumpstart checklist <spec-file>`. All items must pass for Phase Gate approval.

## Structure & Formatting

- [ ] YAML frontmatter present with required fields (id, phase, agent, status)
- [ ] All required sections present (per schema definition)
- [ ] Phase Gate Approval section exists at document end
- [ ] Consistent heading hierarchy (H2 → H3 → H4, no skips)
- [ ] No orphaned headings (every heading has content beneath it)

## Traceability

- [ ] All user stories follow E##-S## ID format
- [ ] All tasks follow M##-T## ID format
- [ ] Every story has ≥1 acceptance criterion
- [ ] Every NFR has a measurable metric
- [ ] No phantom requirements (all referenced IDs exist upstream)

## Prose Quality

- [ ] Ambiguity score < 5 (vague adjectives without metrics)
- [ ] Passive voice count < 10 per document
- [ ] Metric coverage ≥ 80% (stories with quantified criteria)
- [ ] No terminology drift across spec files
- [ ] Smell density < 5.0 per 100 prose lines

## Completeness

- [ ] Domain context specified (problem statement ≥ 20 chars)
- [ ] Constraints section populated (budget/timeline/tech restrictions)
- [ ] Risk assessment included (for architecture docs)
- [ ] Deployment strategy defined (for architecture docs)
- [ ] 100% story-to-task coverage (every PRD story maps to ≥1 task)
- [ ] Six core areas covered in architecture docs (Commands, Testing, Project Structure, Code Style, Git Workflow, Boundaries)
- [ ] Self-verification pass completed by generating agent (all spec items confirmed addressed)
- [ ] Extended TOC present for specs exceeding 500 lines (or `spec_authoring.extended_toc_threshold`)

## Phase-Specific

### Phase 0: Challenger Brief
- [ ] Problem statement clearly defines root cause
- [ ] At least 3 assumptions challenged
- [ ] Reframed problem statement provided

### Phase 1: Product Brief
- [ ] At least 2 user personas defined
- [ ] User journey maps present
- [ ] MVP scope explicitly bounded

### Phase 2: PRD
- [ ] Epics with prioritized user stories
- [ ] Non-functional requirements with metrics
- [ ] Success criteria defined per milestone

### Phase 3: Architecture
- [ ] Technology stack with version numbers
- [ ] Component diagram or description
- [ ] Data model with entity definitions
- [ ] API contracts specified
- [ ] Implementation plan with task breakdown
- [ ] Six Core Areas Coverage checklist fully checked (Commands, Testing, Project Structure, Code Style, Git Workflow, Boundaries)
- [ ] Three-tier boundaries (Always do / Ask first / Never do) section populated
- [ ] Extended TOC present (if document exceeds 500 lines)
- [ ] Self-verification summary included with approval presentation

### Phase 4: Developer
- [ ] Tests written before implementation (if TDD mandate active)
- [ ] AGENTS.md files created per directory
- [ ] README.md with setup instructions
