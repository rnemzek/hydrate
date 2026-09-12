# UOW-HYDRATE-13: Align CLI Subcommands with Slash Command Templates

## 1. Description & Goal
Audit and align `@nemzilla/hydrate` CLI subcommands (`bin/cli.js` / `src/commands/*.js`) with the slash command templates in `templates/.claude/commands/*.md.template`. Ensure all available CLI verbs (`checkup`, `ingest`, `context`, `complete`, `uow`, `artifacts`, `check`, `export-portfolio`) have corresponding `.md.template` wrappers and that flag parameters are handled uniformly across both interfaces.

## 2. Key Acceptance Criteria
- [x] **Template & CLI Parity**: Every supported CLI verb in `bin/cli.js` maps 1:1 to an exposed slash command in `templates/.claude/commands/`.
- [x] **Zero-Touch Sync**: `scaffoldClaudeCommands()` cleanly syncs all templates into `.claude/commands/` without overwriting custom user state.
- [x] **Execution Safety**: Slash commands execute thin `hydrate <verb>` process calls via Bash tool blocks, keeping business logic strictly inside `src/commands/*.js`.
- [x] **Verification Gate**: All unit/integration tests pass cleanly via `npm test` with minimum 80% line/branch coverage across touched files.

## 3. Affected Files
- `templates/.claude/commands/*.md.template`
- `src/commands/*.js`
- `src/init.js` / `src/templates.js`
- `test/*.test.js`

## 4. Verification Steps
1. Compare `bin/cli.js` verbs against `templates/.claude/commands/` and add any missing `.md.template` files.
2. Wire new templates into `src/init.js`'s provisioning list.
3. Run `npm test` to verify CLI command routing and template rendering.
