#!/usr/bin/env node

/**
 * registry.js — Module Registry for Jump Start Marketplace (Item 94).
 *
 * Validates module packaging, generates registry entries, and prepares
 * modules for publishing to a community registry.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Validate a module directory for marketplace readiness.
 *
 * @param {string} moduleDir - Path to the module directory.
 * @returns {{ valid: boolean, errors: string[], warnings: string[], entry: object|null }}
 */
export function validateForPublishing(moduleDir) {
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(moduleDir)) {
    return { valid: false, errors: ['Module directory does not exist'], warnings: [], entry: null };
  }

  // Check manifest
  const manifestPath = path.join(moduleDir, 'module.json');
  if (!fs.existsSync(manifestPath)) {
    return { valid: false, errors: ['Missing module.json manifest'], warnings: [], entry: null };
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    return { valid: false, errors: [`Invalid JSON in module.json: ${err.message}`], warnings: [], entry: null };
  }

  // Required fields
  if (!manifest.name) errors.push('Missing "name" in manifest');
  if (!manifest.version) errors.push('Missing "version" in manifest');
  if (!manifest.description) errors.push('Missing "description" in manifest');

  // Recommended fields
  if (!manifest.author) warnings.push('Missing "author" — recommended for marketplace');
  if (!manifest.license) warnings.push('Missing "license" — recommended for marketplace');
  if (!manifest.keywords || manifest.keywords.length === 0) warnings.push('Missing "keywords" — helps with discovery');

  // Validate referenced files exist
  for (const key of ['agents', 'templates', 'commands', 'checks', 'skills']) {
    if (manifest[key]) {
      for (const filePath of manifest[key]) {
        const fullPath = path.join(moduleDir, filePath);
        if (!fs.existsSync(fullPath)) {
          errors.push(`Referenced ${key} file not found: ${filePath}`);
        }
      }
    }
  }

  // Generate registry entry
  const entry = errors.length === 0 ? generateRegistryEntry(moduleDir, manifest) : null;

  return { valid: errors.length === 0, errors, warnings, entry };
}

/**
 * Generate a registry entry for a validated module.
 *
 * @param {string} moduleDir - Path to the module directory.
 * @param {object} manifest - Parsed module.json.
 * @returns {object} Registry entry.
 */
export function generateRegistryEntry(moduleDir, manifest) {
  // Compute content hash across all module files
  const files = collectFiles(moduleDir);
  const hash = crypto.createHash('sha256');
  for (const file of files) {
    hash.update(fs.readFileSync(file));
  }

  return {
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author || 'Unknown',
    license: manifest.license || 'UNLICENSED',
    keywords: manifest.keywords || [],
    file_count: files.length,
    content_hash: hash.digest('hex'),
    published_at: new Date().toISOString(),
    agents: (manifest.agents || []).length,
    templates: (manifest.templates || []).length,
    commands: (manifest.commands || []).length,
    checks: (manifest.checks || []).length,
    skills: (manifest.skills || []).length
  };
}

/**
 * Collect all files in a directory recursively.
 *
 * @param {string} dir - Directory to scan.
 * @returns {string[]} Array of file paths.
 */
function collectFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Load or initialize a registry index.
 * Supports both local module format ({ modules: [...] }) and
 * Skills marketplace format ({ items: [...] }).
 *
 * @param {string} registryPath - Path to the registry index file.
 * @returns {object} Registry index (normalized with both `modules` and `items` keys).
 */
export function loadRegistry(registryPath) {
  if (fs.existsSync(registryPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      return normalizeRegistryFormat(data);
    } catch (err) {
      return { modules: [], items: [], updated_at: new Date().toISOString() };
    }
  }
  return { modules: [], items: [], updated_at: new Date().toISOString() };
}

/**
 * Normalize a registry payload to contain both `modules` and `items` keys.
 * Detects Skills marketplace format (has `items[]`) vs local module format (has `modules[]`).
 *
 * @param {object} data - Raw parsed registry JSON.
 * @returns {object} Normalized registry with both keys.
 */
export function normalizeRegistryFormat(data) {
  const result = { ...data };
  if (Array.isArray(data.items) && !data.modules) {
    // Skills marketplace format — add empty modules for compat
    result.modules = [];
  }
  if (Array.isArray(data.modules) && !data.items) {
    // Local module format — add empty items for compat
    result.items = [];
  }
  if (!result.modules) result.modules = [];
  if (!result.items) result.items = [];
  if (!result.updated_at) result.updated_at = result.generatedAt || new Date().toISOString();
  return result;
}

/**
 * Add or update a module entry in the registry.
 *
 * @param {string} registryPath - Path to the registry index file.
 * @param {object} entry - Module registry entry.
 */
export function publishToRegistry(registryPath, entry) {
  const registry = loadRegistry(registryPath);

  // Update or add
  const idx = registry.modules.findIndex(m => m.name === entry.name);
  if (idx >= 0) {
    registry.modules[idx] = entry;
  } else {
    registry.modules.push(entry);
  }

  registry.updated_at = new Date().toISOString();

  const dir = path.dirname(registryPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');

  return registry;
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

if (process.argv[1] && process.argv[1].endsWith('registry.js')) {
  const moduleDir = process.argv[2];
  if (!moduleDir) {
    process.stderr.write('Usage: registry.js <module-dir>\n');
    process.exit(1);
  }
  const result = validateForPublishing(moduleDir);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
