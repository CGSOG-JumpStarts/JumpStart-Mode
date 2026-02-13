/**
 * test-requirements-extractor.test.js — Requirements Extractor Feature Validation
 *
 * Tests that the Requirements Extractor advisory agent, its template, the
 * Analyst integration, config registration, product-brief template update,
 * cross-reference integrity, and prose quality are all correct and consistent.
 *
 * Covers:
 * - Agent definition integrity (.jumpstart/agents/requirements-extractor.md)
 * - Template integrity (.jumpstart/templates/requirements-responses.md)
 * - Analyst agent integration (Steps 1.5 & 2.5, Output, subagent invocation)
 * - Config registration (.jumpstart/config.yaml)
 * - Product Brief template coverage summary section
 * - Cross-reference integrity (no stale paths, consistent naming)
 * - Prose quality of the agent definition (ambiguity, smells, composite score)
 */

import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  extractFrontmatter,
  validateMarkdownStructure
} = require('../bin/lib/validator');
const {
  checkAmbiguity,
  runAllChecks
} = require('../bin/lib/spec-tester');
const {
  detectSmells
} = require('../bin/lib/smell-detector');

const __dirname = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const ROOT_DIR = path.join(__dirname, '..');
const AGENTS_DIR = path.join(ROOT_DIR, '.jumpstart', 'agents');
const TEMPLATES_DIR = path.join(ROOT_DIR, '.jumpstart', 'templates');
const CONFIG_PATH = path.join(ROOT_DIR, '.jumpstart', 'config.yaml');
const CHECKLIST_PATH = path.join(ROOT_DIR, '.jumpstart', 'guides', 'requirements-checklist.md');
const AGENTS_MD_PATH = path.join(ROOT_DIR, 'AGENTS.md');

// ─── Helper: Read file safely ─────────────────────────────────────────────────

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

// ─── Agent Definition Integrity ───────────────────────────────────────────────

describe('Agent Definition Integrity — requirements-extractor.md', () => {
  const agentPath = path.join(AGENTS_DIR, 'requirements-extractor.md');

  it('agent definition file exists', () => {
    expect(fs.existsSync(agentPath)).toBe(true);
  });

  it('contains all required top-level sections', () => {
    const content = readFile(agentPath);
    const result = validateMarkdownStructure(content, [
      'Identity',
      'Your Mandate',
      'Activation',
      'Input Context',
      'Extraction Protocol',
      'Behavioral Guidelines',
      'Output',
      'What You Do NOT Do'
    ]);
    expect(result.missing).toHaveLength(0);
  });

  it('contains all 7 extraction protocol steps', () => {
    const content = readFile(agentPath);
    const steps = [
      'Step 1: Load and Index Upstream Data',
      'Step 2: Section Relevance Scoring',
      'Step 3: Question Classification',
      'Step 4: Priority Ranking',
      'Step 5: Batch Formation',
      'Step 6: Compile Extraction Report',
      'Step 7: Quality Check'
    ];
    for (const step of steps) {
      expect(content).toContain(step);
    }
  });

  it('references the correct checklist path', () => {
    const content = readFile(agentPath);
    expect(content).toContain('.jumpstart/guides/requirements-checklist.md');
    expect(content).not.toContain('requirements.md`');
  });

  it('references ask_questions tool constraints', () => {
    const content = readFile(agentPath);
    expect(content).toMatch(/[Mm]aximum\s+\**4\**?\s+questions/);
    expect(content).toMatch(/[Mm]aximum\s+\**6\**?\s+options/);
  });

  it('specifies all 4 classification types', () => {
    const content = readFile(agentPath);
    const classifications = ['ANSWERED', 'PARTIALLY_ANSWERED', 'UNANSWERED', 'NOT_APPLICABLE'];
    for (const cls of classifications) {
      expect(content).toContain(cls);
    }
  });

  it('contains the priority formula Impact × Uncertainty', () => {
    const content = readFile(agentPath);
    expect(content).toMatch(/Impact.*Uncertainty/);
  });

  it('mentions all 3 invoking agents (Analyst, PM, Architect)', () => {
    const content = readFile(agentPath);
    expect(content).toContain('The Analyst');
    expect(content).toContain('The PM');
    expect(content).toContain('The Architect');
  });

  it('includes section relevance scoring for both brownfield and greenfield', () => {
    const content = readFile(agentPath);
    expect(content).toContain('Brownfield');
    expect(content).toContain('Greenfield');
    expect(content).toContain('HIGH');
    expect(content).toContain('SKIP');
    expect(content).toContain('CONDITIONAL');
  });

  it('defines Impact scale (1-5) and Uncertainty scale (1-3)', () => {
    const content = readFile(agentPath);
    expect(content).toMatch(/\*\*5\s*[—–-]\s*Architecture-critical/);
    expect(content).toMatch(/\*\*1\s*[—–-]\s*Nice-to-know/);
    expect(content).toMatch(/\*\*3\s*[—–-]\s*No signal/);
  });

  it('specifies the checklist has 18 sections', () => {
    const content = readFile(agentPath);
    expect(content).toContain('18 section');
  });

  it('includes domain amplification logic', () => {
    const content = readFile(agentPath);
    expect(content).toContain('Domain Amplification');
    expect(content).toContain('domain-complexity.csv');
  });
});

