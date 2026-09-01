# UOW-HYDRATE-05: Implement Smart State Machine & Session Reconciler (`hydrate checkup`)

## 1. Goal & Context
Implement an interactive session reconciliation engine (`hydrate checkup` / `hydrate status --reconcile`) that inspects `git status`, test suite results, and `.hydrate/` artifacts. It automatically identifies dirty working trees, completed but unarchived tasks, or broken test builds, providing plain-text diagnostic options for developers upon opening a session.

## 2. Surgical Scope & Requirements
- **CLI Command Implementation (`bin/cli.js`, `src/commands/checkup.js`, `src/help.js`):**
  - Add `hydrate checkup` command (and alias `hydrate status`) to the CLI parser.
  - Read active task state in `.hydrate/CURRENT_UOW.md`, latest entry in `.hydrate/archive/`, and run internal `git status` check.
- **State Reconciliation Logic:**
  - **State A (Unarchived Done):** If `CURRENT_UOW.md` tasks are completed and tests pass, report: `"UOW-XX is complete but unarchived. Run hydrate complete to archive."`
  - **State B (Clean Slate):** If `CURRENT_UOW.md` is empty/clean and roadmap items exist, report: `"Ready for next task. Pending items available in ROADMAP.md."`
  - **State C (In Progress / Dirty):** If `CURRENT_UOW.md` is active and working tree is modified, output concise status summary of modified files and active UOW goals.
- **Unit & Integration Test Coverage:**
  - Create `test/checkup.test.js` covering dirty tree detection, completed/unarchived detection, and clean slate reporting.
  - Maintain line and branch test coverage quality gates (>80%).

## 3. File Access Restrictions & Protocol
- **READ-ONLY:** `.hydrate/CURRENT_UOW.md`, `.hydrate/ROADMAP.md`
- **APPEND-ONLY (Upon Completion):** `.hydrate/PROJECT_JOURNAL.md`, `.hydrate/DEV_JOURNAL.md`, `.hydrate/ARCHITECT_JOURNAL.md`
- **MOVE/ARCHIVE (Upon Completion):** `.hydrate/CURRENT_UOW.md` -> `.hydrate/archive/UOW-HYDRATE-05.md`

## 4. Acceptance Criteria
1. Running `hydrate checkup` outputs a clear terminal diagnostic of the project's exact session state.
2. Running `npm test` passes 100% of unit tests with zero regressions (including new `test/checkup.test.js` suite).
3. Auto-commit working tree upon clean test verification using `feat(cli): complete UOW-HYDRATE-05 implementation and verification`.
