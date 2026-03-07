/**
 * test-smoke-tester.test.js — Tests for bin/lib/smoke-tester.js
 *
 * Covers:
 * - Project type and command detection
 * - Build execution and reporting
 * - Health check logic
 * - CLI-compatible JSON output structure
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

let runSmokeTest, detectProjectCommands, runBuild, checkHealth;

beforeEach(async () => {
  const mod = await import('../bin/lib/smoke-tester.js');
  runSmokeTest = mod.runSmokeTest;
  detectProjectCommands = mod.detectProjectCommands;
  runBuild = mod.runBuild;
  checkHealth = mod.checkHealth;
});

function createTempDir(suffix = '') {
  const dir = join(tmpdir(), `jumpstart-smoke-${Date.now()}${suffix}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── detectProjectCommands ────────────────────────────────────────────────────

describe('detectProjectCommands', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('detects Node.js project with build and start scripts', () => {
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({
      scripts: { build: 'tsc', start: 'node dist/index.js' }
    }), 'utf8');

    const result = detectProjectCommands(tmpDir);
    expect(result.type).toBe('node');
    expect(result.build).toBe('npm run build');
    expect(result.start).toBe('npm start');
  });

  it('detects Node.js project with dev script as fallback start', () => {
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({
      scripts: { dev: 'next dev' }
    }), 'utf8');

    const result = detectProjectCommands(tmpDir);
    expect(result.type).toBe('node');
    expect(result.build).toBeNull();
    expect(result.start).toBe('npm run dev');
  });

  it('detects Go projects', () => {
    writeFileSync(join(tmpDir, 'go.mod'), 'module example.com/test\n', 'utf8');
    const result = detectProjectCommands(tmpDir);
    expect(result.type).toBe('go');
    expect(result.build).toBe('go build ./...');
  });

  it('detects Python projects', () => {
    writeFileSync(join(tmpDir, 'pyproject.toml'), '[project]\nname = "test"\n', 'utf8');
    const result = detectProjectCommands(tmpDir);
    expect(result.type).toBe('python');
  });

  it('returns unknown for unrecognized projects', () => {
    const result = detectProjectCommands(tmpDir);
    expect(result.type).toBe('unknown');
    expect(result.build).toBeNull();
    expect(result.start).toBeNull();
  });

  it('detects Makefile as build fallback', () => {
    writeFileSync(join(tmpDir, 'Makefile'), 'all:\n\techo "build"\n', 'utf8');
    const result = detectProjectCommands(tmpDir);
    expect(result.build).toBe('make');
  });
});

// ─── runBuild ─────────────────────────────────────────────────────────────────

describe('runBuild', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('-build');
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('reports successful build', () => {
    const result = runBuild('echo "build success"', tmpDir);
    expect(result.pass).toBe(true);
    expect(result.exit_code).toBe(0);
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.output).toContain('build success');
  });

  it('reports failed build', () => {
    const result = runBuild('false', tmpDir);
    expect(result.pass).toBe(false);
    expect(result.exit_code).not.toBe(0);
  });

  it('truncates long output', () => {
    // Generate output longer than 2000 chars
    const result = runBuild('node -e "console.log(\'x\'.repeat(5000))"', tmpDir);
    expect(result.output.length).toBeLessThanOrEqual(2000);
  });

  it('captures command used', () => {
    const result = runBuild('echo "test"', tmpDir);
    expect(result.command).toBe('echo "test"');
  });
});

// ─── checkHealth ──────────────────────────────────────────────────────────────

describe('checkHealth', () => {
  it('reports failure for unreachable URL', async () => {
    const result = await checkHealth('http://localhost:19999/nonexistent', 2000);
    expect(result.pass).toBe(false);
    expect(result.url).toBe('http://localhost:19999/nonexistent');
    expect(result.error).toBeTruthy();
  });

  it('times out for slow responses', async () => {
    const result = await checkHealth('http://localhost:19998/slow', 500);
    expect(result.pass).toBe(false);
  });

  it('returns correct structure', async () => {
    const result = await checkHealth('http://localhost:19997/test', 1000);
    expect(result).toHaveProperty('pass');
    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('error');
  });
});

// ─── runSmokeTest ─────────────────────────────────────────────────────────────

describe('runSmokeTest', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('-smoke');
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('passes with a successful build and skipped health check', async () => {
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({
      scripts: { build: 'echo "built"' }
    }), 'utf8');

    const result = await runSmokeTest({
      root: tmpDir,
      config: { skip_health_check: true }
    });

    expect(result.pass).toBe(true);
    expect(result.build.pass).toBe(true);
    expect(result.health.error).toBe('Health check skipped');
  });

  it('fails when build fails', async () => {
    const result = await runSmokeTest({
      root: tmpDir,
      config: {
        build_command: 'false',
        skip_health_check: true
      }
    });

    expect(result.pass).toBe(false);
    expect(result.build.pass).toBe(false);
  });

  it('returns correct structure with no commands detected', async () => {
    const result = await runSmokeTest({
      root: tmpDir,
      config: { skip_health_check: true }
    });

    expect(result).toHaveProperty('project_type');
    expect(result).toHaveProperty('build');
    expect(result).toHaveProperty('health');
    expect(result).toHaveProperty('pass');
    expect(result.pass).toBe(true);
  });

  it('detects project type', async () => {
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({
      scripts: {}
    }), 'utf8');

    const result = await runSmokeTest({
      root: tmpDir,
      config: { skip_health_check: true }
    });

    expect(result.project_type).toBe('node');
  });
});