// ─── Template Integrity ──────────────────────────────────────────────────────

describe('Template Integrity — requirements-responses.md', () => {
  const templatePath = path.join(TEMPLATES_DIR, 'requirements-responses.md');

  it('template file exists', () => {
    expect(fs.existsSync(templatePath)).toBe(true);
  });

  it('has valid frontmatter with correct metadata', () => {
    const content = readFile(templatePath);
    const fm = extractFrontmatter(content);
    expect(fm).not.toBeNull();
    expect(fm.id).toBe('requirements-responses');
    expect(fm.phase).toBe(1);
    expect(fm.agent).toBe('Analyst');
  });

  it('frontmatter upstream_refs includes all required references', () => {
    const content = readFile(templatePath);
    const fm = extractFrontmatter(content);
    expect(fm.upstream_refs).toContain('specs/challenger-brief.md');
    expect(fm.upstream_refs).toContain('specs/codebase-context.md');
    expect(fm.upstream_refs).toContain('.jumpstart/guides/requirements-checklist.md');
  });

  it('contains Executive Summary section', () => {
    const content = readFile(templatePath);
    const result = validateMarkdownStructure(content, ['Executive Summary']);
    expect(result.present).toContain('Executive Summary');
  });

  it('contains Pre-Answered Items section', () => {
    const content = readFile(templatePath);
    const result = validateMarkdownStructure(content, ['Pre-Answered Items']);
    expect(result.present).toContain('Pre-Answered Items');
  });

  it('contains User Responses section', () => {
    const content = readFile(templatePath);
    const result = validateMarkdownStructure(content, ['User Responses']);
    expect(result.present).toContain('User Responses');
  });

  it('contains Deferred and Not Applicable section', () => {
    const content = readFile(templatePath);
    const result = validateMarkdownStructure(content, ['Deferred and Not Applicable']);
    expect(result.present).toContain('Deferred and Not Applicable');
  });

  it('contains Coverage Dashboard section', () => {
    const content = readFile(templatePath);
    const result = validateMarkdownStructure(content, ['Coverage Dashboard']);
    expect(result.present).toContain('Coverage Dashboard');
  });

  it('contains Downstream Impact Notes section with PM, Architect, Developer', () => {
    const content = readFile(templatePath);
    const result = validateMarkdownStructure(content, ['Downstream Impact Notes']);
    expect(result.present).toContain('Downstream Impact Notes');
    expect(content).toContain('For PM (Phase 2)');
    expect(content).toContain('For Architect (Phase 3)');
    expect(content).toContain('For Developer (Phase 4)');
  });

  it('contains Linked Data section with json-ld block', () => {
    const content = readFile(templatePath);
    const result = validateMarkdownStructure(content, ['Linked Data']);
    expect(result.present).toContain('Linked Data');
    expect(content).toContain('json-ld');
    expect(content).toContain('js:requirements-responses');
  });

  it('has all 18 checklist section headings in Pre-Answered Items', () => {
    const content = readFile(templatePath);
    const sectionNames = [
      'Section 1',
      'Section 2',
      'Section 3',
      'Section 4',
      'Section 5',
      'Section 6',
      'Section 7',
      'Section 8',
      'Section 9',
      'Section 10',
      'Section 11',
      'Section 12',
      'Section 13',
      'Section 14',
      'Section 15',
      'Section 16',
      'Section 17',
      'Section 18'
    ];
    for (const section of sectionNames) {
      expect(content).toContain(section);
    }
  });

  it('Coverage Dashboard has all 18 rows', () => {
    const content = readFile(templatePath);
    const dashboardSections = [
      '1 — Context, Goals',
      '2 — System Inventory',
      '3 — Pain Points',
      '4 — Functional Reqs',
      '5 — NFRs',
      '6 — Data & Integration',
      '7 — Compatibility',
      '8 — Users & UX',
      '9 — Governance & Risk',
      '10 — Releases',
      '11 — Tech Architecture',
      '12 — Cost & Budget',
      '13 — Team & Staffing',
      '14 — Documentation',
      '15 — AI Components',
      '16 — Compliance',
      '17 — Observability',
      '18 — Vendors'
    ];
    for (const row of dashboardSections) {
      expect(content).toContain(row);
    }
  });
});

