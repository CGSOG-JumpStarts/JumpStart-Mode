import React, { useState, useMemo } from 'react';

// --- TypeScript Interfaces ---
export interface Agent {
  id: string;
  name: string;
  icon: string;
  category: "Phase Agents" | "Advisory Agents";
  phase: string;
  description: string;
  templates: string[];
  subagents: string[];
}

export interface BadgeProps {
  type: 'template' | 'subagent';
  text: string;
}

export interface AgentCardProps {
  agent: Agent;
}

// --- Data Model ---
// AUTO-SYNCED from docs/agent-access-reference.md
// Run `npm run sync:agents` from docs_site/ to regenerate templates & subagents
const AGENT_DATA: Agent[] = [
  {
    id: "scout",
    name: "Scout",
    icon: "🔭",
    category: "Phase Agents",
    phase: "Pre-Phase",
    description: "Gathers initial context, analyzes the codebase, and prepares the workspace.",
    templates: ["insights.md", "codebase-context.md", "insight-entry.md", "session-briefing.md"],
    subagents: ["Researcher", "Security"]
  },
  {
    id: "challenger",
    name: "Challenger",
    icon: "⚔️",
    category: "Phase Agents",
    phase: "Phase 0",
    description: "Stress-tests initial ideas, identifies edge cases, and enforces constraints early.",
    templates: ["needs-clarification.md", "insights.md", "challenger-log.md", "challenger-brief.md", "reasoning.md", "insight-entry.md", "wait-checkpoint.md", "session-briefing.md"],
    subagents: ["Researcher", "Security", "Adversary"]
  },
  {
    id: "analyst",
    name: "Analyst",
    icon: "🔎",
    category: "Phase Agents",
    phase: "Phase 1",
    description: "Simulates personas and extracts deep requirements from the initial brief.",
    templates: ["needs-clarification.md", "insights.md", "persona-simulation.md", "product-brief.md", "requirements-responses.md", "insight-entry.md", "wait-checkpoint.md", "persona-change.md", "session-briefing.md", "compliance-checklist.md", "metrics.md", "stakeholders.md"],
    subagents: ["Requirements Extractor", "UX Designer", "Researcher", "Security", "Adversary"]
  },
  {
    id: "pm",
    name: "Product Manager",
    icon: "📋",
    category: "Phase Agents",
    phase: "Phase 2",
    description: "Owns the product definition and writes the core Product Requirements Document (PRD).",
    templates: ["needs-clarification.md", "insights.md", "gherkin-guide.md", "prd.md", "insight-entry.md", "wait-checkpoint.md", "session-briefing.md", "prd-index.md"],
    subagents: ["QA", "Performance", "Security", "Scrum Master", "Adversary"]
  },
  {
    id: "architect",
    name: "Architect",
    icon: "🏗️",
    category: "Phase Agents",
    phase: "Phase 3",
    description: "Translates the PRD into technical blueprints, API contracts, and implementation plans.",
    templates: ["needs-clarification.md", "insights.md", "adr.md", "agents-md.md", "branch-evaluation.md", "documentation-audit.md", "design-system.md", "data-model.md", "contracts.md", "insight-entry.md", "wait-checkpoint.md", "session-briefing.md", "architecture.md", "implementation-plan.md", "constraint-map.md", "task-dependencies.md", "tasks.md", "traceability.md"],
    subagents: ["Security", "Performance", "Researcher", "DevOps", "Adversary", "Scrum Master"]
  },
  {
    id: "developer",
    name: "Developer",
    icon: "💻",
    category: "Phase Agents",
    phase: "Phase 4",
    description: "Executes the implementation plan, writing test-driven code within architectural boundaries.",
    templates: ["needs-clarification.md", "insights.md", "todo.md", "agents-md.md", "red-phase-report.md", "test-failure-evidence.md", "insight-entry.md", "wait-checkpoint.md", "session-briefing.md"],
    subagents: ["QA", "Refactor", "Reviewer", "Tech Writer", "Maintenance", "Retrospective"]
  },
  {
    id: "adversary",
    name: "Adversary",
    icon: "🦹",
    category: "Advisory Agents",
    phase: "Utility",
    description: "Actively attempts to find logical flaws, missing constraints, and architectural weaknesses.",
    templates: ["adversarial-review.md"],
    subagents: []
  },
  {
    id: "devops",
    name: "DevOps",
    icon: "🚀",
    category: "Advisory Agents",
    phase: "Utility",
    description: "Handles deployment strategies, CI/CD pipelines, and infrastructure drift tracking.",
    templates: ["deploy.md", "ci-cd.yml"],
    subagents: ["Security", "Researcher"]
  },
  {
    id: "diagram-verifier",
    name: "Diagram Verifier",
    icon: "📊",
    category: "Advisory Agents",
    phase: "Utility",
    description: "Verifies the accuracy and structure of architectural diagrams.",
    templates: [],
    subagents: []
  },
  {
    id: "facilitator",
    name: "Facilitator",
    icon: "🤝",
    category: "Advisory Agents",
    phase: "Utility",
    description: "Manages workflow, process, and multi-agent team orchestration.",
    templates: ["party-session.md"],
    subagents: ["QA", "Security", "Performance", "Researcher", "UX Designer", "Refactor", "Tech Writer", "Scrum Master", "DevOps", "Adversary", "Reviewer", "Retrospective", "Maintenance", "Quick Dev"]
  },
  {
    id: "maintenance",
    name: "Maintenance",
    icon: "🔧",
    category: "Advisory Agents",
    phase: "Utility",
    description: "Handles code updates, dependency bumps, and routine upkeep.",
    templates: ["drift-report.md"],
    subagents: []
  },
  {
    id: "performance",
    name: "Performance",
    icon: "⚡",
    category: "Advisory Agents",
    phase: "Utility",
    description: "Analyzes application performance, load capacity, and optimization opportunities.",
    templates: ["nfrs.md"],
    subagents: ["Researcher"]
  },
  {
    id: "qa",
    name: "Quality Assurance",
    icon: "🧪",
    category: "Advisory Agents",
    phase: "Utility",
    description: "Validates that the code output matches the PM's PRD and acceptance criteria.",
    templates: ["test-plan.md", "test-report.md"],
    subagents: ["Security", "Performance"]
  },
  {
    id: "quick-dev",
    name: "Quick Dev",
    icon: "⏱️",
    category: "Advisory Agents",
    phase: "Utility",
    description: "Executes rapid, isolated development tasks or hotfixes.",
    templates: ["quickflow.md"],
    subagents: ["QA", "Reviewer"]
  },
  {
    id: "refactor",
    name: "Refactor",
    icon: "♻️",
    category: "Advisory Agents",
    phase: "Utility",
    description: "Restructures existing code without changing its external behavior.",
    templates: ["refactor-report.md"],
    subagents: []
  },
  {
    id: "requirements-extractor",
    name: "Requirements Extractor",
    icon: "🧲",
    category: "Advisory Agents",
    phase: "Utility",
    description: "Aids the Analyst in pulling deep requirements from raw briefs.",
    templates: [],
    subagents: ["Researcher"]
  },
  {
    id: "researcher",
    name: "Researcher",
    icon: "🧠",
    category: "Advisory Agents",
    phase: "Utility",
    description: "Gathers context and analyzes external dependencies or documentation.",
    templates: ["research.md", "stack-metadata.md"],
    subagents: []
  },
  {
    id: "retrospective",
    name: "Retrospective",
    icon: "🔄",
    category: "Advisory Agents",
    phase: "Utility",
    description: "Facilitates end-of-phase reviews and learning capture.",
    templates: ["retrospective.md"],
    subagents: []
  },
  {
    id: "reviewer",
    name: "Reviewer",
    icon: "👁️",
    category: "Advisory Agents",
    phase: "Utility",
    description: "Conducts peer reviews on code or architectural proposals.",
    templates: ["peer-review.md"],
    subagents: []
  },
  {
    id: "scrum-master",
    name: "Scrum Master",
    icon: "📅",
    category: "Advisory Agents",
    phase: "Utility",
    description: "Manages agile tracking, sprint planning, and unblocks agents.",
    templates: ["sprint-status.yaml", "sprint-planning.md", "sprint.yaml"],
    subagents: []
  },
  {
    id: "security",
    name: "Security",
    icon: "🛡️",
    category: "Advisory Agents",
    phase: "Utility",
    description: "Conducts code and architecture vulnerability checks.",
    templates: ["security-review.md"],
    subagents: ["Researcher"]
  },
  {
    id: "tech-writer",
    name: "Tech Writer",
    icon: "✍️",
    category: "Advisory Agents",
    phase: "Utility",
    description: "Ensures code is documented and creates technical guides.",
    templates: ["agents-md.md", "doc-update-checklist.md"],
    subagents: []
  },
  {
    id: "ux",
    name: "UX Designer",
    icon: "✨",
    category: "Advisory Agents",
    phase: "Utility",
    description: "Establishes frontend interface rules and design systems.",
    templates: ["design-system.md", "ux-design.md"],
    subagents: []
  }
];

