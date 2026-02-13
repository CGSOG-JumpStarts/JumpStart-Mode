# Jump Start Framework — Test Suite

This directory contains the 5-layer testing strategy for the Jump Start framework, powered by [Vitest](https://vitest.dev/).

## Prerequisites

```bash
npm install
```

## Running Tests

| Command | Description |
| --- | --- |
| `npm test` | Run all tests |
| `npm run test:unit` | Schema validation + spec quality tests (Layers 1 & 3) |
| `npm run test:integration` | Handoff contract tests (Layer 2) |
| `npm run test:regression` | Golden master regression tests (Layer 5) |
| `npm run test:requirements` | Requirements Extractor feature validation |
| `npm run test:all` | Run every test suite |

You can also use the CLI:

```bash
npx jumpstart-mode test              # all tests
npx jumpstart-mode test --unit       # unit tests only
npx jumpstart-mode test --regression # regression tests only
```

## Test Suites

### Layer 1 — Schema & Formatting (`test-schema.test.js`)

Validates that spec artifacts conform to JSON Schema definitions. Covers:

- Schema loading and `$ref` resolution
- YAML frontmatter extraction (including `\r\n` line endings)
- Type, enum, pattern, minLength, minItems, minimum, maximum, and format validation
- `validateArtifact` end-to-end checks against fixture files
- Markdown structure validation (required H2 sections)
- Phase Gate approval parsing

**Fixtures:** `fixtures/valid/` (prd.md, adr.md, architecture.md) and `fixtures/invalid/` (missing epics, no frontmatter, bad status enum).

### Layer 2 — Handoff Contracts (`test-handoffs.test.js`)

Ensures structured payloads extracted from spec artifacts satisfy their handoff schemas when crossing phase boundaries:

- PM → Architect, Architect → Developer, Developer → QA schema validation
- Phantom requirement detection (downstream IDs with no upstream source)
- Payload extraction from real fixture files
- Handoff report generation

**Schemas:** `.jumpstart/handoffs/*.schema.json`

### Layer 3 — Spec Quality / Unit Tests for English (`test-spec-quality.test.js`)

Static analysis of prose quality in specification documents:

- **Ambiguity detection** — flags vague adjectives (scalable, robust, fast, etc.)
- **Passive voice detection** — catches weak verb constructions
- **Metric coverage** — checks that acceptance criteria contain quantified targets
- **Terminology drift** — cross-file consistency of key terms
- **Smell detection** — 7 smell types: vague-quantifier, undefined-acronym, missing-owner, unbounded-list, hedge-word, dangling-reference, wishful-thinking
- **Smell density scoring** — smells per 100 prose lines
- **`runAllChecks` orchestrator** — composite scoring with configurable threshold (default ≥ 70)

**Fixtures:** `adversarial-review-tests/known-violations.md` (deliberately bad PRD for adversarial testing).

### Requirements Extractor Feature Validation (`test-requirements-extractor.test.js`)

End-to-end validation of the Requirements Extractor advisory agent and its integration with the Analyst workflow:

- **Agent definition integrity** — verifies all required sections, 7-step extraction protocol, classification types, priority formula, section relevance scoring (brownfield/greenfield), and domain amplification logic
- **Template integrity** — validates `requirements-responses.md` template frontmatter, all 18 section headings, Coverage Dashboard rows, Downstream Impact Notes (PM/Architect/Developer), and Linked Data JSON-LD block
- **Analyst integration** — confirms Steps 1.5 (Requirements Discovery) and 2.5 (Requirements Deep Dive) exist in `analyst.md`, subagent invocation, fallback when unavailable, `ask_questions` tool usage, and output references
- **Config registration** — checks `requirements-extractor` block in `config.yaml` with persona_file, checklist_source, max_curated_questions, min_priority_batches, and section_relevance_override
- **Product Brief template** — verifies Requirements Coverage Summary section placement, 18-section coverage table, link to requirements-responses.md, and NEEDS CLARIFICATION markers
- **Cross-reference integrity** — ensures no stale `requirements.md` paths, config persona_file and checklist_source resolve to real files, AGENTS.md subagent table entry, and template upstream_refs are correct
- **Prose quality** — applies ambiguity detection, smell detection (wishful-thinking, missing-owner), and composite scoring (≥70 threshold) to the agent definition

### Layer 4 — LLM-as-a-Judge *(agent-driven, not automated)*

Adversarial and peer review are triggered via slash commands (`/jumpstart.adversary`, `/jumpstart.reviewer`) and produce markdown reports. No automated test suite — the agent personas live in `.jumpstart/agents/adversary.md` and `.jumpstart/agents/reviewer.md`.

### Layer 5 — Regression / Golden Masters (`test-regression.test.js`)

Structural regression testing that compares agent outputs against known-good baselines:

- Structure extraction (frontmatter, sections, story/component counts, tables, code blocks)
- Structural diff with ±20% variance tolerance on numeric metrics
- Similarity scoring (default threshold: 85%)
- Golden master loading and full suite execution
- Story coverage module (E##-S## → M##-T## traceability)

**Golden masters:** `golden-masters/input/` and `golden-masters/expected/`.

## Directory Structure

```
tests/
├── README.md
├── test-schema.test.js                    # Layer 1
├── test-handoffs.test.js                  # Layer 2
├── test-spec-quality.test.js              # Layer 3
├── test-requirements-extractor.test.js    # Requirements Extractor feature
├── test-regression.test.js                # Layer 5
├── fixtures/
│   ├── valid/                   # Conforming spec artifacts
│   └── invalid/                 # Intentionally broken artifacts
├── adversarial-review-tests/
│   └── known-violations.md      # Layer 4 adversarial fixture
└── golden-masters/
    ├── README.md
    ├── input/                   # Challenger briefs (baseline input)
    └── expected/                # Expected agent output
```

## Configuration

Test thresholds are configured in `.jumpstart/config.yaml` under the `testing:` section:

```yaml
testing:
  spec_quality:
    max_ambiguity: 3
    max_passive_voice: 5
    min_metric_coverage: 80
    max_terminology_drift: 2
    max_smell_density: 5.0
  similarity_threshold: 85
  story_coverage_required: true
```

## Adding a Golden Master

1. Place the input artifact in `golden-masters/input/<name>.md`
2. Place the expected output in `golden-masters/expected/<name>.md`
3. The regression suite auto-discovers matching pairs by filename
