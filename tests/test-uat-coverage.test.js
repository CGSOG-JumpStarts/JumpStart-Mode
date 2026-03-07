/**
 * test-uat-coverage.test.js — Tests for bin/lib/uat-coverage.js
 *
 * Covers:
 * - Acceptance criteria extraction (Gherkin and bullet formats)
 * - Test file scanning for story references
 * - Criteria-to-test matching
 * - Coverage computation and reporting
 * - Keyword extraction
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let extractAcceptanceCriteria, scanTestCoverage, matchCriteriaToTests,
    extractKeywords, computeUATCoverage, generateUATReport, walkTestFiles;

beforeEach(() => {
  // CJS module, use require
  const mod = require('../bin/lib/uat-coverage.js');
  extractAcceptanceCriteria = mod.extractAcceptanceCriteria;
  scanTestCoverage = mod.scanTestCoverage;
  matchCriteriaToTests = mod.matchCriteriaToTests;
  extractKeywords = mod.extractKeywords;
  computeUATCoverage = mod.computeUATCoverage;
  generateUATReport = mod.generateUATReport;
  walkTestFiles = mod.walkTestFiles;
});

function createTempDir(suffix = '') {
  const dir = join(tmpdir(), `jumpstart-uat-${Date.now()}${suffix}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── extractAcceptanceCriteria ───────────────────────────────────────────────

describe('extractAcceptanceCriteria', () => {
  it('extracts story IDs from PRD content', () => {
    const prd = `## Stories\n\n### E01-S01 User Login\n\nSome content\n\n### E01-S02 User Registration\n\nMore content`;
    const result = extractAcceptanceCriteria(prd);
    expect(result).toHaveLength(2);
    expect(result[0].story_id).toBe('E01-S01');
    expect(result[1].story_id).toBe('E01-S02');
  });

  it('extracts Gherkin-style acceptance criteria', () => {
    const prd = `### E01-S01 Login

Acceptance criteria:
Given a registered user
When they enter valid credentials
Then they should be logged in
And see the dashboard`;

    const result = extractAcceptanceCriteria(prd);
    expect(result[0].gherkin).toHaveLength(4);
    expect(result[0].gherkin[0]).toContain('Given');
    expect(result[0].gherkin[1]).toContain('When');
    expect(result[0].gherkin[2]).toContain('Then');
    expect(result[0].gherkin[3]).toContain('And');
  });

  it('extracts bullet-point acceptance criteria', () => {
    const prd = `### E01-S01 Login

Acceptance Criteria:
- User can enter email and password in login form
- Invalid credentials show error message with details
- Successful login redirects to dashboard page`;

    const result = extractAcceptanceCriteria(prd);
    expect(result[0].criteria.length).toBeGreaterThan(0);
  });

  it('handles stories with no criteria', () => {
    const prd = `### E01-S01 Login\n\nJust a description.`;
    const result = extractAcceptanceCriteria(prd);
    expect(result[0].story_id).toBe('E01-S01');
    expect(result[0].criteria).toEqual([]);
    expect(result[0].gherkin).toEqual([]);
  });

  it('deduplicates story IDs', () => {
    const prd = `E01-S01 mentioned here\nE01-S01 mentioned again`;
    const result = extractAcceptanceCriteria(prd);
    expect(result).toHaveLength(1);
  });
});

// ─── extractKeywords ─────────────────────────────────────────────────────────

describe('extractKeywords', () => {
  it('extracts meaningful words over 3 characters', () => {
    const keywords = extractKeywords('User can enter email and password');
    expect(keywords).toContain('enter');
    expect(keywords).toContain('email');
    expect(keywords).toContain('password');
  });

  it('filters out stopwords', () => {
    const keywords = extractKeywords('the user should be able to login');
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('should');
    expect(keywords).toContain('able');
    expect(keywords).toContain('login');
  });

  it('converts to lowercase', () => {
    const keywords = extractKeywords('DASHBOARD Display');
    expect(keywords).toContain('dashboard');
    expect(keywords).toContain('display');
  });

  it('returns empty array for empty input', () => {
    expect(extractKeywords('')).toEqual([]);
  });
});

// ─── walkTestFiles ──────────────────────────────────────────────────────────

describe('walkTestFiles', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('-walk');
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('finds test files by common patterns', () => {
    mkdirSync(join(tmpDir, 'sub'), { recursive: true });
    writeFileSync(join(tmpDir, 'login.test.js'), '', 'utf8');
    writeFileSync(join(tmpDir, 'auth.spec.js'), '', 'utf8');
    writeFileSync(join(tmpDir, 'sub', 'deep.test.js'), '', 'utf8');
    writeFileSync(join(tmpDir, 'not-a-test.js'), '', 'utf8');

    const files = walkTestFiles(tmpDir);
    expect(files.length).toBe(3);
  });

  it('skips node_modules', () => {
    mkdirSync(join(tmpDir, 'node_modules', 'foo'), { recursive: true });
    writeFileSync(join(tmpDir, 'node_modules', 'foo', 'index.test.js'), '', 'utf8');

    const files = walkTestFiles(tmpDir);
    expect(files).toHaveLength(0);
  });

  it('returns empty for non-existent directory', () => {
    const files = walkTestFiles(join(tmpDir, 'nonexistent'));
    expect(files).toEqual([]);
  });
});

// ─── scanTestCoverage ────────────────────────────────────────────────────────

describe('scanTestCoverage', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('-scan');
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('finds test files that reference story IDs', () => {
    writeFileSync(join(tmpDir, 'login.test.js'),
      `describe('E01-S01 Login', () => { it('works', () => {}); });`, 'utf8');

    const coverage = scanTestCoverage(tmpDir, ['E01-S01', 'E01-S02']);
    expect(coverage.get('E01-S01').files).toHaveLength(1);
    expect(coverage.get('E01-S02').files).toHaveLength(0);
  });

  it('handles missing test directory', () => {
    const coverage = scanTestCoverage(join(tmpDir, 'nonexistent'), ['E01-S01']);
    expect(coverage.get('E01-S01').files).toHaveLength(0);
  });
});

// ─── matchCriteriaToTests ───────────────────────────────────────────────────

describe('matchCriteriaToTests', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('-match');
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('marks criteria as covered when test references story ID', () => {
    writeFileSync(join(tmpDir, 'login.test.js'),
      `describe('E01-S01', () => { it('checks login credentials', () => {}); });`, 'utf8');

    const criteria = [{
      story_id: 'E01-S01',
      criteria: ['User can enter login credentials'],
      gherkin: []
    }];

    const results = matchCriteriaToTests(criteria, tmpDir);
    expect(results[0].covered).toBe(true);
    expect(results[0].test_files.length).toBeGreaterThan(0);
  });

  it('marks criteria as uncovered when no matching tests', () => {
    writeFileSync(join(tmpDir, 'other.test.js'),
      `describe('other feature', () => {});`, 'utf8');

    const criteria = [{
      story_id: 'E01-S01',
      criteria: ['User can enter login credentials'],
      gherkin: []
    }];

    const results = matchCriteriaToTests(criteria, tmpDir);
    expect(results[0].covered).toBe(false);
  });

  it('handles missing test directory', () => {
    const criteria = [{
      story_id: 'E01-S01',
      criteria: ['Something'],
      gherkin: []
    }];

    const results = matchCriteriaToTests(criteria, join(tmpDir, 'no-tests'));
    expect(results[0].covered).toBe(false);
  });
});

// ─── computeUATCoverage ──────────────────────────────────────────────────────

describe('computeUATCoverage', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('-compute');
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('computes coverage with matching tests', () => {
    const prdPath = join(tmpDir, 'prd.md');
    const testDir = join(tmpDir, 'tests');
    mkdirSync(testDir, { recursive: true });

    writeFileSync(prdPath, `### E01-S01 Login

Acceptance Criteria:
- User can enter valid login credentials
- Dashboard displays after successful login
`, 'utf8');

    writeFileSync(join(testDir, 'login.test.js'),
      `describe('E01-S01', () => {
        it('validates login credentials', () => {});
        it('displays dashboard', () => {});
      });`, 'utf8');

    const result = computeUATCoverage(prdPath, testDir);
    expect(result.total_stories).toBe(1);
    expect(result.covered_stories).toBe(1);
    expect(result.story_coverage_pct).toBe(100);
  });

  it('reports uncovered stories', () => {
    const prdPath = join(tmpDir, 'prd.md');
    const testDir = join(tmpDir, 'tests');
    mkdirSync(testDir, { recursive: true });

    writeFileSync(prdPath, `### E01-S01 Login\n\n### E01-S02 Registration\n`, 'utf8');
    writeFileSync(join(testDir, 'login.test.js'),
      `describe('E01-S01', () => {});`, 'utf8');

    const result = computeUATCoverage(prdPath, testDir);
    expect(result.covered_stories).toBe(1);
    expect(result.total_stories).toBe(2);
    expect(result.story_coverage_pct).toBe(50);
  });

  it('throws on missing PRD file', () => {
    expect(() => computeUATCoverage(join(tmpDir, 'missing.md'), tmpDir))
      .toThrow('PRD not found');
  });

  it('returns correct structure', () => {
    const prdPath = join(tmpDir, 'prd.md');
    writeFileSync(prdPath, '### E01-S01 Feature\n', 'utf8');

    const result = computeUATCoverage(prdPath, join(tmpDir, 'tests'));
    expect(result).toHaveProperty('total_stories');
    expect(result).toHaveProperty('covered_stories');
    expect(result).toHaveProperty('story_coverage_pct');
    expect(result).toHaveProperty('total_criteria');
    expect(result).toHaveProperty('covered_criteria');
    expect(result).toHaveProperty('criteria_coverage_pct');
    expect(result).toHaveProperty('pass');
  });
});

// ─── generateUATReport ──────────────────────────────────────────────────────

describe('generateUATReport', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('-report');
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('generates a markdown report', () => {
    const prdPath = join(tmpDir, 'prd.md');
    writeFileSync(prdPath, '### E01-S01 Feature\n', 'utf8');

    const report = generateUATReport(prdPath, join(tmpDir, 'tests'));
    expect(report).toContain('# UAT Coverage Report');
    expect(report).toContain('Story Coverage');
    expect(report).toContain('E01-S01');
  });

  it('shows pass/fail status', () => {
    const prdPath = join(tmpDir, 'prd.md');
    writeFileSync(prdPath, '### E01-S01 Feature\n', 'utf8');

    const report = generateUATReport(prdPath, join(tmpDir, 'tests'));
    // With no tests, coverage should be low
    expect(report).toContain('Status');
  });
});
