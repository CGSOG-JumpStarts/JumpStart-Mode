---
id: model-map
phase: advisory
agent: system
status: draft
created: ""
updated: ""
version: "1.0.0"
approved_by: "N/A"
approval_date: ""
upstream_refs: []
dependencies: []
risk_level: low
owners: []
sha256: ""
---

# Model Orchestration Map

> **Phase-to-Model Assignment Configuration**

## Purpose

This document defines which AI model is assigned to each phase and advisory agent. Multi-model orchestration allows optimising for cost, speed, context window, and reasoning capability per phase.

---

## Phase Assignments

| Phase | Agent | Model Provider | Model ID | Context Window | Rationale |
|---|---|---|---|---|---|
| Pre-0 | Scout | {{provider}} | {{model}} | {{tokens}} | {{Why this model for codebase analysis}} |
| 0 | Challenger | {{provider}} | {{model}} | {{tokens}} | {{Why this model for problem discovery}} |
| 1 | Analyst | {{provider}} | {{model}} | {{tokens}} | {{Why this model for product analysis}} |
| 2 | PM | {{provider}} | {{model}} | {{tokens}} | {{Why this model for requirements}} |
| 3 | Architect | {{provider}} | {{model}} | {{tokens}} | {{Why this model for architecture}} |
| 4 | Developer | {{provider}} | {{model}} | {{tokens}} | {{Why this model for implementation}} |
| Any | Facilitator | {{provider}} | {{model}} | {{tokens}} | {{Why this model for orchestration}} |

---

## Advisory Agent Assignments

| Agent | Model Provider | Model ID | Rationale |
|---|---|---|---|
| UI/UX Designer | {{provider}} | {{model}} | {{Rationale}} |
| QA | {{provider}} | {{model}} | {{Rationale}} |
| Security | {{provider}} | {{model}} | {{Rationale}} |
| Performance | {{provider}} | {{model}} | {{Rationale}} |
| Researcher | {{provider}} | {{model}} | {{Rationale}} |
| Refactor | {{provider}} | {{model}} | {{Rationale}} |
| Maintenance | {{provider}} | {{model}} | {{Rationale}} |

---

## Model Selection Criteria

| Criterion | Weight | Description |
|---|---|---|
| Reasoning depth | High | Complex multi-step reasoning capability |
| Context window | High | Ability to hold large spec artifacts in context |
| Code generation | Medium | Quality of generated code (Phase 4 primarily) |
| Speed | Medium | Response latency for interactive sessions |
| Cost | Low | Token cost — optimise only after capability |

---

## Supported Providers

| Provider | Models | Notes |
|---|---|---|
| OpenAI | gpt-4o, gpt-4o-mini, o1, o3 | Best for reasoning-heavy phases |
| Anthropic | claude-sonnet-4-20250514, claude-3.5-haiku | Best for long-context analysis |
| Google | gemini-2.0-flash, gemini-2.0-pro | Good balance of speed and quality |
| Local | ollama/llama3, ollama/codellama | For offline / privacy-sensitive work |

---

## Fallback Configuration

| Scenario | Action |
|---|---|
| Primary model unavailable | Fall back to {{fallback model}} |
| Context window exceeded | Shard input and use multi-pass approach |
| Rate limited | Queue and retry with exponential backoff |
| Cost budget exceeded | Switch to cheaper model with human notification |
