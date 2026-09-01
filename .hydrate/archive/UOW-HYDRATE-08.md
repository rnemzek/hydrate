# UOW-HYDRATE-08: Add `hydrate lfg` Easter Egg Alias for Zero-Touch Session Launch

## 1. Goal & Context
Add `lfg` as an official CLI alias for `hydrate ingest` (with automated state checkup pre-flight). Typing `hydrate lfg` triggers the clipboard sniffer, reconciles current session state, and prompts to launch execution in a single command.

## 2. Surgical Scope & Requirements
- **CLI Wiring (`bin/cli.js`, `src/commands/ingest.js`, `src/help.js`):**
  - Wire `lfg` alias in `bin/cli.js` routing to `handleIngest` (case-insensitive: accepts `lfg`, `LFG`, or `Lfg`).
  - Display a subtle easter egg banner greeting in `⚙️ HYDRATE ENGINE` output when invoked via `lfg`.
- **Slash Command Sync (`templates/.claude/commands/` & `.claude/commands/`):**
  - Add `/hydrate-lfg` command shortcut wrapping `hydrate lfg --yes`.
- **Unit & Integration Test Coverage:**
  - Update `test/ingest.test.js` and `test/help.test.js` to verify `lfg` command routing and execution without regressions.

## 3. File Access Restrictions & Protocol
- **READ-ONLY:** `.hydrate/CURRENT_UOW.md`, `.hydrate/ROADMAP.md`
- **APPEND-ONLY (Upon Completion):** `.hydrate/PROJECT_JOURNAL.md`, `.hydrate/DEV_JOURNAL.md`, `.hydrate/ARCHITECT_JOURNAL.md`
- **MOVE/ARCHIVE (Upon Completion):** `.hydrate/CURRENT_UOW.md` -> `.hydrate/archive/UOW-HYDRATE-08.md`

## 4. Acceptance Criteria
1. Running `hydrate lfg` executes clipboard ingestion with the `⚙️ HYDRATE ENGINE` UI.
2. Running `npm test` passes 100% of unit tests with zero regressions.
3. Auto-commit working tree upon clean test verification using `feat(cli): add hydrate lfg easter egg alias`.
