/**
 * install.js — Marketplace Item Installer for JumpStart-Mode.
 *
 * Agentic installation flow:
 *   1. Fetches registry index (URL from config.yaml → --registry flag → default)
 *   2. Matches by exact ID, type+name shorthand, or semantic query
 *   3. Resolves recursive dependencies (topological order, cycle detection)
 *   4. Downloads zip artifacts and verifies SHA256 checksums
 *   5. Extracts to primary targetPaths
 *   6. Auto-detects IDE (VS Code/Copilot vs Claude Code) and remaps
 *      contained agent/prompt files to the IDE-canonical directories
 *   7. Checks compatibility against framework version
 *   8. Tracks installed items in .jumpstart/installed.json for
 *      status / update / uninstall lifecycle management
 *
 * Supports skills, agents, prompts, and bundles.
 */

import { createRequire } from 'module';
import { loadConfig } from './config-loader.js';
import { applyIntegration } from './integrate.js';

const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createWriteStream, mkdirSync, rmSync, cpSync, copyFileSync } = fs;
const os = require('os');
const { execSync } = require('child_process');

const DEFAULT_REGISTRY_URL =
  'https://raw.githubusercontent.com/CGSOG-JumpStarts/JumpStart-Skills/main/registry/index.json';

const FRAMEWORK_VERSION = (() => {
  try {
    const pkgPath = path.resolve(
      path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/i, '$1')),
      '../../package.json'
    );
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || '0.0.0';
  } catch { return '0.0.0'; }
})();

// Type → default install directory under .jumpstart/
const TYPE_INSTALL_DIR = {
  skill: 'skills',
  agent: 'agents',
  prompt: 'prompts',
  bundle: 'bundles',
};

// Valid type keywords for the `install <type> <name>` shorthand
const VALID_TYPES = new Set(['skill', 'agent', 'prompt', 'bundle']);

// ─── Config Integration ─────────────────────────────────────────────────────

/**
 * Resolve the registry URL from (in priority order):
 *   1. options.registryUrl (explicit flag)
 *   2. config.yaml → skills.registry_url
 *   3. DEFAULT_REGISTRY_URL
 */
async function resolveRegistryUrl(options = {}) {
  if (options.registryUrl) return options.registryUrl;

  try {
    const root = options.projectRoot || process.cwd();
    const { config } = await loadConfig({ root });
    if (config?.skills?.registry_url) return config.skills.registry_url;
  } catch { /* config unavailable — use default */ }

  return DEFAULT_REGISTRY_URL;
}

// ─── IDE Auto-Detection ─────────────────────────────────────────────────────

/**
 * Detect which IDE/AI assistant is in use and return the canonical directory
 * conventions for agent and prompt files.
 *
 * Detection heuristic:
 *   - .github/ exists (or .github/copilot-instructions.md) → VS Code + Copilot
 *     → agents: .github/agents/   prompts: .github/prompts/
 *   - Otherwise → Claude Code / generic
 *     → agents: .jumpstart/agents/   prompts: .jumpstart/prompts/
 *
 * @param {string} projectRoot - Absolute path to the project root.
 * @returns {{ ide: string, agentDir: string, promptDir: string }}
 */
export function detectIDE(projectRoot) {
  const hasGitHub = fs.existsSync(path.join(projectRoot, '.github'));
  const hasCopilotInstructions = fs.existsSync(
    path.join(projectRoot, '.github', 'copilot-instructions.md')
  );
  const hasGitHubAgents = fs.existsSync(path.join(projectRoot, '.github', 'agents'));

  if (hasGitHub || hasCopilotInstructions || hasGitHubAgents) {
    return {
      ide: 'vscode-copilot',
      agentDir: '.github/agents',
      promptDir: '.github/prompts',
    };
  }

  return {
    ide: 'generic',
    agentDir: '.jumpstart/agents',
    promptDir: '.jumpstart/prompts',
  };
}

// ─── Registry Fetch ──────────────────────────────────────────────────────────

/**
 * Fetch the remote registry index.json.
 *
 * @param {string} [registryUrl] - URL to the registry index.
 * @returns {Promise<object>} Parsed registry index with `items[]`.
 */
