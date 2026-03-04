/**
 * approve.js — Streamlined Approval & Rejection (UX Feature 4)
 *
 * Programmatic artifact approval / rejection without manually
 * editing Markdown checkboxes.
 */

const { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } = require('fs');
const { join, relative } = require('path');
const { getWorkflowSettings, setWorkflowCurrentPhase } = require('./config-yaml.cjs');

const AGENT_COMMANDS = {
  scout: '/jumpstart.scout',
  challenger: '/jumpstart.challenge',
  analyst: '/jumpstart.analyze',
  pm: '/jumpstart.plan',
  architect: '/jumpstart.architect',
  developer: '/jumpstart.build'
};

// ─── Timeline Hook ───────────────────────────────────────────────────────────
let _timelineHook = null;

/**
 * Set the timeline instance for recording approval/rejection events.
 * @param {object|null} timeline - Timeline instance with recordEvent() method.
 */
function setApproveTimelineHook(timeline) {
  _timelineHook = timeline;
}

/**
 * Phase-to-artifact mapping (primary artifacts only).
 */
const PHASE_ARTIFACT_MAP = {
  '-1': 'specs/codebase-context.md',
  '0': 'specs/challenger-brief.md',
  '1': 'specs/product-brief.md',
  '2': 'specs/prd.md',
  '3': 'specs/architecture.md',
  '4': null
};

const PHASE_MAP = {
  '-1': {
    name: 'Scout',
    next_phase: 0,
    next_agent: 'challenger',
    next_artifacts: ['specs/challenger-brief.md', 'specs/insights/challenger-brief-insights.md'],
    next_context: ['.jumpstart/config.yaml', '.jumpstart/roadmap.md', 'specs/codebase-context.md']
  },
  '0': {
    name: 'Challenger',
    next_phase: 1,
    next_agent: 'analyst',
    next_artifacts: ['specs/product-brief.md', 'specs/insights/product-brief-insights.md'],
    next_context: ['.jumpstart/config.yaml', '.jumpstart/roadmap.md', 'specs/challenger-brief.md']
  },
  '1': {
    name: 'Analyst',
    next_phase: 2,
    next_agent: 'pm',
    next_artifacts: ['specs/prd.md', 'specs/insights/prd-insights.md'],
    next_context: ['.jumpstart/config.yaml', '.jumpstart/roadmap.md', 'specs/challenger-brief.md', 'specs/product-brief.md']
  },
  '2': {
    name: 'PM',
    next_phase: 3,
    next_agent: 'architect',
    next_artifacts: ['specs/architecture.md', 'specs/implementation-plan.md', 'specs/insights/architecture-insights.md'],
    next_context: ['.jumpstart/config.yaml', '.jumpstart/roadmap.md', 'specs/challenger-brief.md', 'specs/product-brief.md', 'specs/prd.md']
  },
  '3': {
    name: 'Architect',
    next_phase: 4,
    next_agent: 'developer',
    next_artifacts: ['specs/insights/implementation-insights.md'],
    next_context: ['.jumpstart/config.yaml', '.jumpstart/roadmap.md', 'specs/prd.md', 'specs/architecture.md', 'specs/implementation-plan.md']
  },
  '4': {
    name: 'Developer',
    next_phase: null,
    next_agent: null,
    next_artifacts: [],
    next_context: []
  }
};

function now() {
  return new Date().toISOString();
}

function defaultState() {
  return {
    version: '1.0.0',
    current_phase: null,
    current_agent: null,
    current_step: null,
    last_completed_step: null,
    active_artifacts: [],
    approved_artifacts: [],
    phase_history: [],
    last_updated: null,
    resume_context: {
      tldr: null,
      last_action: null,
      next_action: null,
      open_questions: [],
      key_insights: [],
      last_agent: null,
      last_phase: null,
      last_step: null,
      timestamp: null
    }
  };
}

function normalizeState(state) {
  const base = defaultState();
  const merged = {
    ...base,
    ...(state || {}),
  };

  if (!Array.isArray(merged.active_artifacts)) merged.active_artifacts = [];
  if (!Array.isArray(merged.approved_artifacts)) merged.approved_artifacts = [];
  if (!Array.isArray(merged.phase_history)) merged.phase_history = [];
  if (!merged.resume_context || typeof merged.resume_context !== 'object') {
    merged.resume_context = base.resume_context;
  }

  return merged;
}

function loadState(statePath) {
  if (!existsSync(statePath)) {
    return defaultState();
  }
  try {
    const parsed = JSON.parse(readFileSync(statePath, 'utf8'));
    return normalizeState(parsed);
  } catch {
    return defaultState();
  }
}

function saveState(state, statePath) {
  state.last_updated = new Date().toISOString();
  writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
  return { success: true };
}

