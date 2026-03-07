/**
 * smoke-tester.js — Automated Smoke Testing
 *
 * Performs a "vitality" check on the application: attempts a build
 * and optionally starts the app to verify it responds (e.g., 200 OK
 * on a health route). Provides immediate feedback to the Developer
 * agent during Phase 4 implementation.
 *
 * Usage:
 *   echo '{"root":"."}' | node bin/lib/smoke-tester.js
 *
 * Input (stdin JSON):
 *   {
 *     "root": ".",
 *     "config": {
 *       "build_command": "npm run build",
 *       "start_command": "npm start",
 *       "health_url": "http://localhost:3000/health",
 *       "health_timeout": 10000,
 *       "skip_health_check": false
 *     }
 *   }
 *
 * Output (stdout JSON):
 *   {
 *     "build": { "pass": true, "command": "npm run build", "duration_ms": 3200 },
 *     "health": { "pass": true, "url": "http://localhost:3000/health", "status": 200 },
 *     "pass": true
 *   }
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const http = require('http');
const https = require('https');

/**
 * Detect the project's build command from package.json or common configs.
 *
 * @param {string} root - Project root path.
 * @returns {{ build: string|null, start: string|null, type: string }}
 */
function detectProjectCommands(root) {
  const result = { build: null, start: null, type: 'unknown' };

  // Check package.json
  const pkgPath = path.join(root, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      result.type = 'node';
      if (pkg.scripts) {
        if (pkg.scripts.build) result.build = 'npm run build';
        if (pkg.scripts.start) result.start = 'npm start';
        if (pkg.scripts.dev) result.start = result.start || 'npm run dev';
      }
    } catch {
      // ignore
    }
    return result;
  }

  // Check for Python projects
  if (fs.existsSync(path.join(root, 'pyproject.toml')) ||
      fs.existsSync(path.join(root, 'setup.py'))) {
    result.type = 'python';
    if (fs.existsSync(path.join(root, 'Makefile'))) {
      result.build = 'make build';
    }
    return result;
  }

  // Check for Go projects
  if (fs.existsSync(path.join(root, 'go.mod'))) {
    result.type = 'go';
    result.build = 'go build ./...';
    return result;
  }

  // Check Makefile as fallback
  if (fs.existsSync(path.join(root, 'Makefile'))) {
    result.build = 'make';
    return result;
  }

  return result;
}

/**
 * Run a build command and report results.
 *
 * @param {string} command - Build command to run.
 * @param {string} root - Project root path.
 * @returns {{ pass: boolean, command: string, duration_ms: number, output: string, exit_code: number }}
 */
function runBuild(command, root) {
  const start = Date.now();
  let output = '';
  let exitCode = 0;

  try {
    output = execSync(command, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000
    });
  } catch (err) {
    output = (err.stdout || '') + (err.stderr || '');
    exitCode = err.status || 1;
  }

  const duration = Date.now() - start;

  return {
    pass: exitCode === 0,
    command,
    duration_ms: duration,
    output: output.substring(0, 2000),
    exit_code: exitCode
  };
}

/**
 * Perform a health check by making an HTTP(S) GET request.
 *
 * @param {string} url - URL to check.
 * @param {number} timeout - Timeout in milliseconds.
 * @returns {Promise<{ pass: boolean, url: string, status: number|null, error: string|null }>}
 */
function checkHealth(url, timeout = 10000) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    let settled = false;
    const settle = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    let req;
    const timer = setTimeout(() => {
      if (req) { try { req.destroy(); } catch { /* ignore */ } }
      settle({ pass: false, url, status: null, error: 'Timeout' });
    }, timeout);

    try {
      req = client.get(url, (res) => {
        clearTimeout(timer);
        settle({
          pass: res.statusCode >= 200 && res.statusCode < 400,
          url,
          status: res.statusCode,
          error: null
        });
        res.resume();
      });

      req.on('error', (err) => {
        clearTimeout(timer);
        settle({ pass: false, url, status: null, error: err.message || err.code || 'Connection failed' });
      });
    } catch (err) {
      clearTimeout(timer);
      settle({ pass: false, url, status: null, error: err.message });
    }
  });
}