export async function fetchRegistryIndex(registryUrl) {
  const url = registryUrl || DEFAULT_REGISTRY_URL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': `jumpstart-mode/${FRAMEWORK_VERSION}` },
    });

    if (!res.ok) {
      throw new Error(`Registry fetch failed: ${res.status} ${res.statusText} — ${url}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Item ID Normalization ───────────────────────────────────────────────────

/**
 * Normalize user input to a dotted item ID.
 * Supports:
 *   - "skill.ignition"       → "skill.ignition"   (pass-through)
 *   - "skill", "ignition"    → "skill.ignition"    (type + name)
 *   - "ignition"             → null                 (ambiguous — use search)
 *
 * @param {string} first  - First positional arg.
 * @param {string} [second] - Optional second positional arg.
 * @returns {string|null} Normalized item ID or null if ambiguous.
 */
export function normalizeItemId(first, second) {
  if (!first) return null;

  // Already a dotted ID?
  if (first.includes('.')) return first;

  // Two-part: type + name  (e.g. "skill" "ignition")
  if (second && VALID_TYPES.has(first.toLowerCase())) {
    return `${first.toLowerCase()}.${second}`;
  }

  // Single word that matches a type keyword — not an item ID
  if (VALID_TYPES.has(first.toLowerCase()) && !second) return null;

  // Single word that isn't a type — assume it's a name, try to resolve later
  return first;
}

// ─── Item Lookup ─────────────────────────────────────────────────────────────

/**
 * Find an item in the registry index by exact ID.
 *
 * @param {object} index - Parsed registry index.
 * @param {string} itemId - Marketplace item ID (e.g., "skill.ignition").
 * @returns {object|null} The matching item or null.
 */
export function findItem(index, itemId) {
  if (!index || !Array.isArray(index.items)) return null;
  return index.items.find((item) => item.id === itemId) || null;
}

/**
 * Find an item by bare name (tries all type prefixes).
 *
 * @param {object} index - Parsed registry index.
 * @param {string} name  - Bare name (e.g., "ignition").
 * @returns {object|null} First matching item or null.
 */
export function findItemByName(index, name) {
  if (!index || !Array.isArray(index.items)) return null;
  const lower = name.toLowerCase();
  // Try exact id match first
  const exact = index.items.find((i) => i.id === lower);
  if (exact) return exact;
  // Try each type prefix
  for (const type of VALID_TYPES) {
    const item = index.items.find((i) => i.id === `${type}.${lower}`);
    if (item) return item;
  }
  // Try displayName match
  return index.items.find(
    (i) => i.displayName && i.displayName.toLowerCase() === lower
  ) || null;
}

/**
 * Search the registry for items matching a query string.
 *
 * @param {object} index - Parsed registry index.
 * @param {string} query - Search term.
 * @returns {object[]} Matching items, scored by relevance.
 */
export function searchItems(index, query) {
  if (!index || !Array.isArray(index.items)) return [];
  const q = query.toLowerCase();
  return index.items
    .map((item) => {
      const fields = [
        item.id,
        item.displayName,
        item.category,
        item.description,
        item.searchText,
        ...(item.tags || []),
        ...(item.keywords || []),
      ].filter(Boolean).map((s) => s.toLowerCase());

      let score = 0;
      for (const f of fields) {
        if (f === q) score += 10;          // exact match
        else if (f.startsWith(q)) score += 5;  // prefix match
        else if (f.includes(q)) score += 2;    // substring match
      }
      return { item, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
}

// ─── Compatibility Checking ─────────────────────────────────────────────────

/**
 * Check if an item is compatible with this framework version.
 * Returns warnings (does not block installation).
 *
 * @param {object} item - Registry item.
 * @returns {{ compatible: boolean, warnings: string[] }}
 */
export function checkCompatibility(item) {
  const warnings = [];
  const compat = item.compatibility || {};

  if (compat.jumpstartMode) {
    const range = compat.jumpstartMode;
    // Basic semver range check: supports ">=X.Y.Z"
    const match = range.match(/^>=\s*(\d+\.\d+\.\d+)$/);
    if (match) {
      const minVersion = match[1];
      if (compareSemver(FRAMEWORK_VERSION, minVersion) < 0) {
        warnings.push(
          `Requires jumpstart-mode ${range} but found ${FRAMEWORK_VERSION}.`
        );
      }
    }
  }

  if (compat.tools && Array.isArray(compat.tools)) {
    // Informational — we can't check tool availability here
    // but we surface the requirement
  }

  return { compatible: warnings.length === 0, warnings };
}

/** Compare two semver strings. Returns <0, 0, or >0. */
function compareSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

// ─── Install Tracking ───────────────────────────────────────────────────────

const INSTALLED_FILE = '.jumpstart/installed.json';

/**
 * Read the local installed-items ledger.
 * @param {string} projectRoot
 * @returns {object} { items: { [id]: { version, installedAt, targetPaths, remappedFiles } } }
 */
export function readInstalled(projectRoot) {
  const fp = path.join(projectRoot, INSTALLED_FILE);
  if (!fs.existsSync(fp)) return { items: {} };
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch { return { items: {} }; }
}

/**
 * Write the installed-items ledger.
 * @param {string} projectRoot
 * @param {object} data
 */
export function writeInstalled(projectRoot, data) {
  const fp = path.join(projectRoot, INSTALLED_FILE);
  mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * Record a successful installation.
 */
function recordInstall(projectRoot, item, targetPaths, remappedFiles = []) {
  const data = readInstalled(projectRoot);
  data.items[item.id] = {
    version: item.version,
    displayName: item.displayName,
    type: item.type,
    installedAt: new Date().toISOString(),
    targetPaths,
    remappedFiles,
    // Persist registry keywords+tags for offline skill-index generation
    keywords: [...(item.keywords || []), ...(item.tags || [])].filter(
      (v, i, a) => a.indexOf(v) === i
    ),
  };
  writeInstalled(projectRoot, data);
}

/**
 * Check if an item is already installed at the current or newer version.
 */
export function isInstalled(itemId, projectRoot) {
  const data = readInstalled(projectRoot);
  return data.items[itemId] || null;
}

// ─── Download & Verify ───────────────────────────────────────────────────────

/**
 * Download a zip file and verify its SHA256 checksum.
 *
 * @param {string} downloadUrl - URL of the zip artifact.
 * @param {string} expectedSha256 - Expected SHA256 hex digest.
 * @returns {Promise<string>} Path to the verified temp file.
 */
export async function downloadAndVerify(downloadUrl, expectedSha256) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumpstart-install-'));
  const tmpFile = path.join(tmpDir, 'package.zip');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const res = await fetch(downloadUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': `jumpstart-mode/${FRAMEWORK_VERSION}` },
    });

    if (!res.ok) {
      throw new Error(`Download failed: ${res.status} ${res.statusText} — ${downloadUrl}`);
    }

    // Stream to file and compute hash simultaneously
    const hash = crypto.createHash('sha256');
    const fileStream = createWriteStream(tmpFile);
    const reader = res.body.getReader();
    let done = false;

    while (!done) {
      const { value, done: streamDone } = await reader.read();
      done = streamDone;
      if (value) {
        hash.update(value);
        fileStream.write(Buffer.from(value));
      }
    }

    await new Promise((resolve, reject) => {
      fileStream.end(() => resolve());
      fileStream.on('error', reject);
    });

    const actualHash = hash.digest('hex');
    if (expectedSha256 && actualHash !== expectedSha256) {
      rmSync(tmpDir, { recursive: true, force: true });
      throw new Error(
        `Checksum mismatch!\n  Expected: ${expectedSha256}\n  Actual:   ${actualHash}\n  File may be corrupted or tampered with.`
      );
    }

    return tmpFile;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Extraction & File Remapping ─────────────────────────────────────────────

/**
 * Extract a zip to a temporary staging directory.
 * @param {string} zipPath
 * @returns {string} Path to the staging directory.
 */
function extractToStaging(zipPath) {
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumpstart-stage-'));
  try {
    if (process.platform === 'win32') {
      execSync(
        `PowerShell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${stagingDir}' -Force"`,
        { stdio: 'pipe', timeout: 60_000 }
      );
    } else {
      execSync(`unzip -o "${zipPath}" -d "${stagingDir}"`, {
        stdio: 'pipe',
        timeout: 60_000,
      });
    }
  } catch (err) {
    rmSync(stagingDir, { recursive: true, force: true });
    throw new Error(`Extraction failed: ${err.message}`);
  }
  return stagingDir;
}

