#!/usr/bin/env node
/**
 * sync-agent-data.js
 *
 * Parses docs/agent-access-reference.md and patches the AGENT_DATA array
 * in docs_site/src/components/AgentCards.tsx so that each agent's
 * `templates` and `subagents` arrays match the markdown source of truth.
 *
 * Usage:
 *   node scripts/sync-agent-data.js            # write changes
 *   node scripts/sync-agent-data.js --dry-run   # preview without writing
 *
 * Zero external dependencies — uses only Node.js builtins.
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Paths (relative to this script's location inside docs_site/scripts/)
// ---------------------------------------------------------------------------
const SCRIPT_DIR = __dirname;
const DOCS_SITE_DIR = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(DOCS_SITE_DIR, '..');
const MD_PATH = path.join(REPO_ROOT, 'docs', 'agent-access-reference.md');
const TSX_PATH = path.join(DOCS_SITE_DIR, 'src', 'components', 'AgentCards.tsx');

const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Name mapping: markdown table name → TSX `name` field
// The markdown uses short names in bold (e.g. **QA**), while the TSX may
// use longer display names (e.g. "Quality Assurance").
// Only entries that differ need to be listed here.
// ---------------------------------------------------------------------------
const MD_NAME_TO_TSX_NAME = {
  'QA': 'Quality Assurance',
  'PM': 'Product Manager',
  'Quick Dev': 'Quick Dev',
};

// Reverse lookup
const TSX_NAME_TO_MD_NAME = {};
for (const [md, tsx] of Object.entries(MD_NAME_TO_TSX_NAME)) {
  TSX_NAME_TO_MD_NAME[tsx] = md;
}

// ---------------------------------------------------------------------------
// 1. Parse the markdown tables
// ---------------------------------------------------------------------------

/**
 * Parse a single markdown table row and return { name, templates[], subagents[] }.
 * Returns null for header/separator rows or rows that can't be parsed.
 */
function parseTableRow(row) {
  // Split by | and trim
  const cells = row.split('|').map(c => c.trim()).filter(Boolean);
  if (cells.length < 3) return null;

  // Extract agent name: **Scout** (Pre-Phase) → Scout
  const nameCell = cells[0];
  const nameMatch = nameCell.match(/\*\*(.+?)\*\*/);
  if (!nameMatch) return null;
  const rawName = nameMatch[1].trim();

  // Parse templates cell
  const templates = parseCellItems(cells[1], 'template');

  // Parse subagents cell
  const subagents = parseCellItems(cells[2], 'subagent');

  return { name: rawName, templates, subagents };
}

/**
 * Parse a markdown table cell into an array of clean string values.
 * Handles: backtick-wrapped items, footnote markers (¹), "None" variants, comma separation.
 */