/**
 * Start a server process and wait for it to be ready.
 *
 * @param {string} command - Start command.
 * @param {string} root - Project root path.
 * @param {string} healthUrl - URL to check for readiness.
 * @param {number} timeout - Total timeout in milliseconds.
 * @returns {Promise<{ process: object|null, ready: boolean, error: string|null }>}
 */
function startAndWait(command, root, healthUrl, timeout = 15000) {
  return new Promise((resolve) => {
    const parts = command.split(' ');
    const proc = spawn(parts[0], parts.slice(1), {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false
    });

    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });

    const deadline = Date.now() + timeout;
    const pollInterval = 1000;

    const poll = async () => {
      if (Date.now() > deadline) {
        try { proc.kill(); } catch { /* ignore */ }
        resolve({ process: null, ready: false, error: 'Startup timeout exceeded' });
        return;
      }

      const health = await checkHealth(healthUrl, 2000);
      if (health.pass) {
        resolve({ process: proc, ready: true, error: null });
      } else {
        setTimeout(poll, pollInterval);
      }
    };

    proc.on('error', (err) => {
      resolve({ process: null, ready: false, error: err.message });
    });

    proc.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        resolve({ process: null, ready: false, error: `Process exited with code ${code}: ${stderr.substring(0, 500)}` });
      }
    });

    // Start polling after a brief delay
    setTimeout(poll, 1500);
  });
}

/**
 * Run the full smoke test suite.
 *
 * @param {object} input - Smoke test options.
 * @param {string} [input.root] - Project root.
 * @param {object} [input.config] - Override config.
 * @returns {Promise<object>} Smoke test results.
 */
async function runSmokeTest(input) {
  const { root = '.', config = {} } = input;
  const resolvedRoot = path.resolve(root);

  // Detect or use provided commands
  const detected = detectProjectCommands(resolvedRoot);
  const buildCommand = config.build_command || detected.build;
  const startCommand = config.start_command || detected.start;
  const healthUrl = config.health_url || 'http://localhost:3000/health';
  const healthTimeout = config.health_timeout || 10000;
  const skipHealthCheck = config.skip_health_check || false;

  const result = {
    project_type: detected.type,
    build: null,
    health: null,
    pass: true
  };

  // Step 1: Build
  if (buildCommand) {
    result.build = runBuild(buildCommand, resolvedRoot);
    if (!result.build.pass) {
      result.pass = false;
      return result;
    }
  } else {
    result.build = {
      pass: true,
      command: null,
      duration_ms: 0,
      output: 'No build command detected.',
      exit_code: 0
    };
  }

  // Step 2: Health check (optional)
  if (!skipHealthCheck && startCommand) {
    const startup = await startAndWait(startCommand, resolvedRoot, healthUrl, healthTimeout);

    if (startup.ready) {
      const health = await checkHealth(healthUrl, 5000);
      result.health = health;
      result.pass = result.pass && health.pass;
    } else {
      result.health = {
        pass: false,
        url: healthUrl,
        status: null,
        error: startup.error || 'Could not start server'
      };
      result.pass = false;
    }

    // Clean up server process
    if (startup.process) {
      try { startup.process.kill(); } catch { /* ignore */ }
    }
  } else {
    result.health = {
      pass: true,
      url: null,
      status: null,
      error: skipHealthCheck ? 'Health check skipped' : 'No start command detected'
    };
  }

  return result;
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

if (process.argv[1] && (
  process.argv[1].endsWith('smoke-tester.js') ||
  process.argv[1].endsWith('smoke-tester')
)) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    (async () => {
      try {
        const parsed = input.trim() ? JSON.parse(input) : {};
        const result = await runSmokeTest(parsed);
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        process.exit(result.pass ? 0 : 1);
      } catch (err) {
        process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
        process.exit(2);
      }
    })();
  });

  if (process.stdin.isTTY) {
    (async () => {
      const result = await runSmokeTest({});
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      process.exit(result.pass ? 0 : 1);
    })();
  }
}

export {
  runSmokeTest,
  detectProjectCommands,
  runBuild,
  checkHealth,
  startAndWait
};
