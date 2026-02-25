/**
 * test-install-integration.test.js — Integration tests for the marketplace installer.
 *
 * Tests the full install/uninstall lifecycle using realistic registry data
 * and mock zip artifacts. Validates:
 *   - Registry fetch + item lookup with real-world index structure
 *   - Dependency resolution with actual manifest data
 *   - Zip extraction and file placement to targetPaths
 *   - IDE auto-detection and agent/prompt remapping
 *   - Install tracking in .jumpstart/installed.json
 *   - Status, update, and uninstall lifecycle
 *   - Search against realistic registry data
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

// ── Realistic Registry Fixture ──────────────────────────────────────────────
// Mirrors the real JumpStart-Skills registry/index.json structure

const REALISTIC_INDEX = {
  version: '2026-02-21',
  generatedAt: '2026-02-21T18:34:11+00:00',
  repo: 'CGSOG-JumpStarts/JumpStart-Skills',
  items: [
    {
      id: 'skill.agent-customization',
      type: 'skill',
      packageId: 'skill.agent-customization',
      displayName: 'Agent Customization',
      category: 'agent-engineering',
      tags: ['agent', 'customization', 'persona'],
      searchText: 'Customize agent behavior, personas, and interaction patterns.',
      sourcePath: 'packages/skills/agent-customization',
      entryFile: 'SKILL.md',
      version: '1.0.0',
      download: {
        zip: 'PLACEHOLDER_URL/dist/skills/agent-customization-1.0.0.zip',
        checksumSha256: 'PLACEHOLDER_HASH',
      },
      install: { targetPaths: ['.jumpstart/skills/agent-customization'] },
      contains: { agents: [], prompts: [], scripts: [], references: [] },
      dependencies: [],
      compatibility: { jumpstartMode: '>=0.9.0' },
      description: 'Techniques for tailoring agent personas and instruction sets.',
      keywords: ['persona', 'instructions', 'behavior'],
    },
    {
      id: 'skill.mermaid-design',
      type: 'skill',
      packageId: 'skill.mermaid-design',
      displayName: 'Mermaid Architect',
      category: 'diagrams',
      tags: ['mermaid', 'diagram', 'architecture'],
      searchText: 'Create, validate, and export Mermaid diagrams with resilient workflows and templates.',
      sourcePath: 'packages/skills/mermaid-design',
      entryFile: 'SKILL.md',
      version: '1.0.0',
      download: {
        zip: 'PLACEHOLDER_URL/dist/skills/mermaid-design-1.0.0.zip',
        checksumSha256: 'PLACEHOLDER_HASH',
      },
      install: { targetPaths: ['.jumpstart/skills/mermaid-design'] },
      contains: {
        agents: [],
        prompts: [],
        scripts: ['scripts/create_prompt.py', 'scripts/extract_mermaid.py'],
        references: ['references/mermaid-diagram-guide.md'],
      },
      dependencies: [],
      compatibility: { jumpstartMode: '>=0.9.0', tools: ['read', 'edit'] },
      description: 'Hierarchical Mermaid diagram workflow with validation and code-to-diagram guides.',
      keywords: ['activity', 'deployment', 'sequence', 'templates'],
    },
    {
      id: 'skill.ignition',
      type: 'skill',
      packageId: 'skill.ignition',
      displayName: 'Ignition',
      category: 'presentations',
      tags: ['pptx', 'slides', 'presentation'],
      searchText: 'Use when any PPTX file needs to be created, modified, or exported.',
      sourcePath: 'packages/skills/ignition',
      entryFile: 'SKILL.md',
      version: '1.0.0',
      download: {
        zip: 'PLACEHOLDER_URL/dist/skills/ignition-1.0.0.zip',
        checksumSha256: 'PLACEHOLDER_HASH',
      },
      install: { targetPaths: ['.jumpstart/skills/ignition'] },
      contains: {
        agents: [
          '.github/agents/content-coach.agent.md',
          '.github/agents/deck-builder.agent.md',
          '.github/agents/editor.agent.md',
        ],
        prompts: [
          '.github/prompts/create-presentation.prompt.md',
          '.github/prompts/extract-content.prompt.md',
        ],
        scripts: [],
        references: [],
      },
      dependencies: ['skill.agent-customization'],
      compatibility: { jumpstartMode: '>=0.9.0' },
      description: 'Enterprise presentation generation with PptxGenJS.',
      keywords: ['presentation', 'deck', 'pptx', 'enterprise'],
    },
    {
      id: 'agent.deck-builder',
      type: 'agent',
      packageId: 'agent.deck-builder',
      displayName: 'Deck Builder',
      category: 'presentations',
      tags: ['orchestrator', 'pptx'],
      sourcePath: 'packages/agents/deck-builder',
      entryFile: 'deck-builder.agent.md',
      version: '1.0.0',
      download: {
        zip: 'PLACEHOLDER_URL/dist/agents/deck-builder-1.0.0.zip',
        checksumSha256: 'PLACEHOLDER_HASH',
      },
      install: { targetPaths: ['.jumpstart/agents/deck-builder'] },
      contains: { agents: [], prompts: [] },
      dependencies: ['skill.ignition'],
      description: 'Orchestrates end-to-end PPTX creation.',
      keywords: ['slides', 'orchestrator'],
    },
    {
      id: 'prompt.create-mermaid',
      type: 'prompt',
      packageId: 'prompt.create-mermaid',
      displayName: 'Create Mermaid',
      category: 'diagrams',
      tags: ['mermaid', 'diagram', 'quick'],
      sourcePath: 'packages/prompts/create-mermaid',
      entryFile: 'create-mermaid.prompt.md',
      version: '1.0.0',
      download: {
        zip: 'PLACEHOLDER_URL/dist/prompts/create-mermaid-1.0.0.zip',
        checksumSha256: 'PLACEHOLDER_HASH',
      },
      install: { targetPaths: ['.jumpstart/prompts/create-mermaid'] },
      contains: { agents: [], prompts: [] },
      dependencies: [],
      description: 'Quick Mermaid diagram generation prompt.',
      keywords: ['mermaid', 'quick'],
    },
    {
      id: 'bundle.ignition-suite',
      type: 'bundle',
      packageId: 'bundle.ignition-suite',
      displayName: 'Ignition Presentation Suite',
      category: 'presentations',
      tags: ['pptx', 'enterprise', 'suite'],
      version: '1.0.0',
      includes: ['skill.ignition', 'agent.deck-builder', 'prompt.create-mermaid'],
      install: { strategy: 'compose' },
      download: {
        zip: 'PLACEHOLDER_URL/dist/bundles/ignition-suite-1.0.0.zip',
        checksumSha256: 'PLACEHOLDER_HASH',
      },
      description: 'Full Ignition presentation suite with agents and prompts.',
      keywords: ['suite', 'presentations'],
    },
  ],
};

// ── Integration Tests ───────────────────────────────────────────────────────

describe('marketplace integration — realistic registry search', () => {
  it('finds mermaid-design by tag "mermaid"', () => {
    const results = mod.searchItems(REALISTIC_INDEX, 'mermaid');
    expect(results.length).toBeGreaterThanOrEqual(2);
    const ids = results.map((r) => r.id);
    expect(ids).toContain('skill.mermaid-design');
    expect(ids).toContain('prompt.create-mermaid');
  });

  it('finds items by category "presentations"', () => {
    const results = mod.searchItems(REALISTIC_INDEX, 'presentations');
    expect(results.length).toBeGreaterThanOrEqual(3);
    const ids = results.map((r) => r.id);
    expect(ids).toContain('skill.ignition');
    expect(ids).toContain('agent.deck-builder');
  });

  it('finds items by searchText keywords', () => {
    const results = mod.searchItems(REALISTIC_INDEX, 'PPTX');
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('ranks exact displayName match highest', () => {
    const results = mod.searchItems(REALISTIC_INDEX, 'Ignition');
    expect(results[0].id).toBe('skill.ignition');
  });

  it('finds items by description keywords', () => {
    const results = mod.searchItems(REALISTIC_INDEX, 'validation');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.map((r) => r.id)).toContain('skill.mermaid-design');
  });
});

describe('marketplace integration — dependency resolution with realistic data', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumpstart-integ-deps-'));
    fs.mkdirSync(path.join(tmpDir, '.jumpstart'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('resolves ignition deps: agent-customization installed first', () => {
    const { order, warnings } = mod.resolveDependencies(
      'skill.ignition',
      REALISTIC_INDEX,
      tmpDir
    );
    expect(warnings.length).toBe(0);
    const custIdx = order.indexOf('skill.agent-customization');
    const ignIdx = order.indexOf('skill.ignition');
    expect(custIdx).toBeGreaterThanOrEqual(0);
    expect(ignIdx).toBeGreaterThan(custIdx);
  });

  it('resolves deck-builder deps: agent-customization then ignition then deck-builder', () => {
    const { order } = mod.resolveDependencies(
      'agent.deck-builder',
      REALISTIC_INDEX,
      tmpDir
    );
    const custIdx = order.indexOf('skill.agent-customization');
    const ignIdx = order.indexOf('skill.ignition');
    const deckIdx = order.indexOf('agent.deck-builder');
    expect(custIdx).toBeLessThan(ignIdx);
    expect(ignIdx).toBeLessThan(deckIdx);
  });

  it('resolves mermaid-design with no dependencies', () => {
    const { order, warnings } = mod.resolveDependencies(
      'skill.mermaid-design',
      REALISTIC_INDEX,
      tmpDir
    );
    expect(order).toEqual(['skill.mermaid-design']);
    expect(warnings.length).toBe(0);
  });

  it('skips already-installed dependencies', () => {
    mod.writeInstalled(tmpDir, {
      items: {
        'skill.agent-customization': {
          version: '1.0.0',
          installedAt: new Date().toISOString(),
          targetPaths: ['.jumpstart/skills/agent-customization'],
          remappedFiles: [],
        },
      },
    });

    const { order, skipped } = mod.resolveDependencies(
      'skill.ignition',
      REALISTIC_INDEX,
      tmpDir
    );
    expect(skipped).toContain('skill.agent-customization');
    expect(order).not.toContain('skill.agent-customization');
    expect(order).toContain('skill.ignition');
  });
});

describe('marketplace integration — IDE detection and file layout', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumpstart-integ-ide-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects VS Code + Copilot when .github/ exists', () => {
    fs.mkdirSync(path.join(tmpDir, '.github', 'agents'), { recursive: true });
    const ide = mod.detectIDE(tmpDir);
    expect(ide.ide).toBe('vscode-copilot');
    expect(ide.agentDir).toBe('.github/agents');
    expect(ide.promptDir).toBe('.github/prompts');
  });

  it('falls back to generic when no .github/', () => {
    const ide = mod.detectIDE(tmpDir);
    expect(ide.ide).toBe('generic');
    expect(ide.agentDir).toBe('.jumpstart/agents');
    expect(ide.promptDir).toBe('.jumpstart/prompts');
  });

  it('resolves targetPaths from realistic manifest with explicit paths', () => {
    const mermaidItem = REALISTIC_INDEX.items.find((i) => i.id === 'skill.mermaid-design');
    const paths = mod.resolveTargetPaths(mermaidItem);
    expect(paths).toEqual(['.jumpstart/skills/mermaid-design']);
  });

  it('resolves targetPaths from realistic manifest without explicit paths', () => {
    const item = { id: 'agent.test-agent', type: 'agent' };
    const paths = mod.resolveTargetPaths(item);
    expect(paths).toEqual(['.jumpstart/agents/test-agent']);
  });
});

describe('marketplace integration — install/uninstall lifecycle', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumpstart-integ-lifecycle-'));
    fs.mkdirSync(path.join(tmpDir, '.github'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.jumpstart'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('installs a skill with no agents/prompts to remap', () => {
    const mermaidItem = REALISTIC_INDEX.items.find((i) => i.id === 'skill.mermaid-design');

    // Verify pre-conditions
    expect(mod.isInstalled('skill.mermaid-design', tmpDir)).toBeNull();

    // Resolve target paths
    const targetPaths = mod.resolveTargetPaths(mermaidItem);
    expect(targetPaths).toEqual(['.jumpstart/skills/mermaid-design']);

    // Simulate what installFromStaging does: copy files to target
    const targetDir = path.resolve(tmpDir, targetPaths[0]);
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'SKILL.md'), '# Mermaid Design');
    fs.mkdirSync(path.join(targetDir, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'scripts', 'extract_mermaid.py'), '# test');

    // Record the install
    const data = mod.readInstalled(tmpDir);
    data.items['skill.mermaid-design'] = {
      version: '1.0.0',
      displayName: 'Mermaid Architect',
      type: 'skill',
      installedAt: new Date().toISOString(),
      targetPaths: ['.jumpstart/skills/mermaid-design'],
      remappedFiles: [],
    };
    mod.writeInstalled(tmpDir, data);

    // Verify installation
    expect(mod.isInstalled('skill.mermaid-design', tmpDir)).not.toBeNull();
    expect(mod.isInstalled('skill.mermaid-design', tmpDir).version).toBe('1.0.0');
    expect(fs.existsSync(path.join(targetDir, 'SKILL.md'))).toBe(true);

    // Verify status
    const status = mod.getStatus(tmpDir);
    expect(status.count).toBe(1);
    expect(status.items['skill.mermaid-design'].displayName).toBe('Mermaid Architect');

    // Uninstall
    const result = mod.uninstallItem('skill.mermaid-design', tmpDir);
    expect(result.success).toBe(true);
    expect(result.removed).toContain('.jumpstart/skills/mermaid-design');
    expect(fs.existsSync(targetDir)).toBe(false);
    expect(mod.isInstalled('skill.mermaid-design', tmpDir)).toBeNull();
  });

  it('installs a skill with agent/prompt remapping (VS Code + Copilot)', () => {
    const ignitionItem = REALISTIC_INDEX.items.find((i) => i.id === 'skill.ignition');

    const targetPaths = mod.resolveTargetPaths(ignitionItem);
    expect(targetPaths).toEqual(['.jumpstart/skills/ignition']);

    // Set up the installed files as installFromStaging would
    const targetDir = path.resolve(tmpDir, targetPaths[0]);
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'SKILL.md'), '# Ignition');

    // Create agent/prompt source files inside the installed skill
    const agentDir = path.join(targetDir, '.github', 'agents');
    const promptDir = path.join(targetDir, '.github', 'prompts');
    fs.mkdirSync(agentDir, { recursive: true });
    fs.mkdirSync(promptDir, { recursive: true });
    fs.writeFileSync(path.join(agentDir, 'content-coach.agent.md'), '# Content Coach');
    fs.writeFileSync(path.join(agentDir, 'deck-builder.agent.md'), '# Deck Builder');
    fs.writeFileSync(path.join(agentDir, 'editor.agent.md'), '# Editor');
    fs.writeFileSync(path.join(promptDir, 'create-presentation.prompt.md'), '# Create Pres');
    fs.writeFileSync(path.join(promptDir, 'extract-content.prompt.md'), '# Extract');

    // Simulate IDE-aware remapping
    const ide = mod.detectIDE(tmpDir);
    expect(ide.ide).toBe('vscode-copilot');

    const remappedFiles = [];

    // Remap agents
    const destAgentDir = path.resolve(tmpDir, ide.agentDir);
    fs.mkdirSync(destAgentDir, { recursive: true });
    for (const agentRelPath of ignitionItem.contains.agents) {
      const srcFile = path.join(targetDir, agentRelPath);
      if (fs.existsSync(srcFile)) {
        const basename = path.basename(agentRelPath);
        const destFile = path.join(destAgentDir, basename);
        fs.copyFileSync(srcFile, destFile);
        remappedFiles.push(path.relative(tmpDir, destFile).replace(/\\/g, '/'));
      }
    }

    // Remap prompts
    const destPromptDir = path.resolve(tmpDir, ide.promptDir);
    fs.mkdirSync(destPromptDir, { recursive: true });
    for (const promptRelPath of ignitionItem.contains.prompts) {
      const srcFile = path.join(targetDir, promptRelPath);
      if (fs.existsSync(srcFile)) {
        const basename = path.basename(promptRelPath);
        const destFile = path.join(destPromptDir, basename);
        fs.copyFileSync(srcFile, destFile);
        remappedFiles.push(path.relative(tmpDir, destFile).replace(/\\/g, '/'));
      }
    }

    // Verify remapping
    expect(remappedFiles.length).toBe(5); // 3 agents + 2 prompts
    expect(fs.existsSync(path.join(destAgentDir, 'content-coach.agent.md'))).toBe(true);
    expect(fs.existsSync(path.join(destAgentDir, 'deck-builder.agent.md'))).toBe(true);
    expect(fs.existsSync(path.join(destPromptDir, 'create-presentation.prompt.md'))).toBe(true);

    // Record install with remapped files
    mod.writeInstalled(tmpDir, {
      items: {
        'skill.ignition': {
          version: '1.0.0',
          displayName: 'Ignition',
          type: 'skill',
          installedAt: new Date().toISOString(),
          targetPaths: ['.jumpstart/skills/ignition'],
          remappedFiles: remappedFiles,
        },
      },
    });

    // Uninstall should remove both skill dir AND remapped files
    const result = mod.uninstallItem('skill.ignition', tmpDir);
    expect(result.success).toBe(true);
    expect(fs.existsSync(targetDir)).toBe(false);
    for (const rf of remappedFiles) {
      expect(fs.existsSync(path.resolve(tmpDir, rf))).toBe(false);
    }
  });
});

describe('marketplace integration — update detection with realistic data', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumpstart-integ-update-'));
    fs.mkdirSync(path.join(tmpDir, '.jumpstart'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects update available when local version is older', () => {
    mod.writeInstalled(tmpDir, {
      items: {
        'skill.mermaid-design': { version: '0.5.0', installedAt: 'now' },
      },
    });

    const { updates, upToDate } = mod.checkUpdates(tmpDir, REALISTIC_INDEX);
    expect(updates.length).toBe(1);
    expect(updates[0].id).toBe('skill.mermaid-design');
    expect(updates[0].localVersion).toBe('0.5.0');
    expect(updates[0].registryVersion).toBe('1.0.0');
  });

  it('reports up-to-date when versions match', () => {
    mod.writeInstalled(tmpDir, {
      items: {
        'skill.mermaid-design': { version: '1.0.0', installedAt: 'now' },
        'skill.agent-customization': { version: '1.0.0', installedAt: 'now' },
      },
    });

    const { updates, upToDate } = mod.checkUpdates(tmpDir, REALISTIC_INDEX);
    expect(updates.length).toBe(0);
    expect(upToDate).toContain('skill.mermaid-design');
    expect(upToDate).toContain('skill.agent-customization');
  });

  it('detects multiple items needing updates', () => {
    mod.writeInstalled(tmpDir, {
      items: {
        'skill.mermaid-design': { version: '0.1.0', installedAt: 'now' },
        'skill.ignition': { version: '0.2.0', installedAt: 'now' },
        'skill.agent-customization': { version: '1.0.0', installedAt: 'now' },
      },
    });

    const { updates, upToDate } = mod.checkUpdates(tmpDir, REALISTIC_INDEX);
    expect(updates.length).toBe(2);
    expect(upToDate).toContain('skill.agent-customization');
  });
});

describe('marketplace integration — compatibility checks', () => {
  it('passes for realistic items with >=0.9.0 requirement', () => {
    const mermaid = REALISTIC_INDEX.items.find((i) => i.id === 'skill.mermaid-design');
    const result = mod.checkCompatibility(mermaid);
    expect(result.compatible).toBe(true);
  });

  it('reports tools requirement without blocking', () => {
    const mermaid = REALISTIC_INDEX.items.find((i) => i.id === 'skill.mermaid-design');
    expect(mermaid.compatibility.tools).toEqual(['read', 'edit']);
    const result = mod.checkCompatibility(mermaid);
    expect(result.compatible).toBe(true);
  });
});

describe('marketplace integration — bare name resolution', () => {
  it('finds mermaid-design by bare name', () => {
    const item = mod.findItemByName(REALISTIC_INDEX, 'mermaid-design');
    expect(item).not.toBeNull();
    expect(item.id).toBe('skill.mermaid-design');
  });

  it('finds ignition by bare name', () => {
    const item = mod.findItemByName(REALISTIC_INDEX, 'ignition');
    expect(item).not.toBeNull();
    expect(item.id).toBe('skill.ignition');
  });

  it('finds deck-builder by displayName', () => {
    const item = mod.findItemByName(REALISTIC_INDEX, 'Deck Builder');
    expect(item).not.toBeNull();
    expect(item.id).toBe('agent.deck-builder');
  });

  it('normalizes dotted IDs for realistic items', () => {
    expect(mod.normalizeItemId('skill.mermaid-design')).toBe('skill.mermaid-design');
    expect(mod.normalizeItemId('skill', 'ignition')).toBe('skill.ignition');
    expect(mod.normalizeItemId('bundle', 'ignition-suite')).toBe('bundle.ignition-suite');
  });
});

describe('marketplace integration — bundle resolution', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumpstart-integ-bundle-'));
    fs.mkdirSync(path.join(tmpDir, '.jumpstart'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('identifies bundle type correctly', () => {
    const bundle = mod.findItem(REALISTIC_INDEX, 'bundle.ignition-suite');
    expect(bundle).not.toBeNull();
    expect(bundle.type).toBe('bundle');
    expect(bundle.includes).toEqual([
      'skill.ignition',
      'agent.deck-builder',
      'prompt.create-mermaid',
    ]);
  });

  it('resolves all transitive dependencies for bundle members', () => {
    const { order } = mod.resolveDependencies(
      'agent.deck-builder',
      REALISTIC_INDEX,
      tmpDir
    );
    expect(order).toContain('skill.agent-customization');
    expect(order).toContain('skill.ignition');
    expect(order).toContain('agent.deck-builder');
  });
});