// ─── Analyst Agent Integration ───────────────────────────────────────────────

describe('Analyst Agent Integration', () => {
  const analystPath = path.join(AGENTS_DIR, 'analyst.md');

  it('analyst.md references requirements-checklist.md in Input Context', () => {
    const content = readFile(analystPath);
    expect(content).toContain('.jumpstart/guides/requirements-checklist.md');
  });

  it('contains Step 1.5: Requirements Discovery', () => {
    const content = readFile(analystPath);
    expect(content).toContain('Step 1.5: Requirements Discovery');
  });

  it('contains Step 2.5: Requirements Deep Dive', () => {
    const content = readFile(analystPath);
    expect(content).toContain('Step 2.5: Requirements Deep Dive');
  });

  it('Step 1.5 invokes Requirements Extractor subagent', () => {
    const content = readFile(analystPath);
    // Extract the Step 1.5 section content
    const step15Start = content.indexOf('Step 1.5: Requirements Discovery');
    const step2Start = content.indexOf('### Step 2:', step15Start);
    const step15Content = content.substring(step15Start, step2Start > -1 ? step2Start : step15Start + 2000);
    expect(step15Content).toContain('Requirements Extractor');
    expect(step15Content).toMatch(/[Ss]ubagent/);
  });

  it('references specs/requirements-responses.md in Output section', () => {
    const content = readFile(analystPath);
    const outputStart = content.indexOf('## Output');
    const outputContent = content.substring(outputStart > -1 ? outputStart : 0);
    expect(outputContent).toContain('specs/requirements-responses.md');
    expect(outputContent).toContain('requirements-responses.md');
  });

  it('Step 10 mentions compiling requirements-responses.md', () => {
    const content = readFile(analystPath);
    // Find the actual H3 heading, not the todo checklist reference
    const step10Start = content.indexOf('### Step 10:');
    const nextHeading = content.indexOf('\n## ', step10Start + 1);
    const step10Content = content.substring(step10Start > -1 ? step10Start : 0, nextHeading > -1 ? nextHeading : step10Start + 5000);
    expect(step10Content).toContain('requirements-responses.md');
  });

  it('todo tracking includes Step 1.5 and Requirements Discovery', () => {
    const content = readFile(analystPath);
    expect(content).toMatch(/Step 1\.5.*Requirements Discovery/);
  });

  it('ask_questions usage includes Step 1.5', () => {
    const content = readFile(analystPath);
    // Find the "When to use" section for ask_questions
    const whenToUseStart = content.indexOf('**When to use:**');
    const whenToUseEnd = content.indexOf('**How to invoke', whenToUseStart);
    const whenToUseContent = content.substring(whenToUseStart, whenToUseEnd > -1 ? whenToUseEnd : whenToUseStart + 1000);
    expect(whenToUseContent).toContain('Step 1.5');
    expect(whenToUseContent).toContain('Requirements');
  });

  it('Step 1.5 includes fallback when subagent is unavailable', () => {
    const content = readFile(analystPath);
    const step15Start = content.indexOf('Step 1.5: Requirements Discovery');
    const step2Start = content.indexOf('### Step 2:', step15Start);
    const step15Content = content.substring(step15Start, step2Start > -1 ? step2Start : step15Start + 3000);
    // Should contain graceful degradation language
    expect(step15Content).toMatch(/not available|not a hard gate|proceed directly/i);
  });

  it('Step 2.5 specifies minimum Tier 1 batches must be asked', () => {
    const content = readFile(analystPath);
    const step25Start = content.indexOf('Step 2.5: Requirements Deep Dive');
    const nextStep = content.indexOf('### Step 3:', step25Start);
    const step25Content = content.substring(step25Start, nextStep > -1 ? nextStep : step25Start + 3000);
    expect(step25Content).toMatch(/Tier 1/);
    expect(step25Content).toMatch(/mandatory|must/i);
  });
});

// ─── Config Registration ─────────────────────────────────────────────────────

