/**
 * test-install.test.js — Tests for the marketplace installer (install.js)
 *
 * Covers: CLI arg normalization, IDE detection, target path resolution,
 * dependency resolution, install tracking, search matching, compatibility.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ── Dynamic import helper ───────────────────────────────────────────────────
let mod;
beforeEach(async () => {
  mod = await import('../bin/lib/install.js');
});

// ── Test Fixtures ───────────────────────────────────────────────────────────

const MOCK_INDEX = {
  version: '2026-02-21',
  items: [
    {
      id: 'skill.ignition',
      type: 'skill',
      displayName: 'Ignition',
      version: '1.0.0',
      category: 'presentations',
      tags: ['pptx', 'slides'],
      keywords: ['presentation', 'deck'],
      searchText: 'Use when any PPTX file needs to be created.',
      install: { targetPaths: ['.jumpstart/skills/ignition'] },
      dependencies: ['skill.agent-customization'],
      contains: {
        agents: ['.github/agents/deck-builder.agent.md'],
        prompts: ['.github/prompts/create-presentation.prompt.md'],
      },
      compatibility: { jumpstartMode: '>=0.9.0' },
      download: {
        zip: 'https://example.com/ignition-1.0.0.zip',
        checksumSha256: 'abc123',
      },
    },
    {
      id: 'skill.agent-customization',
      type: 'skill',
      displayName: 'Agent Customization',
      version: '1.0.0',
      category: 'meta',
      tags: ['agent', 'customization'],
      install: { targetPaths: ['.jumpstart/skills/agent-customization'] },
      dependencies: [],
      download: {
        zip: 'https://example.com/agent-customization-1.0.0.zip',
        checksumSha256: 'def456',
      },
    },
    {
      id: 'agent.deck-builder',
      type: 'agent',
      displayName: 'Deck Builder',
      version: '1.0.0',
      category: 'presentations',
      tags: ['orchestrator', 'pptx'],
      install: { targetPaths: ['.jumpstart/agents/deck-builder'] },
      dependencies: ['skill.ignition'],
      download: {
        zip: 'https://example.com/deck-builder-1.0.0.zip',
        checksumSha256: 'ghi789',
      },
    },
    {
      id: 'prompt.create-presentation',
      type: 'prompt',
      displayName: 'Create Presentation',
      version: '1.0.0',
      category: 'presentations',
      tags: ['pptx', 'slides'],
      install: { targetPaths: ['.jumpstart/prompts/create-presentation'] },
      dependencies: [],
      download: {
        zip: 'https://example.com/create-presentation-1.0.0.zip',
        checksumSha256: 'jkl012',
      },
    },
    {
      id: 'bundle.ignition-suite',
      type: 'bundle',
      displayName: 'Ignition Presentation Suite',
      version: '1.0.0',
      category: 'presentations',
      tags: ['pptx', 'enterprise'],
      includes: ['skill.ignition', 'agent.deck-builder', 'prompt.create-presentation'],
      install: { strategy: 'compose' },
      download: {
        zip: 'https://example.com/ignition-suite-1.0.0.zip',
        checksumSha256: 'mno345',
      },
    },
    {
      id: 'skill.circular-a',
      type: 'skill',
      displayName: 'Circular A',
      version: '1.0.0',
      category: 'test',
      tags: [],
      dependencies: ['skill.circular-b'],
      install: { targetPaths: ['.jumpstart/skills/circular-a'] },
      download: { zip: 'https://example.com/a.zip', checksumSha256: 'aaa' },
    },
    {
      id: 'skill.circular-b',
      type: 'skill',
      displayName: 'Circular B',
      version: '1.0.0',
      category: 'test',
      tags: [],
      dependencies: ['skill.circular-a'],
      install: { targetPaths: ['.jumpstart/skills/circular-b'] },
      download: { zip: 'https://example.com/b.zip', checksumSha256: 'bbb' },
    },
  ],
};

// ── normalizeItemId ─────────────────────────────────────────────────────────

describe('normalizeItemId', () => {
  it('passes through dotted IDs', () => {
    expect(mod.normalizeItemId('skill.ignition')).toBe('skill.ignition');
    expect(mod.normalizeItemId('bundle.ignition-suite')).toBe('bundle.ignition-suite');
  });

  it('joins type + name into dotted ID', () => {
    expect(mod.normalizeItemId('skill', 'ignition')).toBe('skill.ignition');
    expect(mod.normalizeItemId('agent', 'deck-builder')).toBe('agent.deck-builder');
    expect(mod.normalizeItemId('prompt', 'create-presentation')).toBe('prompt.create-presentation');
    expect(mod.normalizeItemId('bundle', 'ignition-suite')).toBe('bundle.ignition-suite');
  });

  it('returns null for bare type keyword without name', () => {
    expect(mod.normalizeItemId('skill')).toBeNull();
    expect(mod.normalizeItemId('agent')).toBeNull();
  });

  it('returns bare name for non-type single word', () => {
    expect(mod.normalizeItemId('ignition')).toBe('ignition');
  });

  it('returns null for empty input', () => {
    expect(mod.normalizeItemId(null)).toBeNull();
    expect(mod.normalizeItemId('')).toBeNull();
    expect(mod.normalizeItemId(undefined)).toBeNull();
  });

  it('is case-insensitive for type keywords', () => {
    expect(mod.normalizeItemId('Skill', 'ignition')).toBe('skill.ignition');
    expect(mod.normalizeItemId('AGENT', 'deck-builder')).toBe('agent.deck-builder');
  });
});

// ── findItem / findItemByName ───────────────────────────────────────────────

describe('findItem', () => {
  it('finds by exact ID', () => {
    expect(mod.findItem(MOCK_INDEX, 'skill.ignition').displayName).toBe('Ignition');
  });

  it('returns null for unknown ID', () => {
    expect(mod.findItem(MOCK_INDEX, 'skill.nonexistent')).toBeNull();
  });

  it('returns null for null/invalid index', () => {
    expect(mod.findItem(null, 'skill.ignition')).toBeNull();
    expect(mod.findItem({}, 'skill.ignition')).toBeNull();
  });
});

describe('findItemByName', () => {
  it('finds by bare name trying all type prefixes', () => {
    const item = mod.findItemByName(MOCK_INDEX, 'ignition');
    expect(item).not.toBeNull();
    expect(item.id).toBe('skill.ignition');
  });

  it('finds by displayName', () => {
    const item = mod.findItemByName(MOCK_INDEX, 'Deck Builder');
    expect(item).not.toBeNull();
    expect(item.id).toBe('agent.deck-builder');
  });

  it('returns null for unknown name', () => {
    expect(mod.findItemByName(MOCK_INDEX, 'nonexistent')).toBeNull();
  });
});

// ── searchItems ─────────────────────────────────────────────────────────────

describe('searchItems', () => {
  it('finds items by tag', () => {
    const results = mod.searchItems(MOCK_INDEX, 'pptx');
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.map(r => r.id)).toContain('skill.ignition');
  });

  it('finds items by category', () => {
    const results = mod.searchItems(MOCK_INDEX, 'presentations');
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it('scores exact matches higher', () => {
    const results = mod.searchItems(MOCK_INDEX, 'Ignition');
    expect(results[0].id).toBe('skill.ignition');
  });

  it('returns empty for no-match', () => {
    expect(mod.searchItems(MOCK_INDEX, 'zzzzzzzzzzz')).toEqual([]);
  });

  it('handles null/empty index gracefully', () => {
    expect(mod.searchItems(null, 'pptx')).toEqual([]);
    expect(mod.searchItems({}, 'pptx')).toEqual([]);
  });
});

// ── resolveTargetPaths ──────────────────────────────────────────────────────

describe('resolveTargetPaths', () => {
  it('uses explicit targetPaths from item', () => {
    const paths = mod.resolveTargetPaths(MOCK_INDEX.items[0]); // skill.ignition
    expect(paths).toEqual(['.jumpstart/skills/ignition']);
  });

  it('derives from type when targetPaths absent', () => {
    const item = { id: 'agent.my-agent', type: 'agent' };
    expect(mod.resolveTargetPaths(item)).toEqual(['.jumpstart/agents/my-agent']);
  });

  it('handles multi-segment names', () => {
    const item = { id: 'prompt.my.deep.name', type: 'prompt' };
    expect(mod.resolveTargetPaths(item)).toEqual(['.jumpstart/prompts/my.deep.name']);
  });
});

// ── detectIDE ───────────────────────────────────────────────────────────────

describe('detectIDE', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumpstart-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects VS Code / Copilot when .github/ exists', () => {
    fs.mkdirSync(path.join(tmpDir, '.github'));
    const result = mod.detectIDE(tmpDir);
    expect(result.ide).toBe('vscode-copilot');
    expect(result.agentDir).toBe('.github/agents');
    expect(result.promptDir).toBe('.github/prompts');
  });

  it('detects generic when .github/ absent', () => {
    const result = mod.detectIDE(tmpDir);
    expect(result.ide).toBe('generic');
    expect(result.agentDir).toBe('.jumpstart/agents');
    expect(result.promptDir).toBe('.jumpstart/prompts');
  });

  it('detects VS Code via copilot-instructions.md', () => {
    fs.mkdirSync(path.join(tmpDir, '.github'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.github', 'copilot-instructions.md'), '');
    const result = mod.detectIDE(tmpDir);
    expect(result.ide).toBe('vscode-copilot');
  });
});

// ── resolveDependencies ─────────────────────────────────────────────────────

describe('resolveDependencies', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumpstart-deps-'));
    // ensure .jumpstart dir exists
    fs.mkdirSync(path.join(tmpDir, '.jumpstart'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('produces topological order with deps first', () => {
    const { order } = mod.resolveDependencies(
      'skill.ignition', MOCK_INDEX, tmpDir
    );
    const depIdx = order.indexOf('skill.agent-customization');
    const mainIdx = order.indexOf('skill.ignition');
    expect(depIdx).toBeLessThan(mainIdx);
  });

  it('detects circular dependencies', () => {
    const { warnings } = mod.resolveDependencies(
      'skill.circular-a', MOCK_INDEX, tmpDir
    );
    expect(warnings.some(w => w.includes('Circular'))).toBe(true);
  });

  it('skips already-installed items', () => {
    // Pre-install agent-customization in the ledger
    const fp = path.join(tmpDir, '.jumpstart', 'installed.json');
    fs.writeFileSync(fp, JSON.stringify({
      items: {
        'skill.agent-customization': { version: '1.0.0', installedAt: new Date().toISOString() }
      }
    }));

    const { order, skipped } = mod.resolveDependencies(
      'skill.ignition', MOCK_INDEX, tmpDir
    );
    expect(skipped).toContain('skill.agent-customization');
    expect(order).not.toContain('skill.agent-customization');
    expect(order).toContain('skill.ignition');
  });

  it('warns on missing dependency', () => {
    const indexWithMissingDep = {
      items: [{
        id: 'skill.test',
        type: 'skill',
        version: '1.0.0',
        dependencies: ['skill.nonexistent'],
        install: { targetPaths: ['.jumpstart/skills/test'] },
        download: { zip: 'x', checksumSha256: 'y' },
      }]
    };
    const { warnings } = mod.resolveDependencies(
      'skill.test', indexWithMissingDep, tmpDir
    );
    expect(warnings.some(w => w.includes('not found'))).toBe(true);
  });
});

// ── Install Tracking (readInstalled / writeInstalled / isInstalled) ─────────

describe('install tracking', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumpstart-track-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('readInstalled returns empty for fresh project', () => {
    const data = mod.readInstalled(tmpDir);
    expect(data.items).toEqual({});
  });

  it('writeInstalled + readInstalled round-trips', () => {
    const payload = {
      items: {
        'skill.test': {
          version: '1.0.0',
          installedAt: '2026-02-21T00:00:00Z',
          targetPaths: ['.jumpstart/skills/test'],
          remappedFiles: ['.github/agents/test.agent.md'],
        }
      }
    };
    mod.writeInstalled(tmpDir, payload);
    const read = mod.readInstalled(tmpDir);
    expect(read.items['skill.test'].version).toBe('1.0.0');
    expect(read.items['skill.test'].remappedFiles).toEqual(['.github/agents/test.agent.md']);
  });

  it('isInstalled returns entry when present', () => {
    const payload = {
      items: {
        'skill.test': { version: '2.0.0', installedAt: '2026-02-21T00:00:00Z' }
      }
    };
    mod.writeInstalled(tmpDir, payload);
    const entry = mod.isInstalled('skill.test', tmpDir);
    expect(entry).not.toBeNull();
    expect(entry.version).toBe('2.0.0');
  });

  it('isInstalled returns null when absent', () => {
    expect(mod.isInstalled('skill.missing', tmpDir)).toBeNull();
  });
});

// ── checkCompatibility ──────────────────────────────────────────────────────

describe('checkCompatibility', () => {
  it('passes for compatible items', () => {
    const item = { compatibility: { jumpstartMode: '>=0.1.0' } };
    const result = mod.checkCompatibility(item);
    expect(result.compatible).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('warns for incompatible version', () => {
    const item = { compatibility: { jumpstartMode: '>=99.0.0' } };
    const result = mod.checkCompatibility(item);
    expect(result.compatible).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('passes for items with no compatibility block', () => {
    const result = mod.checkCompatibility({});
    expect(result.compatible).toBe(true);
  });
});

// ── getStatus ───────────────────────────────────────────────────────────────

describe('getStatus', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumpstart-status-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns count 0 for fresh project', () => {
    const status = mod.getStatus(tmpDir);
    expect(status.count).toBe(0);
  });

  it('returns installed items', () => {
    mod.writeInstalled(tmpDir, {
      items: {
        'skill.a': { version: '1.0.0', type: 'skill', installedAt: 'now' },
        'agent.b': { version: '2.0.0', type: 'agent', installedAt: 'now' },
      }
    });
    const status = mod.getStatus(tmpDir);
    expect(status.count).toBe(2);
    expect(status.items['skill.a'].version).toBe('1.0.0');
  });
});

// ── checkUpdates ────────────────────────────────────────────────────────────

describe('checkUpdates', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumpstart-update-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects available updates', () => {
    mod.writeInstalled(tmpDir, {
      items: {
        'skill.ignition': { version: '0.9.0', installedAt: 'now' },
      }
    });
    const { updates, upToDate } = mod.checkUpdates(tmpDir, MOCK_INDEX);
    expect(updates.length).toBe(1);
    expect(updates[0].id).toBe('skill.ignition');
    expect(updates[0].localVersion).toBe('0.9.0');
    expect(updates[0].registryVersion).toBe('1.0.0');
  });

  it('marks items as up-to-date when versions match', () => {
    mod.writeInstalled(tmpDir, {
      items: {
        'skill.ignition': { version: '1.0.0', installedAt: 'now' },
      }
    });
    const { updates, upToDate } = mod.checkUpdates(tmpDir, MOCK_INDEX);
    expect(updates.length).toBe(0);
    expect(upToDate).toContain('skill.ignition');
  });
});

// ── uninstallItem ───────────────────────────────────────────────────────────

describe('uninstallItem', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumpstart-uninstall-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('removes installed item and its files', () => {
    // Set up a fake installed item
    const targetDir = path.join(tmpDir, '.jumpstart', 'skills', 'test');
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'SKILL.md'), 'test');

    const remappedFile = path.join(tmpDir, '.github', 'agents', 'test.agent.md');
    fs.mkdirSync(path.dirname(remappedFile), { recursive: true });
    fs.writeFileSync(remappedFile, 'agent');

    mod.writeInstalled(tmpDir, {
      items: {
        'skill.test': {
          version: '1.0.0',
          installedAt: 'now',
          targetPaths: ['.jumpstart/skills/test'],
          remappedFiles: ['.github/agents/test.agent.md'],
        }
      }
    });

    const result = mod.uninstallItem('skill.test', tmpDir);
    expect(result.success).toBe(true);
    expect(result.removed).toContain('.jumpstart/skills/test');
    expect(result.removed).toContain('.github/agents/test.agent.md');

    // Verify files are gone
    expect(fs.existsSync(targetDir)).toBe(false);
    expect(fs.existsSync(remappedFile)).toBe(false);

    // Verify ledger is updated
    const data = mod.readInstalled(tmpDir);
    expect(data.items['skill.test']).toBeUndefined();
  });

  it('throws for uninstalled items', () => {
    expect(() => mod.uninstallItem('skill.missing', tmpDir)).toThrow('not installed');
  });
});
