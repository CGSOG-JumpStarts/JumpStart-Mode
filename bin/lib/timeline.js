/**
 * timeline.js — Agent Interaction Timeline (Item 102)
 *
 * Records all agent/subagent interactions, tool calls, template reads,
 * artifact writes, questions, approvals, research queries, and LLM turns
 * as a chronological timeline. Supports querying, rendering (Markdown,
 * JSON, HTML), and integration with the headless runner and live IDE mode.
 *
 * Usage (CLI):
 *   echo '{"action":"summary"}' | node bin/lib/timeline.js
 *   echo '{"action":"report","format":"markdown"}' | node bin/lib/timeline.js
 *   echo '{"action":"report","format":"html"}' | node bin/lib/timeline.js
 *   echo '{"action":"export","filters":{"phase":"3"}}' | node bin/lib/timeline.js
 *   echo '{"action":"clear"}' | node bin/lib/timeline.js
 *
 * Output (stdout JSON or rendered text/html):
 *   Depends on action — see individual functions.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_TIMELINE_PATH = '.jumpstart/state/timeline.json';
const DEFAULT_MAX_EVENTS = 50000;
const DEFAULT_FLUSH_INTERVAL = 5;

const EVENT_TYPES = [
  'phase_start', 'phase_end', 'tool_call', 'tool_result',
  'file_read', 'file_write', 'template_read',
  'artifact_write', 'artifact_read',
  'question_asked', 'question_answered',
  'approval', 'rejection',
  'subagent_invoked', 'subagent_completed',
  'llm_turn_start', 'llm_turn_end',
  'research_query', 'checkpoint_created', 'rewind',
  'handoff', 'usage_logged', 'custom'
];

// ─── ID Generation ───────────────────────────────────────────────────────────

let _counter = 0;

/**
 * Generate a unique event ID.
 * @returns {string}
 */
function generateEventId() {
  _counter++;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `evt-${ts}-${rand}-${_counter}`;
}

/**
 * Generate a unique session ID.
 * @returns {string}
 */
export function generateSessionId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `ses-${ts}-${rand}`;
}

// ─── Timeline Factory ────────────────────────────────────────────────────────

/**
 * Create a timeline instance bound to a file path and session.
 *
 * @param {object} [options]
 * @param {string} [options.filePath] - Path to timeline.json.
 * @param {string} [options.sessionId] - Session ID (auto-generated if omitted).
 * @param {boolean} [options.enabled=true] - Whether timeline recording is active.
 * @param {number} [options.maxEvents=50000] - Max events before oldest are pruned.
 * @param {number} [options.flushInterval=5] - Flush to disk every N events.
 * @param {boolean} [options.captureToolCalls=true] - Record tool call events.
 * @param {boolean} [options.captureFileReads=true] - Record file read events.
 * @param {boolean} [options.captureFileWrites=true] - Record file write events.
 * @param {boolean} [options.captureLLMTurns=true] - Record LLM turn events.
 * @param {boolean} [options.captureQuestions=true] - Record question events.
 * @param {boolean} [options.captureApprovals=true] - Record approval/rejection events.
 * @param {boolean} [options.captureSubagents=true] - Record subagent events.
 * @param {boolean} [options.captureResearch=true] - Record research query events.
 * @param {boolean} [options.archiveOnClear=true] - Archive before clearing.
 * @returns {object} Timeline instance.
 */
