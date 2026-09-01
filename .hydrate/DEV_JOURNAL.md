# Developer Journal - hydrate

# hydrate — System Documentation

## 1. Living Architecture & System Overview
`@nemzilla/hydrate` is a zero-dependency Node.js CLI (`bin/cli.js`) that scaffolds and maintains a 3-artifact AI context harness inside any target repo:

- **`CLAUDE.md`** — Operating rules & AI execution protocol, rendered from `templates/CLAUDE.md.template`.
- **`.hydrate/CURRENT_UOW.md`** — The active Unit of Work execution canvas, rendered from `templates/CURRENT_UOW.md.template`.
- **`docs/SYSTEM.md`** — This file's own shape: living architecture notes, roadmap/task index, backlog, and an append-only decision log, rendered from `templates/SYSTEM.md.template`.

**Module map**
- `src/templates.js` — loads/renders `templates/*.template` files (`{{PLACEHOLDER}}` substitution).
- `src/init.js` — `scaffold()` idempotently writes the 3 canonical artifacts into a target repo.
- `bin/cli.js` — command dispatch for the strict v2 surface (`init`, `prompt`, `clip`, `complete`, `help`, plus `-h`/`-v`/`?` aliases); owns `prompt` (sync active UOW payload from `docs/SYSTEM.md` + `CLAUDE.md`) and `complete` (mark done in `docs/SYSTEM.md`, log to Section 4, archive, reset) directly.
- `src/clipboard.js`, `src/help.js` — clipboard piping and CLI help/usage text.

**Pruned in UOW-02 (v2 Refactor):** `src/adopt.js`, `src/inject.js`, `src/discover.js`, `src/guide.js`, `src/setupCc.js` — the v1 `adopt`/`inject`/`iterate`/`setup-cc`/`greenfield`/`brownfield`/`next`/`lost`/`copy` command entry points and their backing modules.

## 2. Tactical Roadmap & Task Index
- [x] **UOW-01:** Core CLI Inject & Init Engine (`.hydrate/` setup)
- [x] **UOW-02:** Guidance Engine (`hydrate ?` / `hydrate lost`)
- [x] **UOW-03:** Portfolio Featured Card Integration (`robert.nemzilla.net`)
- [x] **UOW-04:** Native System Clipboard Pipe (`hydrate clip`) & Strict Task Validation (`v1.1.0`)
- [x] **UOW-05:** Universal Brownfield Adoption Engine & Claude Code Integration (`hydrate adopt` / `hydrate setup-cc`)
- [x] **UOW-09:** Universal Git Hygiene, Brownfield Status Heuristics & Repo Fingerprinting
- [x] **UOW-01 (v2 Refactor):** Streamlined CLI Harness & 3-Artifact Scaffolding (Iterated: 0)

## 3. Backlog & Feature Parking Lot (Brainstorm)
- **UOW-06:** Scope Guardrails (`hydrate diff` / File Boundary Inspector)
- **UOW-07:** Pre/Post Execution Hook Runner (`hydrate run`)
- **UOW-08:** Telemetry & Token Accounting (`.hydrate/session.json`)

## 4. Decision & Execution Log
<!-- Append-only history of completed UOWs -->

### UOW-01 — completed 2026-08-28
- Iterations logged: 0
- Suggested commit: `feat: complete UOW-01`

### UOW-02 — completed 2026-08-28
- Iterations logged: 0
- Suggested commit: `feat: complete UOW-02`

### UOW-HYDRATE-01 — completed 2026-08-31
**Scaffold Engine & Template Migration to `.hydrate/` Journal Architecture**

- Migrated `hydrate init` off the legacy 3-artifact scaffold (`CLAUDE.md`, `.hydrate/CURRENT_UOW.md`, `docs/SYSTEM.md`) onto the 6-artifact layout: `CLAUDE.md` plus `.hydrate/{CURRENT_UOW,ROADMAP,PROJECT_JOURNAL,DEV_JOURNAL,ARCHITECT_JOURNAL}.md` and `.hydrate/archive/`.
- Added `templates/.hydrate/{CURRENT_UOW,ROADMAP,PROJECT_JOURNAL,DEV_JOURNAL,ARCHITECT_JOURNAL}.md.template`; removed the stray non-`.template`-suffixed files that `loadTemplate()` could never have resolved (`templates/{ARCHITECT_JOURNAL,DEV_JOURNAL,PROJECT_JOURNAL,ROADMAP}.md`) and the now-missing `templates/SYSTEM.md.template` dependency that was crashing `scaffold()`.
- Rewrote `src/init.js`'s `scaffold()` to render the 5 `.hydrate/` templates via a small `{name, label}` table instead of one-off blocks; still idempotent (skips any file that already exists) and returns only the files it actually created.
- Rewired `bin/cli.js`'s `prompt`/`complete` commands off `docs/SYSTEM.md` onto the new journal files: `findNextPendingUow()` now scans `.hydrate/ROADMAP.md`'s "## Section 1: Scheduled Roadmap Items" instead of `docs/SYSTEM.md`'s "## 2."; `hydrate complete` now flips the matching bullet in `.hydrate/ROADMAP.md` and appends the completion entry to `.hydrate/PROJECT_JOURNAL.md` instead of `docs/SYSTEM.md` Section 4. `docs/`/`docs/SYSTEM.md` are no longer created or referenced by bootstrap.
- Updated `src/help.js` command summaries/workflow banner and `test/{init,prompt,complete,cli}.test.js` to match — `cli.test.js`'s stale `doesNotMatch(/ROADMAP\.md/)` assertion (a leftover from pruning v1's root-level `ROADMAP.md`) was removed since `.hydrate/ROADMAP.md` is now an intentional v2 artifact.
- Verified end-to-end by hand in a scratch dir: `init` → edit `.hydrate/ROADMAP.md` → `prompt` (pulls the pending UOW, writes the fingerprinted payload) → `complete` (marks the roadmap bullet `[x]`, appends to `PROJECT_JOURNAL.md`, archives the canvas).
- Test suite: 48/48 passing. Coverage: `src/init.js` 100% line/branch; `bin/cli.js` 93.48% line / 73.81% branch; `src/help.js` 93.99% line / 72.00% branch — all new branches added by this UOW are covered; the uncovered lines are pre-existing edge cases (malformed `package.json`, `--chunk-size` parsing, non-chunked architect payload path) outside this UOW's surgical scope.