/**
 * Walk a directory recursively, returning all file paths relative to root.
 */
function walkDir(dir, root = dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(full, root));
    } else {
      files.push(path.relative(root, full));
    }
  }
  return files;
}

/**
 * Copy the entire staging directory to the primary target paths,
 * then remap agent/prompt files to the IDE-canonical directories.
 *
 * @param {string} stagingDir - Extracted staging directory.
 * @param {string[]} targetPaths - Relative target directories.
 * @param {string} projectRoot - Project root.
 * @param {object} item - Registry item (for contains metadata).
 * @param {{ agentDir: string, promptDir: string }} idePaths - IDE-detected dirs.
 * @returns {{ extracted: string[], fileCount: number, remappedFiles: string[] }}
 */
function installFromStaging(stagingDir, targetPaths, projectRoot, item, idePaths) {
  const extracted = [];
  const remappedFiles = [];
  let fileCount = 0;

  // Determine the actual content root inside staging —
  // zip may contain a single top-level directory
  let contentRoot = stagingDir;
  const stagingEntries = fs.readdirSync(stagingDir, { withFileTypes: true });
  if (
    stagingEntries.length === 1 &&
    stagingEntries[0].isDirectory()
  ) {
    // Single-folder zip — use its contents
    contentRoot = path.join(stagingDir, stagingEntries[0].name);
  }

  // Copy to each primary target path
  for (const targetRel of targetPaths) {
    const targetAbs = path.resolve(projectRoot, targetRel);
    mkdirSync(targetAbs, { recursive: true });
    cpSync(contentRoot, targetAbs, { recursive: true, force: true });

    const files = walkDir(targetAbs);
    fileCount += files.length;
    extracted.push(targetAbs);
  }

  // ── Remap contained agent/prompt files to IDE-canonical locations ────────
  // The "contains" block in the registry entry lists relative paths like:
  //   ".github/agents/content-coach.agent.md"
  //   ".github/prompts/create-presentation.prompt.md"
  // These need to be copied OUT of the skill's install dir and INTO the
  // IDE-canonical agent/prompt directories at the workspace root.

  const contains = item.contains || {};

  // Remap agents
  if (Array.isArray(contains.agents)) {
    const destDir = path.resolve(projectRoot, idePaths.agentDir);
    mkdirSync(destDir, { recursive: true });

    for (const agentRelPath of contains.agents) {
      // Try to find the file in the first extracted target
      const primaryTarget = extracted[0];
      if (!primaryTarget) continue;

      const srcFile = path.join(primaryTarget, agentRelPath);
      if (!fs.existsSync(srcFile)) continue;

      const basename = path.basename(agentRelPath);
      const destFile = path.join(destDir, basename);
      copyFileSync(srcFile, destFile);
      remappedFiles.push(path.relative(projectRoot, destFile));
    }
  }

  // Remap prompts
  if (Array.isArray(contains.prompts)) {
    const destDir = path.resolve(projectRoot, idePaths.promptDir);
    mkdirSync(destDir, { recursive: true });

    for (const promptRelPath of contains.prompts) {
      const primaryTarget = extracted[0];
      if (!primaryTarget) continue;

      const srcFile = path.join(primaryTarget, promptRelPath);
      if (!fs.existsSync(srcFile)) continue;

      const basename = path.basename(promptRelPath);
      const destFile = path.join(destDir, basename);
      copyFileSync(srcFile, destFile);
      remappedFiles.push(path.relative(projectRoot, destFile));
    }
  }

  return { extracted, fileCount, remappedFiles };
}

