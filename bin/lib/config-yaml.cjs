const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

function parseConfigDocument(configPath) {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const content = fs.readFileSync(configPath, 'utf8');
  const doc = YAML.parseDocument(content, {
    prettyErrors: true,
    strict: true,
  });

  if (doc.errors && doc.errors.length > 0) {
    const message = doc.errors.map(error => error.message).join('; ');
    throw new Error(`Invalid YAML in ${configPath}: ${message}`);
  }

  return doc;
}

function writeConfigDocument(configPath, doc) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, doc.toString(), 'utf8');
}

function updateBootstrapAnswers(configPath, updates = {}) {
  const doc = parseConfigDocument(configPath);
  const applied = [];

  if (updates.projectName !== undefined && updates.projectName !== null && updates.projectName !== '') {
    doc.setIn(['project', 'name'], updates.projectName);
    applied.push('project.name');
  }

  if (updates.projectType !== undefined && updates.projectType !== null && updates.projectType !== '') {
    doc.setIn(['project', 'type'], updates.projectType);
    applied.push('project.type');
  }

  if (updates.approverName !== undefined && updates.approverName !== null && updates.approverName !== '') {
    doc.setIn(['project', 'approver'], updates.approverName);
    applied.push('project.approver');
  }

  if (applied.length === 0) {
    return { applied, changed: false };
  }

  writeConfigDocument(configPath, doc);
  return { applied, changed: true };
}

function setWorkflowCurrentPhase(configPath, phase) {
  const doc = parseConfigDocument(configPath);
  doc.setIn(['workflow', 'current_phase'], phase);
  writeConfigDocument(configPath, doc);
  return { changed: true, current_phase: phase };
}

function getWorkflowSettings(configPath) {
  const doc = parseConfigDocument(configPath);
  const autoHandoffValue = doc.getIn(['workflow', 'auto_handoff']);
  const currentPhase = doc.getIn(['workflow', 'current_phase']);

  return {
    auto_handoff: autoHandoffValue !== false,
    current_phase: currentPhase,
  };
}

module.exports = {
  updateBootstrapAnswers,
  setWorkflowCurrentPhase,
  getWorkflowSettings,
  parseConfigDocument,
  writeConfigDocument,
};
