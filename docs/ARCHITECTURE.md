# Architecture - hydrate

## 1. Overall System Architecture

```mermaid
flowchart TD
    Dev[Product Owner / Developer]
    Dev -->|slash commands| CC["Claude Code Prompt<br/>(.claude/commands/*.md)"]
    Dev -->|shell| Shell["Standard Bash Shell"]

    CC -->|invokes| CLI["@nemzilla/hydrate CLI<br/>(bin/cli.js)"]
    Shell -->|npx hydrate ...| CLI

    CLI --> Init["src/init.js<br/>scaffold()"]
    CLI --> Checkup["src/commands/checkup.js"]
    CLI --> Ingest["src/commands/ingest.js"]
    CLI --> Context["src/commands/context.js"]
    CLI --> Uow["src/commands/uow.js"]
    CLI --> Artifacts["src/commands/artifacts.js"]
    CLI --> Check["src/commands/check.js"]
    CLI --> ExportPortfolio["src/commands/export-portfolio.js"]
    CLI --> Help["src/help.js"]

    Init --> Templates["src/templates.js<br/>(renders templates/*)"]
    Templates --> HydrateDir[".hydrate/ journals"]
    Templates --> ClaudeCommands[".claude/commands/*.md"]
    Templates --> DocsDir["docs/ARCHITECTURE*.md"]

    Context --> Clipboard["src/utils/clipboard.js<br/>(pbcopy / xclip / powershell)"]
    Postinstall["bin/postinstall.js"] -->|npm install| ClaudeCommands
```

## 2. Technology Stack & Dependencies
- **Runtime**: Node.js (CommonJS modules).
- **CLI Engine**: `bin/cli.js` — hand-rolled argument routing (no external CLI framework), dispatching to `src/commands/*.js`.
- **Provisioning**: `src/init.js` (scaffold on `hydrate init`) and `bin/postinstall.js` (zero-touch scaffold of `.claude/commands/` on `npm install`), both rendering from `templates/` via `src/templates.js`.
- **Templating**: `src/templates.js` — minimal `{{KEY}}` placeholder substitution, zero-dependency.
- **OS Integration**: `src/utils/clipboard.js` — native process spawns (`pbcopy`, `xclip`, `powershell.exe`), no external clipboard package.
- **Testing**: Node's built-in `node:test` + `node:assert/strict` runner (`npm test`), zero-dependency.
- **Host Integration**: Claude Code slash commands (`.claude/commands/*.md`) — thin frontmatter-driven prompt wrappers that shell out to the `hydrate` CLI, keeping interactive and headless execution identical.
