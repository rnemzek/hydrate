# UOW-HYDRATE-07: Implement Claude Code Boot Hooks & Slash Command Definitions

## 1. Goal & Context
Integrate `@nemzilla/hydrate` runtime commands directly into Claude Code's session lifecycle. Update `CLAUDE.md` templates and project configurations to instruct Claude Code to execute `hydrate checkup` on boot and expose custom slash commands (`/hydrate-checkup`, `/hydrate-ingest`, `/hydrate-context`) for zero-touch interaction.

## 2. Surgical Scope & Requirements
- **`CLAUDE.md` & Template Upgrades (`templates/CLAUDE.md.template` & `CLAUDE.md`):**
  - Add explicit **Fast-Start Boot Protocol** directing Claude Code to run `hydrate checkup` upon session launch to orient itself with `.hydrate/CURRENT_UOW.md`, `.hydrate/archive/`, and `git status`.
  - Declare `.hydrate/CURRENT_UOW.md`, `.hydrate/ROADMAP.md`, and `.hydrate/ARCHITECT_JOURNAL.md` as the canonical context sources (suppressing legacy `CONTEXT.md` lookup notices).
- **Claude Code Tool / Command Hooks (`.claude/` / `templates/.claude/`):**
  - Define custom slash command prompt handlers or command shortcuts for:
    - `/hydrate-checkup`: Run state reconciler.
    - `/hydrate-ingest`: Ingest UOW from clipboard.
    - `/hydrate-context`: Output/clip token-dense context prompt.
  - Ensure `hydrate init` scaffolds these slash command configurations into target repositories.
- **Unit & Integration Test Coverage:**
  - Create/update test suites (`test/init.test.js`, `test/claude-hooks.test.js`) verifying template output and custom command configuration rendering.
  - Maintain line and branch test coverage quality gates (>80%).

## 3. File Access Restrictions & Protocol
- **READ-ONLY:** `.hydrate/CURRENT_UOW.md`, `.hydrate/ROADMAP.md`
- **APPEND-ONLY (Upon Completion):** `.hydrate/PROJECT_JOURNAL.md`, `.hydrate/DEV_JOURNAL.md`, `.hydrate/ARCHITECT_JOURNAL.md`
- **MOVE/ARCHIVE (Upon Completion):** `.hydrate/CURRENT_UOW.md` -> `.hydrate/archive/UOW-HYDRATE-07.md`

## 4. Acceptance Criteria
1. `CLAUDE.md` template instructs Claude Code to run `hydrate checkup` immediately upon session boot.
2. `hydrate init` successfully provisions slash command configurations for target repositories.
3. Running `npm test` passes 100% of unit tests with zero regressions.
4. Auto-commit working tree upon clean test verification using `feat(cli): complete UOW-HYDRATE-07 implementation and verification`.
