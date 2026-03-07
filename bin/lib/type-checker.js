/**
 * type-checker.js — Automated Type Checking Gate
 *
 * Detects and runs type checkers (TypeScript tsc, Python mypy/pyright)
 * after agent writes to src/. Provides structured output for the
 * Developer agent during Phase 4 implementation.
 *
 * Usage:
 *   echo '{"files":["src/index.ts"],"root":"."}' | node bin/lib/type-checker.js
 *
 * Input (stdin JSON):
 *   {
 *     "files": ["src/index.ts", "src/utils.ts"],
 *     "root": ".",
 *     "config": {
 *       "type_command": "npx tsc --noEmit",
 *       "strict": true
 *     }
 *   }
 *
 * Output (stdout JSON):
 *   {
 *     "files_checked": 2,
 *     "errors": 3,
 *     "warnings": 0,
 *     "findings": [...],
 *     "pass": false,
 *     "checker": "TypeScript"
 *   }
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Detect the project's type checker from configuration files.
 *
 * @param {string} root - Project root path.
 * @returns {{ command: string, name: string } | null}
 */
function detectTypeChecker(root) {
  const checks = [
    { file: 'tsconfig.json', command: 'npx tsc --noEmit', name: 'TypeScript' },
    { file: 'jsconfig.json', command: 'npx tsc --noEmit --allowJs', name: 'TypeScript (JS)' },
    { file: 'pyrightconfig.json', command: 'npx pyright', name: 'Pyright' },
    { file: 'mypy.ini', command: 'python -m mypy', name: 'mypy' },
    { file: '.mypy.ini', command: 'python -m mypy', name: 'mypy' }
  ];

  // Check pyproject.toml for mypy or pyright config
  const pyprojectPath = path.join(root, 'pyproject.toml');
  if (fs.existsSync(pyprojectPath)) {
    try {
      const content = fs.readFileSync(pyprojectPath, 'utf8');
      if (content.includes('[tool.mypy]')) {
        return { command: 'python -m mypy', name: 'mypy' };
      }
      if (content.includes('[tool.pyright]')) {
        return { command: 'npx pyright', name: 'Pyright' };
      }
    } catch {
      // ignore
    }
  }

  for (const check of checks) {
    if (fs.existsSync(path.join(root, check.file))) {
      return { command: check.command, name: check.name };
    }
  }

  return null;
}

/**
 * Parse type checker output into structured findings.
 * Handles TypeScript, Pyright, and mypy output formats.
 *
 * @param {string} output - Raw type checker output.
 * @param {string} checkerName - Name of the type checker.
 * @returns {Array<{ file: string, line: number|null, severity: string, message: string, code: string|null }>}
 */
function parseTypeErrors(output, checkerName) {
  const findings = [];
  const lines = output.split('\n');

  for (const line of lines) {
    // TypeScript format: src/index.ts(10,5): error TS2322: Type 'string' is not assignable...
    const tsMatch = line.match(/^(.+?)\((\d+),\d+\):\s+(error|warning)\s+(TS\d+):\s+(.+)/);
    if (tsMatch) {
      findings.push({
        file: tsMatch[1],
        line: parseInt(tsMatch[2], 10),
        severity: tsMatch[3],
        code: tsMatch[4],
        message: tsMatch[5].trim()
      });
      continue;
    }

    // TypeScript alternative format: src/index.ts:10:5 - error TS2322: Type 'string'...
    const tsAltMatch = line.match(/^(.+?):(\d+):\d+\s+-\s+(error|warning)\s+(TS\d+):\s+(.+)/);
    if (tsAltMatch) {
      findings.push({
        file: tsAltMatch[1],
        line: parseInt(tsAltMatch[2], 10),
        severity: tsAltMatch[3],
        code: tsAltMatch[4],
        message: tsAltMatch[5].trim()
      });
      continue;
    }

    // mypy format: src/main.py:10: error: Incompatible types...  [assignment]
    const mypyMatch = line.match(/^(.+?):(\d+):\s+(error|warning|note):\s+(.+?)(?:\s+\[(.+?)\])?$/);
    if (mypyMatch && !line.startsWith(' ')) {
      findings.push({
        file: mypyMatch[1],
        line: parseInt(mypyMatch[2], 10),
        severity: mypyMatch[3] === 'note' ? 'warning' : mypyMatch[3],
        code: mypyMatch[5] || null,
        message: mypyMatch[4].trim()
      });
      continue;
    }

    // Pyright format: src/main.py:10:5 - error: Cannot assign...  (reportGeneralClassIssues)
    const pyrightMatch = line.match(/^(.+?):(\d+):\d+\s+-\s+(error|warning|information):\s+(.+?)(?:\s+\((.+?)\))?$/);
    if (pyrightMatch) {
      findings.push({
        file: pyrightMatch[1],
        line: parseInt(pyrightMatch[2], 10),
        severity: pyrightMatch[3] === 'information' ? 'warning' : pyrightMatch[3],
        code: pyrightMatch[5] || null,
        message: pyrightMatch[4].trim()
      });
    }
  }

  return findings;
}

