/**
 * integrate.js — Dynamic Skill Integration Engine for JumpStart-Mode.
 *
 * When skills are installed or uninstalled, this module regenerates:
 *   1. IDE-level instructions (.github/instructions/skills.instructions.md)
 *      — an applyTo:'**' file that Copilot injects into ALL agent conversations,
 *        giving every @Jump Start: * agent awareness of installed skills.
 *   2. Framework-level skill index (.jumpstart/skills/skill-index.md)
 *      — a structured catalog that agent personas reference via protocol steps.
 *   3. Integration log (.jumpstart/integration-log.json)
 *      — tracks every generated file so uninstall can cleanly reverse changes.
 *
 * Both auto-integration (post-install hook) and manual rebuild
 * (`npx jumpstart-mode integrate`) are supported.
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Constants ──────────────────────────────────────────────────────────────

const SKILLS_DIR = '.jumpstart/skills';
const INSTALLED_FILE = '.jumpstart/installed.json';
const INTEGRATION_LOG = '.jumpstart/integration-log.json';
const SKILL_INDEX_FILE = '.jumpstart/skills/skill-index.md';
const IDE_INSTRUCTIONS_VSCODE = '.github/instructions/skills.instructions.md';
const IDE_INSTRUCTIONS_GENERIC = '.jumpstart/instructions/skills.instructions.md';

// ─── SKILL.md Frontmatter Parser ────────────────────────────────────────────

/**
 * Parse YAML-like frontmatter from a SKILL.md file.
 * Handles the ```skill ... ``` fenced format and standard --- fenced format.
 *
 * @param {string} content - Raw SKILL.md content.
 * @returns {{ name: string, description: string, discoveryKeywords: string[], triggers: string[], body: string }}
 */
