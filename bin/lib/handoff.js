/**
 * handoff.js — Auto-Handoff Logic (Item 37)
 *
 * After a phase artifact is approved, this module initialises the next phase's
 * artifacts and agent context automatically.
 *
 * Usage:
 *   echo '{"phase":2,"artifact":"specs/prd.md"}' | node bin/lib/handoff.js
 *
 * Input (stdin JSON):
 *   {
 *     "phase": 2,
 *     "artifact": "specs/prd.md",
 *     "config_path": ".jumpstart/config.yaml"
 *   }
 *
 * Output (stdout JSON):
 *   {
 *     "current_phase": 2,
 *     "next_phase": 3,
 *     "next_agent": "architect",
 *     "artifacts_to_create": [...],
 *     "context_files": [...],
 *     "ready": true
 *   }
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { existsSync } = require('fs');

// ─── Timeline Hook ───────────────────────────────────────────────────────────
let _timelineHook = null;

/**
 * Set the timeline instance for recording handoff events.
 * @param {object|null} timeline - Timeline instance with recordEvent() method.
 */
export function setHandoffTimelineHook(timeline) {
  _timelineHook = timeline;
}

/**
 * Phase transition map.
 * Each phase defines what artifacts and context the next phase needs.
 */
const PHASE_MAP = {
  '-1': {
    name: 'Scout',
    artifact: 'specs/codebase-context.md',
    next_phase: 0,
    next_agent: 'challenger',
    next_artifacts: ['specs/challenger-brief.md', 'specs/insights/challenger-brief-insights.md'],
    next_context: ['.jumpstart/config.yaml', '.jumpstart/roadmap.md', 'specs/codebase-context.md']
  },
  '0': {
    name: 'Challenger',
    artifact: 'specs/challenger-brief.md',
    next_phase: 1,
    next_agent: 'analyst',
    next_artifacts: ['specs/product-brief.md', 'specs/insights/product-brief-insights.md'],
    next_context: ['.jumpstart/config.yaml', '.jumpstart/roadmap.md', 'specs/challenger-brief.md']
  },
  '1': {
    name: 'Analyst',
    artifact: 'specs/product-brief.md',
    next_phase: 2,
    next_agent: 'pm',
    next_artifacts: ['specs/prd.md', 'specs/insights/prd-insights.md'],
    next_context: ['.jumpstart/config.yaml', '.jumpstart/roadmap.md', 'specs/challenger-brief.md', 'specs/product-brief.md']
  },
  '2': {
    name: 'PM',
    artifact: 'specs/prd.md',
    next_phase: 3,
    next_agent: 'architect',
    next_artifacts: ['specs/architecture.md', 'specs/implementation-plan.md', 'specs/insights/architecture-insights.md'],
    next_context: ['.jumpstart/config.yaml', '.jumpstart/roadmap.md', 'specs/challenger-brief.md', 'specs/product-brief.md', 'specs/prd.md']
  },
  '3': {
    name: 'Architect',
    artifact: 'specs/architecture.md',
    next_phase: 4,
    next_agent: 'developer',
    next_artifacts: ['specs/insights/implementation-insights.md'],
    next_context: ['.jumpstart/config.yaml', '.jumpstart/roadmap.md', 'specs/prd.md', 'specs/architecture.md', 'specs/implementation-plan.md']
  },
  '4': {
    name: 'Developer',
    artifact: null,
    next_phase: null,
    next_agent: null,
    next_artifacts: [],
    next_context: []
  }
};

/**
 * Check if an artifact is approved by scanning for Phase Gate approval markers.
 * @param {string} content - File content
 * @returns {boolean}
 */
export function isArtifactApproved(content) {
  if (!content) return false;
  const hasGateSection = /## Phase Gate Approval/i.test(content);
  if (!hasGateSection) return false;

  // Check that "Approved by" is not "Pending"
  const approvedByMatch = content.match(/\*\*Approved by:\*\*\s*(.+)/i);
  if (!approvedByMatch || approvedByMatch[1].trim().toLowerCase() === 'pending') return false;

  // Check all checkboxes are checked
  const gateSection = content.split(/## Phase Gate Approval/i)[1] || '';
  const unchecked = gateSection.match(/- \[ \]/g);
  return !unchecked || unchecked.length === 0;
}

/**
 * Determine the next phase handoff from a given phase.
 * @param {number} currentPhase
 * @returns {object}
 */
export function getHandoff(currentPhase) {
  const key = String(currentPhase);
  const transition = PHASE_MAP[key];

  if (!transition) {
    return { error: `Unknown phase: ${currentPhase}`, ready: false };
  }

  if (transition.next_phase === null) {
    return {
      current_phase: currentPhase,
      next_phase: null,
      next_agent: null,
      message: 'Phase 4 is the final phase. No further handoff needed.',
      ready: false
    };
  }

  return {
    current_phase: currentPhase,
    current_name: transition.name,
    next_phase: transition.next_phase,
    next_agent: transition.next_agent,
    artifacts_to_create: transition.next_artifacts,
    context_files: transition.next_context,
    ready: true
  };
}

/**
 * Execute a handoff and record it in the timeline.
 * @param {number} currentPhase
 * @returns {object} Handoff result.
 */
export function executeHandoff(currentPhase) {
  const result = getHandoff(currentPhase);
  
  if (result.ready && _timelineHook) {
    _timelineHook.recordEvent({
      event_type: 'handoff',
      phase: currentPhase,
      action: `Handoff: Phase ${currentPhase} (${result.current_name}) → Phase ${result.next_phase} (${result.next_agent})`,
      metadata: {
        source_phase: currentPhase,
        target_phase: result.next_phase,
        next_agent: result.next_agent,
        context_files: result.context_files
      }
    });
  }
  
  return result;
}

// CLI mode
if (process.argv[1] && process.argv[1].endsWith('handoff.js')) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(input || '{}');
      const result = getHandoff(data.phase);
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } catch (err) {
      process.stderr.write(JSON.stringify({ error: err.message }) + '\n');
      process.exit(1);
    }
  });
}