export function createTimeline(options = {}) {
  const filePath = options.filePath || DEFAULT_TIMELINE_PATH;
  const sessionId = options.sessionId || generateSessionId();
  const enabled = options.enabled !== false;
  const maxEvents = options.maxEvents || DEFAULT_MAX_EVENTS;
  const flushInterval = options.flushInterval || DEFAULT_FLUSH_INTERVAL;
  const archiveOnClear = options.archiveOnClear !== false;

  // Capture flags
  const capture = {
    toolCalls: options.captureToolCalls !== false,
    fileReads: options.captureFileReads !== false,
    fileWrites: options.captureFileWrites !== false,
    llmTurns: options.captureLLMTurns !== false,
    questions: options.captureQuestions !== false,
    approvals: options.captureApprovals !== false,
    subagents: options.captureSubagents !== false,
    research: options.captureResearch !== false
  };

  // In-memory buffer
  let buffer = [];
  let pendingFlush = 0;
  let currentPhase = null;
  let currentAgent = null;

  // Load existing timeline (merge sessions)
  let timelineData = _loadOrInit(filePath, sessionId);

  /**
   * Record a timeline event.
   * @param {object} event - Partial event; id, timestamp, session_id are auto-filled.
   * @returns {object|null} The recorded event, or null if disabled/filtered.
   */
  function recordEvent(event) {
    if (!enabled) return null;

    // Check capture flags
    if (!_shouldCapture(event.event_type, capture)) return null;

    const fullEvent = {
      id: generateEventId(),
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      phase: event.phase !== undefined ? event.phase : currentPhase,
      agent: event.agent || currentAgent,
      parent_agent: event.parent_agent || null,
      event_type: event.event_type || 'custom',
      action: event.action || '',
      metadata: event.metadata || null,
      duration_ms: event.duration_ms || null
    };

    buffer.push(fullEvent);
    pendingFlush++;

    // Auto-flush when buffer hits threshold
    if (pendingFlush >= flushInterval) {
      flush();
    }

    return fullEvent;
  }

  /**
   * Flush buffered events to disk.
   */
  function flush() {
    if (buffer.length === 0) return;

    // Merge buffer into timeline data
    timelineData.events.push(...buffer);

    // Prune if over max
    if (timelineData.events.length > maxEvents) {
      const excess = timelineData.events.length - maxEvents;
      timelineData.events = timelineData.events.slice(excess);
    }

    // Write to disk
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(timelineData, null, 2) + '\n', 'utf8');

    buffer = [];
    pendingFlush = 0;
  }

  /**
   * End the session — flush and stamp ended_at.
   */
  function endSession() {
    flush();
    timelineData.ended_at = new Date().toISOString();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(timelineData, null, 2) + '\n', 'utf8');
  }

  /**
   * Set the current phase context for subsequent events.
   * @param {string|number} phase
   */
  function setPhase(phase) {
    currentPhase = phase;
  }

  /**
   * Set the current agent context for subsequent events.
   * @param {string} agent
   */
  function setAgent(agent) {
    currentAgent = agent;
  }

  /**
   * Get the session ID.
   * @returns {string}
   */
  function getSessionId() {
    return sessionId;
  }

  /**
   * Get buffered event count (not yet flushed).
   * @returns {number}
   */
  function getBufferedCount() {
    return buffer.length;
  }

  /**
   * Get total event count (flushed + buffered).
   * @returns {number}
   */
  function getEventCount() {
    return timelineData.events.length + buffer.length;
  }

  return {
    recordEvent,
    flush,
    endSession,
    setPhase,
    setAgent,
    getSessionId,
    getBufferedCount,
    getEventCount,
    // Expose capture config for tool-bridge integration
    capture
  };
}

// ─── Loading & Querying ──────────────────────────────────────────────────────

/**
 * Load timeline data from disk.
 * @param {string} [filePath] - Path to timeline.json.
 * @returns {{ version: string, session_id: string, started_at: string, ended_at: string|null, events: object[] }}
 */