function parseSkillFrontmatter(content) {
  const result = {
    name: '',
    description: '',
    discoveryKeywords: [],
    triggers: [],
    body: content,
  };

  // Extract YAML frontmatter from ```skill ... ``` or --- ... ---
  let yamlBlock = '';
  const skillFenceMatch = content.match(/^```skill\s*\n---\n([\s\S]*?)\n---\s*\n/m);
  const standardFenceMatch = content.match(/^---\n([\s\S]*?)\n---\s*\n/m);

  if (skillFenceMatch) {
    yamlBlock = skillFenceMatch[1];
    result.body = content.slice(skillFenceMatch[0].length);
  } else if (standardFenceMatch) {
    yamlBlock = standardFenceMatch[1];
    result.body = content.slice(standardFenceMatch[0].length);
  }

  // Simple YAML parser for name/description (avoids dependency on yaml lib)
  for (const line of yamlBlock.split('\n')) {
    const nameMatch = line.match(/^name:\s*(.+)/);
    const descMatch = line.match(/^description:\s*['"]?([\s\S]+?)['"]?\s*$/);
    if (nameMatch) result.name = nameMatch[1].trim();
    if (descMatch) result.description = descMatch[1].trim();
  }

  // Extract Discovery Keywords section
  const kwMatch = result.body.match(
    /## Discovery Keywords\s*\n([^\n#]+)/i
  );
  if (kwMatch) {
    result.discoveryKeywords = kwMatch[1]
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
  }

  // Extract Triggers section
  const triggerMatch = result.body.match(
    /## Triggers\s*\n([\s\S]*?)(?=\n##|\n#[^#]|$)/i
  );
  if (triggerMatch) {
    result.triggers = triggerMatch[1]
      .split('\n')
      .map((l) => l.replace(/^[-*]\s*/, '').trim())
      .filter((l) => l.length > 0 && !l.startsWith('Use when'));
  }

  return result;
}

// ─── Skill Scanner ──────────────────────────────────────────────────────────

/**
 * Scan .jumpstart/skills/ for installed skills and parse their metadata.
 * Cross-references with installed.json for version/type/contains info.
 *
 * @param {string} projectRoot
 * @returns {object[]} Array of skill catalog entries.
 */
export function scanInstalledSkills(projectRoot) {
  const skillsDir = path.resolve(projectRoot, SKILLS_DIR);
  if (!fs.existsSync(skillsDir)) return [];

  // Read installed.json for registry metadata
  let installed = { items: {} };
  const installedPath = path.resolve(projectRoot, INSTALLED_FILE);
  try {
    installed = JSON.parse(fs.readFileSync(installedPath, 'utf8'));
  } catch { /* ignore */ }

  const skills = [];
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'README.md' || entry.name.startsWith('.')) continue;

    const skillDir = path.join(skillsDir, entry.name);
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) continue;

    const content = fs.readFileSync(skillMdPath, 'utf8');
    const parsed = parseSkillFrontmatter(content);

    // Cross-reference with installed.json
    const itemId = `skill.${entry.name}`;
    const installedEntry = installed.items[itemId] || {};

    skills.push({
      id: itemId,
      name: parsed.name || entry.name,
      displayName: installedEntry.displayName || parsed.name || entry.name,
      description: parsed.description,
      // keywords persisted at install time take precedence; fall back to SKILL.md body parsing
      discoveryKeywords: installedEntry.keywords || parsed.discoveryKeywords,
      triggers: parsed.triggers,
      version: installedEntry.version || 'unknown',
      type: installedEntry.type || 'skill',
      skillDir: `.jumpstart/skills/${entry.name}`,
      entryFile: `.jumpstart/skills/${entry.name}/SKILL.md`,
      remappedFiles: installedEntry.remappedFiles || [],
      installedAt: installedEntry.installedAt || null,
    });
  }

  return skills;
}

// ─── IDE Instructions Generator ─────────────────────────────────────────────

/**
 * Detect the IDE environment (mirrors install.js logic).
 *
 * @param {string} projectRoot
 * @returns {{ ide: string, instructionsDir: string }}
 */
function detectIDEForIntegration(projectRoot) {
  const hasGitHub = fs.existsSync(path.join(projectRoot, '.github'));
  if (hasGitHub) {
    return {
      ide: 'vscode-copilot',
      instructionsDir: '.github/instructions',
    };
  }
  return {
    ide: 'generic',
    instructionsDir: '.jumpstart/instructions',
  };
}

/**
 * Generate the IDE-level skills instructions file.
 * This file uses applyTo: '**' so Copilot injects it into ALL agent conversations,
 * making every @Jump Start: * agent skill-aware.
 *
 * @param {string} projectRoot
 * @param {object[]} skills - Scanned skill catalog.
 * @returns {{ filePath: string, content: string } | null}
 */
export function generateIDEInstructions(projectRoot, skills) {
  if (skills.length === 0) return null;

  const ide = detectIDEForIntegration(projectRoot);
  const relPath =
    ide.ide === 'vscode-copilot' ? IDE_INSTRUCTIONS_VSCODE : IDE_INSTRUCTIONS_GENERIC;

  // Build the skill table
  const tableRows = skills.map((s) => {
    const triggers = s.triggers.length > 0
      ? s.triggers.slice(0, 3).join('; ')
      : s.discoveryKeywords.slice(0, 4).join(', ');
    const agents = s.remappedFiles
      .filter((f) => f.endsWith('.agent.md'))
      .map((f) => `@${path.basename(f, '.agent.md').split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`)
      .join(', ') || '—';
    return `| ${s.displayName} | ${triggers} | \`${s.entryFile}\` | ${agents} |`;
  });

  const triggerList = skills.map((s) => {
    const kw = [...s.discoveryKeywords, ...s.triggers.slice(0, 3)].slice(0, 6);
    return `- **${s.displayName}** (\`${s.id}\`): ${kw.join(', ') || s.description.slice(0, 80)}`;
  });

  const content = `---
applyTo: "**"
---

# Installed Skills — Dynamic Integration

This file is auto-generated by \`jumpstart-mode integrate\`. Do NOT edit manually.
Regenerate with: \`npx jumpstart-mode integrate\`

## Available Skills

${skills.length} skill(s) are installed in this project:

| Skill | Triggers | Entry File | Bundled Agents |
| --- | --- | --- | --- |
${tableRows.join('\n')}

## Skill Loading Protocol

When a user's request matches any of the trigger conditions below, you MUST:
1. Read the skill's \`SKILL.md\` entry file for domain-specific instructions.
2. Follow the workflow, templates, and decision trees defined in the skill.
3. If the skill has bundled agents listed above, delegate to them as appropriate.
4. Reference the skill's \`references/\` and \`scripts/\` directories for supporting assets.

## Trigger Keywords

${triggerList.join('\n')}

## Skill Discovery Index

For detailed metadata, see \`.jumpstart/skills/skill-index.md\`.
`;

  return { filePath: relPath, content };
}

