/**
 * Tests for bin/lib/integrate.js — Dynamic Skill Integration Engine.
 *
 * Covers:
 *   - SKILL.md frontmatter parsing (```skill fence and --- fence)
 *   - Skill scanning with cross-referencing installed.json
 *   - IDE instructions generation (applyTo: '**')
 *   - Framework skill index generation
 *   - Integration log read/write
 *   - Full apply/clean lifecycle
 *   - Edge cases: no skills, missing SKILL.md, empty directory
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');
const os = require('os');

// Dynamic import (ESM)
const {
  scanInstalledSkills,
  generateIDEInstructions,
  generateSkillIndex,
  applyIntegration,
  cleanIntegration,
  readIntegrationLog,
} = await import('../bin/lib/integrate.js');

// ─── Test Fixtures ──────────────────────────────────────────────────────────

function createTestProject(tmpDir) {
  // Create .github dir for VS Code detection
  fs.mkdirSync(path.join(tmpDir, '.github', 'instructions'), { recursive: true });
  // Create skills dir
  fs.mkdirSync(path.join(tmpDir, '.jumpstart', 'skills'), { recursive: true });
}

function writeSkillMd(tmpDir, skillName, content) {
  const dir = path.join(tmpDir, '.jumpstart', 'skills', skillName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), content, 'utf8');
}

function writeInstalled(tmpDir, items) {
  const fp = path.join(tmpDir, '.jumpstart', 'installed.json');
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify({ items }, null, 2), 'utf8');
}

const SAMPLE_SKILL_FENCED = `\`\`\`skill
---
name: mermaid-design
description: "Create Mermaid diagrams from natural language descriptions"
---
\`\`\`

## Discovery Keywords

mermaid, diagram, flowchart, sequence, architecture, visualization

## Triggers

- Use when the user asks to create or update Mermaid diagrams
- Use when the user wants flowcharts, sequence diagrams, or entity relationships
- Use when architecture or system design visualization is needed
`;

const SAMPLE_SKILL_DASHES = `---
name: ignition
description: "Kickstart any new project with scaffolding and best practices"
---

## Discovery Keywords

scaffolding, project setup, bootstrap, quickstart

## Triggers

- Use when user wants to start a new project from scratch
- Use when user needs boilerplate or starter templates
`;

// ─── Test Suite ─────────────────────────────────────────────────────────────

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'integrate-test-'));
  createTestProject(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('scanInstalledSkills', () => {
  it('returns empty array when no skills directory exists', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-'));
    const result = scanInstalledSkills(emptyDir);
    expect(result).toEqual([]);
    fs.rmSync(emptyDir, { recursive: true, force: true });
  });

  it('returns empty array when skills dir is empty', () => {
    const result = scanInstalledSkills(tmpDir);
    expect(result).toEqual([]);
  });

  it('scans a single skill with ```skill fenced frontmatter', () => {
    writeSkillMd(tmpDir, 'mermaid-design', SAMPLE_SKILL_FENCED);
    const result = scanInstalledSkills(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('skill.mermaid-design');
    expect(result[0].name).toBe('mermaid-design');
    expect(result[0].description).toContain('Mermaid diagrams');
    expect(result[0].discoveryKeywords).toContain('mermaid');
    expect(result[0].discoveryKeywords).toContain('flowchart');
    expect(result[0].triggers.length).toBeGreaterThan(0);
  });

  it('scans a skill with --- fenced frontmatter', () => {
    writeSkillMd(tmpDir, 'ignition', SAMPLE_SKILL_DASHES);
    const result = scanInstalledSkills(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('ignition');
    expect(result[0].discoveryKeywords).toContain('scaffolding');
  });

  it('cross-references with installed.json', () => {
    writeSkillMd(tmpDir, 'mermaid-design', SAMPLE_SKILL_FENCED);
    writeInstalled(tmpDir, {
      'skill.mermaid-design': {
        version: '1.2.0',
        displayName: 'Mermaid Design',
        type: 'skill',
        installedAt: '2026-01-15T10:00:00.000Z',
        targetPaths: ['.jumpstart/skills/mermaid-design'],
        remappedFiles: ['.github/agents/content-coach.agent.md'],
      },
    });
    const result = scanInstalledSkills(tmpDir);
    expect(result[0].version).toBe('1.2.0');
    expect(result[0].displayName).toBe('Mermaid Design');
    expect(result[0].remappedFiles).toContain('.github/agents/content-coach.agent.md');
  });

  it('scans multiple skills', () => {
    writeSkillMd(tmpDir, 'mermaid-design', SAMPLE_SKILL_FENCED);
    writeSkillMd(tmpDir, 'ignition', SAMPLE_SKILL_DASHES);
    const result = scanInstalledSkills(tmpDir);
    expect(result).toHaveLength(2);
    const ids = result.map((s) => s.id);
    expect(ids).toContain('skill.mermaid-design');
    expect(ids).toContain('skill.ignition');
  });

  it('skips directories without SKILL.md', () => {
    fs.mkdirSync(path.join(tmpDir, '.jumpstart', 'skills', 'empty-dir'), { recursive: true });
    writeSkillMd(tmpDir, 'mermaid-design', SAMPLE_SKILL_FENCED);
    const result = scanInstalledSkills(tmpDir);
    expect(result).toHaveLength(1);
  });
});

describe('generateIDEInstructions', () => {
  it('returns null for empty skills array', () => {
    const result = generateIDEInstructions(tmpDir, []);
    expect(result).toBeNull();
  });

  it('generates VS Code instructions when .github exists', () => {
    const skills = [{
      id: 'skill.mermaid-design',
      displayName: 'Mermaid Design',
      description: 'Create Mermaid diagrams',
      discoveryKeywords: ['mermaid', 'diagram'],
      triggers: ['Create diagrams'],
      entryFile: '.jumpstart/skills/mermaid-design/SKILL.md',
      remappedFiles: ['.github/agents/content-coach.agent.md'],
    }];
    const result = generateIDEInstructions(tmpDir, skills);
    expect(result.filePath).toBe('.github/instructions/skills.instructions.md');
    expect(result.content).toContain('applyTo: "**"');
    expect(result.content).toContain('Mermaid Design');
    expect(result.content).toContain('SKILL.md');
    expect(result.content).toContain('Skill Loading Protocol');
  });

  it('generates generic instructions when no .github dir', () => {
    const noGithub = fs.mkdtempSync(path.join(os.tmpdir(), 'no-gh-'));
    const skills = [{
      id: 'skill.test',
      displayName: 'Test',
      description: 'Test skill',
      discoveryKeywords: ['test'],
      triggers: ['Run tests'],
      entryFile: '.jumpstart/skills/test/SKILL.md',
      remappedFiles: [],
    }];
    const result = generateIDEInstructions(noGithub, skills);
    expect(result.filePath).toBe('.jumpstart/instructions/skills.instructions.md');
    fs.rmSync(noGithub, { recursive: true, force: true });
  });
});

describe('generateSkillIndex', () => {
  it('returns null for empty skills array', () => {
    expect(generateSkillIndex([])).toBeNull();
  });

  it('generates skill index with proper structure', () => {
    const skills = [{
      id: 'skill.mermaid-design',
      displayName: 'Mermaid Design',
      description: 'Create Mermaid diagrams',
      discoveryKeywords: ['mermaid', 'diagram'],
      triggers: ['Create diagrams'],
      entryFile: '.jumpstart/skills/mermaid-design/SKILL.md',
      version: '1.2.0',
      remappedFiles: ['.github/agents/content-coach.agent.md'],
      installedAt: '2026-01-15',
    }];
    const result = generateSkillIndex(skills);
    expect(result.filePath).toBe('.jumpstart/skills/skill-index.md');
    expect(result.content).toContain('# Skill Index');
    expect(result.content).toContain('Mermaid Design');
    expect(result.content).toContain('1.2.0');
    expect(result.content).toContain('content-coach.agent.md');
    expect(result.content).toContain('Skill Discovery Protocol');
  });
});

describe('applyIntegration', () => {
  it('cleans up when no skills installed', () => {
    // Write a stale integration file
    const staleFile = path.join(tmpDir, '.github', 'instructions', 'skills.instructions.md');
    fs.writeFileSync(staleFile, 'old content', 'utf8');
    const stalePath = '.github/instructions/skills.instructions.md';
    const logPath = path.join(tmpDir, '.jumpstart', 'integration-log.json');
    fs.writeFileSync(logPath, JSON.stringify({
      generatedAt: '2026-01-01',
      files: { [stalePath]: { type: 'generated', hash: 'old' } },
      skillContributions: {},
    }), 'utf8');

    const result = applyIntegration(tmpDir);
    expect(result.skillCount).toBe(0);
    expect(result.filesRemoved).toContain(stalePath);
    expect(fs.existsSync(staleFile)).toBe(false);
  });

  it('generates both files for a single installed skill', () => {
    writeSkillMd(tmpDir, 'mermaid-design', SAMPLE_SKILL_FENCED);
    const result = applyIntegration(tmpDir);

    expect(result.skillCount).toBe(1);
    expect(result.filesWritten).toContain('.github/instructions/skills.instructions.md');
    expect(result.filesWritten).toContain('.jumpstart/skills/skill-index.md');

    // Verify files exist
    expect(fs.existsSync(path.join(tmpDir, '.github', 'instructions', 'skills.instructions.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.jumpstart', 'skills', 'skill-index.md'))).toBe(true);
  });

  it('writes integration log with hashes', () => {
    writeSkillMd(tmpDir, 'mermaid-design', SAMPLE_SKILL_FENCED);
    applyIntegration(tmpDir);

    const log = readIntegrationLog(tmpDir);
    expect(log.generatedAt).toBeTruthy();
    expect(Object.keys(log.files)).toHaveLength(2);

    for (const meta of Object.values(log.files)) {
      expect(meta.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(meta.sourceSkills).toContain('skill.mermaid-design');
    }
    expect(log.skillContributions['skill.mermaid-design']).toBeTruthy();
  });

  it('regenerates cleanly when skills change', () => {
    // Install skill A
    writeSkillMd(tmpDir, 'mermaid-design', SAMPLE_SKILL_FENCED);
    applyIntegration(tmpDir);

    // Add skill B
    writeSkillMd(tmpDir, 'ignition', SAMPLE_SKILL_DASHES);
    const result = applyIntegration(tmpDir);
    expect(result.skillCount).toBe(2);

    // Verify content includes both
    const idx = fs.readFileSync(
      path.join(tmpDir, '.jumpstart', 'skills', 'skill-index.md'),
      'utf8'
    );
    expect(idx).toContain('mermaid-design');
    expect(idx).toContain('ignition');
  });

  it('reports progress via onProgress callback', () => {
    writeSkillMd(tmpDir, 'mermaid-design', SAMPLE_SKILL_FENCED);
    const messages = [];
    applyIntegration(tmpDir, { onProgress: (m) => messages.push(m) });
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.some((m) => m.includes('skills.instructions.md') || m.includes('skill-index.md'))).toBe(true);
  });
});

describe('cleanIntegration', () => {
  it('removes all generated files', () => {
    writeSkillMd(tmpDir, 'mermaid-design', SAMPLE_SKILL_FENCED);
    applyIntegration(tmpDir);

    // Verify files exist before clean
    expect(fs.existsSync(path.join(tmpDir, '.github', 'instructions', 'skills.instructions.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.jumpstart', 'skills', 'skill-index.md'))).toBe(true);

    const result = cleanIntegration(tmpDir);
    expect(result.filesRemoved).toHaveLength(2);

    // Verify files removed
    expect(fs.existsSync(path.join(tmpDir, '.github', 'instructions', 'skills.instructions.md'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.jumpstart', 'skills', 'skill-index.md'))).toBe(false);
  });

  it('resets integration log', () => {
    writeSkillMd(tmpDir, 'mermaid-design', SAMPLE_SKILL_FENCED);
    applyIntegration(tmpDir);
    cleanIntegration(tmpDir);

    const log = readIntegrationLog(tmpDir);
    expect(Object.keys(log.files)).toHaveLength(0);
    expect(Object.keys(log.skillContributions)).toHaveLength(0);
  });

  it('is idempotent on empty project', () => {
    const result = cleanIntegration(tmpDir);
    expect(result.filesRemoved).toHaveLength(0);
  });
});

describe('readIntegrationLog', () => {
  it('returns default structure when file missing', () => {
    const log = readIntegrationLog(tmpDir);
    expect(log.generatedAt).toBeNull();
    expect(log.files).toEqual({});
    expect(log.skillContributions).toEqual({});
  });

  it('returns default structure for corrupted JSON', () => {
    const fp = path.join(tmpDir, '.jumpstart', 'integration-log.json');
    fs.writeFileSync(fp, 'not json', 'utf8');
    const log = readIntegrationLog(tmpDir);
    expect(log.files).toEqual({});
  });
});

describe('full lifecycle', () => {
  it('install → integrate → uninstall → integrate cleans up', () => {
    // 1. Install a skill
    writeSkillMd(tmpDir, 'mermaid-design', SAMPLE_SKILL_FENCED);
    writeInstalled(tmpDir, {
      'skill.mermaid-design': {
        version: '1.0.0',
        displayName: 'Mermaid Design',
        type: 'skill',
        installedAt: new Date().toISOString(),
        targetPaths: ['.jumpstart/skills/mermaid-design'],
        remappedFiles: [],
      },
    });

    // 2. Apply integration
    const r1 = applyIntegration(tmpDir);
    expect(r1.skillCount).toBe(1);
    expect(r1.filesWritten).toHaveLength(2);

    // 3. Simulate uninstall (remove skill dir + installed entry)
    fs.rmSync(path.join(tmpDir, '.jumpstart', 'skills', 'mermaid-design'), { recursive: true });
    writeInstalled(tmpDir, {});

    // 4. Re-integrate
    const r2 = applyIntegration(tmpDir);
    expect(r2.skillCount).toBe(0);
    expect(r2.filesRemoved.length).toBeGreaterThan(0);

    // Verify all integration files cleaned
    expect(fs.existsSync(path.join(tmpDir, '.github', 'instructions', 'skills.instructions.md'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.jumpstart', 'skills', 'skill-index.md'))).toBe(false);
  });
});