/**
 * Run type checking on the project.
 *
 * @param {object} input - Type check options.
 * @param {string[]} [input.files] - Specific files (used for filtering results).
 * @param {string} [input.root] - Project root.
 * @param {object} [input.config] - Override config.
 * @param {string} [input.config.type_command] - Custom type check command.
 * @param {boolean} [input.config.strict] - Enable strict mode.
 * @returns {object} Type check results.
 */
function runTypeCheck(input) {
  const { files = [], root = '.', config = {} } = input;
  const resolvedRoot = path.resolve(root);

  // Determine type checker
  let checkerInfo;
  if (config.type_command) {
    checkerInfo = { command: config.type_command, name: 'custom' };
  } else {
    checkerInfo = detectTypeChecker(resolvedRoot);
  }

  if (!checkerInfo) {
    return {
      files_checked: files.length,
      errors: 0,
      warnings: 0,
      findings: [],
      pass: true,
      checker: null,
      message: 'No type checker detected. Consider adding tsconfig.json (TypeScript) or mypy.ini (Python).'
    };
  }

  // Build command
  let cmd = checkerInfo.command;
  if (config.strict && checkerInfo.name === 'TypeScript') {
    cmd += ' --strict';
  }

  let output = '';
  let exitCode = 0;

  try {
    output = execSync(cmd, {
      cwd: resolvedRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000
    });
  } catch (err) {
    output = (err.stdout || '') + (err.stderr || '');
    exitCode = err.status || 1;
  }

  let findings = parseTypeErrors(output, checkerInfo.name);

  // If specific files provided, filter findings to those files
  if (files.length > 0) {
    const normalizedFiles = new Set(files.map(f => {
      if (path.isAbsolute(f)) return path.relative(resolvedRoot, f);
      return f;
    }));

    findings = findings.filter(f => {
      const normalized = path.isAbsolute(f.file)
        ? path.relative(resolvedRoot, f.file)
        : f.file;
      return normalizedFiles.has(normalized);
    });
  }

  const errors = findings.filter(f => f.severity === 'error').length;
  const warnings = findings.filter(f => f.severity === 'warning').length;

  return {
    files_checked: files.length || '(project-wide)',
    errors,
    warnings,
    findings,
    pass: errors === 0,
    checker: checkerInfo.name,
    exit_code: exitCode
  };
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

if (process.argv[1] && (
  process.argv[1].endsWith('type-checker.js') ||
  process.argv[1].endsWith('type-checker')
)) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const parsed = input.trim() ? JSON.parse(input) : {};
      const result = runTypeCheck(parsed);
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      process.exit(result.pass ? 0 : 1);
    } catch (err) {
      process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
      process.exit(2);
    }
  });

  if (process.stdin.isTTY) {
    const result = runTypeCheck({});
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(result.pass ? 0 : 1);
  }
}

export { runTypeCheck, detectTypeChecker, parseTypeErrors };