// ─── Framework Skill Index Generator ────────────────────────────────────────

/**
 * Generate the framework-level skill index (.jumpstart/skills/skill-index.md).
 * Agent personas reference this during their Skill Discovery protocol step.
 *
 * @param {object[]} skills - Scanned skill catalog.
 * @returns {{ filePath: string, content: string } | null}
 */
export function generateSkillIndex(skills) {
  if (skills.length === 0) return null;

  const generatedAt = new Date().toISOString();

  const catalogEntries = skills.map((s) => {
    return `### ${s.displayName} (\`${s.id}\`)

- **Version:** ${s.version}
- **Entry File:** \`${s.entryFile}\`
- **Description:** ${s.description}
- **Discovery Keywords:** ${s.discoveryKeywords.join(', ') || '—'}
- **Triggers:** ${s.triggers.length > 0 ? '\n' + s.triggers.map(t => `  - ${t}`).join('\n') : '—'}
- **Bundled Agents:** ${s.remappedFiles.filter(f => f.endsWith('.agent.md')).map(f => `\`${path.basename(f)}\``).join(', ') || 'None'}
- **Bundled Prompts:** ${s.remappedFiles.filter(f => f.endsWith('.prompt.md')).map(f => `\`${path.basename(f)}\``).join(', ') || 'None'}
- **Installed:** ${s.installedAt || 'Unknown'}`;
  });

  const content = `# Skill Index — Dynamic Integration

> **Auto-generated** by \`jumpstart-mode integrate\` on ${generatedAt}.
> Do NOT edit manually. Regenerate with: \`npx jumpstart-mode integrate\`

## Summary

${skills.length} skill(s) installed.

| Skill | Version | Keywords |
| --- | --- | --- |
${skills.map(s => `| [${s.displayName}](${s.entryFile}) | ${s.version} | ${s.discoveryKeywords.slice(0, 5).join(', ')} |`).join('\n')}

## Catalog

${catalogEntries.join('\n\n')}

## Skill Discovery Protocol

All phase and advisory agents follow this protocol when \`skills.enabled\` is \`true\` in \`.jumpstart/config.yaml\`:

1. **Scan this index** at the start of each task.
2. **Match triggers** — compare the user's request against each skill's triggers and discovery keywords.
3. **Load SKILL.md** — for each matching skill, read its entry file for domain-specific workflow.
4. **Delegate to bundled agents** — if the skill has remapped agents, invoke them for specialized work.
5. **Follow skill workflow** — the SKILL.md defines decision trees, templates, and validation rules.

## Usage by Agents

- **Phase agents** (Challenger → Developer): check this index during their Setup step.
- **Advisory agents** (QA, Security, Performance, etc.): check this index at activation.
- **Facilitator**: include skill-aware agents in Party Mode when topics overlap with installed skills.
`;

  return { filePath: SKILL_INDEX_FILE, content };
}

// ─── Integration Log ────────────────────────────────────────────────────────

/**
 * Read the integration log.
 * @param {string} projectRoot
 * @returns {object}
 */
export function readIntegrationLog(projectRoot) {
  const fp = path.resolve(projectRoot, INTEGRATION_LOG);
  if (!fs.existsSync(fp)) {
    return { generatedAt: null, files: {}, skillContributions: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return { generatedAt: null, files: {}, skillContributions: {} };
  }
}

/**
 * Write the integration log.
 * @param {string} projectRoot
 * @param {object} log
 */
function writeIntegrationLog(projectRoot, log) {
  const fp = path.resolve(projectRoot, INTEGRATION_LOG);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(log, null, 2) + '\n', 'utf8');
}

/**
 * Compute SHA256 hash of a string.
 */
function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

// ─── Core Integration Engine ────────────────────────────────────────────────

/**
 * Apply full integration: scan skills → generate IDE instructions →
 * generate skill index → write integration log.
 *
 * Called automatically after install/uninstall, or manually via
 * `npx jumpstart-mode integrate`.
 *
 * @param {string} projectRoot
 * @param {{ onProgress?: (msg: string) => void }} options
 * @returns {{ filesWritten: string[], filesRemoved: string[], skillCount: number }}
 */