// Phase sort order mapping
const PHASE_ORDER: Record<string, number> = {
  "Pre-Phase": 0,
  "Phase 0": 1,
  "Phase 1": 2,
  "Phase 2": 3,
  "Phase 3": 4,
  "Phase 4": 5,
  "Utility": 6
};

// --- Components ---

const Badge: React.FC<BadgeProps> = ({ type, text }) => {
  const isTemplate = type === 'template';
  const baseClasses = "inline-flex items-center px-2 py-1 text-xs font-medium rounded-md border mr-2 mb-2 transition-colors";
  
  const colorClasses = isTemplate 
    ? "bg-[var(--ifm-color-primary)]/10 text-[var(--ifm-color-primary)] border-[var(--ifm-color-primary)]/30 hover:bg-[var(--ifm-color-primary)]/20"
    : "bg-[var(--ifm-color-emphasis-100)] text-[var(--ifm-color-content)] border-[var(--ifm-color-emphasis-300)] hover:bg-[var(--ifm-color-emphasis-200)]";

  return (
    <span className={`${baseClasses} ${colorClasses}`}>
      {isTemplate ? (
        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      ) : (
        <span className="mr-1">@</span>
      )}
      {text}
    </span>
  );
};

const AgentCard: React.FC<AgentCardProps> = ({ agent }) => {
  return (
    <div className="flex flex-col bg-[var(--ifm-background-surface-color)] rounded-xl shadow-sm border border-[var(--ifm-color-emphasis-200)] hover:shadow-md hover:border-[var(--ifm-color-primary)] transition-all duration-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--ifm-color-emphasis-200)] bg-[var(--ifm-background-color)] flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="text-2xl bg-[var(--ifm-background-surface-color)] p-2 rounded-lg shadow-sm border border-[var(--ifm-color-emphasis-200)] flex-shrink-0">
            {agent.icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--ifm-color-content)] leading-tight m-0">
              {agent.name}
            </h3>
            <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--ifm-color-content-secondary)] bg-[var(--ifm-color-emphasis-200)] rounded-full">
              {agent.phase}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 flex-grow flex flex-col">
        <p className="text-sm text-[var(--ifm-color-content)] mb-6 flex-grow">
          {agent.description}
        </p>

        {/* Templates Section */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--ifm-color-content-secondary)] mb-2 flex items-center">
            Writes to Templates
          </h4>
          <div className="flex flex-wrap">
            {agent.templates.length > 0 ? (
              agent.templates.map(t => <Badge key={t} type="template" text={t} />)
            ) : (
              <span className="text-sm text-[var(--ifm-color-content-secondary)] italic">None specified</span>
            )}
          </div>
        </div>

        {/* Subagents Section */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--ifm-color-content-secondary)] mb-2 flex items-center">
            Invokes Subagents
          </h4>
          <div className="flex flex-wrap">
            {agent.subagents.length > 0 ? (
              agent.subagents.map(s => <Badge key={s} type="subagent" text={s} />)
            ) : (
              <span className="text-sm text-[var(--ifm-color-content-secondary)] italic">Standalone</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterPhase, setFilterPhase] = useState<string>('');
  const [filterTemplate, setFilterTemplate] = useState<string>('');
  const [filterSubagent, setFilterSubagent] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('default');

  // Extract unique filter options
  const phaseOptions = useMemo(() => [...new Set(AGENT_DATA.map(a => a.phase))].sort((a, b) => PHASE_ORDER[a] - PHASE_ORDER[b]), []);
  const templateOptions = useMemo(() => [...new Set(AGENT_DATA.flatMap(a => a.templates))].sort(), []);
  const subagentOptions = useMemo(() => [...new Set(AGENT_DATA.flatMap(a => a.subagents))].sort(), []);

  // Filter and Sort agents
  const filteredAndSortedAgents = useMemo(() => {
    let result = AGENT_DATA;

    // 1. Text Search Filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(agent => 
        agent.name.toLowerCase().includes(term) ||
        agent.description.toLowerCase().includes(term) ||
        agent.templates.some(t => t.toLowerCase().includes(term)) ||
        agent.subagents.some(s => s.toLowerCase().includes(term))
      );
    }

    // 2. Dropdown Filters
    if (filterPhase) {
      result = result.filter(a => a.phase === filterPhase);
    }
    if (filterTemplate) {
      result = result.filter(a => a.templates.includes(filterTemplate));
    }
    if (filterSubagent) {
      result = result.filter(a => a.subagents.includes(filterSubagent));
    }

    // 3. Sorting
    result = [...result].sort((a, b) => {
      if (sortBy === 'nameAsc') return a.name.localeCompare(b.name);
      if (sortBy === 'nameDesc') return b.name.localeCompare(a.name);
      if (sortBy === 'phaseAsc') return (PHASE_ORDER[a.phase] ?? 99) - (PHASE_ORDER[b.phase] ?? 99);
      if (sortBy === 'phaseDesc') return (PHASE_ORDER[b.phase] ?? 99) - (PHASE_ORDER[a.phase] ?? 99);
      
      // 'default' sorting keeps original order but groups them naturally when mapped
      return 0;
    });

    return result;
  }, [searchTerm, filterPhase, filterTemplate, filterSubagent, sortBy]);

  // Group filtered and sorted agents by category
  const groupedAgents = filteredAndSortedAgents.reduce((acc: Record<string, Agent[]>, agent) => {
    if (!acc[agent.category]) acc[agent.category] = [];
    acc[agent.category].push(agent);
    return acc;
  }, {});

  return (
    <div className="p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="mb-8 text-center md:text-left md:flex justify-between items-end">
          <div className="mb-6 md:mb-0">
            <h1 className="text-3xl font-extrabold tracking-tight mb-2 flex items-center justify-center md:justify-start">
              <span className="text-[var(--ifm-color-primary)] mr-3">⚡</span> 
              Jump Start Agent Reference
            </h1>
            <p className="text-[var(--ifm-color-content-secondary)] max-w-2xl text-lg">
              Explore the framework's phase agents, their designated templates, and authorized subagent communication paths.
            </p>
          </div>

          {/* General Search Bar */}
          <div className="relative w-full md:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-[var(--ifm-color-content-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-[var(--ifm-color-emphasis-300)] rounded-lg leading-5 bg-[var(--ifm-background-surface-color)] text-[var(--ifm-color-content)] placeholder-[var(--ifm-color-content-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--ifm-color-primary)] focus:border-[var(--ifm-color-primary)] sm:text-sm transition-shadow shadow-sm"
              placeholder="Search everything..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Filter and Sort Controls */}
        <div className="mb-10 p-4 bg-[var(--ifm-background-surface-color)] border border-[var(--ifm-color-emphasis-200)] rounded-xl shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Phase Filter */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ifm-color-content-secondary)] mb-1">Filter by Phase</label>
            <select 
              value={filterPhase} 
              onChange={(e) => setFilterPhase(e.target.value)}
              className="block w-full px-3 py-2 border border-[var(--ifm-color-emphasis-300)] bg-[var(--ifm-background-color)] text-[var(--ifm-color-content)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--ifm-color-primary)] focus:border-[var(--ifm-color-primary)] sm:text-sm transition-colors"
            >
              <option value="">All Phases</option>
              {phaseOptions.map(phase => <option key={phase} value={phase}>{phase}</option>)}
            </select>
          </div>

          {/* Template Filter */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ifm-color-content-secondary)] mb-1">Filter by Template</label>
            <select 
              value={filterTemplate} 
              onChange={(e) => setFilterTemplate(e.target.value)}
              className="block w-full px-3 py-2 border border-[var(--ifm-color-emphasis-300)] bg-[var(--ifm-background-color)] text-[var(--ifm-color-content)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--ifm-color-primary)] focus:border-[var(--ifm-color-primary)] sm:text-sm transition-colors"
            >
              <option value="">All Templates</option>
              {templateOptions.map(template => <option key={template} value={template}>{template}</option>)}
            </select>
          </div>

          {/* Subagent Filter */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ifm-color-content-secondary)] mb-1">Filter by Subagent</label>
            <select 
              value={filterSubagent} 
              onChange={(e) => setFilterSubagent(e.target.value)}
              className="block w-full px-3 py-2 border border-[var(--ifm-color-emphasis-300)] bg-[var(--ifm-background-color)] text-[var(--ifm-color-content)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--ifm-color-primary)] focus:border-[var(--ifm-color-primary)] sm:text-sm transition-colors"
            >
              <option value="">All Subagents</option>
              {subagentOptions.map(sub => <option key={sub} value={sub}>{sub}</option>)}
            </select>
          </div>

          {/* Sorting */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ifm-color-content-secondary)] mb-1">Sort Cards By</label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="block w-full px-3 py-2 border border-[var(--ifm-color-emphasis-300)] bg-[var(--ifm-background-color)] text-[var(--ifm-color-content)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--ifm-color-primary)] focus:border-[var(--ifm-color-primary)] sm:text-sm transition-colors"
            >
              <option value="default">Default Category Order</option>
              <option value="nameAsc">Name (A-Z)</option>
              <option value="nameDesc">Name (Z-A)</option>
              <option value="phaseAsc">Phase (Start to Finish)</option>
              <option value="phaseDesc">Phase (Finish to Start)</option>
            </select>
          </div>
        </div>

        {/* Empty State */}
        {filteredAndSortedAgents.length === 0 && (
          <div className="text-center py-20 bg-[var(--ifm-background-surface-color)] rounded-xl border border-dashed border-[var(--ifm-color-emphasis-300)]">
            <div className="text-4xl mb-4">🕵️</div>
            <h3 className="text-lg font-medium text-[var(--ifm-color-content)]">No agents found</h3>
            <p className="text-[var(--ifm-color-content-secondary)] mt-1">Try adjusting your search terms or clearing the selected filters.</p>
            <button 
              onClick={() => {
                setSearchTerm(''); setFilterPhase(''); setFilterTemplate(''); setFilterSubagent(''); setSortBy('default');
              }}
              className="mt-4 px-4 py-2 bg-[var(--ifm-color-primary)]/10 text-[var(--ifm-color-primary)] rounded-md hover:bg-[var(--ifm-color-primary)]/20 transition-colors text-sm font-medium border-none cursor-pointer"
            >
              Clear All Filters
            </button>
          </div>
        )}

        {/* Results Grid by Category */}
        {['Phase Agents', 'Advisory Agents'].map(category => {
          const agentsInCategory = groupedAgents[category];
          if (!agentsInCategory || agentsInCategory.length === 0) return null;

          return (
            <div key={category} className="mb-12">
              <div className="flex items-center mb-6">
                <h2 className="text-xl font-bold text-[var(--ifm-color-content)] m-0">
                  {category} 
                  <span className="ml-3 text-sm font-medium bg-[var(--ifm-color-emphasis-200)] text-[var(--ifm-color-content-secondary)] py-1 px-2 rounded-full">
                    {agentsInCategory.length}
                  </span>
                </h2>
                <div className="ml-4 h-px bg-[var(--ifm-color-emphasis-200)] flex-grow"></div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agentsInCategory.map(agent => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}