function updateState(updates, statePath) {
  const state = loadState(statePath);

  if (updates.phase !== undefined) {
    if (state.current_phase !== null && state.current_phase !== updates.phase) {
      state.phase_history.push({
        phase: state.current_phase,
        agent: state.current_agent,
        completed_at: new Date().toISOString()
      });
    }
    state.current_phase = updates.phase;
  }

  if (updates.agent !== undefined) state.current_agent = updates.agent;
  if (updates.step !== undefined) state.current_step = updates.step;
  if (updates.last_completed_step !== undefined) state.last_completed_step = updates.last_completed_step;
  if (updates.active_artifacts) state.active_artifacts = updates.active_artifacts;
  if (updates.resume_context) state.resume_context = updates.resume_context;

  if (updates.approved_artifact) {
    if (!state.approved_artifacts.includes(updates.approved_artifact)) {
      state.approved_artifacts.push(updates.approved_artifact);
    }
  }

  saveState(state, statePath);
  return { success: true, state };
}

function syncPhaseState(phase, options = {}) {
  const root = options.root || process.cwd();
  const statePath = options.statePath || join(root, '.jumpstart', 'state', 'state.json');
  const configPath = options.configPath || join(root, '.jumpstart', 'config.yaml');

  const updates = { phase };
  if (options.agent !== undefined) {
    updates.agent = options.agent;
  }

  const stateResult = updateState(updates, statePath);

  try {
    setWorkflowCurrentPhase(configPath, phase);
  } catch (error) {
    return {
      success: false,
      state: stateResult.state,
      error: `Failed to sync workflow.current_phase in config.yaml: ${error.message}`,
    };
  }

  return { success: true, state: stateResult.state };
}