export function applyIntegration(projectRoot, options = {}) {
  const progress = options.onProgress || (() => {});
  const skills = scanInstalledSkills(projectRoot);
  const filesWritten = [];
  const filesRemoved = [];

  // Read previous integration log to know what to clean up
  const prevLog = readIntegrationLog(projectRoot);

  if (skills.length === 0) {
    // No skills installed — remove all integration files
    progress('No skills installed — cleaning up integration files.');
    for (const relPath of Object.keys(prevLog.files || {})) {
      const abs = path.resolve(projectRoot, relPath);
      if (fs.existsSync(abs)) {
        fs.rmSync(abs, { force: true });
        filesRemoved.push(relPath);
        progress(`  Removed ${relPath}`);
      }
    }
    // Write empty log
    writeIntegrationLog(projectRoot, {
      generatedAt: new Date().toISOString(),
      files: {},
      skillContributions: {},
    });
    return { filesWritten, filesRemoved, skillCount: 0 };
  }

  // Generate IDE instructions
  const ideResult = generateIDEInstructions(projectRoot, skills);
  if (ideResult) {
    const abs = path.resolve(projectRoot, ideResult.filePath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, ideResult.content, 'utf8');
    filesWritten.push(ideResult.filePath);
    progress(`  ✓ ${ideResult.filePath}`);
  }

  // Generate skill index
  const indexResult = generateSkillIndex(skills);
  if (indexResult) {
    const abs = path.resolve(projectRoot, indexResult.filePath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, indexResult.content, 'utf8');
    filesWritten.push(indexResult.filePath);
    progress(`  ✓ ${indexResult.filePath}`);
  }

  // Remove any previously generated files that we didn't just regenerate
  const currentFiles = new Set(filesWritten);
  for (const relPath of Object.keys(prevLog.files || {})) {
    if (!currentFiles.has(relPath)) {
      const abs = path.resolve(projectRoot, relPath);
      if (fs.existsSync(abs)) {
        fs.rmSync(abs, { force: true });
        filesRemoved.push(relPath);
        progress(`  Removed stale ${relPath}`);
      }
    }
  }

  // Build integration log
  const newLog = {
    generatedAt: new Date().toISOString(),
    files: {},
    skillContributions: {},
  };

  for (const fp of filesWritten) {
    const abs = path.resolve(projectRoot, fp);
    const content = fs.readFileSync(abs, 'utf8');
    newLog.files[fp] = {
      type: 'generated',
      sourceSkills: skills.map((s) => s.id),
      hash: `sha256:${sha256(content)}`,
    };
  }

  for (const s of skills) {
    newLog.skillContributions[s.id] = {
      integratedAt: new Date().toISOString(),
      generatedFiles: filesWritten,
      triggers: [...s.discoveryKeywords.slice(0, 5), ...s.triggers.slice(0, 3)],
    };
  }

  writeIntegrationLog(projectRoot, newLog);
  progress(`Integration complete: ${skills.length} skill(s), ${filesWritten.length} file(s) written.`);

  return { filesWritten, filesRemoved, skillCount: skills.length };
}

/**
 * Remove all integration-generated files and reset the log.
 * Used by `npx jumpstart-mode integrate --clean`.
 *
 * @param {string} projectRoot
 * @param {{ onProgress?: (msg: string) => void }} options
 * @returns {{ filesRemoved: string[] }}
 */
export function cleanIntegration(projectRoot, options = {}) {
  const progress = options.onProgress || (() => {});
  const log = readIntegrationLog(projectRoot);
  const filesRemoved = [];

  for (const relPath of Object.keys(log.files || {})) {
    const abs = path.resolve(projectRoot, relPath);
    if (fs.existsSync(abs)) {
      fs.rmSync(abs, { force: true });
      filesRemoved.push(relPath);
      progress(`  Removed ${relPath}`);
    }
  }

  // Reset the log
  writeIntegrationLog(projectRoot, {
    generatedAt: new Date().toISOString(),
    files: {},
    skillContributions: {},
  });

  progress(`Clean complete: removed ${filesRemoved.length} file(s).`);
  return { filesRemoved };
}
