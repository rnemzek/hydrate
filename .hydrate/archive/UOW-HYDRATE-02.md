# UOW-HYDRATE-02: Implement Journal & Archive Validation Utility (`hydrate check`)

## 1. Goal & Context
Implement a CLI validation command (`hydrate check`) for `@nemzilla/hydrate` to programmatically verify journal consistency. It ensures that every archived UOW file in `.hydrate/archive/UOW-XX.md` has corresponding entries in `PROJECT_JOURNAL.md`, `DEV_JOURNAL.md`, and `ARCHITECT_JOURNAL.md`, and alerts on dangling or unarchived active tasks.

## 2. Surgical Scope & Requirements
- **CLI Command Implementation (`bin/cli.js` & `src/commands/check.js`):**
  - Add `hydrate check` command to the CLI parser.
  - Read all `.md` files in `.hydrate/archive/`.
  - For each archived UOW ID (e.g., `UOW-HYDRATE-01`):
    - Assert a completed checklist entry `- [x] **[<UOW-ID>]**` exists in `.hydrate/PROJECT_JOURNAL.md`.
    - Assert a section header `## [<UOW-ID>]` exists in `.hydrate/DEV_JOURNAL.md`.
    - Assert a section header `## [<UOW-ID>]` exists in `.hydrate/ARCHITECT_JOURNAL.md`.
  - Check state of `.hydrate/CURRENT_UOW.md`:
    - Warn/flag if `CURRENT_UOW.md` contains a completed UOW payload that has not yet been moved to `.hydrate/archive/`.
  - **Output Formatting:** Print a clean terminal report detailing validation passes, missing log entries, or unarchived state. Return process exit code `0` on clean verification and non-zero `1` on missing journal entries.
- **Unit & Integration Test Coverage:**
  - Create `test/check.test.js` covering clean journal passes, missing log entry detections, unarchived task warnings, and empty/missing `.hydrate/` directory scenarios.
  - Maintain line and branch test coverage quality gates ($>80\%$).

## 3. File Access Restrictions & Protocol
- **READ-ONLY:** `.hydrate/CURRENT_UOW.md`, `.hydrate/ROADMAP.md`
- **APPEND-ONLY (Upon Completion):** `.hydrate/PROJECT_JOURNAL.md`, `.hydrate/DEV_JOURNAL.md`, `.hydrate/ARCHITECT_JOURNAL.md`
- **MOVE/ARCHIVE (Upon Completion):** `.hydrate/CURRENT_UOW.md` -> `.hydrate/archive/UOW-HYDRATE-02.md`

## 4. Acceptance Criteria
1. Running `hydrate check` against a complete `.hydrate/` structure passes with exit code `0`.
2. Missing journal entries or unarchived tasks produce descriptive error/warning output and exit code `1`.
3. Running `npm test` passes 100% of unit tests with zero regressions (including new `test/check.test.js` suite).
4. Auto-commit working tree upon clean test verification using `feat(cli): complete UOW-HYDRATE-02 implementation and verification`.