function getHandoff(currentPhase) {
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

function detectCurrentArtifact(options = {}) {
  const root = options.root || process.cwd();
  const statePath = options.statePath || join(root, '.jumpstart', 'state', 'state.json');
  const state = loadState(statePath);

  const phase = state.current_phase;
  if (phase === null || phase === undefined) {
    return { phase: null, artifact_path: null, exists: false };
  }

  const artifact = PHASE_ARTIFACT_MAP[String(phase)];
  if (!artifact) {
    return { phase, artifact_path: null, exists: false };
  }

  const fullPath = join(root, artifact);
  return { phase, artifact_path: artifact, exists: existsSync(fullPath) };
}

function approveArtifact(filePath, options = {}) {
  const root = options.root || process.cwd();
  const fullPath = filePath.startsWith('/') || filePath.includes(':') ? filePath : join(root, filePath);
  const relPath = relative(root, fullPath).replace(/\\/g, '/');
  const approver = options.approver || 'Human';
  const statePath = options.statePath || join(root, '.jumpstart', 'state', 'state.json');
  const configPath = options.configPath || join(root, '.jumpstart', 'config.yaml');

  if (!existsSync(fullPath)) {
    return { success: false, error: `Artifact not found: ${filePath}` };
  }

  let content = readFileSync(fullPath, 'utf8');

  if (!/## Phase Gate Approval/i.test(content)) {
    return { success: false, error: 'No "## Phase Gate Approval" section found in artifact' };
  }

  content = content.replace(/- \[ \]/g, '- [x]');
  content = content.replace(/(\*\*Approved by:\*\*)\s*.+/i, `$1 ${approver}`);

  const dateStr = now().split('T')[0];
  content = content.replace(/(\*\*Approval date:\*\*)\s*.+/i, `$1 ${dateStr}`);
  content = content.replace(/(\*\*Status:\*\*)\s*.+/i, '$1 Approved');

  writeFileSync(fullPath, content, 'utf8');

  updateState({ approved_artifact: relPath }, statePath);

  // Record approval in timeline
  if (_timelineHook) {
    _timelineHook.recordEvent({
      event_type: 'approval',
      action: `Artifact approved: ${relPath}`,
      metadata: { artifact_path: relPath, approver, date: dateStr }
    });
  }
  const state = loadState(statePath);
  let handoffInfo = null;
  let autoHandoff = {
    enabled: false,
    advanced: false,
    command: null,
    warning: null,
  };

  try {
    const settings = getWorkflowSettings(configPath);
    autoHandoff.enabled = settings.auto_handoff !== false;
  } catch {
    autoHandoff.warning = 'Could not read workflow settings from config.yaml; auto-handoff skipped.';
  }

  if (state.current_phase !== null && state.current_phase !== undefined) {
    handoffInfo = getHandoff(state.current_phase);

    if (autoHandoff.enabled && handoffInfo && handoffInfo.ready) {
      const syncResult = syncPhaseState(handoffInfo.next_phase, {
        root,
        statePath,
        configPath,
        agent: handoffInfo.next_agent,
      });

      if (syncResult.success) {
        autoHandoff.advanced = true;
        autoHandoff.command = AGENT_COMMANDS[handoffInfo.next_agent] || null;
      } else {
        autoHandoff.warning = syncResult.error || 'Unable to sync phase progression.';
      }
    }
  }

  return {
    success: true,
    artifact: relPath,
    approver,
    date: dateStr,
    handoff_info: handoffInfo,
    auto_handoff: autoHandoff
  };
}

function rejectArtifact(filePath, options = {}) {
  const root = options.root || process.cwd();
  const fullPath = filePath.startsWith('/') || filePath.includes(':') ? filePath : join(root, filePath);
  const relPath = relative(root, fullPath).replace(/\\/g, '/');
  const reason = options.reason || 'No reason provided';
  const statePath = options.statePath || join(root, '.jumpstart', 'state', 'state.json');

  if (!existsSync(fullPath)) {
    return { success: false, error: `Artifact not found: ${filePath}` };
  }

  let content = readFileSync(fullPath, 'utf8');

  if (!/## Phase Gate Approval/i.test(content)) {
    return { success: false, error: 'No "## Phase Gate Approval" section found in artifact' };
  }

  content = content.replace(/- \[x\]/gi, '- [ ]');
  content = content.replace(/(\*\*Approved by:\*\*)\s*.+/i, '$1 Pending');
  content = content.replace(/(\*\*Approval date:\*\*)\s*.+/i, '$1 Pending');
  content = content.replace(/(\*\*Status:\*\*)\s*.+/i, '$1 Draft');

  writeFileSync(fullPath, content, 'utf8');

  const state = loadState(statePath);
  state.approved_artifacts = (state.approved_artifacts || []).filter(a => a !== relPath);
  saveState(state, statePath);

  // Record rejection in timeline
  if (_timelineHook) {
    _timelineHook.recordEvent({
      event_type: 'rejection',
      action: `Artifact rejected: ${relPath}`,
      metadata: { artifact_path: relPath, reason }
    });
  }
  let loggedTo = null;
  try {
    const insightsDir = join(root, 'specs', 'insights');
    if (!existsSync(insightsDir)) {
      mkdirSync(insightsDir, { recursive: true });
    }
    const logFile = join(insightsDir, 'rejection-log.md');
    loggedTo = 'specs/insights/rejection-log.md';

    const entry = `\n## Rejection — ${now()}\n\n- **Artifact:** ${relPath}\n- **Reason:** ${reason}\n- **Date:** ${now()}\n\n---\n`;

    if (!existsSync(logFile)) {
      writeFileSync(logFile, `# Rejection Log\n\nAudit trail of artifact rejections.\n${entry}`, 'utf8');
    } else {
      appendFileSync(logFile, entry, 'utf8');
    }
  } catch {
  }

  return {
    success: true,
    artifact: relPath,
    reason,
    logged_to: loggedTo
  };
}

function renderApprovalResult(result) {
  if (!result.success) {
    return `\n  ❌ Approval failed: ${result.error}\n`;
  }

  const lines = [];
  lines.push('');
  lines.push(`  ✅ Approved: ${result.artifact}`);
  lines.push(`     Approver: ${result.approver}`);
  lines.push(`     Date: ${result.date}`);

  if (result.handoff_info && result.handoff_info.ready) {
    lines.push('');
    lines.push(`  ▶ Next: Phase ${result.handoff_info.next_phase} — ${result.handoff_info.next_agent}`);
    if (result.auto_handoff && result.auto_handoff.advanced) {
      lines.push('    Auto-advanced phase state.');
      if (result.auto_handoff.command) {
        lines.push(`    Start next agent: ${result.auto_handoff.command}`);
      } else {
        lines.push('    Start next agent using your phase command.');
      }
    } else {
      lines.push('    Run /jumpstart.next to continue');
    }
  }

  if (result.auto_handoff && result.auto_handoff.warning) {
    lines.push('');
    lines.push(`  ⚠ ${result.auto_handoff.warning}`);
  }

  lines.push('');
  return lines.join('\n');
}

function renderRejectionResult(result) {
  if (!result.success) {
    return `\n  ❌ Rejection failed: ${result.error}\n`;
  }

  const lines = [];
  lines.push('');
  lines.push(`  🚫 Rejected: ${result.artifact}`);
  lines.push(`     Reason: ${result.reason}`);
  if (result.logged_to) {
    lines.push(`     Logged to: ${result.logged_to}`);
  }
  lines.push('');
  lines.push('  Revision needed — update the artifact and re-approve when ready.');
  lines.push('');
  return lines.join('\n');
}

exports.detectCurrentArtifact = detectCurrentArtifact;
exports.approveArtifact = approveArtifact;
exports.rejectArtifact = rejectArtifact;
exports.renderApprovalResult = renderApprovalResult;
exports.renderRejectionResult = renderRejectionResult;
exports.setApproveTimelineHook = setApproveTimelineHook;

if (process.argv[1] && process.argv[1].endsWith('approve.js')) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(input || '{}');
      const action = data.action || 'approve';
      let result;
      if (action === 'reject') {
        result = rejectArtifact(data.artifact, {
          reason: data.reason,
          root: data.root
        });
      } else {
        result = approveArtifact(data.artifact, {
          approver: data.approver,
          root: data.root
        });
      }
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } catch (err) {
      process.stderr.write(JSON.stringify({ error: err.message }) + '\n');
      process.exit(1);
    }
  });
}