describe('Config Registration — requirements-extractor', () => {
  it('config.yaml contains requirements-extractor agent block', () => {
    const content = readFile(CONFIG_PATH);
    expect(content).toContain('requirements-extractor:');
  });

  it('config specifies correct persona_file', () => {
    const content = readFile(CONFIG_PATH);
    expect(content).toContain('persona_file: "agents/requirements-extractor.md"');
  });

  it('config specifies checklist_source pointing to guides/', () => {
    const content = readFile(CONFIG_PATH);
    expect(content).toContain('checklist_source:');
    expect(content).toContain('.jumpstart/guides/requirements-checklist.md');
  });

  it('config specifies max_curated_questions: 60', () => {
    const content = readFile(CONFIG_PATH);
    expect(content).toMatch(/max_curated_questions:\s*60/);
  });

  it('config specifies min_priority_batches: 3', () => {
    const content = readFile(CONFIG_PATH);
    expect(content).toMatch(/min_priority_batches:\s*3/);
  });

  it('config specifies section_relevance_override: {}', () => {
    const content = readFile(CONFIG_PATH);
    expect(content).toContain('section_relevance_override:');
  });

  it('config enables capture_insights: true', () => {
    const content = readFile(CONFIG_PATH);
    // Find the requirements-extractor block and check capture_insights
    const blockStart = content.indexOf('requirements-extractor:');
    const nextBlock = content.indexOf('\n  ', blockStart + 30);
    // Search for capture_insights within a reasonable range after the block header
    const blockContent = content.substring(blockStart, blockStart + 500);
    expect(blockContent).toContain('capture_insights: true');
  });
});

// ─── Product Brief Template — Coverage Summary ──────────────────────────────

describe('Product Brief Template — Requirements Coverage Summary', () => {
  const briefPath = path.join(TEMPLATES_DIR, 'product-brief.md');

  it('product-brief.md contains Requirements Coverage Summary heading', () => {
    const content = readFile(briefPath);
    const result = validateMarkdownStructure(content, ['Requirements Coverage Summary']);
    expect(result.present).toContain('Requirements Coverage Summary');
  });

  it('coverage table references all 18 sections', () => {
    const content = readFile(briefPath);
    const coverageStart = content.indexOf('## Requirements Coverage Summary');
    const nextSection = content.indexOf('\n## ', coverageStart + 1);
    const coverageContent = content.substring(coverageStart, nextSection > -1 ? nextSection : coverageStart + 3000);
    const sectionNames = [
      '1 — Context',
      '2 — System Inventory',
      '3 — Pain Points',
      '4 — Functional Reqs',
      '5 — NFRs',
      '6 — Data & Integration',
      '7 — Compatibility',
      '8 — Users & UX',
      '9 — Governance & Risk',
      '10 — Releases',
      '11 — Tech Architecture',
      '12 — Cost & Budget',
      '13 — Team & Staffing',
      '14 — Documentation',
      '15 — AI Components',
      '16 — Compliance',
      '17 — Observability',
      '18 — Vendors'
    ];
    for (const name of sectionNames) {
      expect(coverageContent).toContain(name);
    }
  });

  it('links to specs/requirements-responses.md', () => {
    const content = readFile(briefPath);
    const coverageStart = content.indexOf('## Requirements Coverage Summary');
    const nextSection = content.indexOf('\n## ', coverageStart + 1);
    const coverageContent = content.substring(coverageStart, nextSection > -1 ? nextSection : coverageStart + 3000);
    expect(coverageContent).toContain('requirements-responses.md');
  });

  it('mentions NEEDS CLARIFICATION markers for high-gap sections', () => {
    const content = readFile(briefPath);
    const coverageStart = content.indexOf('## Requirements Coverage Summary');
    const nextSection = content.indexOf('\n## ', coverageStart + 1);
    const coverageContent = content.substring(coverageStart, nextSection > -1 ? nextSection : coverageStart + 3000);
    expect(coverageContent).toContain('NEEDS CLARIFICATION');
  });

  it('section appears between Deferred and Risks to the Product Concept', () => {
    const content = readFile(briefPath);
    const deferredIdx = content.indexOf('### Deferred');
    const coverageIdx = content.indexOf('## Requirements Coverage Summary');
    const risksIdx = content.indexOf('## Risks to the Product Concept');
    expect(deferredIdx).toBeLessThan(coverageIdx);
    expect(coverageIdx).toBeLessThan(risksIdx);
  });
});

// ─── Cross-Reference Integrity ───────────────────────────────────────────────