export function loadTimeline(filePath) {
  const p = filePath || DEFAULT_TIMELINE_PATH;
  if (!fs.existsSync(p)) {
    return { version: '1.0.0', session_id: null, started_at: null, ended_at: null, events: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return { version: '1.0.0', session_id: null, started_at: null, ended_at: null, events: [] };
  }
}

/**
 * Query timeline events with filters.
 *
 * @param {string} [filePath] - Path to timeline.json.
 * @param {object} [filters]
 * @param {string} [filters.session_id] - Filter by session.
 * @param {string|number} [filters.phase] - Filter by phase.
 * @param {string} [filters.agent] - Filter by agent name.
 * @param {string|string[]} [filters.event_type] - Filter by event type(s).
 * @param {string} [filters.from] - ISO timestamp lower bound (inclusive).
 * @param {string} [filters.to] - ISO timestamp upper bound (inclusive).
 * @param {number} [filters.limit] - Max events to return.
 * @returns {object[]} Matching events.
 */
export function queryTimeline(filePath, filters = {}) {
  const data = loadTimeline(filePath);
  let events = data.events || [];

  if (filters.session_id) {
    events = events.filter(e => e.session_id === filters.session_id);
  }
  if (filters.phase !== undefined && filters.phase !== null) {
    const p = String(filters.phase);
    events = events.filter(e => String(e.phase) === p);
  }
  if (filters.agent) {
    const a = filters.agent.toLowerCase();
    events = events.filter(e => e.agent && e.agent.toLowerCase() === a);
  }
  if (filters.event_type) {
    const types = Array.isArray(filters.event_type) ? filters.event_type : [filters.event_type];
    events = events.filter(e => types.includes(e.event_type));
  }
  if (filters.from) {
    const fromTs = new Date(filters.from).getTime();
    events = events.filter(e => new Date(e.timestamp).getTime() >= fromTs);
  }
  if (filters.to) {
    const toTs = new Date(filters.to).getTime();
    events = events.filter(e => new Date(e.timestamp).getTime() <= toTs);
  }
  if (filters.limit && filters.limit > 0) {
    events = events.slice(-filters.limit);
  }

  return events;
}

/**
 * Get a summary of the timeline.
 *
 * @param {string} [filePath] - Path to timeline.json.
 * @returns {object} Summary object.
 */
export function getTimelineSummary(filePath) {
  const data = loadTimeline(filePath);
  const events = data.events || [];

  if (events.length === 0) {
    return {
      total_events: 0,
      by_type: {},
      by_agent: {},
      by_phase: {},
      sessions: [],
      duration_ms: null,
      first_event: null,
      last_event: null
    };
  }

  const byType = {};
  const byAgent = {};
  const byPhase = {};
  const sessions = new Set();

  for (const evt of events) {
    // By type
    byType[evt.event_type] = (byType[evt.event_type] || 0) + 1;

    // By agent
    if (evt.agent) {
      byAgent[evt.agent] = (byAgent[evt.agent] || 0) + 1;
    }

    // By phase
    if (evt.phase !== null && evt.phase !== undefined) {
      const pk = String(evt.phase);
      byPhase[pk] = (byPhase[pk] || 0) + 1;
    }

    // Sessions
    if (evt.session_id) sessions.add(evt.session_id);
  }

  const firstTs = new Date(events[0].timestamp).getTime();
  const lastTs = new Date(events[events.length - 1].timestamp).getTime();

  return {
    total_events: events.length,
    by_type: byType,
    by_agent: byAgent,
    by_phase: byPhase,
    sessions: [...sessions],
    duration_ms: lastTs - firstTs,
    first_event: events[0].timestamp,
    last_event: events[events.length - 1].timestamp
  };
}

/**
 * Clear the timeline, optionally archiving first.
 *
 * @param {string} [filePath] - Path to timeline.json.
 * @param {object} [options]
 * @param {boolean} [options.archive=true] - Archive before clearing.
 * @param {string} [options.archiveDir] - Archive directory.
 * @returns {{ success: boolean, archived_to?: string }}
 */
export function clearTimeline(filePath, options = {}) {
  const p = filePath || DEFAULT_TIMELINE_PATH;
  const archive = options.archive !== false;
  const archiveDir = options.archiveDir || '.jumpstart/archive';

  let archivedTo = null;

  if (archive && fs.existsSync(p)) {
    // Archive existing timeline
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const archivePath = path.join(archiveDir, `timeline-${ts}.json`);
    fs.copyFileSync(p, archivePath);
    archivedTo = archivePath;
  }

  // Write empty timeline
  const empty = {
    version: '1.0.0',
    session_id: null,
    started_at: null,
    ended_at: null,
    events: []
  };
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(p, JSON.stringify(empty, null, 2) + '\n', 'utf8');

  return { success: true, archived_to: archivedTo };
}

// ─── Renderers ───────────────────────────────────────────────────────────────

/**
 * Render timeline as Markdown report.
 *
 * @param {object[]} events - Timeline events.
 * @param {object} [options]
 * @param {string} [options.title] - Report title.
 * @returns {string} Markdown string.
 */
export function renderMarkdown(events, options = {}) {
  const title = options.title || 'Agent Interaction Timeline';

  if (!events || events.length === 0) {
    return `# ${title}\n\n*No timeline events recorded.*\n`;
  }

  const lines = [];
  lines.push(`# ${title}\n`);
  lines.push(`**Events:** ${events.length}  `);
  lines.push(`**Period:** ${events[0].timestamp} → ${events[events.length - 1].timestamp}  `);

  // Unique sessions
  const sessions = [...new Set(events.map(e => e.session_id).filter(Boolean))];
  if (sessions.length > 0) {
    lines.push(`**Sessions:** ${sessions.length}  `);
  }
  lines.push('');

  // Group by phase
  const phaseGroups = _groupByPhase(events);

  for (const [phase, phaseEvents] of Object.entries(phaseGroups)) {
    const phaseName = phase === 'null' ? 'No Phase' : `Phase ${phase}`;
    lines.push(`## ${phaseName}\n`);
    lines.push('| Time | Agent | Event | Action | Details |');
    lines.push('|------|-------|-------|--------|---------|');

    for (const evt of phaseEvents) {
      const time = evt.timestamp ? evt.timestamp.slice(11, 19) : '—';
      const agent = evt.agent || '—';
      const type = _formatEventType(evt.event_type);
      const action = _escapeMarkdown(evt.action || '—');
      const details = _formatMetadataBrief(evt);
      lines.push(`| ${time} | ${agent} | ${type} | ${action} | ${details} |`);
    }
    lines.push('');
  }

  // Summary statistics
  lines.push('## Summary\n');
  const summary = _computeSummaryFromEvents(events);
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Events | ${summary.total_events} |`);
  for (const [type, count] of Object.entries(summary.by_type)) {
    lines.push(`| ${_formatEventType(type)} | ${count} |`);
  }
  lines.push('');

  if (Object.keys(summary.by_agent).length > 0) {
    lines.push('### Events by Agent\n');
    lines.push('| Agent | Events |');
    lines.push('|-------|--------|');
    for (const [agent, count] of Object.entries(summary.by_agent)) {
      lines.push(`| ${agent} | ${count} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Render timeline as JSON export.
 *
 * @param {object[]} events - Timeline events.
 * @returns {string} JSON string.
 */
export function renderJSON(events) {
  return JSON.stringify({
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    event_count: events.length,
    events
  }, null, 2);
}

/**
 * Render timeline as self-contained HTML viewer.
 *
 * @param {object[]} events - Timeline events.
 * @param {object} [options]
 * @param {string} [options.title] - Page title.
 * @returns {string} HTML string.
 */
export function renderHTML(events, options = {}) {
  const title = options.title || 'Jump Start Timeline';
  const summary = events.length > 0 ? _computeSummaryFromEvents(events) : null;
  const eventsJSON = JSON.stringify(events);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${_escapeHTML(title)}</title>
<style>
  :root {
    --bg: #0d1117; --surface: #161b22; --border: #30363d;
    --text: #e6edf3; --text-secondary: #8b949e; --accent: #58a6ff;
    --green: #3fb950; --yellow: #d29922; --red: #f85149; --purple: #bc8cff;
    --cyan: #39d353; --orange: #db6d28;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; padding: 24px; }
  h1 { font-size: 24px; margin-bottom: 8px; }
  .subtitle { color: var(--text-secondary); margin-bottom: 24px; font-size: 14px; }
  .controls { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
  .controls select, .controls input { background: var(--surface); border: 1px solid var(--border); color: var(--text); padding: 6px 12px; border-radius: 6px; font-size: 13px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px; text-align: center; }
  .stat-card .value { font-size: 28px; font-weight: 700; color: var(--accent); }
  .stat-card .label { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
  .timeline { position: relative; padding-left: 28px; }
  .timeline::before { content: ''; position: absolute; left: 12px; top: 0; bottom: 0; width: 2px; background: var(--border); }
  .phase-group { margin-bottom: 24px; }
  .phase-header { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: var(--accent); cursor: pointer; user-select: none; }
  .phase-header::before { content: '▸ '; }
  .phase-header.expanded::before { content: '▾ '; }
  .event { position: relative; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; margin-bottom: 8px; font-size: 13px; transition: border-color 0.2s; }
  .event:hover { border-color: var(--accent); }
  .event::before { content: ''; position: absolute; left: -20px; top: 16px; width: 10px; height: 10px; border-radius: 50%; }
  .event[data-type="phase_start"]::before, .event[data-type="phase_end"]::before { background: var(--accent); }
  .event[data-type="tool_call"]::before, .event[data-type="tool_result"]::before { background: var(--cyan); }
  .event[data-type="file_read"]::before, .event[data-type="file_write"]::before { background: var(--yellow); }
  .event[data-type="template_read"]::before, .event[data-type="artifact_write"]::before, .event[data-type="artifact_read"]::before { background: var(--orange); }
  .event[data-type="question_asked"]::before, .event[data-type="question_answered"]::before { background: var(--purple); }
  .event[data-type="approval"]::before { background: var(--green); }
  .event[data-type="rejection"]::before { background: var(--red); }
  .event[data-type="subagent_invoked"]::before, .event[data-type="subagent_completed"]::before { background: var(--purple); }
  .event[data-type="llm_turn_start"]::before, .event[data-type="llm_turn_end"]::before { background: var(--text-secondary); }
  .event[data-type="custom"]::before { background: var(--border); }
  .event .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  .event .time { color: var(--text-secondary); font-family: monospace; font-size: 12px; }
  .event .type-badge { display: inline-block; padding: 1px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
  .event .agent-name { color: var(--accent); font-weight: 600; }
  .event .action-text { color: var(--text); }
  .event .metadata { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); font-family: monospace; font-size: 12px; color: var(--text-secondary); white-space: pre-wrap; word-break: break-all; display: none; }
  .event .metadata.visible { display: block; }
  .event .toggle-meta { cursor: pointer; color: var(--accent); font-size: 11px; margin-left: 8px; }
  .subagent { margin-left: 20px; border-left: 2px solid var(--purple); }
  .hidden { display: none; }
  .count-badge { background: var(--border); color: var(--text-secondary); padding: 2px 8px; border-radius: 10px; font-size: 11px; margin-left: 8px; }
</style>
</head>
<body>
<h1>${_escapeHTML(title)}</h1>
<div class="subtitle">Generated ${new Date().toISOString()} — ${events.length} events</div>

<div class="controls">
  <select id="filterType"><option value="">All Event Types</option></select>
  <select id="filterAgent"><option value="">All Agents</option></select>
  <select id="filterPhase"><option value="">All Phases</option></select>
  <input type="text" id="filterSearch" placeholder="Search actions..." />
</div>

<div class="stats" id="stats"></div>
<div class="timeline" id="timeline"></div>

<script>
const ALL_EVENTS = ${eventsJSON};

// Populate filters
const types = [...new Set(ALL_EVENTS.map(e => e.event_type))].sort();
const agents = [...new Set(ALL_EVENTS.map(e => e.agent).filter(Boolean))].sort();
const phases = [...new Set(ALL_EVENTS.map(e => String(e.phase)).filter(p => p !== 'null'))].sort();

types.forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t.replace(/_/g, ' '); document.getElementById('filterType').appendChild(o); });
agents.forEach(a => { const o = document.createElement('option'); o.value = a; o.textContent = a; document.getElementById('filterAgent').appendChild(o); });
phases.forEach(p => { const o = document.createElement('option'); o.value = p; o.textContent = 'Phase ' + p; document.getElementById('filterPhase').appendChild(o); });

function getFiltered() {
  const ft = document.getElementById('filterType').value;
  const fa = document.getElementById('filterAgent').value;
  const fp = document.getElementById('filterPhase').value;
  const fs = document.getElementById('filterSearch').value.toLowerCase();
  return ALL_EVENTS.filter(e => {
    if (ft && e.event_type !== ft) return false;
    if (fa && e.agent !== fa) return false;
    if (fp && String(e.phase) !== fp) return false;
    if (fs && !(e.action || '').toLowerCase().includes(fs)) return false;
    return true;
  });
}

function renderStats(events) {
  const el = document.getElementById('stats');
  if (!events.length) { el.innerHTML = '<div class="stat-card"><div class="value">0</div><div class="label">Events</div></div>'; return; }
  const byType = {};
  events.forEach(e => { byType[e.event_type] = (byType[e.event_type] || 0) + 1; });
  const first = new Date(events[0].timestamp);
  const last = new Date(events[events.length - 1].timestamp);
  const dur = Math.round((last - first) / 1000);
  const cards = [
    { value: events.length, label: 'Total Events' },
    { value: [...new Set(events.map(e => e.agent).filter(Boolean))].length, label: 'Agents' },
    { value: byType['tool_call'] || 0, label: 'Tool Calls' },
    { value: byType['llm_turn_start'] || 0, label: 'LLM Turns' },
    { value: dur + 's', label: 'Duration' }
  ];
  el.innerHTML = cards.map(c => '<div class="stat-card"><div class="value">' + c.value + '</div><div class="label">' + c.label + '</div></div>').join('');
}

function renderTimeline(events) {
  const el = document.getElementById('timeline');
  if (!events.length) { el.innerHTML = '<p style="color:var(--text-secondary)">No events match the current filters.</p>'; return; }

  // Group by phase
  const groups = {};
  events.forEach(e => {
    const k = e.phase != null ? String(e.phase) : 'none';
    if (!groups[k]) groups[k] = [];
    groups[k].push(e);
  });

  let html = '';
  for (const [phase, evts] of Object.entries(groups)) {
    const label = phase === 'none' ? 'No Phase' : 'Phase ' + phase;
    html += '<div class="phase-group">';
    html += '<div class="phase-header expanded" onclick="this.classList.toggle(\\'expanded\\');this.nextElementSibling.classList.toggle(\\'hidden\\')">' + label + '<span class="count-badge">' + evts.length + '</span></div>';
    html += '<div class="phase-events">';
    for (const evt of evts) {
      const isSubagent = evt.parent_agent ? ' subagent' : '';
      const time = evt.timestamp ? evt.timestamp.slice(11, 19) : '';
      const meta = evt.metadata ? JSON.stringify(evt.metadata, null, 2) : '';
      html += '<div class="event' + isSubagent + '" data-type="' + evt.event_type + '">';
      html += '<div class="header"><span><span class="type-badge">' + evt.event_type.replace(/_/g, ' ') + '</span>';
      if (evt.agent) html += ' <span class="agent-name">' + esc(evt.agent) + '</span>';
      if (meta) html += '<span class="toggle-meta" onclick="this.parentElement.parentElement.parentElement.querySelector(\\'.metadata\\').classList.toggle(\\'.visible\\')">[details]</span>';
      html += '</span><span class="time">' + time + '</span></div>';
      html += '<div class="action-text">' + esc(evt.action || '') + '</div>';
      if (meta) html += '<div class="metadata">' + esc(meta) + '</div>';
      html += '</div>';
    }
    html += '</div></div>';
  }
  el.innerHTML = html;

  // Fix toggle metadata
  el.querySelectorAll('.toggle-meta').forEach(btn => {
    btn.onclick = function(e) { e.stopPropagation(); this.closest('.event').querySelector('.metadata').classList.toggle('visible'); };
  });
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function render() {
  const filtered = getFiltered();
  renderStats(filtered);
  renderTimeline(filtered);
}

document.getElementById('filterType').onchange = render;
document.getElementById('filterAgent').onchange = render;
document.getElementById('filterPhase').onchange = render;
document.getElementById('filterSearch').oninput = render;

render();
</script>
</body>
</html>`;
}

// ─── Report Generation Dispatcher ────────────────────────────────────────────

/**
 * Generate a timeline report in the specified format.
 *
 * @param {string} [filePath] - Path to timeline.json.
 * @param {object} [options]
 * @param {string} [options.format='markdown'] - 'markdown' | 'json' | 'html'
 * @param {object} [options.filters] - Filters to apply before rendering.
 * @param {string} [options.title] - Report title.
 * @returns {string} Rendered report string.
 */
export function generateTimelineReport(filePath, options = {}) {
  const format = options.format || 'markdown';
  const filters = options.filters || {};
  const events = queryTimeline(filePath, filters);

  switch (format) {
    case 'json':
      return renderJSON(events);
    case 'html':
      return renderHTML(events, { title: options.title });
    case 'markdown':
    default:
      return renderMarkdown(events, { title: options.title });
  }
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Load or initialize timeline data.
 * @param {string} filePath
 * @param {string} sessionId
 * @returns {object}
 */
function _loadOrInit(filePath, sessionId) {
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      // Keep existing events, update session
      data.session_id = sessionId;
      return data;
    } catch {
      // Corrupted — start fresh
    }
  }
  return {
    version: '1.0.0',
    session_id: sessionId,
    started_at: new Date().toISOString(),
    ended_at: null,
    events: []
  };
}

/**
 * Check if an event type should be captured based on config flags.
 * @param {string} eventType
 * @param {object} capture
 * @returns {boolean}
 */
function _shouldCapture(eventType, capture) {
  switch (eventType) {
    case 'tool_call':
    case 'tool_result':
      return capture.toolCalls;
    case 'file_read':
    case 'template_read':
    case 'artifact_read':
      return capture.fileReads;
    case 'file_write':
    case 'artifact_write':
      return capture.fileWrites;
    case 'llm_turn_start':
    case 'llm_turn_end':
      return capture.llmTurns;
    case 'question_asked':
    case 'question_answered':
      return capture.questions;
    case 'approval':
    case 'rejection':
      return capture.approvals;
    case 'subagent_invoked':
    case 'subagent_completed':
      return capture.subagents;
    case 'research_query':
      return capture.research;
    default:
      return true; // Always capture: phase_start, phase_end, handoff, checkpoint, rewind, usage_logged, custom
  }
}

/**
 * Group events by phase.
 * @param {object[]} events
 * @returns {object} Map of phase → events
 */
function _groupByPhase(events) {
  const groups = {};
  for (const evt of events) {
    const key = evt.phase != null ? String(evt.phase) : 'null';
    if (!groups[key]) groups[key] = [];
    groups[key].push(evt);
  }
  return groups;
}

/**
 * Compute summary stats from an events array.
 * @param {object[]} events
 * @returns {object}
 */
function _computeSummaryFromEvents(events) {
  const byType = {};
  const byAgent = {};
  for (const evt of events) {
    byType[evt.event_type] = (byType[evt.event_type] || 0) + 1;
    if (evt.agent) {
      byAgent[evt.agent] = (byAgent[evt.agent] || 0) + 1;
    }
  }
  return { total_events: events.length, by_type: byType, by_agent: byAgent };
}

/**
 * Format event type for display.
 * @param {string} type
 * @returns {string}
 */
function _formatEventType(type) {
  return (type || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Brief metadata summary for Markdown table.
 * @param {object} evt
 * @returns {string}
 */
function _formatMetadataBrief(evt) {
  const m = evt.metadata;
  if (!m) return '—';

  switch (evt.event_type) {
    case 'tool_call':
      return m.tool_name ? `\`${m.tool_name}\`` : '—';
    case 'file_read':
    case 'file_write':
      return m.file_path ? _truncPath(m.file_path) : '—';
    case 'template_read':
      return m.template_path ? _truncPath(m.template_path) : '—';
    case 'artifact_write':
    case 'artifact_read':
      return m.artifact_path ? _truncPath(m.artifact_path) : '—';
    case 'question_asked':
      return m.questions ? `${m.questions.length} question(s)` : '—';
    case 'question_answered':
      return m.answers ? 'answered' : '—';
    case 'approval':
      return m.approver ? `by ${m.approver}` : '—';
    case 'rejection':
      return m.reason ? _escapeMarkdown(m.reason.slice(0, 50)) : '—';
    case 'subagent_invoked':
      return m.subagent_name || '—';
    case 'llm_turn_start':
      return m.model ? `${m.model} turn ${m.turn || ''}` : '—';
    case 'llm_turn_end':
      return m.prompt_tokens ? `${m.prompt_tokens}+${m.completion_tokens} tokens` : '—';
    case 'handoff':
      return m.source_phase != null ? `${m.source_phase} → ${m.target_phase}` : '—';
    case 'checkpoint_created':
      return m.checkpoint_label || m.checkpoint_id || '—';
    default:
      return '—';
  }
}

/**
 * Truncate a file path for table display.
 * @param {string} p
 * @returns {string}
 */
function _truncPath(p) {
  if (!p) return '';
  const parts = p.replace(/\\/g, '/').split('/');
  return parts.length > 3 ? `…/${parts.slice(-3).join('/')}` : p;
}

/**
 * Escape Markdown special characters.
 * @param {string} str
 * @returns {string}
 */
function _escapeMarkdown(str) {
  return (str || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/**
 * Escape HTML special characters.
 * @param {string} str
 * @returns {string}
 */
function _escapeHTML(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export { EVENT_TYPES, DEFAULT_TIMELINE_PATH };

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

if (process.argv[1] && process.argv[1].endsWith('timeline.js')) {
  let input = '';
  process.stdin.setEncoding('utf8');

  if (process.stdin.isTTY) {
    // No stdin — default to summary
    const tlPath = process.argv[2] || DEFAULT_TIMELINE_PATH;
    const summary = getTimelineSummary(tlPath);
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  } else {
    process.stdin.on('data', chunk => { input += chunk; });
    process.stdin.on('end', () => {
      try {
        const data = JSON.parse(input || '{}');
        const action = data.action || 'summary';
        const tlPath = data.file || DEFAULT_TIMELINE_PATH;

        switch (action) {
          case 'summary': {
            const summary = getTimelineSummary(tlPath);
            process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
            break;
          }
          case 'report': {
            const report = generateTimelineReport(tlPath, {
              format: data.format || 'markdown',
              filters: data.filters || {},
              title: data.title
            });
            process.stdout.write(report + '\n');
            break;
          }
          case 'export': {
            const events = queryTimeline(tlPath, data.filters || {});
            process.stdout.write(renderJSON(events) + '\n');
            break;
          }
          case 'query': {
            const events = queryTimeline(tlPath, data.filters || {});
            process.stdout.write(JSON.stringify(events, null, 2) + '\n');
            break;
          }
          case 'clear': {
            const result = clearTimeline(tlPath, { archive: data.archive !== false, archiveDir: data.archive_dir });
            process.stdout.write(JSON.stringify(result, null, 2) + '\n');
            break;
          }
          default:
            process.stderr.write(JSON.stringify({ error: `Unknown action: ${action}` }) + '\n');
            process.exit(1);
        }
      } catch (err) {
        process.stderr.write(JSON.stringify({ error: err.message }) + '\n');
        process.exit(1);
      }
    });
  }
}
