#!/usr/bin/env node

/**
 * usage.js — Agent Cost & Token Tracking for Jump Start (Item 99).
 *
 * Logs estimated usage per phase and per agent session. Writes entries
 * to a structured JSON log for status dashboard summarization.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');

// ─── Timeline Hook ───────────────────────────────────────────────────────────
let _timelineHook = null;

/**
 * Set the timeline instance for recording usage events.
 * @param {object|null} timeline - Timeline instance with recordEvent() method.
 */
export function setUsageTimelineHook(timeline) {
  _timelineHook = timeline;
}

/**
 * @typedef {object} UsageEntry
 * @property {string} timestamp - ISO UTC timestamp.
 * @property {string} phase - Phase identifier (e.g., "phase-0", "phase-3").
 * @property {string} agent - Agent name (e.g., "Challenger", "Architect").
 * @property {string} action - Action description (e.g., "generate", "review").
 * @property {number} estimated_tokens - Estimated token count.
 * @property {number} [estimated_cost_usd] - Optional estimated cost in USD.
 * @property {string} [model] - Model name if known.
 * @property {object} [metadata] - Additional metadata.
 */

/**
 * Load the usage log from disk.
 *
 * @param {string} logPath - Path to usage-log.json.
 * @returns {{ entries: UsageEntry[], total_tokens: number, total_cost_usd: number }}
 */
export function loadUsageLog(logPath) {
  if (!fs.existsSync(logPath)) {
    return { entries: [], total_tokens: 0, total_cost_usd: 0 };
  }

  try {
    const data = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    return {
      entries: data.entries || [],
      total_tokens: data.total_tokens || 0,
      total_cost_usd: data.total_cost_usd || 0
    };
  } catch (err) {
    return { entries: [], total_tokens: 0, total_cost_usd: 0 };
  }
}

/**
 * Append a usage entry to the log.
 *
 * @param {string} logPath - Path to usage-log.json.
 * @param {UsageEntry} entry - Usage entry to log.
 * @returns {{ entries: UsageEntry[], total_tokens: number, total_cost_usd: number }}
 */
export function logUsage(logPath, entry) {
  const log = loadUsageLog(logPath);

  const newEntry = {
    timestamp: new Date().toISOString(),
    phase: entry.phase || 'unknown',
    agent: entry.agent || 'unknown',
    action: entry.action || 'unknown',
    estimated_tokens: entry.estimated_tokens || 0,
    estimated_cost_usd: entry.estimated_cost_usd || 0,
    model: entry.model || null,
    metadata: entry.metadata || null
  };

  log.entries.push(newEntry);
  log.total_tokens += newEntry.estimated_tokens;
  log.total_cost_usd += newEntry.estimated_cost_usd;

  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + '\n', 'utf8');

  // Record usage in timeline
  if (_timelineHook) {
    _timelineHook.recordEvent({
      event_type: 'usage_logged',
      phase: newEntry.phase,
      agent: newEntry.agent,
      action: `Usage logged: ${newEntry.estimated_tokens} tokens ($${newEntry.estimated_cost_usd.toFixed(4)})`,
      metadata: {
        estimated_tokens: newEntry.estimated_tokens,
        estimated_cost_usd: newEntry.estimated_cost_usd,
        model: newEntry.model
      }
    });
  }

  return log;
}

/**
 * Generate a usage summary grouped by phase and agent.
 *
 * @param {string} logPath - Path to usage-log.json.
 * @returns {object} Summary with per-phase and per-agent breakdowns.
 */
export function summarizeUsage(logPath) {
  const log = loadUsageLog(logPath);

  const byPhase = {};
  const byAgent = {};

  for (const entry of log.entries) {
    // By phase
    if (!byPhase[entry.phase]) {
      byPhase[entry.phase] = { tokens: 0, cost_usd: 0, sessions: 0 };
    }
    byPhase[entry.phase].tokens += entry.estimated_tokens;
    byPhase[entry.phase].cost_usd += entry.estimated_cost_usd;
    byPhase[entry.phase].sessions++;

    // By agent
    if (!byAgent[entry.agent]) {
      byAgent[entry.agent] = { tokens: 0, cost_usd: 0, sessions: 0 };
    }
    byAgent[entry.agent].tokens += entry.estimated_tokens;
    byAgent[entry.agent].cost_usd += entry.estimated_cost_usd;
    byAgent[entry.agent].sessions++;
  }

  return {
    total_tokens: log.total_tokens,
    total_cost_usd: Math.round(log.total_cost_usd * 10000) / 10000,
    total_sessions: log.entries.length,
    by_phase: byPhase,
    by_agent: byAgent
  };
}

/**
 * Generate a markdown summary of usage.
 *
 * @param {string} logPath - Path to usage-log.json.
 * @returns {string} Markdown report.
 */
export function generateUsageReport(logPath) {
  const summary = summarizeUsage(logPath);

  let report = '## Usage Summary\n\n';
  report += `| Metric | Value |\n|--------|-------|\n`;
  report += `| Total Tokens | ${summary.total_tokens.toLocaleString()} |\n`;
  report += `| Estimated Cost | $${summary.total_cost_usd.toFixed(4)} |\n`;
  report += `| Total Sessions | ${summary.total_sessions} |\n\n`;

  report += '### By Phase\n\n';
  report += '| Phase | Tokens | Cost | Sessions |\n|-------|--------|------|----------|\n';
  for (const [phase, data] of Object.entries(summary.by_phase)) {
    report += `| ${phase} | ${data.tokens.toLocaleString()} | $${data.cost_usd.toFixed(4)} | ${data.sessions} |\n`;
  }

  report += '\n### By Agent\n\n';
  report += '| Agent | Tokens | Cost | Sessions |\n|-------|--------|------|----------|\n';
  for (const [agent, data] of Object.entries(summary.by_agent)) {
    report += `| ${agent} | ${data.tokens.toLocaleString()} | $${data.cost_usd.toFixed(4)} | ${data.sessions} |\n`;
  }

  return report;
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

if (process.argv[1] && process.argv[1].endsWith('usage.js')) {
  const logPath = process.argv[2] || path.join(process.cwd(), '.jumpstart', 'usage-log.json');
  const action = process.argv[3] || 'summary';

  if (action === 'summary') {
    const summary = summarizeUsage(logPath);
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  } else if (action === 'report') {
    process.stdout.write(generateUsageReport(logPath) + '\n');
  } else {
    process.stderr.write('Usage: usage.js [log-path] [summary|report]\n');
  }
}