function parseCellItems(cell, type) {
  // Check for "None" variants
  if (/^\*?None/i.test(cell.replace(/\*/g, '').trim())) return [];
  if (cell.trim() === '' || cell.trim() === '-') return [];

  let items;

  if (type === 'template') {
    // Templates are backtick-wrapped: `file.md`, `file2.md`¹
    const matches = cell.match(/`([^`]+)`/g);
    if (!matches) return [];
    items = matches.map(m => {
      let val = m.replace(/`/g, '').trim();
      // Strip footnote markers (¹, ², etc.)
      val = val.replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]+$/g, '');
      return val;
    });
  } else {
    // Subagents: `Jump Start: Researcher`, `Jump Start: Security`
    // Split on comma, strip backticks, strip "Jump Start: " prefix
    items = cell.split(',').map(s => {
      let val = s.replace(/`/g, '').trim();
      // Strip footnote markers
      val = val.replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]+$/g, '');
      // Remove "Jump Start: " prefix
      val = val.replace(/^Jump Start:\s*/i, '');
      return val;
    }).filter(Boolean);

    // Filter out "None" that may have slipped through
    items = items.filter(i => !/^none/i.test(i.replace(/\*/g, '').trim()));
  }

  // Strip any remaining footnote markers from items
  items = items.map(i => i.replace(/¹/g, ''));

  return items;
}

function parseMarkdownTables(mdContent) {
  const agents = {};
  const lines = mdContent.split('\n');

  let inTable = false;
  let headerSeen = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect table start (header row with Agent | Templates | Subagents)
    if (trimmed.startsWith('|') && /Agent/i.test(trimmed) && /Templates/i.test(trimmed)) {
      inTable = true;
      headerSeen = false;
      continue;
    }

    if (inTable) {
      // Skip separator row (| :--- | :--- | :--- |)
      if (trimmed.match(/^\|[\s:|-]+\|$/)) {
        headerSeen = true;
        continue;
      }

      // End of table: empty line or non-table line
      if (!trimmed.startsWith('|')) {
        inTable = false;
        continue;
      }

      if (headerSeen) {
        const parsed = parseTableRow(trimmed);
        if (parsed) {
          agents[parsed.name] = { templates: parsed.templates, subagents: parsed.subagents };
        }
      }
    }
  }

  return agents;
}

// ---------------------------------------------------------------------------
// 2. Read and patch the TSX file
// ---------------------------------------------------------------------------

function patchTsx(tsxContent, mdAgents) {
  const changes = [];

  // For each agent in the markdown, find the matching agent in the TSX and
  // replace its templates and subagents arrays.
  for (const [mdName, data] of Object.entries(mdAgents)) {
    // Determine the TSX name to search for
    const tsxName = MD_NAME_TO_TSX_NAME[mdName] || mdName;

    // Find the agent block by matching: name: "AgentName"
    const namePattern = `name: "${tsxName}"`;
    const nameIdx = tsxContent.indexOf(namePattern);
    if (nameIdx === -1) {
      console.warn(`  WARN: Agent "${tsxName}" (md: "${mdName}") not found in TSX — skipping`);
      continue;
    }

    // Find the enclosing object boundaries ({ ... }) around this agent
    // Walk backwards to find the opening {
    let braceDepth = 0;
    let blockStart = nameIdx;
    for (let i = nameIdx; i >= 0; i--) {
      if (tsxContent[i] === '}') braceDepth++;
      if (tsxContent[i] === '{') {
        if (braceDepth === 0) { blockStart = i; break; }
        braceDepth--;
      }
    }

    // Walk forward to find the closing }
    braceDepth = 0;
    let blockEnd = nameIdx;
    for (let i = blockStart; i < tsxContent.length; i++) {
      if (tsxContent[i] === '{') braceDepth++;
      if (tsxContent[i] === '}') {
        braceDepth--;
        if (braceDepth === 0) { blockEnd = i + 1; break; }
      }
    }

    const agentBlock = tsxContent.substring(blockStart, blockEnd);

    // Replace templates array
    let newBlock = agentBlock;
    const templatesRegex = /templates:\s*\[([^\]]*)\]/;
    const subagentsRegex = /subagents:\s*\[([^\]]*)\]/;

    const oldTemplatesMatch = agentBlock.match(templatesRegex);
    const oldSubagentsMatch = agentBlock.match(subagentsRegex);

    const formatArray = (arr) => {
      if (arr.length === 0) return '[]';
      return '[' + arr.map(i => `"${i}"`).join(', ') + ']';
    };

    const newTemplates = formatArray(data.templates);
    const newSubagents = formatArray(data.subagents);

    // Determine changes
    const oldTemplates = oldTemplatesMatch ? oldTemplatesMatch[0] : null;
    const oldSubagents = oldSubagentsMatch ? oldSubagentsMatch[0] : null;

    const newTemplatesField = `templates: ${newTemplates}`;
    const newSubagentsField = `subagents: ${newSubagents}`;

    let changed = false;
    if (oldTemplates && oldTemplates !== newTemplatesField) {
      newBlock = newBlock.replace(templatesRegex, newTemplatesField);
      changed = true;
      changes.push({ agent: tsxName, field: 'templates', old: oldTemplates, new: newTemplatesField });
    }
    if (oldSubagents && oldSubagents !== newSubagentsField) {
      newBlock = newBlock.replace(subagentsRegex, newSubagentsField);
      changed = true;
      changes.push({ agent: tsxName, field: 'subagents', old: oldSubagents, new: newSubagentsField });
    }

    if (changed) {
      tsxContent = tsxContent.substring(0, blockStart) + newBlock + tsxContent.substring(blockEnd);
    }
  }

  return { content: tsxContent, changes };
}

// ---------------------------------------------------------------------------
// 3. Main
// ---------------------------------------------------------------------------

function main() {
  console.log('sync-agent-data: Syncing AgentCards.tsx from agent-access-reference.md');
  console.log(`  Source : ${MD_PATH}`);
  console.log(`  Target : ${TSX_PATH}`);
  console.log(`  Mode   : ${DRY_RUN ? 'DRY RUN (no writes)' : 'WRITE'}`);
  console.log();

  // Read files
  if (!fs.existsSync(MD_PATH)) {
    console.error(`ERROR: Markdown source not found: ${MD_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(TSX_PATH)) {
    console.error(`ERROR: TSX target not found: ${TSX_PATH}`);
    process.exit(1);
  }

  const mdContent = fs.readFileSync(MD_PATH, 'utf-8');
  const tsxContent = fs.readFileSync(TSX_PATH, 'utf-8');

  // Parse markdown
  const mdAgents = parseMarkdownTables(mdContent);
  const agentCount = Object.keys(mdAgents).length;
  console.log(`  Parsed ${agentCount} agents from markdown`);

  if (agentCount === 0) {
    console.error('ERROR: No agents parsed from markdown — check table format');
    process.exit(1);
  }

  // Patch TSX
  const { content: newTsx, changes } = patchTsx(tsxContent, mdAgents);

  // Report
  if (changes.length === 0) {
    console.log('\n  No changes needed — TSX is already in sync.');
    process.exit(0);
  }

  console.log(`\n  ${changes.length} change(s) detected:\n`);
  for (const c of changes) {
    console.log(`    ${c.agent} → ${c.field}`);
    console.log(`      OLD: ${c.old}`);
    console.log(`      NEW: ${c.new}`);
    console.log();
  }

  if (DRY_RUN) {
    console.log('  DRY RUN — no files were written.');
  } else {
    fs.writeFileSync(TSX_PATH, newTsx, 'utf-8');
    console.log(`  Written: ${TSX_PATH}`);
  }

  process.exit(0);
}

main();
