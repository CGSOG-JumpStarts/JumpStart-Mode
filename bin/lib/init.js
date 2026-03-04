/**
 * init.js — Interactive Init (Item 76)
 *
 * Adjusts explanation detail based on user's chosen skill level.
 * Asks skill-level questions during initialization and stores
 * preferences in config.
 *
 * Usage:
 *   echo '{"skill_level":"beginner"}' | node bin/lib/init.js
 *
 * Input (stdin JSON):
 *   {
 *     "skill_level": "beginner" | "intermediate" | "expert",
 *     "project_type": "greenfield" | "brownfield"
 *   }
 *
 * Output (stdout JSON):
 *   {
 *     "skill_level": "beginner",
 *     "config_overrides": { ... },
 *     "explanation_depth": "detailed",
 *     "recommendations": [...]
 *   }
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/**
 * Skill-level presets that adjust framework behavior.
 */
const SKILL_PRESETS = {
  beginner: {
    explanation_depth: 'detailed',
    show_examples: true,
    verbose_gates: true,
    auto_hints: true,
    config_overrides: {
      'workflow.explanation_level': 'detailed',
      'workflow.show_hints': true,
      'workflow.verbose_gates': true
    },
    recommendations: [
      'Read the AGENTS.md file for an overview of the workflow',
      'Start with /jumpstart.challenge to define your problem',
      'Follow each phase sequentially — do not skip ahead',
      'Use /jumpstart.help at any time for phase-specific guidance',
      'Review the Gherkin guide for writing acceptance criteria'
    ]
  },
  intermediate: {
    explanation_depth: 'standard',
    show_examples: false,
    verbose_gates: true,
    auto_hints: false,
    config_overrides: {
      'workflow.explanation_level': 'standard',
      'workflow.show_hints': false,
      'workflow.verbose_gates': true
    },
    recommendations: [
      'Run /jumpstart.status to see project progress at any time',
      'Use /jumpstart.pitcrew for multi-agent advisory discussions',
      'Review specs/ artifacts before advancing phases'
    ]
  },
  expert: {
    explanation_depth: 'minimal',
    show_examples: false,
    verbose_gates: false,
    auto_hints: false,
    config_overrides: {
      'workflow.explanation_level': 'minimal',
      'workflow.show_hints': false,
      'workflow.verbose_gates': false
    },
    recommendations: [
      'Use /jumpstart.quick for small changes that skip full flow',
      'Run /jumpstart.crossref to validate spec linkage',
      'Consider /jumpstart.scan for brownfield projects'
    ]
  }
};

/**
 * Generate initialization configuration based on skill level.
 *
 * @param {object} input - Init options.
 * @param {string} input.skill_level - User skill level.
 * @param {string} [input.project_type] - Greenfield or brownfield.
 * @returns {object} Init configuration.
 */
function generateInitConfig(input) {
  const { skill_level = 'intermediate', project_type = 'greenfield' } = input;
  const normalizedLevel = skill_level.toLowerCase();

  const preset = SKILL_PRESETS[normalizedLevel] || SKILL_PRESETS.intermediate;

  // Add project-type-specific recommendations
  const recommendations = [...preset.recommendations];
  if (project_type === 'brownfield') {
    recommendations.unshift('Run /jumpstart.scout first to analyze your existing codebase');
    recommendations.push('The Scout output will inform all subsequent phases');
  }

  return {
    skill_level: normalizedLevel,
    project_type,
    explanation_depth: preset.explanation_depth,
    show_examples: preset.show_examples,
    verbose_gates: preset.verbose_gates,
    auto_hints: preset.auto_hints,
    config_overrides: preset.config_overrides,
    recommendations
  };
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

if (process.argv[1] && (
  process.argv[1].endsWith('init.js') ||
  process.argv[1].endsWith('init')
)) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const parsed = input.trim() ? JSON.parse(input) : {};
      const result = generateInitConfig(parsed);
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } catch (err) {
      process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
      process.exit(2);
    }
  });

  if (process.stdin.isTTY) {
    const result = generateInitConfig({});
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  }
}

export { generateInitConfig, SKILL_PRESETS };
