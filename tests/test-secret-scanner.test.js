/**
 * test-secret-scanner.test.js — Tests for bin/lib/secret-scanner.js
 *
 * Covers:
 * - Pattern detection (AWS keys, GitHub tokens, private keys, etc.)
 * - File skipping (binary files, node_modules, allowlisted files)
 * - Custom pattern support
 * - CLI-compatible JSON output structure
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Dynamic import for ESM module
let runSecretScan, scanFile, shouldSkip, compileCustomPatterns, DEFAULT_PATTERNS;

beforeEach(async () => {
  const mod = await import('../bin/lib/secret-scanner.js');
  runSecretScan = mod.runSecretScan;
  scanFile = mod.scanFile;
  shouldSkip = mod.shouldSkip;
  compileCustomPatterns = mod.compileCustomPatterns;
  DEFAULT_PATTERNS = mod.DEFAULT_PATTERNS;
});

function createTempDir(suffix = '') {
  const dir = join(tmpdir(), `jumpstart-secret-scan-${Date.now()}${suffix}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── Test Secret Constants (built dynamically to avoid triggering scanners) ──

const AWS_KEY_PREFIX = 'AKIA';
const AWS_KEY_SUFFIX = 'IOSFODNN7EXAMPLE';
const GH_TOKEN_PREFIX = 'ghp_';
const GH_TOKEN_SUFFIX = 'ABCDEFghijklmnopqrstuvwxyz0123456789';
const PK_HEADER = Buffer.from('LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQ==', 'base64').toString('ascii');

// ─── DEFAULT_PATTERNS ─────────────────────────────────────────────────────────

describe('DEFAULT_PATTERNS', () => {
  it('includes patterns for common secret types', () => {
    const names = DEFAULT_PATTERNS.map(p => p.name);
    expect(names).toContain('AWS Access Key');
    expect(names).toContain('GitHub Token');
    expect(names).toContain('Private Key Header');
    expect(names).toContain('Generic API Key Assignment');
    expect(names).toContain('Generic Secret Assignment');
  });
});

// ─── shouldSkip ───────────────────────────────────────────────────────────────

describe('shouldSkip', () => {
  it('skips binary file extensions', () => {
    expect(shouldSkip('image.png')).toBe(true);
    expect(shouldSkip('font.woff2')).toBe(true);
    expect(shouldSkip('archive.zip')).toBe(true);
  });

  it('skips node_modules paths', () => {
    expect(shouldSkip('node_modules/foo/bar.js')).toBe(true);
  });

  it('skips .git paths', () => {
    expect(shouldSkip('.git/config')).toBe(true);
  });

  it('does not skip regular source files', () => {
    expect(shouldSkip('src/index.js')).toBe(false);
    expect(shouldSkip('config.yaml')).toBe(false);
  });

  it('skips allowlisted files', () => {
    expect(shouldSkip('.env.example', ['.env.example'])).toBe(true);
    expect(shouldSkip('src/config.example.js', ['config.example.js'])).toBe(true);
  });

  it('does not skip files not in allowlist', () => {
    expect(shouldSkip('.env', ['.env.example'])).toBe(false);
  });

  it('does not skip files whose names contain skip strings as substrings', () => {
    expect(shouldSkip('src/buildUtils.js')).toBe(false);
    expect(shouldSkip('src/distributed/app.js')).toBe(false);
    expect(shouldSkip('src/coverage-reporter.js')).toBe(false);
    expect(shouldSkip('src/rebuild/index.js')).toBe(false);
  });

  it('skips files in actual skip directories', () => {
    expect(shouldSkip('build/output.js')).toBe(true);
    expect(shouldSkip('dist/bundle.js')).toBe(true);
    expect(shouldSkip('coverage/report.html')).toBe(true);
  });
});

// ─── compileCustomPatterns ────────────────────────────────────────────────────

describe('compileCustomPatterns', () => {
  it('compiles string patterns into RegExp objects', () => {
    const compiled = compileCustomPatterns([
      { name: 'Custom Token', pattern: 'CUSTOM_[A-Z0-9]{32}' }
    ]);
    expect(compiled).toHaveLength(1);
    expect(compiled[0].name).toBe('Custom Token');
    expect(compiled[0].pattern).toBeInstanceOf(RegExp);
    expect(compiled[0].severity).toBe('high');
  });

  it('handles empty input', () => {
    expect(compileCustomPatterns(null)).toEqual([]);
    expect(compileCustomPatterns([])).toEqual([]);
  });

  it('filters out invalid regex patterns', () => {
    const compiled = compileCustomPatterns([
      { name: 'Valid', pattern: 'VALID_[A-Z]+' },
      { name: 'Invalid', pattern: '[invalid(' }
    ]);
    expect(compiled).toHaveLength(1);
    expect(compiled[0].name).toBe('Valid');
  });
});

// ─── scanFile ─────────────────────────────────────────────────────────────────

describe('scanFile', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('detects AWS access keys', () => {
    const filePath = join(tmpDir, 'config.js');
    writeFileSync(filePath, `const key = "${AWS_KEY_PREFIX}${AWS_KEY_SUFFIX}";\n`, 'utf8');
    const findings = scanFile(filePath, DEFAULT_PATTERNS);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].pattern_name).toBe('AWS Access Key');
    expect(findings[0].severity).toBe('critical');
  });

  it('detects GitHub tokens', () => {
    const filePath = join(tmpDir, 'config.js');
    writeFileSync(filePath, `const token = "${GH_TOKEN_PREFIX}${GH_TOKEN_SUFFIX}";\n`, 'utf8');
    const findings = scanFile(filePath, DEFAULT_PATTERNS);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some(f => f.pattern_name === 'GitHub Token')).toBe(true);
  });

  it('detects private key headers', () => {
    const filePath = join(tmpDir, 'key.pem');
    writeFileSync(filePath, `${PK_HEADER}\nMIIBog...\n-----END RSA PRIVATE KEY-----\n`, 'utf8');
    const findings = scanFile(filePath, DEFAULT_PATTERNS);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].pattern_name).toBe('Private Key Header');
  });

  it('detects generic API key assignments', () => {
    const filePath = join(tmpDir, 'config.js');
    const fakeApiKey = 'test_fake_abc123def456ghi789jkl012';
    writeFileSync(filePath, `const api_key = "${fakeApiKey}";\n`, 'utf8');
    const findings = scanFile(filePath, DEFAULT_PATTERNS);
    expect(findings.some(f => f.pattern_name === 'Generic API Key Assignment')).toBe(true);
  });

  it('detects generic secret/password assignments', () => {
    const filePath = join(tmpDir, 'config.js');
    writeFileSync(filePath, 'const password = "TestFakeP4ssword";\n', 'utf8');
    const findings = scanFile(filePath, DEFAULT_PATTERNS);
    expect(findings.some(f => f.pattern_name === 'Generic Secret Assignment')).toBe(true);
  });

  it('detects database connection strings', () => {
    const filePath = join(tmpDir, 'config.js');
    writeFileSync(filePath, 'const db = "mongodb://testuser:fakepw@localhost:27017/testdb";\n', 'utf8');
    const findings = scanFile(filePath, DEFAULT_PATTERNS);
    expect(findings.some(f => f.pattern_name === 'Database Connection String')).toBe(true);
  });

  it('redacts matched secrets in findings', () => {
    const filePath = join(tmpDir, 'config.js');
    const fakeKey = `${AWS_KEY_PREFIX}${AWS_KEY_SUFFIX}`;
    writeFileSync(filePath, `const key = "${fakeKey}";\n`, 'utf8');
    const findings = scanFile(filePath, DEFAULT_PATTERNS);
    expect(findings[0].match).toContain('****');
    expect(findings[0].match).not.toBe(fakeKey);
  });

  it('returns empty array for clean files', () => {
    const filePath = join(tmpDir, 'clean.js');
    writeFileSync(filePath, 'const x = 42;\nconsole.log("hello");\n', 'utf8');
    const findings = scanFile(filePath, DEFAULT_PATTERNS);
    expect(findings).toEqual([]);
  });

  it('returns empty array for non-existent files', () => {
    const findings = scanFile(join(tmpDir, 'nonexistent.js'), DEFAULT_PATTERNS);
    expect(findings).toEqual([]);
  });

  it('reports correct line numbers', () => {
    const filePath = join(tmpDir, 'multi.js');
    writeFileSync(filePath, `line1\nline2\nconst key = "${AWS_KEY_PREFIX}${AWS_KEY_SUFFIX}";\nline4\n`, 'utf8');
    const findings = scanFile(filePath, DEFAULT_PATTERNS);
    expect(findings[0].line).toBe(3);
  });
});

// ─── runSecretScan ────────────────────────────────────────────────────────────

describe('runSecretScan', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('-run');
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('scans multiple files and aggregates results', () => {
    const fakeKey = AWS_KEY_PREFIX + AWS_KEY_SUFFIX;
    writeFileSync(join(tmpDir, 'a.js'), `const key = "${fakeKey}";\n`, 'utf8');
    writeFileSync(join(tmpDir, 'b.js'), 'const x = 42;\n', 'utf8');

    const result = runSecretScan({
      files: ['a.js', 'b.js'],
      root: tmpDir
    });

    expect(result.files_scanned).toBe(2);
    expect(result.secrets_found).toBeGreaterThan(0);
    expect(result.pass).toBe(false);
    expect(result.critical).toBeGreaterThan(0);
  });

  it('passes when no secrets found', () => {
    writeFileSync(join(tmpDir, 'clean.js'), 'const x = 42;\n', 'utf8');

    const result = runSecretScan({
      files: ['clean.js'],
      root: tmpDir
    });

    expect(result.pass).toBe(true);
    expect(result.secrets_found).toBe(0);
  });

  it('skips non-existent files gracefully', () => {
    const result = runSecretScan({
      files: ['nonexistent.js'],
      root: tmpDir
    });

    expect(result.files_scanned).toBe(0);
    expect(result.pass).toBe(true);
  });

  it('respects allowlist', () => {
    const fakeKey = AWS_KEY_PREFIX + AWS_KEY_SUFFIX;
    writeFileSync(join(tmpDir, '.env.example'), `API_KEY="${fakeKey}"\n`, 'utf8');

    const result = runSecretScan({
      files: ['.env.example'],
      root: tmpDir,
      config: { allowlist: ['.env.example'] }
    });

    expect(result.files_scanned).toBe(0);
    expect(result.pass).toBe(true);
  });

  it('supports custom patterns', () => {
    writeFileSync(join(tmpDir, 'config.js'), 'const token = "CUSTOM_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345";\n', 'utf8');

    const result = runSecretScan({
      files: ['config.js'],
      root: tmpDir,
      config: {
        custom_patterns: [
          { name: 'Custom Token', pattern: 'CUSTOM_[A-Z0-9]{32}' }
        ]
      }
    });

    expect(result.secrets_found).toBeGreaterThan(0);
    expect(result.findings.some(f => f.pattern_name === 'Custom Token')).toBe(true);
  });

  it('returns correct structure for empty input', () => {
    const result = runSecretScan({});
    expect(result).toHaveProperty('files_scanned');
    expect(result).toHaveProperty('secrets_found');
    expect(result).toHaveProperty('findings');
    expect(result).toHaveProperty('pass');
    expect(result).toHaveProperty('critical');
    expect(result).toHaveProperty('high');
  });
});
