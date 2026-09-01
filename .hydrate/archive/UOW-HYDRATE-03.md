# UOW-HYDRATE-03: Implement High-Density Context Compiler (`hydrate context`)

## 1. Goal & Context
Implement a CLI command (`hydrate context` / `hydrate context --clip`) that parses `.hydrate/` artifacts (active task in `CURRENT_UOW.md`, recent architectural state in `ARCHITECT_JOURNAL.md`, and macro goals in `ROADMAP.md`) and compiles a token-dense, zero-fluff context payload designed for seeding AI LLM prompt sessions.

## 2. Surgical Scope & Requirements
- **CLI Command Implementation (`bin/cli.js`, `src/commands/context.js`, `src/help.js`):**
  - Add `hydrate context` command to the CLI parser.
  - Support an optional `--clip` / `-c` flag to automatically copy the compiled context string directly to the OS clipboard (using the existing `clipboard.js` utility).
  - Support an optional `--depth <n>` flag (default: `3`) to specify how many recent UOW blocks to pull from `ARCHITECT_JOURNAL.md`.
- **Payload Construction Logic:**
  - **Header:** Project identification and timestamp.
  - **Active Scope:** Full contents of `.hydrate/CURRENT_UOW.md` (or notice if unassigned).
  - **Architectural Context:** Tail $N$ entries extracted from `.hydrate/ARCHITECT_JOURNAL.md` to establish domain state and active schemas.
  - **Macro Roadmap:** Active epics section from `.hydrate/ROADMAP.md`.
- **Unit & Integration Test Coverage:**
  - Create `test/context.test.js` covering standard stdout generation, `--clip` behavior, missing artifact fallbacks, and depth limiting.
  - Maintain line and branch test coverage quality gates ($>80\%$).

## 3. File Access Restrictions & Protocol
- **READ-ONLY:** `.hydrate/CURRENT_UOW.md`, `.hydrate/ROADMAP.md`
- **APPEND-ONLY (Upon Completion):** `.hydrate/PROJECT_JOURNAL.md`, `.hydrate/DEV_JOURNAL.md`, `.hydrate/ARCHITECT_JOURNAL.md`
- **MOVE/ARCHIVE (Upon Completion):** `.hydrate/CURRENT_UOW.md` -> `.hydrate/archive/UOW-HYDRATE-03.md`

## 4. Acceptance Criteria
1. `hydrate context` outputs a structured, high-density system context to stdout.
2. `hydrate context --clip` successfully copies the context block to the clipboard.
3. Running `npm test` passes 100% of unit tests with zero regressions (including new `test/context.test.js` suite).
4. Auto-commit working tree upon clean test verification using `feat(cli): complete UOW-HYDRATE-03 implementation and verification`.
