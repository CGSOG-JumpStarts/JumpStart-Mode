/**
 * test-type-checker.test.js — Tests for bin/lib/type-checker.js
 *
 * Covers:
 * - Type checker detection (tsconfig.json, mypy.ini, pyright, pyproject.toml)
 * - Output parsing (TypeScript, mypy, Pyright formats)
 * - CLI-compatible JSON output structure
 * - Graceful handling when no type checker detected
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

let runTypeCheck, detectTypeChecker, parseTypeErrors;

beforeEach(async () => {
  const mod = await import('../bin/lib/type-checker.js');
  runTypeCheck = mod.runTypeCheck;
  detectTypeChecker = mod.detectTypeChecker;
  parseTypeErrors = mod.parseTypeErrors;
});

function createTempDir(suffix = '') {
  const dir = join(tmpdir(), `jumpstart-type-check-${Date.now()}${suffix}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── detectTypeChecker ────────────────────────────────────────────────────────

describe('detectTypeChecker', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('detects tsconfig.json → TypeScript', () => {
    writeFileSync(join(tmpDir, 'tsconfig.json'), '{}', 'utf8');
    const result = detectTypeChecker(tmpDir);
    expect(result).not.toBeNull();
    expect(result.name).toBe('TypeScript');
    expect(result.command).toContain('tsc');
  });

  it('detects jsconfig.json → TypeScript (JS)', () => {
    writeFileSync(join(tmpDir, 'jsconfig.json'), '{}', 'utf8');
    const result = detectTypeChecker(tmpDir);
    expect(result).not.toBeNull();
    expect(result.name).toBe('TypeScript (JS)');
  });

  it('detects pyrightconfig.json → Pyright', () => {
    writeFileSync(join(tmpDir, 'pyrightconfig.json'), '{}', 'utf8');
    const result = detectTypeChecker(tmpDir);
    expect(result).not.toBeNull();
    expect(result.name).toBe('Pyright');
  });

  it('detects mypy.ini → mypy', () => {
    writeFileSync(join(tmpDir, 'mypy.ini'), '[mypy]\n', 'utf8');
    const result = detectTypeChecker(tmpDir);
    expect(result).not.toBeNull();
    expect(result.name).toBe('mypy');
  });

  it('detects pyproject.toml with [tool.mypy] → mypy', () => {
    writeFileSync(join(tmpDir, 'pyproject.toml'), '[tool.mypy]\nstrict = true\n', 'utf8');
    const result = detectTypeChecker(tmpDir);
    expect(result).not.toBeNull();
    expect(result.name).toBe('mypy');
  });

  it('detects pyproject.toml with [tool.pyright] → Pyright', () => {
    writeFileSync(join(tmpDir, 'pyproject.toml'), '[tool.pyright]\ntypeCheckingMode = "strict"\n', 'utf8');
    const result = detectTypeChecker(tmpDir);
    expect(result).not.toBeNull();
    expect(result.name).toBe('Pyright');
  });

  it('returns null when no type checker found', () => {
    const result = detectTypeChecker(tmpDir);
    expect(result).toBeNull();
  });
});

// ─── parseTypeErrors ──────────────────────────────────────────────────────────

describe('parseTypeErrors', () => {
  it('parses TypeScript format: file(line,col): error TS####: message', () => {
    const output = `src/index.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.`;
    const findings = parseTypeErrors(output, 'TypeScript');
    expect(findings).toHaveLength(1);
    expect(findings[0].file).toBe('src/index.ts');
    expect(findings[0].line).toBe(10);
    expect(findings[0].severity).toBe('error');
    expect(findings[0].code).toBe('TS2322');
    expect(findings[0].message).toContain("Type 'string'");
  });

  it('parses TypeScript alternative format: file:line:col - error TS####: message', () => {
    const output = `src/utils.ts:25:3 - error TS2345: Argument of type 'string' is not assignable.`;
    const findings = parseTypeErrors(output, 'TypeScript');
    expect(findings).toHaveLength(1);
    expect(findings[0].file).toBe('src/utils.ts');
    expect(findings[0].line).toBe(25);
    expect(findings[0].code).toBe('TS2345');
  });

  it('parses mypy format: file:line: error: message [code]', () => {
    const output = `src/main.py:10: error: Incompatible types in assignment  [assignment]`;
    const findings = parseTypeErrors(output, 'mypy');
    expect(findings).toHaveLength(1);
    expect(findings[0].file).toBe('src/main.py');
    expect(findings[0].line).toBe(10);
    expect(findings[0].severity).toBe('error');
    expect(findings[0].code).toBe('assignment');
  });

  it('parses mypy notes as warnings', () => {
    const output = `src/main.py:15: note: Revealed type is "builtins.int"`;
    const findings = parseTypeErrors(output, 'mypy');
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('warning');
  });

  it('parses Pyright format: file:line:col - error: message (code)', () => {
    const output = `src/main.py:20:5 - error: Cannot assign member "x" for type "Foo"  (reportGeneralClassIssues)`;
    const findings = parseTypeErrors(output, 'Pyright');
    expect(findings).toHaveLength(1);
    expect(findings[0].file).toBe('src/main.py');
    expect(findings[0].line).toBe(20);
    expect(findings[0].code).toBe('reportGeneralClassIssues');
  });

  it('returns empty array for clean output', () => {
    const output = `Found 0 errors in 5 source files`;
    expect(parseTypeErrors(output, 'TypeScript')).toEqual([]);
  });

  it('handles multiple errors', () => {
    const output = [
      `src/a.ts(1,1): error TS2322: Type error 1.`,
      `src/b.ts(2,1): error TS2345: Type error 2.`,
      `src/a.ts(5,1): warning TS6133: Unused variable.`
    ].join('\n');
    const findings = parseTypeErrors(output, 'TypeScript');
    expect(findings).toHaveLength(3);
    expect(findings.filter(f => f.severity === 'error')).toHaveLength(2);
    expect(findings.filter(f => f.severity === 'warning')).toHaveLength(1);
  });
});

// ─── runTypeCheck ─────────────────────────────────────────────────────────────

describe('runTypeCheck', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('-run');
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns pass with message when no type checker detected', () => {
    const result = runTypeCheck({ root: tmpDir });
    expect(result.pass).toBe(true);
    expect(result.checker).toBeNull();
    expect(result.message).toContain('No type checker detected');
  });

  it('returns correct structure', () => {
    const result = runTypeCheck({ root: tmpDir });
    expect(result).toHaveProperty('files_checked');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('findings');
    expect(result).toHaveProperty('pass');
  });

  it('uses custom type_command when provided', () => {
    // Provide a command that will succeed (echo)
    const result = runTypeCheck({
      root: tmpDir,
      config: { type_command: 'echo "no errors"' }
    });
    expect(result.checker).toBe('custom');
    expect(result.pass).toBe(true);
  });

  it('handles failing commands gracefully', () => {
    const result = runTypeCheck({
      root: tmpDir,
      config: { type_command: 'false' }
    });
    expect(result.exit_code).not.toBe(0);
  });
});