### UOW-HYDRATE-01-HOTFIX — completed 2026-09-01
**Fix UOW ID Regex Parser for Hyphenated & Alphanumeric Identifiers**

- `bin/cli.js:251` — `handleComplete()`'s UOW-ID extraction regex was `/UOW-[\d\w]+/`, which stops at the first `-` (since `\w` excludes hyphens) and truncated hyphenated IDs like `UOW-HYDRATE-01` down to `UOW-HYDRATE`, dropping the `-01` sub-slug. Confirmed as the only occurrence of a UOW-ID regex in the codebase (`grep -rn "UOW-\[" bin src`).
- Fixed by widening the character class to `/UOW-[A-Za-z0-9-]+/`, so hyphens inside the ID are retained; matching still stops naturally at the first non-alphanumeric/non-hyphen character (`:`, `*`, whitespace), so existing single-segment IDs (`UOW-42`) are unaffected.
- Added a parameterized regression test in `test/complete.test.js` covering `UOW-HYDRATE-01`, `UOW-HOTFIX-03`, and `UOW-CARBOYZ-12` end-to-end (stdout message, suggested commit, `.hydrate/archive/<id>.md` filename, `.hydrate/PROJECT_JOURNAL.md` entry), plus a dedicated test confirming the `.hydrate/ROADMAP.md` bullet-flip regex also preserves the full hyphenated ID.
- Verified by hand in a scratch dir: `init` → set `.hydrate/CURRENT_UOW.md` to `## UOW-HYDRATE-01: Fixture` → `complete` → archived to `.hydrate/archive/UOW-HYDRATE-01.md` (previously would have been `UOW-HYDRATE.md`).
- Test suite: 52/52 passing (48 prior + 4 new). No coverage regressions.

### UOW-HYDRATE-02 — completed 2026-09-01
**Implement Journal & Archive Validation Utility (`hydrate check`)**

- Added `src/commands/check.js` (`runCheck(cwd)` / `formatReport(result)`) and wired a new `hydrate check` command into `bin/cli.js`'s dispatch switch (`handleCheck()`) plus a `COMMANDS.check` entry in `src/help.js`.
- `runCheck()` reads every `<UOW-ID>.md` filename under `.hydrate/archive/` as the source of truth for archived UOW IDs, then for each ID asserts: a completed checklist line `- [x] **[<UOW-ID>]**` in `.hydrate/PROJECT_JOURNAL.md`, and a markdown heading referencing `<UOW-ID>` in `.hydrate/DEV_JOURNAL.md` and `.hydrate/ARCHITECT_JOURNAL.md`.
- **Deliberate deviation from the UOW spec's literal `## [<UOW-ID>]` heading format:** `DEV_JOURNAL.md`/`ARCHITECT_JOURNAL.md` are hand-maintained (CLAUDE.md §4) and this repo's own established convention is `### <UOW-ID> — completed <date>` (see UOW-HYDRATE-01/-01-HOTFIX entries above), not `## [<UOW-ID>]`. A literal implementation of the spec's format would fail-close against this repo's own real journals, contradicting Acceptance Criterion 1 ("a complete `.hydrate/` structure passes with exit code 0"). Used a lenient heading matcher (`hasJournalHeading()`: any `#{1,6}` line containing the UOW ID token) that accepts both styles instead.
- Also implements the spec's "warn/flag if `CURRENT_UOW.md` contains a completed UOW payload not yet archived" requirement (`findUnarchivedCompletedUow()`): fires when `CURRENT_UOW.md` resolves a UOW ID, has zero remaining `- [ ]` tasks, isn't the reset placeholder, and that ID isn't already in `.hydrate/archive/` — mirroring the `findOpenTasks()` heuristic `hydrate complete` already uses. Per Acceptance Criterion 2, this warning also flips the overall exit code to `1` (not just the missing-journal-entry errors).
- `hydrate check` exits `0` only when there are zero missing-entry errors and zero unarchived-UOW warnings; exits `1` otherwise. A missing `.hydrate/` directory is reported as a single top-level error (exit `1`); an existing `.hydrate/` with an empty/missing `archive/` reports "No archived UOWs found" and exits `0`.
- Added `test/check.test.js` (12 tests) covering: missing `.hydrate/`, empty structure (pass), fully-consistent archive (pass), each of the three journal files missing an entry independently, all three journal files absent, the unarchived-completed-UOW warning, no warning when tasks are still open / already archived / reset to placeholder, and multiple archived UOWs validated independently.
- Test suite: 64/64 passing (52 prior + 12 new). Coverage: `src/commands/check.js` 100% line / 90.48% branch / 100% funcs — clears the 80% line+branch gate; `bin/cli.js` 93.73% line / 74.42% branch (the new `handleCheck()` lines are fully covered; uncovered lines are pre-existing, out-of-scope edge cases).