// ─── Target Path Resolution ─────────────────────────────────────────────────

/**
 * Resolve install target paths for an item.
 * Uses item.install.targetPaths if present, otherwise derives from type + name.
 *
 * @param {object} item - Registry item.
 * @returns {string[]} Relative target paths.
 */
export function resolveTargetPaths(item) {
  if (item.install && Array.isArray(item.install.targetPaths) && item.install.targetPaths.length > 0) {
    return item.install.targetPaths;
  }

  const typeDir = TYPE_INSTALL_DIR[item.type] || 'skills';
  const name = item.id.split('.').slice(1).join('.');
  return [`.jumpstart/${typeDir}/${name}`];
}

// ─── Dependency Resolution ──────────────────────────────────────────────────

/**
 * Build a topologically-sorted install order including all transitive
 * dependencies. Detects and rejects circular dependency chains.
 *
 * @param {string} rootId - The item the user requested.
 * @param {object} index  - Registry index.
 * @param {string} projectRoot - For checking already-installed items.
 * @param {object} [opts]
 * @param {boolean} [opts.force=false] - Re-install even if already present.
 * @returns {{ order: string[], skipped: string[], warnings: string[] }}
 */
export function resolveDependencies(rootId, index, projectRoot, opts = {}) {
  const force = opts.force || false;
  const order = [];       // topological install order
  const skipped = [];     // already installed
  const warnings = [];
  const visiting = new Set(); // cycle detection (gray nodes)
  const visited = new Set();  // fully processed (black nodes)

  function visit(itemId) {
    if (visited.has(itemId)) return;
    if (visiting.has(itemId)) {
      warnings.push(`Circular dependency detected: ${itemId}`);
      return;
    }

    visiting.add(itemId);

    const item = findItem(index, itemId);
    if (!item) {
      warnings.push(`Dependency "${itemId}" not found in registry — skipping.`);
      visiting.delete(itemId);
      visited.add(itemId);
      return;
    }

    // Recurse into dependencies
    const deps = item.dependencies || [];
    for (const depId of deps) {
      visit(depId);
    }

    visiting.delete(itemId);
    visited.add(itemId);

    // Check if already installed
    if (!force && isInstalled(itemId, projectRoot)) {
      skipped.push(itemId);
    } else {
      order.push(itemId);
    }
  }

  visit(rootId);
  return { order, skipped, warnings };
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

/**
 * Install a single marketplace item by ID.
 *
 * @param {string} itemId - Item ID (e.g., "skill.ignition").
 * @param {object} options
 * @param {string}  [options.registryUrl]  - Registry URL override.
 * @param {string}  [options.projectRoot]  - Project root (default: cwd).
 * @param {object}  [options.index]        - Pre-fetched registry index.
 * @param {boolean} [options.force=false]  - Re-install even if present.
 * @param {boolean} [options.dryRun=false] - Print what would happen, don't install.
 * @param {boolean} [options.skipDeps]     - Skip dependency resolution.
 * @param {Function} [options.onProgress]  - Progress callback(msg).
 * @returns {Promise<{ installed: string[], fileCount: number, item: object, remappedFiles: string[] }>}
 */
export async function installItem(itemId, options = {}) {
  const registryUrl = await resolveRegistryUrl(options);
  const projectRoot = options.projectRoot || process.cwd();
  const force = options.force || false;
  const dryRun = options.dryRun || false;
  const progress = options.onProgress || (() => {});
  const index = options.index || (await fetchRegistryIndex(registryUrl));

  const item = findItem(index, itemId);
  if (!item) {
    // Try bare-name lookup
    const byName = findItemByName(index, itemId);
    if (byName) {
      return installItem(byName.id, { ...options, index });
    }
    throw new Error(
      `Item "${itemId}" not found in registry.\n` +
        `  Registry: ${registryUrl}\n` +
        `  Hint: try  jumpstart-mode install --search ${itemId}`
    );
  }

  // Already installed?
  if (!force) {
    const existing = isInstalled(item.id, projectRoot);
    if (existing && compareSemver(existing.version, item.version) >= 0) {
      progress(`${item.id} v${existing.version} is already installed — skipping.`);
      return {
        installed: existing.targetPaths || [],
        fileCount: 0,
        item,
        remappedFiles: existing.remappedFiles || [],
        skipped: true,
      };
    }
  }

  // Compatibility check (warn only)
  const compat = checkCompatibility(item);
  for (const w of compat.warnings) progress(`⚠ ${w}`);

  if (!item.download || !item.download.zip) {
    throw new Error(
      `Item "${itemId}" has no download URL. It may not be packaged yet.`
    );
  }

  if (dryRun) {
    const targetPaths = resolveTargetPaths(item);
    const ide = detectIDE(projectRoot);
    return {
      installed: targetPaths,
      fileCount: 0,
      item,
      remappedFiles: [],
      dryRun: true,
      ide: ide.ide,
    };
  }

  // Download and verify
  progress(`Downloading ${item.id} v${item.version}...`);
  const zipPath = await downloadAndVerify(
    item.download.zip,
    item.download.checksumSha256
  );

  let result;
  try {
    // Extract to staging
    progress('Verifying checksum & extracting...');
    const stagingDir = extractToStaging(zipPath);

    try {
      const targetPaths = resolveTargetPaths(item);
      const ide = detectIDE(projectRoot);

      result = installFromStaging(stagingDir, targetPaths, projectRoot, item, ide);
      result.item = item;
      result.ide = ide.ide;

      // Record in installed.json
      recordInstall(projectRoot, item, targetPaths, result.remappedFiles);

      progress(`✓ Installed ${item.id} v${item.version}`);
      if (result.remappedFiles.length > 0) {
        progress(`  Remapped ${result.remappedFiles.length} file(s) to ${ide.agentDir}`);
      }

      // Auto-integrate: regenerate IDE instructions and skill index
      try {
        if (item.type === 'skill' || item.type === 'bundle') {
          progress('Rebuilding skill integration...');
          applyIntegration(projectRoot, { onProgress: progress });
        }
      } catch (err) {
        progress(`⚠ Integration update failed (non-fatal): ${err.message}`);
      }
    } finally {
      rmSync(stagingDir, { recursive: true, force: true });
    }
  } finally {
    try {
      rmSync(path.dirname(zipPath), { recursive: true, force: true });
    } catch { /* best-effort cleanup */ }
  }

  return result;
}

/**
 * Install a bundle and all its member items.
 *
 * @param {string} bundleId - Bundle item ID.
 * @param {object} options  - Same as installItem options.
 * @returns {Promise<{ bundleId: string, installed: object[] }>}
 */
export async function installBundle(bundleId, options = {}) {
  const registryUrl = await resolveRegistryUrl(options);
  const projectRoot = options.projectRoot || process.cwd();
  const index = options.index || (await fetchRegistryIndex(registryUrl));

  const bundle = findItem(index, bundleId);
  if (!bundle) throw new Error(`Bundle "${bundleId}" not found in registry.`);
  if (bundle.type !== 'bundle') {
    throw new Error(`"${bundleId}" is a ${bundle.type}, not a bundle.`);
  }

  const includes = bundle.includes || [];
  if (includes.length === 0) {
    const result = await installItem(bundleId, { ...options, index });
    return { bundleId, installed: [result] };
  }

  const installed = [];
  for (const memberId of includes) {
    try {
      const result = await installItem(memberId, { ...options, index });
      installed.push(result);
    } catch (err) {
      installed.push({ item: { id: memberId }, error: err.message });
    }
  }

  return { bundleId, installed };
}

/**
 * Top-level install dispatcher.
 *
 * Full agentic flow:
 *   1. Fetch registry index
 *   2. Resolve item + dependencies
 *   3. Install in topological order
 *   4. Remap agent/prompt files per IDE convention
 *   5. Record everything in installed.json
 *
 * @param {string} itemId  - Item ID or bare name.
 * @param {object} options - Install options.
 * @returns {Promise<object>} Installation result.
 */
export async function install(itemId, options = {}) {
  const registryUrl = await resolveRegistryUrl(options);
  const projectRoot = options.projectRoot || process.cwd();
  const index = options.index || (await fetchRegistryIndex(registryUrl));
  const progress = options.onProgress || (() => {});

  // Resolve item ID (support bare names)
  let item = findItem(index, itemId);
  if (!item) item = findItemByName(index, itemId);
  if (!item) {
    throw new Error(
      `Item "${itemId}" not found in registry.\n` +
        `  Hint: try  jumpstart-mode install --search ${itemId}`
    );
  }

  // Bundle?
  if (item.type === 'bundle') {
    return installBundle(item.id, { ...options, index, registryUrl });
  }

  // Dependency resolution (unless skipped)
  if (!options.skipDeps) {
    const { order, skipped, warnings } = resolveDependencies(
      item.id, index, projectRoot, { force: options.force }
    );

    for (const w of warnings) progress(`⚠ ${w}`);
    for (const s of skipped) progress(`  ${s} already installed — skipping.`);

    // Install dependencies first, then the requested item
    const allResults = [];
    for (const depId of order) {
      const result = await installItem(depId, {
        ...options,
        index,
        registryUrl,
        skipDeps: true, // deps already resolved
      });
      allResults.push(result);
    }

    // Return the last result (the requested item) with dep info
    const primaryResult = allResults.find((r) => r.item?.id === item.id) ||
      allResults[allResults.length - 1];
    if (allResults.length > 1) {
      primaryResult.dependenciesInstalled = allResults
        .filter((r) => r.item?.id !== item.id)
        .map((r) => r.item?.id);
    }
    return primaryResult;
  }

  return installItem(item.id, { ...options, index, registryUrl });
}

// ─── Lifecycle: Status / Uninstall / Update ─────────────────────────────────

/**
 * Get the status of all installed marketplace items.
 *
 * @param {string} projectRoot
 * @returns {object} { items: { [id]: {...} }, count: number }
 */
export function getStatus(projectRoot) {
  const data = readInstalled(projectRoot);
  const items = data.items || {};
  return { items, count: Object.keys(items).length };
}

/**
 * Uninstall a marketplace item and its remapped files.
 *
 * @param {string} itemId
 * @param {string} projectRoot
 * @returns {{ removed: string[], success: boolean }}
 */
export function uninstallItem(itemId, projectRoot) {
  const data = readInstalled(projectRoot);
  const entry = data.items[itemId];
  if (!entry) {
    throw new Error(`"${itemId}" is not installed.`);
  }

  const removed = [];

  // Remove primary target paths
  for (const tp of entry.targetPaths || []) {
    const abs = path.resolve(projectRoot, tp);
    if (fs.existsSync(abs)) {
      rmSync(abs, { recursive: true, force: true });
      removed.push(tp);
    }
  }

  // Remove remapped files (agents/prompts copied to IDE dirs)
  for (const rf of entry.remappedFiles || []) {
    const abs = path.resolve(projectRoot, rf);
    if (fs.existsSync(abs)) {
      rmSync(abs, { force: true });
      removed.push(rf);
    }
  }

  // Remove from ledger
  const wasSkill = entry.type === 'skill' || entry.type === 'bundle';
  delete data.items[itemId];
  writeInstalled(projectRoot, data);

  // Re-integrate: regenerate IDE instructions and skill index without this skill
  if (wasSkill) {
    try {
      applyIntegration(projectRoot);
    } catch { /* non-fatal */ }
  }

  return { removed, success: true };
}

/**
 * Check for available updates by comparing local vs registry versions.
 *
 * @param {string} projectRoot
 * @param {object} index - Registry index.
 * @returns {{ updates: Array<{ id, localVersion, registryVersion }>, upToDate: string[] }}
 */
export function checkUpdates(projectRoot, index) {
  const data = readInstalled(projectRoot);
  const updates = [];
  const upToDate = [];

  for (const [id, entry] of Object.entries(data.items || {})) {
    const registryItem = findItem(index, id);
    if (!registryItem) continue;
    if (compareSemver(registryItem.version, entry.version) > 0) {
      updates.push({
        id,
        localVersion: entry.version,
        registryVersion: registryItem.version,
      });
    } else {
      upToDate.push(id);
    }
  }

  return { updates, upToDate };
}

/**
 * Update one or all installed items to the latest registry version.
 *
 * @param {string|null} itemId - Specific item or null for all.
 * @param {object} options - Install options.
 * @returns {Promise<object[]>} Updated items.
 */
export async function updateItems(itemId, options = {}) {
  const registryUrl = await resolveRegistryUrl(options);
  const projectRoot = options.projectRoot || process.cwd();
  const index = options.index || (await fetchRegistryIndex(registryUrl));
  const progress = options.onProgress || (() => {});

  const { updates } = checkUpdates(projectRoot, index);
  const toUpdate = itemId
    ? updates.filter((u) => u.id === itemId)
    : updates;

  if (toUpdate.length === 0) {
    progress('Everything is up to date.');
    return [];
  }

  const results = [];
  for (const u of toUpdate) {
    progress(`Updating ${u.id}: ${u.localVersion} → ${u.registryVersion}`);
    const result = await installItem(u.id, {
      ...options,
      index,
      registryUrl,
      force: true,
    });
    results.push(result);
  }

  return results;
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

if (process.argv[1] && process.argv[1].endsWith('install.js')) {
  const first = process.argv[2];
  const second = process.argv[3];
  const itemId = normalizeItemId(first, second);

  if (!itemId) {
    process.stderr.write('Usage: install.js <item-id> [--registry <url>]\n');
    process.stderr.write('       install.js <type> <name>\n');
    process.stderr.write('Example: install.js skill.ignition\n');
    process.stderr.write('         install.js skill ignition\n');
    process.exit(1);
  }

  const registryIdx = process.argv.indexOf('--registry');
  const registryUrl = registryIdx >= 0 ? process.argv[registryIdx + 1] : undefined;
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');

  install(itemId, {
    registryUrl,
    dryRun,
    force,
    onProgress: (msg) => process.stderr.write(msg + '\n'),
  })
    .then((result) => {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    })
    .catch((err) => {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    });
}
