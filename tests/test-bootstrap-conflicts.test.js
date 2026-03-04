import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const cliPath = path.join(repoRoot, 'bin', 'cli.js');

function runCli(tempDir, args = []) {
  return spawnSync(process.execPath, [cliPath, tempDir, '--name', 'Test Project', '--approver', 'QA Team', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

function writeFile(baseDir, relativePath, content) {
  const fullPath = path.join(baseDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
}

describe('bootstrap conflict handling', () => {
  it('persists startup answers into .jumpstart/config.yaml', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumpstart-config-persist-'));

    const result = runCli(tempDir, ['--type', 'brownfield', '--conflict', 'overwrite']);
    expect(result.status).toBe(0);

    const configPath = path.join(tempDir, '.jumpstart', 'config.yaml');
    expect(fs.existsSync(configPath)).toBe(true);

    const configContent = fs.readFileSync(configPath, 'utf8');
    expect(configContent).toContain('name: "Test Project"');
    expect(configContent).toContain('approver: "QA Team"');
    expect(configContent).toContain('type: brownfield');
  });

  it('merges AGENTS.md and CLAUDE.md while preserving user content', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumpstart-merge-'));

    writeFile(tempDir, 'AGENTS.md', '# Existing AGENTS\n\nCustom team instructions.\n');
    writeFile(tempDir, 'CLAUDE.md', '# Existing CLAUDE\n\nInternal Claude rules.\n');

    const firstRun = runCli(tempDir, ['--conflict', 'merge']);
    expect(firstRun.status).toBe(0);

    const agentsContent = fs.readFileSync(path.join(tempDir, 'AGENTS.md'), 'utf8');
    const claudeContent = fs.readFileSync(path.join(tempDir, 'CLAUDE.md'), 'utf8');

    expect(agentsContent).toContain('Custom team instructions.');
    expect(claudeContent).toContain('Internal Claude rules.');
    expect(agentsContent).toContain('<!-- BEGIN JUMPSTART MERGE: AGENTS.md -->');
    expect(claudeContent).toContain('<!-- BEGIN JUMPSTART MERGE: CLAUDE.md -->');

    const secondRun = runCli(tempDir, ['--conflict', 'merge']);
    expect(secondRun.status).toBe(0);

    const agentsAfterSecondRun = fs.readFileSync(path.join(tempDir, 'AGENTS.md'), 'utf8');
    const markerCount = (agentsAfterSecondRun.match(/BEGIN JUMPSTART MERGE: AGENTS\.md/g) || []).length;
    expect(markerCount).toBe(1);
  });

  it('overwrites existing AGENTS.md in overwrite mode', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumpstart-overwrite-'));

    writeFile(tempDir, 'AGENTS.md', '# Existing AGENTS\n\nDo not keep this marker: USER_ONLY_MARKER\n');

    const result = runCli(tempDir, ['--conflict', 'overwrite']);
    expect(result.status).toBe(0);

    const agentsContent = fs.readFileSync(path.join(tempDir, 'AGENTS.md'), 'utf8');
    expect(agentsContent).not.toContain('USER_ONLY_MARKER');
    expect(agentsContent).toContain('# Jump Start Framework -- Agent Instructions');
    expect(agentsContent).not.toContain('BEGIN JUMPSTART MERGE: AGENTS.md');
  });

  it('warns and persists warning note when AGENTS.md/CLAUDE.md are skipped', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumpstart-skip-'));

    writeFile(tempDir, 'AGENTS.md', '# Existing AGENTS\n\nCustom only.\n');
    writeFile(tempDir, 'CLAUDE.md', '# Existing CLAUDE\n\nCustom only.\n');

    const result = runCli(tempDir, ['--conflict', 'skip']);
    expect(result.status).toBe(0);

    const output = `${result.stdout}\n${result.stderr}`;
    expect(output).toContain('Integration warning: AGENTS.md / CLAUDE.md were skipped.');

    const warningPath = path.join(tempDir, '.jumpstart', 'state', 'install-warnings.md');
    expect(fs.existsSync(warningPath)).toBe(true);

    const warningContent = fs.readFileSync(warningPath, 'utf8');
    expect(warningContent).toContain('AGENTS.md');
    expect(warningContent).toContain('CLAUDE.md');
    expect(warningContent).toContain('can cause integration issues');
  });
});
