#!/usr/bin/env node

/**
 * uat-coverage.js — Automated User Acceptance Testing (UAT) Alignment
 *
 * Part of Jump Start Framework.
 *
 * Extends the coverage.js concept to verify that PRD acceptance criteria
 * (Gherkin-style Given/When/Then or plain-text AC) are actually covered
 * by the generated test suite. Bridges Phase 2 (Planning) and Phase 4
 * (Implementing) by ensuring tests fulfil business needs.
 *
 * Usage:
 *   node bin/lib/uat-coverage.js specs/prd.md tests/
 *
 * Output: JSON or Markdown report showing AC → test mapping.
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Extract acceptance criteria from a PRD document.
 * Supports both Gherkin (Given/When/Then) and bullet-list AC formats.
 *
 * @param {string} prdContent - PRD markdown content.
 * @returns {Array<{ story_id: string, criteria: string[], gherkin: string[] }>}
 */
function extractAcceptanceCriteria(prdContent) {
  const stories = [];
  const storyPattern = /\b(E\d+-S\d+)\b/g;
  const storyIds = [...new Set((prdContent.match(storyPattern) || []))];

  for (const storyId of storyIds) {
    // Find the section for this story
    const escapedId = storyId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sectionRegex = new RegExp(
      `${escapedId}[\\s\\S]*?(?=E\\d+-S\\d+|## |$)`,
      'g'
    );
    const section = sectionRegex.exec(prdContent);

    if (!section) {
      stories.push({ story_id: storyId, criteria: [], gherkin: [] });
      continue;
    }

    const sectionText = section[0];

    // Extract Gherkin blocks (Given/When/Then)
    const gherkinLines = [];
    const gherkinPattern = /^\s*(Given|When|Then|And|But)\s+(.+)/gm;
    let gherkinMatch;
    while ((gherkinMatch = gherkinPattern.exec(sectionText)) !== null) {
      gherkinLines.push(`${gherkinMatch[1]} ${gherkinMatch[2].trim()}`);
    }

    // Extract bullet-point acceptance criteria
    const criteria = [];
    // Look for AC section markers
    const acSection = sectionText.match(
      /(?:acceptance\s+criteria|AC|criteria)[:\s]*\n([\s\S]*?)(?=\n(?:#{1,3}\s|\n\n)|$)/i
    );

    if (acSection) {
      const bulletPattern = /^\s*[-*]\s+(.+)/gm;
      let bulletMatch;
      while ((bulletMatch = bulletPattern.exec(acSection[1])) !== null) {
        criteria.push(bulletMatch[1].trim());
      }
    }

    // Also extract standalone bullet criteria near the story ID
    if (criteria.length === 0) {
      const bulletPattern = /^\s*[-*]\s+(.+)/gm;
      let bulletMatch;
      while ((bulletMatch = bulletPattern.exec(sectionText)) !== null) {
        const text = bulletMatch[1].trim();
        // Filter out non-AC items (headers, metadata, etc.)
        if (text.length > 10 && !text.startsWith('#') && !text.startsWith('|')) {
          criteria.push(text);
        }
      }
    }

    stories.push({
      story_id: storyId,
      criteria,
      gherkin: gherkinLines
    });
  }

  return stories;
}

/**
 * Scan test files for references to story IDs and acceptance criteria.
 *
 * @param {string} testDir - Path to the test directory.
 * @param {string[]} storyIds - Story IDs to look for.
 * @returns {Map<string, { files: string[], keywords: string[] }>}
 */
function scanTestCoverage(testDir, storyIds) {
  const coverage = new Map();
  for (const id of storyIds) {
    coverage.set(id, { files: [], keywords: [] });
  }

  if (!fs.existsSync(testDir)) {
    return coverage;
  }

  const testFiles = walkTestFiles(testDir);

  for (const testFile of testFiles) {
    let content;
    try {
      content = fs.readFileSync(testFile, 'utf8');
    } catch {
      continue;
    }

    for (const storyId of storyIds) {
      // Check for direct story ID reference
      if (content.includes(storyId)) {
        coverage.get(storyId).files.push(path.relative(testDir, testFile));
      }

      // Check for describe/it blocks that reference the story semantically
      const escapedId = storyId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const testBlockPattern = new RegExp(
        `(?:describe|it|test)\\s*\\(\\s*['"\`].*${escapedId}.*['"\`]`,
        'i'
      );
      if (testBlockPattern.test(content)) {
        const entry = coverage.get(storyId);
        const relFile = path.relative(testDir, testFile);
        if (!entry.files.includes(relFile)) {
          entry.files.push(relFile);
        }
      }
    }
  }

  return coverage;
}

/**
 * Walk a directory tree and collect test file paths.
 *
 * @param {string} dir - Directory to walk.
 * @returns {string[]}
 */
function walkTestFiles(dir) {
  const results = [];
  const testPatterns = ['.test.', '.spec.', '_test.', '_spec.', '.feature'];

  function walk(currentDir) {
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          walk(fullPath);
        }
      } else {
        const isTestFile = testPatterns.some(p => entry.name.includes(p));
        if (isTestFile) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Match acceptance criteria text against test file content for semantic coverage.
 *
 * @param {Array<{ story_id: string, criteria: string[], gherkin: string[] }>} storyCriteria
 * @param {string} testDir - Path to test directory.
 * @returns {Array<{ story_id: string, criterion: string, covered: boolean, test_files: string[] }>}
 */
function matchCriteriaToTests(storyCriteria, testDir) {
  const results = [];

  if (!fs.existsSync(testDir)) {
    for (const story of storyCriteria) {
      const allCriteria = [...story.criteria, ...story.gherkin];
      for (const criterion of allCriteria) {
        results.push({
          story_id: story.story_id,
          criterion,
          covered: false,
          test_files: []
        });
      }
    }
    return results;
  }

  const testFiles = walkTestFiles(testDir);
  const testContents = new Map();
  for (const file of testFiles) {
    try {
      testContents.set(file, fs.readFileSync(file, 'utf8').toLowerCase());
    } catch {
      // skip
    }
  }

  for (const story of storyCriteria) {
    const allCriteria = [...story.criteria, ...story.gherkin];

    for (const criterion of allCriteria) {
      // Extract key terms from the criterion (words > 3 chars, not stopwords)
      const keywords = extractKeywords(criterion);
      const matchingFiles = [];

      for (const [file, content] of testContents) {
        // Check if test file mentions the story ID
        const hasStoryRef = content.includes(story.story_id.toLowerCase());

        // Check keyword overlap (at least 50% of keywords present)
        const keywordHits = keywords.filter(k => content.includes(k.toLowerCase()));
        const keywordCoverage = keywords.length > 0
          ? keywordHits.length / keywords.length
          : 0;

        if (hasStoryRef || keywordCoverage >= 0.5) {
          matchingFiles.push(path.relative(testDir, file));
        }
      }

      results.push({
        story_id: story.story_id,
        criterion,
        covered: matchingFiles.length > 0,
        test_files: [...new Set(matchingFiles)]
      });
    }
  }

  return results;
}

/**
 * Extract meaningful keywords from a text string.
 *
 * @param {string} text - Input text.
 * @returns {string[]}
 */
function extractKeywords(text) {
  const stopwords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
    'should', 'may', 'might', 'must', 'can', 'could', 'and', 'but', 'or',
    'nor', 'not', 'so', 'yet', 'both', 'either', 'neither', 'each',
    'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some',
    'such', 'than', 'too', 'very', 'just', 'that', 'this', 'these',
    'those', 'with', 'from', 'into', 'for', 'about', 'given', 'when',
    'then', 'user', 'system'
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.has(w));
}

/**
 * Compute UAT coverage statistics.
 *
 * @param {string} prdPath - Path to the PRD file.
 * @param {string} testDir - Path to the test directory.
 * @returns {object} Coverage results.
 */
function computeUATCoverage(prdPath, testDir) {
  if (!fs.existsSync(prdPath)) {
    throw new Error(`PRD not found: ${prdPath}`);
  }

  const prdContent = fs.readFileSync(prdPath, 'utf8');
  const storyCriteria = extractAcceptanceCriteria(prdContent);
  const storyIds = storyCriteria.map(s => s.story_id);

  // Story-level coverage (does the test suite reference this story?)
  const storyCoverage = scanTestCoverage(testDir, storyIds);

  // Criteria-level coverage (are individual AC items addressed?)
  const criteriaResults = matchCriteriaToTests(storyCriteria, testDir);

  const totalCriteria = criteriaResults.length;
  const coveredCriteria = criteriaResults.filter(r => r.covered).length;
  const criteriaCoveragePct = totalCriteria > 0
    ? Math.round((coveredCriteria / totalCriteria) * 100)
    : 100;

  const totalStories = storyIds.length;
  const coveredStories = storyIds.filter(id => {
    const entry = storyCoverage.get(id);
    return entry && entry.files.length > 0;
  });
  const storyCoveragePct = totalStories > 0
    ? Math.round((coveredStories.length / totalStories) * 100)
    : 100;

  return {
    total_stories: totalStories,
    covered_stories: coveredStories.length,
    story_coverage_pct: storyCoveragePct,
    total_criteria: totalCriteria,
    covered_criteria: coveredCriteria,
    criteria_coverage_pct: criteriaCoveragePct,
    story_details: storyCriteria.map(s => ({
      story_id: s.story_id,
      criteria_count: s.criteria.length + s.gherkin.length,
      test_files: (storyCoverage.get(s.story_id) || { files: [] }).files
    })),
    criteria_details: criteriaResults,
    pass: criteriaCoveragePct >= 80
  };
}

/**
 * Generate a UAT coverage report in markdown format.
 *
 * @param {string} prdPath - Path to the PRD file.
 * @param {string} testDir - Path to the test directory.
 * @returns {string} Markdown report.
 */
function generateUATReport(prdPath, testDir) {
  const result = computeUATCoverage(prdPath, testDir);

  let report = `# UAT Coverage Report: Acceptance Criteria → Tests\n\n`;
  report += `**Story Coverage:** ${result.story_coverage_pct}% (${result.covered_stories}/${result.total_stories} stories)\n`;
  report += `**Criteria Coverage:** ${result.criteria_coverage_pct}% (${result.covered_criteria}/${result.total_criteria} criteria)\n`;
  report += `**Status:** ${result.pass ? '✅ PASS' : '❌ FAIL'} (threshold: 80%)\n\n`;

  report += `## Story Summary\n\n`;
  report += `| Story | Criteria | Test Files | Status |\n`;
  report += `|-------|----------|------------|--------|\n`;

  for (const story of result.story_details) {
    const status = story.test_files.length > 0 ? '✅' : '❌';
    const files = story.test_files.length > 0
      ? story.test_files.join(', ')
      : '_none_';
    report += `| ${story.story_id} | ${story.criteria_count} | ${files} | ${status} |\n`;
  }

  // Show uncovered criteria
  const uncovered = result.criteria_details.filter(c => !c.covered);
  if (uncovered.length > 0) {
    report += `\n## Uncovered Acceptance Criteria\n\n`;
    for (const item of uncovered) {
      report += `- ❌ **${item.story_id}**: ${item.criterion}\n`;
    }
  }

  // Show covered criteria
  const covered = result.criteria_details.filter(c => c.covered);
  if (covered.length > 0) {
    report += `\n## Covered Acceptance Criteria\n\n`;
    for (const item of covered) {
      report += `- ✅ **${item.story_id}**: ${item.criterion} → ${item.test_files.join(', ')}\n`;
    }
  }

  return report;
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node bin/lib/uat-coverage.js <prd-path> <test-dir>');
    process.exit(2);
  }

  try {
    const report = generateUATReport(args[0], args[1]);
    process.stdout.write(report + '\n');
    const result = computeUATCoverage(args[0], args[1]);
    process.exit(result.pass ? 0 : 1);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(2);
  }
}

module.exports = {
  extractAcceptanceCriteria,
  scanTestCoverage,
  matchCriteriaToTests,
  extractKeywords,
  computeUATCoverage,
  generateUATReport,
  walkTestFiles
};
