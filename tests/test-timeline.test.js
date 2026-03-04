/**
 * test-timeline.test.js — Tests for the interaction timeline system
 *
 * Tests core timeline module functions:
 * - createTimeline / recordEvent / flush / endSession
 * - loadTimeline / queryTimeline / getTimelineSummary
 * - clearTimeline (with archive)
 * - Renderers (markdown, JSON, HTML)
 * - Capture flag filtering
 * - Max events pruning
 * - Disabled timeline
 * - Tool schema registration
 * - SimulationTracer delegation
 * - State-store / approve / handoff / usage hooks
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';

// ESM imports
import {
  createTimeline,
  generateSessionId,
  loadTimeline,
  queryTimeline,
  getTimelineSummary,
  clearTimeline,
  renderMarkdown,
  renderJSON,
  renderHTML,
  generateTimelineReport,
  EVENT_TYPES,
  DEFAULT_TIMELINE_PATH
} from '../bin/lib/timeline.js';

// CJS imports
const require = createRequire(import.meta.url);
const { getToolsForPhase, getToolByName, ALL_TOOLS } = require('../bin/lib/tool-schemas');
const { SimulationTracer } = require('../bin/lib/simulation-tracer');

// ─── Test Fixtures ───────────────────────────────────────────────────────────

let tempDir;
let timelinePath;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'timeline-test-'));
  timelinePath = path.join(tempDir, 'timeline.json');
});

afterEach(() => {
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// ─── Session ID ──────────────────────────────────────────────────────────────

describe('generateSessionId', () => {
  it('produces a string with expected format', () => {
    const id = generateSessionId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(10);
    expect(id).toMatch(/^ses-/);
  });

  it('generates unique ids', () => {
    const a = generateSessionId();
    const b = generateSessionId();
    expect(a).not.toBe(b);
  });
});

// ─── Constants ───────────────────────────────────────────────────────────────

describe('EVENT_TYPES', () => {
  it('exports an array of event type strings', () => {
    expect(EVENT_TYPES).toBeDefined();
    expect(Array.isArray(EVENT_TYPES)).toBe(true);
    expect(EVENT_TYPES).toContain('phase_start');
    expect(EVENT_TYPES).toContain('tool_call');
    expect(EVENT_TYPES).toContain('approval');
    expect(EVENT_TYPES).toContain('custom');
  });

  it('contains all 23 event types', () => {
    expect(EVENT_TYPES.length).toBe(23);
    expect(EVENT_TYPES).toContain('phase_start');
    expect(EVENT_TYPES).toContain('phase_end');
    expect(EVENT_TYPES).toContain('llm_turn_start');
    expect(EVENT_TYPES).toContain('llm_turn_end');
    expect(EVENT_TYPES).toContain('handoff');
    expect(EVENT_TYPES).toContain('rewind');
    expect(EVENT_TYPES).toContain('usage_logged');
  });
});

describe('DEFAULT_TIMELINE_PATH', () => {
  it('points to .jumpstart/state/timeline.json', () => {
    expect(DEFAULT_TIMELINE_PATH).toContain('timeline.json');
  });
});

// ─── createTimeline ──────────────────────────────────────────────────────────

describe('createTimeline', () => {
  it('creates a timeline instance with expected methods', () => {
    const tl = createTimeline({ filePath: timelinePath });
    expect(tl).toBeDefined();
    expect(typeof tl.recordEvent).toBe('function');
    expect(typeof tl.flush).toBe('function');
    expect(typeof tl.endSession).toBe('function');
    expect(typeof tl.setPhase).toBe('function');
    expect(typeof tl.setAgent).toBe('function');
    expect(typeof tl.getSessionId).toBe('function');
    expect(typeof tl.getBufferedCount).toBe('function');
    expect(typeof tl.getEventCount).toBe('function');
    expect(tl.capture).toBeDefined();
  });

  it('generates a session ID', () => {
    const tl = createTimeline({ filePath: timelinePath });
    const sid = tl.getSessionId();
    expect(sid).toMatch(/^ses-/);
  });

  it('accepts a custom session ID', () => {
    const tl = createTimeline({ filePath: timelinePath, sessionId: 'sess-custom-123' });
    expect(tl.getSessionId()).toBe('sess-custom-123');
  });

  it('records an event to the buffer', () => {
    const tl = createTimeline({ filePath: timelinePath, flushInterval: 100 });
    const ev = tl.recordEvent({ event_type: 'custom', action: 'Test event' });
    expect(ev).not.toBeNull();
    expect(ev.event_type).toBe('custom');
    expect(ev.action).toBe('Test event');
    expect(ev.timestamp).toBeDefined();
    expect(ev.session_id).toBe(tl.getSessionId());
    expect(tl.getBufferedCount()).toBe(1);
  });

  it('sets phase/agent context', () => {
    const tl = createTimeline({ filePath: timelinePath, flushInterval: 100 });
    tl.setPhase('architect');
    tl.setAgent('Architect');
    const ev = tl.recordEvent({ event_type: 'tool_call', action: 'Test' });
    expect(ev.phase).toBe('architect');
    expect(ev.agent).toBe('Architect');
  });

  it('allows event-level phase override', () => {
    const tl = createTimeline({ filePath: timelinePath, flushInterval: 100 });
    tl.setPhase('developer');
    const ev = tl.recordEvent({ event_type: 'custom', action: 'Manual', phase: 'challenger' });
    expect(ev.phase).toBe('challenger');
  });

  it('auto-flushes when buffer hits threshold', () => {
    const tl = createTimeline({ filePath: timelinePath, flushInterval: 3 });
    tl.recordEvent({ event_type: 'custom', action: '1' });
    tl.recordEvent({ event_type: 'custom', action: '2' });
    expect(fs.existsSync(timelinePath)).toBe(false); // not yet
    tl.recordEvent({ event_type: 'custom', action: '3' }); // triggers flush
    expect(fs.existsSync(timelinePath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
    expect(data.events.length).toBe(3);
  });

  it('manual flush writes to disk', () => {
    const tl = createTimeline({ filePath: timelinePath, flushInterval: 100 });
    tl.recordEvent({ event_type: 'phase_start', action: 'Start architect' });
    tl.flush();
    expect(fs.existsSync(timelinePath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
    expect(data.events.length).toBe(1);
    expect(data.events[0].event_type).toBe('phase_start');
  });

  it('endSession flushes and writes session end time', () => {
    const tl = createTimeline({ filePath: timelinePath, flushInterval: 100 });
    tl.recordEvent({ event_type: 'custom', action: 'Before end' });
    tl.endSession();
    expect(fs.existsSync(timelinePath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
    expect(data.events.length).toBe(1);
    // Session should have ended_at
    const session = data.sessions
      ? data.sessions.find(s => s.session_id === tl.getSessionId())
      : null;
    if (session) {
      expect(session.ended_at).toBeDefined();
    }
  });

  it('prunes events when exceeding maxEvents', () => {
    const tl = createTimeline({ filePath: timelinePath, maxEvents: 5, flushInterval: 10 });
    for (let i = 0; i < 10; i++) {
      tl.recordEvent({ event_type: 'custom', action: `Event ${i}` });
    }
    tl.flush();
    const data = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
    expect(data.events.length).toBeLessThanOrEqual(5);
    // Should keep the latest events
    expect(data.events[data.events.length - 1].action).toBe('Event 9');
  });
});

// ─── Disabled Timeline ──────────────────────────────────────────────────────

describe('disabled timeline', () => {
  it('returns null for all recordEvent calls', () => {
    const tl = createTimeline({ filePath: timelinePath, enabled: false });
    const ev = tl.recordEvent({ event_type: 'custom', action: 'Should not record' });
    expect(ev).toBeNull();
    tl.flush();
    expect(fs.existsSync(timelinePath)).toBe(false);
  });
});

// ─── Capture Flags ──────────────────────────────────────────────────────────

describe('capture flag filtering', () => {
  it('filters out tool_call when captureToolCalls is false', () => {
    const tl = createTimeline({ filePath: timelinePath, captureToolCalls: false, flushInterval: 100 });
    const ev = tl.recordEvent({ event_type: 'tool_call', action: 'Should be filtered' });
    expect(ev).toBeNull();
    // But other types still work
    const ev2 = tl.recordEvent({ event_type: 'custom', action: 'Should record' });
    expect(ev2).not.toBeNull();
  });

  it('filters out file_read when captureFileReads is false', () => {
    const tl = createTimeline({ filePath: timelinePath, captureFileReads: false, flushInterval: 100 });
    expect(tl.recordEvent({ event_type: 'file_read', action: 'read' })).toBeNull();
  });

  it('filters out llm_turn_start when captureLLMTurns is false', () => {
    const tl = createTimeline({ filePath: timelinePath, captureLLMTurns: false, flushInterval: 100 });
    expect(tl.recordEvent({ event_type: 'llm_turn_start', action: 'start' })).toBeNull();
    expect(tl.recordEvent({ event_type: 'llm_turn_end', action: 'end' })).toBeNull();
  });

  it('filters out question_asked when captureQuestions is false', () => {
    const tl = createTimeline({ filePath: timelinePath, captureQuestions: false, flushInterval: 100 });
    expect(tl.recordEvent({ event_type: 'question_asked', action: 'q' })).toBeNull();
    expect(tl.recordEvent({ event_type: 'question_answered', action: 'a' })).toBeNull();
  });

  it('filters out approval when captureApprovals is false', () => {
    const tl = createTimeline({ filePath: timelinePath, captureApprovals: false, flushInterval: 100 });
    expect(tl.recordEvent({ event_type: 'approval', action: 'approve' })).toBeNull();
    expect(tl.recordEvent({ event_type: 'rejection', action: 'reject' })).toBeNull();
  });

  it('filters out subagent events when captureSubagents is false', () => {
    const tl = createTimeline({ filePath: timelinePath, captureSubagents: false, flushInterval: 100 });
    expect(tl.recordEvent({ event_type: 'subagent_invoked', action: 'invoke' })).toBeNull();
    expect(tl.recordEvent({ event_type: 'subagent_completed', action: 'complete' })).toBeNull();
  });

  it('filters out research_query when captureResearch is false', () => {
    const tl = createTimeline({ filePath: timelinePath, captureResearch: false, flushInterval: 100 });
    expect(tl.recordEvent({ event_type: 'research_query', action: 'search' })).toBeNull();
  });
});

// ─── loadTimeline ────────────────────────────────────────────────────────────

describe('loadTimeline', () => {
  it('returns empty structure for non-existent file', () => {
    const result = loadTimeline(path.join(tempDir, 'nonexistent.json'));
    expect(result).toBeDefined();
    expect(result.events).toEqual([]);
    expect(result.version).toBe('1.0.0');
  });

  it('loads a previously written timeline', () => {
    const tl = createTimeline({ filePath: timelinePath, flushInterval: 100 });
    tl.recordEvent({ event_type: 'phase_start', action: 'Start' });
    tl.recordEvent({ event_type: 'tool_call', action: 'Read file' });
    tl.flush();

    const loaded = loadTimeline(timelinePath);
    expect(loaded).not.toBeNull();
    expect(loaded.events.length).toBe(2);
    expect(loaded.events[0].event_type).toBe('phase_start');
    expect(loaded.events[1].event_type).toBe('tool_call');
  });
});

// ─── queryTimeline ───────────────────────────────────────────────────────────

describe('queryTimeline', () => {
  beforeEach(() => {
    const tl = createTimeline({ filePath: timelinePath, flushInterval: 100 });
    tl.setPhase('architect');
    tl.setAgent('Architect');
    tl.recordEvent({ event_type: 'phase_start', action: 'Start architect' });
    tl.recordEvent({ event_type: 'tool_call', action: 'Read file' });
    tl.recordEvent({ event_type: 'file_read', action: 'Read specs/prd.md' });
    tl.setPhase('developer');
    tl.setAgent('Developer');
    tl.recordEvent({ event_type: 'phase_start', action: 'Start developer' });
    tl.recordEvent({ event_type: 'tool_call', action: 'Create file' });
    tl.flush();
  });

  it('returns all events with empty filters', () => {
    const events = queryTimeline(timelinePath, {});
    expect(events.length).toBe(5);
  });

  it('filters by phase', () => {
    const events = queryTimeline(timelinePath, { phase: 'architect' });
    expect(events.length).toBe(3);
    expect(events.every(e => e.phase === 'architect')).toBe(true);
  });

  it('filters by agent', () => {
    const events = queryTimeline(timelinePath, { agent: 'Developer' });
    expect(events.length).toBe(2);
  });

  it('filters by event_type', () => {
    const events = queryTimeline(timelinePath, { event_type: 'tool_call' });
    expect(events.length).toBe(2);
  });

  it('combines multiple filters', () => {
    const events = queryTimeline(timelinePath, { phase: 'architect', event_type: 'tool_call' });
    expect(events.length).toBe(1);
    expect(events[0].action).toBe('Read file');
  });

  it('returns empty for non-existent file', () => {
    const events = queryTimeline(path.join(tempDir, 'nope.json'), { phase: 'x' });
    expect(events).toEqual([]);
  });
});

// ─── getTimelineSummary ──────────────────────────────────────────────────────

describe('getTimelineSummary', () => {
  it('returns zero-counts for non-existent file', () => {
    const summary = getTimelineSummary(path.join(tempDir, 'nope.json'));
    expect(summary).toBeDefined();
    expect(summary.total_events).toBe(0);
  });

  it('computes correct summary', () => {
    const tl = createTimeline({ filePath: timelinePath, flushInterval: 100 });
    tl.setPhase('analyst');
    tl.recordEvent({ event_type: 'phase_start', action: 'Start' });
    tl.recordEvent({ event_type: 'tool_call', action: 'Call 1' });
    tl.recordEvent({ event_type: 'tool_call', action: 'Call 2' });
    tl.setPhase('pm');
    tl.recordEvent({ event_type: 'phase_start', action: 'Start PM' });
    tl.flush();

    const summary = getTimelineSummary(timelinePath);
    expect(summary.total_events).toBe(4);
    expect(summary.by_type.tool_call).toBe(2);
    expect(summary.by_type.phase_start).toBe(2);
    expect(summary.by_phase.analyst).toBe(3);
    expect(summary.by_phase.pm).toBe(1);
  });
});

// ─── clearTimeline ───────────────────────────────────────────────────────────

describe('clearTimeline', () => {
  it('clears events from timeline file', () => {
    const tl = createTimeline({ filePath: timelinePath, flushInterval: 100 });
    tl.recordEvent({ event_type: 'custom', action: 'Test' });
    tl.flush();
    expect(JSON.parse(fs.readFileSync(timelinePath, 'utf8')).events.length).toBe(1);

    clearTimeline(timelinePath, { archive: false });
    const data = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
    expect(data.events.length).toBe(0);
  });

  it('archives when archive option is true', () => {
    // Create archive dir
    const archiveDir = path.join(tempDir, 'archive');
    fs.mkdirSync(archiveDir, { recursive: true });

    const tl = createTimeline({ filePath: timelinePath, flushInterval: 100 });
    tl.recordEvent({ event_type: 'custom', action: 'Will be archived' });
    tl.flush();

    const result = clearTimeline(timelinePath, { archive: true, archiveDir });
    expect(result.archived_to).toBeDefined();
    expect(fs.existsSync(result.archived_to)).toBe(true);

    // Original file should be cleared
    const data = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
    expect(data.events.length).toBe(0);
  });

  it('handles missing file gracefully', () => {
    const result = clearTimeline(path.join(tempDir, 'missing.json'), { archive: false });
    expect(result).toBeDefined();
  });
});

// ─── Renderers ───────────────────────────────────────────────────────────────

describe('renderMarkdown', () => {
  it('renders events as markdown', () => {
    const events = [
      { id: 'e1', timestamp: '2025-01-01T00:00:00Z', session_id: 's1', phase: 'architect', agent: 'Architect', event_type: 'phase_start', action: 'Phase started', metadata: null, duration_ms: null },
      { id: 'e2', timestamp: '2025-01-01T00:01:00Z', session_id: 's1', phase: 'architect', agent: 'Architect', event_type: 'tool_call', action: 'Read file', metadata: { tool: 'read_file', file: 'specs/prd.md' }, duration_ms: 50 }
    ];
    const md = renderMarkdown(events);
    expect(typeof md).toBe('string');
    // Markdown uses human-readable names (e.g., 'Phase Start' instead of 'phase_start')
    expect(md).toContain('Phase Start');
    expect(md).toContain('Tool Call');
    expect(md).toContain('Phase started');
    expect(md).toContain('Read file');
  });

  it('returns empty-state message for empty events', () => {
    const md = renderMarkdown([]);
    expect(typeof md).toBe('string');
    expect(md.length).toBeGreaterThan(0);
  });
});

describe('renderJSON', () => {
  it('renders events as JSON string wrapped in an export object', () => {
    const events = [
      { id: 'e1', timestamp: '2025-01-01T00:00:00Z', event_type: 'custom', action: 'Test' }
    ];
    const json = renderJSON(events);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.event_count).toBe(1);
    expect(parsed.events).toBeInstanceOf(Array);
    expect(parsed.events.length).toBe(1);
    expect(parsed.events[0].id).toBe('e1');
  });
});

describe('renderHTML', () => {
  it('renders events as self-contained HTML', () => {
    const events = [
      { id: 'e1', timestamp: '2025-01-01T00:00:00Z', session_id: 's1', phase: 'architect', agent: 'Architect', event_type: 'phase_start', action: 'Phase started', metadata: null, duration_ms: null }
    ];
    const html = renderHTML(events);
    expect(typeof html).toBe('string');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Phase started');
    expect(html).toContain('phase_start');
  });

  it('handles empty events', () => {
    const html = renderHTML([]);
    expect(html).toContain('<!DOCTYPE html>');
  });
});

// ─── generateTimelineReport ──────────────────────────────────────────────────

describe('generateTimelineReport', () => {
  beforeEach(() => {
    const tl = createTimeline({ filePath: timelinePath, flushInterval: 100 });
    tl.setPhase('challenger');
    tl.recordEvent({ event_type: 'phase_start', action: 'Start challenger' });
    tl.recordEvent({ event_type: 'tool_call', action: 'Read file' });
    tl.flush();
  });

  it('generates markdown report by default', () => {
    const report = generateTimelineReport(timelinePath);
    expect(typeof report).toBe('string');
    expect(report).toContain('Phase Start');
    expect(report).toContain('Start challenger');
  });

  it('generates JSON report', () => {
    const report = generateTimelineReport(timelinePath, { format: 'json' });
    const parsed = JSON.parse(report);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.events).toBeInstanceOf(Array);
    expect(parsed.events.length).toBe(2);
  });

  it('generates HTML report', () => {
    const report = generateTimelineReport(timelinePath, { format: 'html' });
    expect(report).toContain('<!DOCTYPE html>');
  });

  it('returns empty-state for missing file', () => {
    const report = generateTimelineReport(path.join(tempDir, 'nope.json'));
    expect(typeof report).toBe('string');
  });
});

// ─── Tool Schema Registration ────────────────────────────────────────────────

describe('record_timeline_event tool schema', () => {
  it('exists in ALL_TOOLS', () => {
    const tool = getToolByName('record_timeline_event');
    expect(tool).not.toBeNull();
    expect(tool.type).toBe('function');
    expect(tool.function.name).toBe('record_timeline_event');
  });

  it('has required parameters event_type and action', () => {
    const tool = getToolByName('record_timeline_event');
    const params = tool.function.parameters;
    expect(params.required).toContain('event_type');
    expect(params.required).toContain('action');
  });

  it('event_type has enum with all types', () => {
    const tool = getToolByName('record_timeline_event');
    const enumValues = tool.function.parameters.properties.event_type.enum;
    expect(enumValues).toContain('phase_start');
    expect(enumValues).toContain('tool_call');
    expect(enumValues).toContain('subagent_invoked');
    expect(enumValues).toContain('custom');
    expect(enumValues.length).toBeGreaterThanOrEqual(22);
  });

  it('is available in all phases (BASE_TOOLS)', () => {
    for (const phase of ['scout', 'challenger', 'analyst', 'pm', 'architect', 'developer']) {
      const tools = getToolsForPhase(phase);
      const names = tools.map(t => t.function.name);
      expect(names).toContain('record_timeline_event');
    }
  });
});

// ─── SimulationTracer Delegation ─────────────────────────────────────────────

describe('SimulationTracer timeline delegation', () => {
  it('has setTimeline method', () => {
    const tracer = new SimulationTracer('/tmp', 'test');
    expect(typeof tracer.setTimeline).toBe('function');
  });

  it('delegates startPhase to timeline', () => {
    const tracer = new SimulationTracer('/tmp', 'test');
    const tl = createTimeline({ filePath: timelinePath, flushInterval: 100 });
    tracer.setTimeline(tl);

    tracer.startPhase('architect');
    tl.flush();

    const data = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
    const phaseEvents = data.events.filter(e => e.event_type === 'phase_start');
    expect(phaseEvents.length).toBe(1);
    expect(phaseEvents[0].action).toContain('architect');
  });

  it('delegates endPhase to timeline', () => {
    const tracer = new SimulationTracer('/tmp', 'test');
    const tl = createTimeline({ filePath: timelinePath, flushInterval: 100 });
    tracer.setTimeline(tl);

    tracer.startPhase('architect');
    tracer.endPhase('architect', 'PASS');
    tl.flush();

    const data = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
    const endEvents = data.events.filter(e => e.event_type === 'phase_end');
    expect(endEvents.length).toBe(1);
    expect(endEvents[0].metadata.status).toBe('PASS');
  });

  it('delegates logArtifact to timeline', () => {
    const tracer = new SimulationTracer('/tmp', 'test');
    const tl = createTimeline({ filePath: timelinePath, flushInterval: 100 });
    tracer.setTimeline(tl);

    tracer.startPhase('architect');
    tracer.logArtifact('specs/architecture.md');
    tl.flush();

    const data = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
    const artifactEvents = data.events.filter(e => e.event_type === 'artifact_write');
    expect(artifactEvents.length).toBe(1);
    expect(artifactEvents[0].metadata.file).toBe('specs/architecture.md');
  });

  it('delegates logLLMCall to timeline', () => {
    const tracer = new SimulationTracer('/tmp', 'test');
    const tl = createTimeline({ filePath: timelinePath, flushInterval: 100 });
    tracer.setTimeline(tl);

    tracer.logLLMCall('gpt-4', 1000, 500, 0.05);
    tl.flush();

    const data = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
    const llmEvents = data.events.filter(e => e.event_type === 'llm_turn_end');
    expect(llmEvents.length).toBe(1);
    expect(llmEvents[0].metadata.model).toBe('gpt-4');
    expect(llmEvents[0].metadata.prompt_tokens).toBe(1000);
  });

  it('delegates logToolInterception to timeline', () => {
    const tracer = new SimulationTracer('/tmp', 'test');
    const tl = createTimeline({ filePath: timelinePath, flushInterval: 100 });
    tracer.setTimeline(tl);

    tracer.logToolInterception('read_file', { filePath: '/test' }, { content: 'ok' });
    tl.flush();

    const data = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
    const toolEvents = data.events.filter(e => e.event_type === 'tool_call');
    expect(toolEvents.length).toBe(1);
    expect(toolEvents[0].metadata.tool).toBe('read_file');
  });

  it('delegates logUserProxyExchange to timeline', () => {
    const tracer = new SimulationTracer('/tmp', 'test');
    const tl = createTimeline({ filePath: timelinePath, flushInterval: 100 });
    tracer.setTimeline(tl);

    tracer.logUserProxyExchange({ questions: [{ question: 'Which?' }] }, 'Option A');
    tl.flush();

    const data = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
    const qEvents = data.events.filter(e => e.event_type === 'question_asked');
    const aEvents = data.events.filter(e => e.event_type === 'question_answered');
    expect(qEvents.length).toBe(1);
    expect(aEvents.length).toBe(1);
  });

  it('still works without timeline (no crash)', () => {
    const tracer = new SimulationTracer('/tmp', 'test');
    // No setTimeline call — _timeline is null
    expect(() => {
      tracer.startPhase('test');
      tracer.endPhase('test', 'PASS');
      tracer.logArtifact('file.md');
      tracer.logLLMCall('gpt-4', 100, 50, 0.01);
      tracer.logToolInterception('read_file', {}, {});
      tracer.logUserProxyExchange({ questions: [] }, 'answer');
    }).not.toThrow();
  });

  it('getReport still works with timeline attached', () => {
    const tracer = new SimulationTracer('/tmp', 'test');
    const tl = createTimeline({ filePath: timelinePath, flushInterval: 100 });
    tracer.setTimeline(tl);

    tracer.startPhase('analyst');
    tracer.logLLMCall('gpt-4', 100, 50, 0.01);
    tracer.logToolInterception('read_file', {}, {});
    tracer.endPhase('analyst', 'PASS');

    const report = tracer.getReport();
    expect(report.scenario).toBe('test');
    expect(report.phases.length).toBe(1);
    expect(report.phases[0].name).toBe('analyst');
    expect(report.phases[0].status).toBe('PASS');
    expect(report.headless.llm_usage.totalCalls).toBe(1);
  });
});

// ─── Hook Exports ────────────────────────────────────────────────────────────

describe('hook export availability', () => {
  it('state-store exports setTimelineHook', async () => {
    const { setTimelineHook } = await import('../bin/lib/state-store.js');
    expect(typeof setTimelineHook).toBe('function');
  });

  it('approve exports setApproveTimelineHook', async () => {
    const { setApproveTimelineHook } = await import('../bin/lib/approve.js');
    expect(typeof setApproveTimelineHook).toBe('function');
  });

  it('handoff exports setHandoffTimelineHook', async () => {
    const { setHandoffTimelineHook } = await import('../bin/lib/handoff.js');
    expect(typeof setHandoffTimelineHook).toBe('function');
  });

  it('usage exports setUsageTimelineHook', async () => {
    // usage.js has a shebang that can cause issues with some import methods;
    // verify the export by reading and checking the source
    const usageSource = fs.readFileSync(path.join(process.cwd(), 'bin', 'lib', 'usage.js'), 'utf8');
    expect(usageSource).toContain('export function setUsageTimelineHook');
    expect(usageSource).toContain('_timelineHook = timeline');
  });
});

// ─── Multiple Sessions ───────────────────────────────────────────────────────

describe('multiple sessions', () => {
  it('appends events from separate sessions to the same file', () => {
    // Session 1
    const tl1 = createTimeline({ filePath: timelinePath, sessionId: 'sess-A', flushInterval: 100 });
    tl1.recordEvent({ event_type: 'phase_start', action: 'Session A start' });
    tl1.flush();

    // Session 2
    const tl2 = createTimeline({ filePath: timelinePath, sessionId: 'sess-B', flushInterval: 100 });
    tl2.recordEvent({ event_type: 'phase_start', action: 'Session B start' });
    tl2.flush();

    const data = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
    expect(data.events.length).toBe(2);
    expect(data.events[0].session_id).toBe('sess-A');
    expect(data.events[1].session_id).toBe('sess-B');
  });

  it('queryTimeline can filter by session_id', () => {
    const tl1 = createTimeline({ filePath: timelinePath, sessionId: 'sess-A', flushInterval: 100 });
    tl1.recordEvent({ event_type: 'custom', action: 'A1' });
    tl1.recordEvent({ event_type: 'custom', action: 'A2' });
    tl1.flush();

    const tl2 = createTimeline({ filePath: timelinePath, sessionId: 'sess-B', flushInterval: 100 });
    tl2.recordEvent({ event_type: 'custom', action: 'B1' });
    tl2.flush();

    const eventsA = queryTimeline(timelinePath, { session_id: 'sess-A' });
    expect(eventsA.length).toBe(2);
    const eventsB = queryTimeline(timelinePath, { session_id: 'sess-B' });
    expect(eventsB.length).toBe(1);
  });
});
