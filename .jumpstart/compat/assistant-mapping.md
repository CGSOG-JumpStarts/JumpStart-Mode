# Cross-Assistant Portability Mapping

> **Purpose:** Maps Jump Start framework concepts to their equivalents across different AI coding assistants, enabling teams to use the framework regardless of their tool choice.

---

## Instruction Injection Points

| Jump Start Concept | GitHub Copilot (VS Code) | Cursor | Claude Code | Windsurf |
|---|---|---|---|---|
| **Agent Persona Files** | `.github/copilot-instructions.md` + skill references | `.cursor/rules/*.mdc` (one rule per agent) | `CLAUDE.md` at repo root | `.windsurfrules` at repo root |
| **Config Injection** | Copilot instructions in settings.json | Cursor Settings → Rules for AI | `CLAUDE.md` preamble | `.windsurfrules` preamble |
| **Activation Commands** | `/jumpstart.<phase>` in chat | Same — typed in chat | Same — typed in chat | Same — typed in chat |
| **Skills** | VS Code Skills (`.vscode/skills/`) | `.cursor/rules/` with `globs` | Project-level `SKILL.md` files | Manual prompt inclusion |
| **Todo Tracking** | `manage_todo_list` tool | Cursor chat (manual) | `TodoWrite` tool | Chat-based tracking |
| **File Operations** | `create_file`, `replace_string_in_file` | `edit_file`, `create_file` | `Write`, `Edit` tools | Built-in file tools |
| **Terminal Execution** | `run_in_terminal` | `run_terminal_command` | `Bash` tool | Built-in terminal |
| **Web Search** | `fetch_webpage` | `@web` mention | `WebSearch` tool | Built-in search |

---

## Configuration Mapping

### GitHub Copilot (VS Code)

```
.github/
  copilot-instructions.md    ← Primary instruction file (auto-loaded)
.vscode/
  settings.json              ← Tool settings, file associations
```

Copilot reads `.github/copilot-instructions.md` automatically. Additional instruction files can be specified via `settings.json` using `github.copilot.chat.codeGeneration.instructions`.

### Cursor

```
.cursor/
  rules/
    jumpstart-core.mdc       ← Framework core rules
    challenger.mdc            ← Phase 0 agent persona
    analyst.mdc               ← Phase 1 agent persona
    ...
```

Cursor uses `.mdc` files in `.cursor/rules/`. Each file can have `globs` and `alwaysApply` frontmatter to control when rules activate.

### Claude Code

```
CLAUDE.md                     ← Primary instruction file (auto-loaded)
.jumpstart/                   ← Framework directory (referenced from CLAUDE.md)
```

Claude Code reads `CLAUDE.md` at the repository root. All Jump Start instructions should be consolidated or referenced from this file.

If `CLAUDE.md` already exists, bootstrap install can use merge mode (`npx jumpstart-mode --conflict merge`) to append or refresh the Jump Start-managed instruction block while preserving existing project guidance.

### Windsurf

```
.windsurfrules                ← Primary instruction file (auto-loaded)
```

Windsurf reads `.windsurfrules` at the repository root. Similar to `CLAUDE.md` but single-file format.

---

## Portability Checklist

When setting up Jump Start for a new assistant:

- [ ] Copy `.jumpstart/` directory to the project
- [ ] Create the assistant's instruction file (see mapping above)
- [ ] Reference `.jumpstart/agents/*.md` from the instruction file
- [ ] Map `/jumpstart.*` commands in instruction preamble
- [ ] Verify the assistant can read `.jumpstart/config.yaml`
- [ ] Test one full phase cycle (Phase 0) to confirm operation

---

## Feature Parity Notes

| Feature | Copilot | Cursor | Claude Code | Windsurf |
|---------|---------|--------|-------------|----------|
| Multi-file editing | ✅ | ✅ | ✅ | ✅ |
| Todo management | ✅ (native) | ⚠️ (manual) | ✅ (native) | ⚠️ (manual) |
| Question prompts | ✅ (ask_questions) | ⚠️ (text only) | ⚠️ (text only) | ⚠️ (text only) |
| Background tasks | ✅ | ✅ | ✅ | ✅ |
| Diagram rendering | ✅ (Mermaid) | ⚠️ (text only) | ⚠️ (text only) | ⚠️ (text only) |
| Context7 MCP | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ Full support | ⚠️ Partial/workaround needed | ❌ Not supported

---

## Context7 MCP Setup

Context7 MCP provides up-to-date library documentation. Setup is required for each AI assistant.

> **Full documentation:** `.jumpstart/guides/context7-usage.md`

### Installation (All Assistants)

```bash
npx add-mcp https://mcp.context7.com/mcp --header "CONTEXT7_API_KEY: YOUR_API_KEY"
```

Add `-y` to skip confirmation. Get an API key at: https://context7.com/dashboard

### Context7 Tools

| Tool | Full MCP Name | Parameters |
|------|---------------|------------|
| Resolve Library | `mcp_context7_resolve-library-id` | `libraryName` (required), `query` (required) |
| Query Documentation | `mcp_context7_query-docs` | `libraryId` (required), `query` (required) |

### Client-Specific Notes

| Client | MCP Configuration Location |
|--------|---------------------------|
| VS Code Copilot | MCP settings in VS Code (auto-detected by add-mcp) |
| Cursor | `Cursor Settings > MCP` or install via Cursor marketplace plugin |
| Claude Code | MCP configuration via add-mcp CLI |
| Windsurf | MCP configuration (auto-detected by add-mcp) |
