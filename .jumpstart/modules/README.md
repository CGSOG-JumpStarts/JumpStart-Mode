# Jump Start Modules

Modules are pluggable add-on suites that extend the Jump Start framework with additional agents, templates, commands, and checks.

## Module Structure

Each module is a directory containing a `module.json` manifest and its resources:

```
modules/
  my-module/
    module.json          # Module manifest (required)
    agents/              # Additional agent personas
    templates/           # Additional templates
    commands/            # Additional slash commands
    checks/              # Additional quality checks
```

## Module Manifest (`module.json`)

See `.jumpstart/schemas/module.schema.json` for the full schema.

```json
{
  "name": "my-module",
  "version": "1.0.0",
  "description": "A custom Jump Start module",
  "author": "Your Name",
  "agents": ["agents/my-agent.md"],
  "templates": ["templates/my-template.md"],
  "commands": ["commands/my-commands.md"],
  "checks": []
}
```

## Installing Modules

1. Place the module directory inside `.jumpstart/modules/`
2. Add the module name to `modules.enabled` in `.jumpstart/config.yaml`
3. The framework will automatically load the module's agents, templates, and commands

## Creating Modules

Use the module manifest template: `.jumpstart/templates/module-manifest.json`

Validate with: `npx jumpstart-mode validate-module <module-dir>`

## Marketplace

The **Skills Marketplace** is live. Browse and install skills, agents, prompts, and bundles:

**Registry index:** https://raw.githubusercontent.com/CGSOG-JumpStarts/JumpStart-Skills/main/registry/index.json

**Install an item:**

```bash
npx jumpstart-mode install skill.ignition
npx jumpstart-mode install agent.deck-builder
npx jumpstart-mode install bundle.ignition-suite
```

**Search the catalog:**

```bash
npx jumpstart-mode install --search pptx
```

**How it works:**
- The registry index lists all available items with download URLs and SHA256 checksums.
- `jumpstart-mode install` fetches the zip, verifies its checksum, and extracts to the item's `install.targetPaths` (e.g., `.jumpstart/skills/ignition/`).
- Bundles resolve their `includes[]` array and install all member items.

**Local modules vs marketplace items:**
- Local modules use `module.json` manifests and live in `.jumpstart/modules/`.
- Marketplace items use `package.json` manifests and install to `.jumpstart/skills/`, `.jumpstart/agents/`, or `.jumpstart/prompts/` per their type.
- Both coexist. Local modules are validated with `npx jumpstart-mode validate-module <dir>`. Marketplace items are validated upstream in the JumpStart-Skills CI pipeline.
