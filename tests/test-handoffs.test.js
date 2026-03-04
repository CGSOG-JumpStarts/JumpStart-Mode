/**
 * test-handoffs.test.js — Layer 2: Handoff Contract Tests
 * 
 * Tests that handoff payloads extracted from spec artifacts conform
 * to their handoff schemas and that phantom requirements are detected.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { validateHandoff, checkPhantomRequirements, extractHandoffPayload, generateHandoffReport } = require('../bin/lib/handoff-validator');

const __dirname = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const HANDOFFS_DIR = path.join(__dirname, '..', '.jumpstart', 'handoffs');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

// ─── Schema Loading ──────────────────────────────────────────────────────────

describe('Handoff Schemas', () => {
  it('pm-to-architect schema exists and is valid JSON', () => {
    const schemaPath = path.join(HANDOFFS_DIR, 'pm-to-architect.schema.json');
    expect(fs.existsSync(schemaPath)).toBe(true);
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    expect(schema.type).toBe('object');
    expect(schema.required).toContain('functional_requirements');
  });

  it('architect-to-dev schema exists and is valid JSON', () => {
    const schemaPath = path.join(HANDOFFS_DIR, 'architect-to-dev.schema.json');
    expect(fs.existsSync(schemaPath)).toBe(true);
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    expect(schema.type).toBe('object');
    expect(schema.required).toContain('technology_stack');
  });

  it('dev-to-qa schema exists and is valid JSON', () => {
    const schemaPath = path.join(HANDOFFS_DIR, 'dev-to-qa.schema.json');
    expect(fs.existsSync(schemaPath)).toBe(true);
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    expect(schema.type).toBe('object');
    expect(schema.required).toContain('implemented_tasks');
  });
});

// ─── PM → Architect Validation ───────────────────────────────────────────────

describe('PM → Architect Handoff', () => {
  it('validates a valid PM-to-Architect payload', () => {
    const payload = {
      functional_requirements: [
        { id: 'E01-S01', description: 'User registration', priority: 'must-have' }
      ],
      non_functional_requirements: [
        { id: 'NFR-1', category: 'performance', description: 'Response time < 200ms', metric: '200ms' }
      ],
      user_stories: [
        { id: 'E01-S01', title: 'Register user', acceptance_criteria: ['Given valid data, user is created'] }
      ],
      constraints: {
        budget: '$10,000',
        timeline: '4 weeks'
      },
      domain_context: {
        domain: 'productivity',
        problem_statement: 'Users need a lightweight task management tool for developers'
      }
    };

    const result = validateHandoff(payload, 'pm-to-architect.schema.json', HANDOFFS_DIR);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing functional_requirements', () => {
    const payload = {
      non_functional_requirements: [],
      user_stories: [],
      constraints: {},
      domain_context: { domain: 'test', problem_statement: 'A test problem statement' }
    };

    const result = validateHandoff(payload, 'pm-to-architect.schema.json', HANDOFFS_DIR);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('functional_requirements'))).toBe(true);
  });

  it('rejects empty user_stories array (minItems)', () => {
    const payload = {
      functional_requirements: [
        { id: 'E01-S01', description: 'User registration via email and password', priority: 'must-have' }
      ],
      non_functional_requirements: [],
      user_stories: [],
      constraints: {},
      domain_context: { domain: 'test', problem_statement: 'A test problem statement that is long enough' }
    };

    const result = validateHandoff(payload, 'pm-to-architect.schema.json', HANDOFFS_DIR);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('user_stories') && e.includes('minItems'))).toBe(true);
  });
});

// ─── Architect → Dev Validation ──────────────────────────────────────────────

describe('Architect → Developer Handoff', () => {
  it('validates a valid Architect-to-Dev payload', () => {
    const payload = {
      project_type: 'greenfield',
      technology_stack: {
        runtime: { name: 'Node.js', version: '20.x' },
        framework: { name: 'Express', version: '4.18' }
      },
      components: [
        { name: 'API Server', purpose: 'HTTP endpoint handling', interface: 'REST API' }
      ],
      data_model: {
        entities: [{ name: 'User', fields: [{ name: 'id', type: 'string' }] }]
      },
      task_list: [
        { id: 'M1-T01', title: 'Scaffold project', milestone: 'M1' }
      ],
      deployment_strategy: {
        environment: 'production'
      }
    };

    const result = validateHandoff(payload, 'architect-to-dev.schema.json', HANDOFFS_DIR);
    expect(result.valid).toBe(true);
  });

  it('rejects missing components', () => {
    const payload = {
      technology_stack: {
        runtime: { name: 'Node.js', version: '20.x' },
        framework: { name: 'Express', version: '4.18' }
      },
      data_model: { entities: [] },
      task_list: [{ id: 'M1-T01', title: 'Scaffold', milestone: 'M1' }],
      deployment_strategy: { environment: 'staging' }
    };

    const result = validateHandoff(payload, 'architect-to-dev.schema.json', HANDOFFS_DIR);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('components'))).toBe(true);
  });
});

// ─── Dev → QA Validation ─────────────────────────────────────────────────────

describe('Developer → QA Handoff', () => {
  it('validates a valid Dev-to-QA payload', () => {
    const payload = {
      implemented_tasks: [
        { id: 'M1-T01', status: 'completed', files_changed: ['src/index.js', 'src/routes.js'] }
      ],
      test_coverage: { unit_tests: 15, coverage_pct: 85 },
      build_artifacts: { build_command: 'npm run build', output_dir: 'dist' },
      environment_setup: {
        prerequisites: ['Node.js >= 20'],
        setup_steps: ['npm install', 'npm run build']
      }
    };

    const result = validateHandoff(payload, 'dev-to-qa.schema.json', HANDOFFS_DIR);
    expect(result.valid).toBe(true);
  });

  it('rejects invalid task status', () => {
    const payload = {
      implemented_tasks: [
        { id: 'M1-T01', status: 'in-progress', files_changed: ['src/index.js'] }
      ],
      test_coverage: { unit_tests: 0, coverage_pct: 0 },
      build_artifacts: { build_command: 'npm run build', output_dir: 'dist' },
      environment_setup: { prerequisites: ['Node.js'], setup_steps: ['npm install'] }
    };

    const result = validateHandoff(payload, 'dev-to-qa.schema.json', HANDOFFS_DIR);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('status'))).toBe(true);
  });
});

// ─── Phantom Requirements ────────────────────────────────────────────────────

describe('Phantom Requirement Detection', () => {
  it('detects phantom story references', () => {
    const upstream = {
      user_stories: [
        { id: 'E01-S01' },
        { id: 'E01-S02' }
      ]
    };

    const downstream = `
## Architecture

This component implements E01-S01 and E01-S02.
It also references E99-S01 which was never in the PRD.
And task M5-T99 from an unknown milestone.
    `;

    const result = checkPhantomRequirements(upstream, downstream);
    expect(result.phantoms).toContain('E99-S01');
    expect(result.phantoms).toContain('M5-T99');
    expect(result.traced).toContain('E01-S01');
    expect(result.traced).toContain('E01-S02');
  });

  it('returns empty phantoms when everything traces', () => {
    const upstream = {
      user_stories: [{ id: 'E01-S01' }],
      task_list: [{ id: 'M1-T01' }]
    };

    const downstream = 'Implements E01-S01 via task M1-T01.';

    const result = checkPhantomRequirements(upstream, downstream);
    expect(result.phantoms).toHaveLength(0);
    expect(result.traced).toHaveLength(2);
  });

  it('handles empty upstream gracefully', () => {
    const upstream = {};
    const downstream = 'References E01-S01 and M1-T01.';

    const result = checkPhantomRequirements(upstream, downstream);
    expect(result.phantoms).toContain('E01-S01');
    expect(result.phantoms).toContain('M1-T01');
  });
});

// ─── Payload Extraction ──────────────────────────────────────────────────────

describe('Payload Extraction', () => {
  it('extracts stories from a valid PRD fixture', () => {
    const prdPath = path.join(FIXTURES_DIR, 'valid', 'prd.md');
    const payload = extractHandoffPayload(prdPath, 'architect');
    
    expect(payload.user_stories.length).toBeGreaterThan(0);
    expect(payload.user_stories[0].id).toMatch(/^E\d+-S\d+$/);
  });

  it('throws for missing artifact', () => {
    expect(() => extractHandoffPayload('/nonexistent/file.md', 'architect'))
      .toThrow('Artifact not found');
  });

  it('throws for unknown target phase', () => {
    const prdPath = path.join(FIXTURES_DIR, 'valid', 'prd.md');
    expect(() => extractHandoffPayload(prdPath, 'unknown'))
      .toThrow('Unknown target phase');
  });
});

// ─── Report Generation ───────────────────────────────────────────────────────

describe('Handoff Report', () => {
  it('generates a report for PRD → Architecture transition', () => {
    const prdPath = path.join(FIXTURES_DIR, 'valid', 'prd.md');
    const report = generateHandoffReport(prdPath, 'pm', 'architect', HANDOFFS_DIR);
    expect(report).toHaveProperty('transition');
    expect(report).toHaveProperty('schema');
    expect(report).toHaveProperty('payload_keys');
  });

  it('returns error for missing artifact', () => {
    const report = generateHandoffReport('/nonexistent.md', 'pm', 'architect', HANDOFFS_DIR);
    expect(report.valid).toBe(false);
    expect(report.errors[0]).toContain('Payload extraction failed');
  });
});
