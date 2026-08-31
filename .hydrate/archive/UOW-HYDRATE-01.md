# UOW-HYDRATE-01: Full Scaffold & CLI Command Migration to `.hydrate/` Journal Architecture

## 1. Goal & Context
Migrate `@nemzilla/hydrate` scaffolding engine, CLI commands (`prompt`, `complete`), and test suites away from legacy monolithic documentation (`docs/SYSTEM.md`) to the new 5-artifact `.hydrate/` journal layout.

## 2. Surgical Scope & Requirements
- **Templates Directory (`templates/`):**
  - Update `templates/CLAUDE.md.template` with fast-start triggers (5.1–5.4) and `.hydrate/*_JOURNAL.md` access rules.
  - Create starter template files in `templates/.hydrate/`:
    - `PROJECT_JOURNAL.md.template`
    - `DEV_JOURNAL.md.template`
    - `ARCHITECT_JOURNAL.md.template`
    - `ROADMAP.md.template`
    - `CURRENT_UOW.md.template`
- **CLI Commands (`bin/cli.js` & `src/`):**
  - Update `hydrate init` to construct `.hydrate/` and `.hydrate/archive/` directories and render the 5 journal templates.
  - Update `hydrate prompt` to read active context from `.hydrate/ROADMAP.md` and `.hydrate/CURRENT_UOW.md`.
  - Update `hydrate complete` to write completion logs into `.hydrate/PROJECT_JOURNAL.md`, `.hydrate/DEV_JOURNAL.md`, and `.hydrate/ARCHITECT_JOURNAL.md`, and archive `.hydrate/CURRENT_UOW.md`.
- **Test Suite Updates:**
  - Update `test/prompt.test.js`, `test/complete.test.js`, `test/clipboard.test.js`, and `test/init.test.js` to assert against `.hydrate/` paths instead of `docs/SYSTEM.md`.

## 3. File Access Restrictions & Protocol
- **READ-ONLY:** `.hydrate/CURRENT_UOW.md`, `.hydrate/ROADMAP.md`
- **APPEND-ONLY (Upon Completion):** `.hydrate/PROJECT_JOURNAL.md`, `.hydrate/DEV_JOURNAL.md`, `.hydrate/ARCHITECT_JOURNAL.md`
- **MOVE/ARCHIVE (Upon Completion):** `.hydrate/CURRENT_UOW.md` -> `.hydrate/archive/UOW-HYDRATE-01.md`

## 4. Acceptance Criteria
1. Running `npm test` passes 100% of unit tests with zero regressions.
2. `hydrate init` builds full `.hydrate/` layout and `.hydrate/archive/` with no `docs/SYSTEM.md` output.
3. `hydrate prompt` and `hydrate complete` operate seamlessly on `.hydrate/` artifacts.
4. Auto-commit working tree upon clean test verification.