describe('Cross-Reference Integrity', () => {
  it('requirements checklist file exists at the canonical path', () => {
    expect(fs.existsSync(CHECKLIST_PATH)).toBe(true);
  });

  it('no stale references to root-level requirements.md in agent definition', () => {
    const content = readFile(path.join(AGENTS_DIR, 'requirements-extractor.md'));
    // Should not contain a bare "requirements.md" reference (only the full guide path)
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.includes('requirements.md') && !line.includes('requirements-responses.md')) {
        // Must be the full path, not a bare reference
        expect(line).toContain('.jumpstart/guides/requirements-checklist.md');
      }
    }
  });

  it('no stale references to root-level requirements.md in analyst.md', () => {
    const content = readFile(path.join(AGENTS_DIR, 'analyst.md'));
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.includes('requirements.md') && !line.includes('requirements-responses.md')) {
        expect(line).toContain('.jumpstart/guides/requirements-checklist.md');
      }
    }
  });

  it('no stale references to root-level requirements.md in config.yaml', () => {
    const content = readFile(CONFIG_PATH);
    const lines = content.split('\n');
    for (const line of lines) {
      if (
        line.includes('requirements') &&
        line.includes('.md') &&
        !line.includes('requirements-responses') &&
        !line.includes('requirements-extractor')
      ) {
        expect(line).toContain('.jumpstart/guides/requirements-checklist.md');
      }
    }
  });

  it('AGENTS.md contains Requirements Extractor in subagent table', () => {
    const content = readFile(AGENTS_MD_PATH);
    expect(content).toContain('Requirements Extractor');
    // Should be in a table row format
    expect(content).toMatch(/\|.*Requirements Extractor.*\|/);
  });

  it('requirements-extractor config persona_file matches actual file location', () => {
    const configContent = readFile(CONFIG_PATH);
    // Extract persona_file value
    const match = configContent.match(/requirements-extractor:[\s\S]*?persona_file:\s*"([^"]+)"/);
    expect(match).not.toBeNull();
    const personaFile = match[1];
    const fullPath = path.join(ROOT_DIR, '.jumpstart', personaFile);
    expect(fs.existsSync(fullPath)).toBe(true);
  });

  it('requirements-extractor config checklist_source matches actual file location', () => {
    const configContent = readFile(CONFIG_PATH);
    const match = configContent.match(/checklist_source:\s*"([^"]+)"/);
    expect(match).not.toBeNull();
    const checklistFile = match[1];
    const fullPath = path.join(ROOT_DIR, checklistFile);
    expect(fs.existsSync(fullPath)).toBe(true);
  });

  it('template frontmatter upstream_refs point to valid paths', () => {
    const content = readFile(path.join(TEMPLATES_DIR, 'requirements-responses.md'));
    const fm = extractFrontmatter(content);
    // The checklist ref should be the new canonical path
    const checklistRef = fm.upstream_refs.find(r => r.includes('requirements-checklist'));
    expect(checklistRef).toBe('.jumpstart/guides/requirements-checklist.md');
  });
});

// ─── Prose Quality — Requirements Extractor Agent ────────────────────────────

describe('Prose Quality — requirements-extractor.md', () => {
  const agentPath = path.join(AGENTS_DIR, 'requirements-extractor.md');

  it('has low ambiguity count in non-example prose', () => {
    const content = readFile(agentPath);
    // Remove code blocks and JSON examples to test only prose
    const proseOnly = content.replace(/```[\s\S]*?```/g, '').replace(/\|[^\n]+\|/g, '');
    const result = checkAmbiguity(proseOnly);
    // Agent definitions should be precise — allow a small tolerance
    // since some vague words may appear in explanatory examples
    expect(result.count).toBeLessThanOrEqual(5);
  });

  it('has no wishful-thinking smells in prose', () => {
    const content = readFile(agentPath);
    const proseOnly = content.replace(/```[\s\S]*?```/g, '');
    const result = detectSmells(proseOnly);
    const wishful = result.smells.filter(s => s.type === 'wishful-thinking');
    expect(wishful).toHaveLength(0);
  });

  it('has very few missing-owner smells in prose', () => {
    const content = readFile(agentPath);
    const proseOnly = content.replace(/```[\s\S]*?```/g, '');
    const result = detectSmells(proseOnly);
    const missingOwner = result.smells.filter(s => s.type === 'missing-owner');
    // Agent prose may legitimately reference actors in instructional context
    expect(missingOwner.length).toBeLessThanOrEqual(3);
  });

  it('composite quality score passes the ≥70 threshold', () => {
    const content = readFile(agentPath);
    const result = runAllChecks(content);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.pass).toBe(true);
  });
});
