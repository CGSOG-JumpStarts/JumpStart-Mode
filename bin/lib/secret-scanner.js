/**
 * secret-scanner.js — Secret Scanning for Agents
 *
 * Scans files for accidentally committed secrets (API keys, tokens,
 * passwords, private keys). Prevents sensitive data from reaching
 * source control.
 *
 * Usage:
 *   echo '{"files":["src/config.js"],"root":"."}' | node bin/lib/secret-scanner.js
 *
 * Input (stdin JSON):
 *   {
 *     "files": ["src/config.js", "src/utils.ts"],
 *     "root": ".",
 *     "config": {
 *       "custom_patterns": [{ "name": "Custom Token", "pattern": "CUSTOM_[A-Z0-9]{32}" }],
 *       "allowlist": [".env.example"]
 *     }
 *   }
 *
 * Output (stdout JSON):
 *   {
 *     "files_scanned": 2,
 *     "secrets_found": 1,
 *     "findings": [...],
 *     "pass": false
 *   }
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');

/**
 * Built-in secret patterns to detect.
 * Each has a name, a regex pattern, and a severity level.
 */
const DEFAULT_PATTERNS = [
  {
    name: 'AWS Access Key',
    pattern: /(?<![A-Za-z0-9/+=])(AKIA[0-9A-Z]{16})(?![A-Za-z0-9/+=])/,
    severity: 'critical'
  },
  {
    name: 'AWS Secret Key',
    pattern: /(?<![A-Za-z0-9/+=])([A-Za-z0-9/+=]{40})(?![A-Za-z0-9/+=])/,
    severity: 'critical',
    requires_context: /aws_secret|secret_access_key|AWS_SECRET/i
  },
  {
    name: 'GitHub Token',
    pattern: /(?<![A-Za-z0-9_])(gh[ps]_[A-Za-z0-9_]{36,})(?![A-Za-z0-9_])/,
    severity: 'critical'
  },
  {
    name: 'GitHub Fine-grained PAT',
    pattern: /(?<![A-Za-z0-9_])(github_pat_[A-Za-z0-9_]{22,})(?![A-Za-z0-9_])/,
    severity: 'critical'
  },
  {
    name: 'Generic API Key Assignment',
    pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["']([A-Za-z0-9_\-]{20,})["']/i,
    severity: 'high'
  },
  {
    name: 'Generic Secret Assignment',
    pattern: /(?:secret|password|passwd|pwd)\s*[:=]\s*["']([^\s"']{8,})["']/i,
    severity: 'high'
  },
  {
    name: 'Generic Token Assignment',
    pattern: /(?:token|auth_token|access_token)\s*[:=]\s*["']([A-Za-z0-9_\-.]{20,})["']/i,
    severity: 'high'
  },
  {
    name: 'Private Key Header',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
    severity: 'critical'
  },
  {
    name: 'Slack Webhook',
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/,
    severity: 'high'
  },
  {
    name: 'Slack Bot Token',
    pattern: /(?<![A-Za-z0-9_-])(xoxb-[0-9]{10,}-[0-9]{10,}-[A-Za-z0-9]{24,})(?![A-Za-z0-9_-])/,
    severity: 'critical'
  },
  {
    name: 'Database Connection String',
    pattern: /(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/[^\s"'<>]{10,}/i,
    severity: 'high'
  },
  {
    name: 'Bearer Token',
    pattern: /(?:Authorization|Bearer)\s*[:=]\s*["']?Bearer\s+[A-Za-z0-9_\-.]{20,}/i,
    severity: 'high'
  }
];

/**
 * Files/directories to skip by default.
 */
const DEFAULT_SKIP = [
  'node_modules', '.git', 'dist', 'build', 'coverage',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'
];

/**
 * File extensions typically safe to skip (binary/media).
 */
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.zip', '.tar', '.gz', '.bz2',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.mp3', '.mp4', '.avi', '.mov', '.wav'
]);

/**
 * Compile custom pattern strings into RegExp objects.
 *
 * @param {Array<{ name: string, pattern: string }>} customPatterns
 * @returns {Array<{ name: string, pattern: RegExp, severity: string }>}
 */
function compileCustomPatterns(customPatterns) {
  return (customPatterns || []).map(p => {
    // Basic safeguard: reject patterns exceeding a reasonable length
    if (typeof p.pattern === 'string' && p.pattern.length > 500) {
      return null;
    }
    let regex;
    try {
      regex = new RegExp(p.pattern);
    } catch {
      return null;
    }
    return {
      name: p.name || 'Custom Pattern',
      pattern: regex,
      severity: p.severity || 'high'
    };
  }).filter(Boolean);
}

/**
 * Check if a file path should be skipped.
 *
 * @param {string} filePath - File path to check.
 * @param {string[]} allowlist - Paths to allowlist.
 * @returns {boolean}
 */
function shouldSkip(filePath, allowlist = []) {
  const basename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (BINARY_EXTENSIONS.has(ext)) return true;

  // Match skip entries against path segments to avoid false positives
  // (e.g. "build" should not match "rebuild" or "buildUtils.js")
  const segments = filePath.split(path.sep).flatMap(s => s.split('/'));
  for (const skip of DEFAULT_SKIP) {
    if (segments.includes(skip)) return true;
  }

  for (const allowed of allowlist) {
    if (filePath === allowed || filePath.endsWith(allowed) || basename === allowed) {
      return true;
    }
  }

  return false;
}

/**
 * Scan a single file for secrets.
 *
 * @param {string} filePath - Absolute path to file.
 * @param {Array} patterns - Secret patterns to check against.
 * @returns {Array<{ file: string, line: number, pattern_name: string, severity: string, match: string }>}
 */
function scanFile(filePath, patterns) {
  const findings = [];

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return findings;
  }

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comment lines that are example/template patterns
    if (/^\s*(#|\/\/)\s*(example|TODO|FIXME|NOTE)/i.test(line)) continue;

    for (const patternDef of patterns) {
      // If pattern requires context (e.g. AWS secret key), check for context first
      if (patternDef.requires_context && !patternDef.requires_context.test(line)) {
        continue;
      }

      const match = line.match(patternDef.pattern);
      if (match) {
        const matched = match[1] || match[0];
        // Redact the match for safe reporting
        const redacted = matched.length > 8
          ? matched.substring(0, 4) + '****' + matched.substring(matched.length - 4)
          : '****';

        findings.push({
          file: filePath,
          line: i + 1,
          pattern_name: patternDef.name,
          severity: patternDef.severity,
          match: redacted
        });
      }
    }
  }

  return findings;
}

/**
 * Run secret scanning on specified files.
 *
 * @param {object} input - Scan options.
 * @param {string[]} input.files - Files to scan.
 * @param {string} [input.root] - Project root.
 * @param {object} [input.config] - Override config.
 * @param {Array} [input.config.custom_patterns] - Additional patterns.
 * @param {string[]} [input.config.allowlist] - Files to skip.
 * @returns {object} Scan results.
 */
function runSecretScan(input) {
  const { files = [], root = '.', config = {} } = input;
  const resolvedRoot = path.resolve(root);
  const allowlist = config.allowlist || [];

  // Merge default + custom patterns
  const patterns = [
    ...DEFAULT_PATTERNS,
    ...compileCustomPatterns(config.custom_patterns)
  ];

  const allFindings = [];
  let filesScanned = 0;

  for (const file of files) {
    const fullPath = path.isAbsolute(file) ? file : path.join(resolvedRoot, file);

    if (!fs.existsSync(fullPath)) continue;
    if (shouldSkip(file, allowlist)) continue;

    filesScanned++;
    const fileFindings = scanFile(fullPath, patterns);
    allFindings.push(...fileFindings);
  }

  // Group by severity for summary
  const critical = allFindings.filter(f => f.severity === 'critical').length;
  const high = allFindings.filter(f => f.severity === 'high').length;

  return {
    files_scanned: filesScanned,
    secrets_found: allFindings.length,
    critical,
    high,
    findings: allFindings,
    pass: allFindings.length === 0
  };
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

if (process.argv[1] && (
  process.argv[1].endsWith('secret-scanner.js') ||
  process.argv[1].endsWith('secret-scanner')
)) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const parsed = input.trim() ? JSON.parse(input) : {};
      const result = runSecretScan(parsed);
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      process.exit(result.pass ? 0 : 1);
    } catch (err) {
      process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
      process.exit(2);
    }
  });

  if (process.stdin.isTTY) {
    const result = runSecretScan({});
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(result.pass ? 0 : 1);
  }
}

export {
  runSecretScan,
  scanFile,
  shouldSkip,
  compileCustomPatterns,
  DEFAULT_PATTERNS
};
