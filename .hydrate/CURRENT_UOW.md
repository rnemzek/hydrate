# Unit of Work: UOW-05

**Title:** Universal Brownfield Adoption Engine & Claude Code Integration
**Status:** IN_PROGRESS
**Target Version:** `@nemzilla/hydrate@1.2.0`

## Scope & Architectural Requirements
1. **Universal Brownfield Adoption Engine (`hydrate adopt`)**:
   - **Heuristic Scanner:** Detect common AI context/rule conventions (`.cursorrules`, `.claude/*`, `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.codex/*`, `CONTEXT.md`).
   - **Interactive Multi-Select:** Built-in terminal CLI prompt to select discovered context files or add custom file paths.
   - **Non-Destructive Consolidation:** Merge selected context sources into a unified `CONTEXT.md` (or user's preferred target rule file) while backing up originals to `.hydrate/backups/`.
   - **Core Triad Injection:** Append required `@nemzilla/hydrate` workflow directives to the consolidated context file.
   - **Canonical Setup:** Guarantee `ROADMAP.md` and `.hydrate/CURRENT_UOW.md` are initialized cleanly with zero legacy error paths.

2. **Claude Code Slash Command Integration (`hydrate setup-cc`)**:
   - Scaffold `.claude/commands/hydrate.md` (or CC-compatible configuration) allowing users to run `/hydrate` directly inside Claude Code to trigger `hydrate prompt --copy`.

3. **Documentation & Tests**:
   - Unit tests covering scanner heuristics, interactive fallback, and non-destructive backups (`test/adopt.test.js`).
   - Update `README.md` and `src/help.js` to document `hydrate adopt` for onboarding any repo.

## Tasks
- [x] **Task 5.1:** Build `src/adopt.js` with a heuristic scanner for `.cursorrules`, `.claude/`, `AGENTS.md`, `CLAUDE.md`, `.codex/`, `.github/copilot-instructions.md`, `CONTEXT.md`.
- [x] **Task 5.2:** Build an interactive terminal multi-select UI using Node's built-in `readline` (zero heavy third-party dependencies).
- [x] **Task 5.3:** Implement non-destructive merging into the target context file with automatic per-run backups under `.hydrate/backups/`, plus core triad directive injection.
- [x] **Task 5.4:** Implement `hydrate setup-cc` to generate `.claude/commands/hydrate.md`.
- [x] **Task 5.5:** Wire `adopt` / `setup-cc` into `bin/cli.js` and document both in `src/help.js`.
- [x] **Task 5.6:** Write comprehensive unit tests in `test/adopt.test.js` covering scanner heuristics, interactive fallback, and non-destructive backups; verify with `npm test`.
- [x] **Task 5.7:** Document `hydrate adopt` / `hydrate setup-cc` in `README.md`.
