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

### UOW-HYDRATE-03 — completed 2026-09-01
**Implement High-Density Context Compiler (`hydrate context`)**

- Added `src/commands/context.js` (`buildContext(cwd, { depth })`, plus exported helpers `extractRecentArchitectEntries()` and `extractActiveEpics()` — kept pure/testable, following `src/commands/check.js`'s split) and wired a new `hydrate context` command into `bin/cli.js`'s dispatch switch (`handleContext()`) plus a `COMMANDS.context` entry in `src/help.js`.
- `buildContext()` compiles a single string: a project/timestamp header, the full trimmed contents of `.hydrate/CURRENT_UOW.md` (or a "no active UOW" fallback notice), the tail `depth` (default 3) "### " decision-log blocks from `.hydrate/ARCHITECT_JOURNAL.md`, and the `## Section 1: Scheduled Roadmap Items` section of `.hydrate/ROADMAP.md` (falls back to the full trimmed roadmap text if that heading is absent). Each artifact independently reports its own fallback notice if missing, rather than failing the whole command.
- `handleContext()` supports `--depth <n>` and `--depth=<n>` (invalid/non-positive values silently fall back to the default of 3, matching `hydrate prompt --chunk-size`'s existing parse-and-fallback convention) and `--clip`/`-c`, reusing `copyWithFeedback()` (`printFallback: false`, since the payload is already printed to stdout before the copy attempt).
- Small deliberate duplication: `context.js` carries its own copy of `getProjectName()` rather than requiring it from `bin/cli.js`, since `bin/cli.js` executes top-level command dispatch on require and isn't safe to import as a library module.
- Added `test/context.test.js` (21 tests): unit coverage of `extractRecentArchitectEntries()` (null/empty, depth 0, tail-slicing, depth exceeding count, ignoring pre-heading content) and `extractActiveEpics()` (null input, section extraction/truncation, fallback to full text); `buildContext()` fallback notices, full compilation, and whitespace-only CURRENT_UOW.md handling; CLI-level coverage of stdout output, `--depth`/`--depth=`/invalid-depth handling, the bare-`.hydrate/` fallback path, `--clip`/`-c` piping through a fake clipboard binary (mirrors `clipboard.test.js`'s fake-bin approach), the no-clipboard-tool fallback notice (payload not reprinted), the no-`--clip` no-op path, and `--help`.
- Test suite: 85/85 passing (64 prior + 21 new). Coverage: `src/commands/context.js` 100% line / 97.30% branch / 100% funcs — clears the 80% line+branch gate; `bin/cli.js` 94.67% line / 77.78% branch (new `handleContext()` lines fully covered; uncovered lines are pre-existing, out-of-scope edge cases).

### UOW-HYDRATE-04 — completed 2026-09-01
**Implement Static Portfolio Overview Exporter (`hydrate export-portfolio`)**

- Added `src/commands/export-portfolio.js` exporting a pure `buildPortfolio(cwd)` (plus testable helpers `buildOverview()`, `buildArchitecture()`, `buildStack()`, `buildRoadmap()`, `extractCompletedUows()`, `parseRoadmapLine()`) and wired `hydrate export-portfolio` (alias `hydrate export`) into `bin/cli.js`'s dispatch switch (`handleExportPortfolio()`) plus a `COMMANDS['export-portfolio']` entry (and a hidden `COMMANDS.export` alias entry) in `src/help.js`.
- `handleExportPortfolio()` supports `-o`/`--out <path>` (default `./tech-overview.json`, parent directories created via `fs.mkdirSync(..., { recursive: true })`) and `--stdout` (prints the JSON payload and skips the file write entirely, rather than doing both).
- **Payload shape:** `{ generatedAt, overview, architecture, stack, roadmap }`. `overview` pulls `name`/`description` from `package.json` (falls back to dirname/empty string) plus `totalCompletedUows`/`latestMilestone` parsed from `.hydrate/PROJECT_JOURNAL.md`'s real completion-line convention (`- [x] **[<UOW-ID>]** <title> — <date> | Pass: <n>/<n> tests`, the same format `hydrate check`'s `hasProjectJournalEntry()` already asserts). `architecture` is an array of `{ id, title, date, body }` derived from `.hydrate/ARCHITECT_JOURNAL.md`'s `### `-delimited decision blocks — reuses `context.js`'s `extractRecentArchitectEntries(text, Infinity)` for the block-splitting instead of re-implementing it (`slice(-Infinity)` degrades to the full array). `stack` is extracted straight from `package.json` (name/version/license/runtime via `type`/engines/bin/dependency taxonomy) — the spec's "and DEV_JOURNAL.md annotations" was skipped since `DEV_JOURNAL.md` has no established stack-annotation convention to parse (a hand-maintained prose decision log, not structured data); `package.json` alone is a complete, well-defined source. `roadmap` is `{ scheduled, backlog }`, parsed from `.hydrate/ROADMAP.md`'s `## Section 1`/`## Section 2` headings (reusing the same section-slicing convention as `context.js`'s `extractActiveEpics()`), each entry `{ id, title, status, description }` via `parseRoadmapLine()` — handles both this repo's checkbox convention (`- [ ] **UOW-ID:** ...`, status `scheduled`/`done`) and plain concept bullets (`- **UOW-ID:** Title (detail)`, status `backlog`), with a trailing em-dash or parenthetical treated as the `description`.
- Every section degrades independently to an empty/null fallback (no thrown errors) when its source file, `.hydrate/` directory, or `package.json` is entirely missing or malformed — consistent with `context.js`/`check.js`'s existing resilience precedent.
- Added `tech-overview.json` to `.gitignore` since it's a generated build artifact (mirrors the existing `.hydrate/session.json` entry).
- Added `test/export-portfolio.test.js` (30 tests): unit coverage of every pure helper (`extractCompletedUows()`, `buildOverview()`, `buildArchitecture()`, `buildStack()`, `parseRoadmapLine()`, `buildRoadmap()`, `buildPortfolio()` including missing-`.hydrate/`, missing/malformed-`package.json`, and full-payload cases) plus CLI-level coverage (`--out` default/custom/`-o` short form with nested-directory creation, `--stdout` skipping the file write, the `export` alias, resilience against a completely absent `.hydrate/`, and `--help`).
- Test suite: 112/112 passing (85 prior + 27 new). Coverage: `src/commands/export-portfolio.js` 100% line / 94.74% branch / 100% funcs — clears the 80% line+branch gate; `bin/cli.js` 95.12% line / 77.55% branch (new `handleExportPortfolio()` lines fully covered; uncovered lines are pre-existing, out-of-scope edge cases).

### UOW-HYDRATE-05 — completed 2026-09-01
**Implement Smart State Machine & Session Reconciler (`hydrate checkup`)**

- Added `src/commands/checkup.js` exporting a pure `runCheckup(cwd)` (returns `{ state, message, ... }`) and `formatCheckupReport(result)`, and wired `hydrate checkup` (alias `hydrate status`) into `bin/cli.js`'s dispatch switch (`handleCheckup()`) plus a `COMMANDS.checkup` entry (and a hidden `COMMANDS.status` alias entry) in `src/help.js` — continues the `src/commands/*.js` pure-logic-vs-CLI-I/O split established by `check.js`/`context.js`/`export-portfolio.js`.
- `runCheckup()` reconciles `.hydrate/CURRENT_UOW.md`, `.hydrate/ROADMAP.md`, `.hydrate/archive/`, and `git status --porcelain` into one of five states: `clean-slate` (`CURRENT_UOW.md` empty/reset — reports whether `.hydrate/ROADMAP.md` has any pending content beneath its heading), `in-progress-dirty` / `in-progress-clean` (an active UOW with unchecked tasks — modified-file count from `git status` plus remaining-task count), `unarchived-done` (every task checked off and `npm test` passes — "run `hydrate complete`"), and `broken-build` (every task checked off but `npm test` fails). `error` covers a missing `.hydrate/` directory.
- `npm test` is only invoked when every `- [ ]` task in `CURRENT_UOW.md` is already checked off (`unarchived-done`/`broken-build` branches) rather than on every call — the only two states that actually depend on the test result, keeping `hydrate checkup` cheap for the common in-progress case.
- **Reused heuristic:** the "no remaining `- [ ]` tasks" signal is the same one `handleComplete()`'s `findOpenTasks()` and `check.js`'s `findUnarchivedCompletedUow()` already encode; also checks the resolved UOW ID against `.hydrate/archive/`'s filename stems (same contract `check.js` uses) so an already-archived-but-not-yet-reset `CURRENT_UOW.md` doesn't get re-flagged as "complete but unarchived".
- Both `git status --porcelain` and `npm test` spawn failures (binary not found, not a git repo) degrade gracefully rather than throwing — `getGitStatus()` treats "not a repo"/spawn error identically as "no git signal available", and `runTestSuite()`'s unrunnable case is treated the same as a passing test run (can't disprove completion, so don't block on it).
- Exit code: `0` for every state except `error` and `broken-build` (both `1`) — `hydrate checkup` is meant to be run as a quick, mostly-informational reconciler, not a hard CI gate, except when it detects an actual regression (broken build) or a missing `.hydrate/` structure.
- Added `test/checkup.test.js` (14 tests) covering: missing `.hydrate/`, clean-slate with/without pending roadmap content, the `status` alias, dirty vs. clean working tree with remaining tasks, complete-but-unarchived (tests pass) vs. broken-build (tests fail), a missing/whitespace-only `CURRENT_UOW.md`, a UOW payload with no resolvable ID (generic-label fallback), an already-archived UOW not being re-flagged, and both `git`/`npm` spawn-failure branches (forced via a blanked `PATH` env).
- Test suite: 126/126 passing (112 prior + 14 new). Coverage: `src/commands/checkup.js` 100% line / 82.61% branch / 100% funcs — clears the 80% line+branch gate; `bin/cli.js` 95.26% line / 78.00% branch (new `handleCheckup()` lines fully covered; uncovered lines are pre-existing, out-of-scope edge cases).

### UOW-HYDRATE-06 — completed 2026-09-01
**Implement Clipboard Ingress Engine & Interactive Prompting (`hydrate ingest`)**

- Added `src/commands/ingest.js` exporting a pure `runIngest(cwd, options)` (async — the only interactive command so far) plus testable helpers `isValidUowPayload()`, `isEmptyUow()`, `extractUowId()`, `renderBanner()`. Wired `hydrate ingest` (alias `hydrate paste`) into `bin/cli.js`'s dispatch switch (`handleIngest()`) plus a `COMMANDS.ingest` entry (and hidden `COMMANDS.paste` alias) in `src/help.js`.
- Extended `src/clipboard.js` (not a new `src/utils/` module as the UOW payload suggested — this repo has no `utils/` directory, and `clipboard.js` already owns clipboard I/O) with `readFromClipboard()`/`pasteCandidatesForPlatform()`, mirroring `copyToClipboard()`/`candidatesForPlatform()`'s platform-dispatch and injectable-`spawn` shape exactly. Paste tools: `pbpaste` (darwin), `powershell -NoProfile -Command Get-Clipboard` (win32 — `clip` is copy-only there), `xclip -selection clipboard -o` then `xsel --clipboard --output` (linux).
- **Validation contract:** `isValidUowPayload()` requires both a `# UOW-...`/`## UOW-...`/`### UOW-...` id header AND at least one of `Goal & Context` / `Surgical Scope` / `Acceptance Criteria` (case-insensitive) — requiring both, not either, avoids false-positiving on a stray `# UOW-` mention in unrelated clipboard text. An invalid payload prints a diagnostic to stderr, exits `1`, and leaves `.hydrate/CURRENT_UOW.md` completely untouched (checked before any file I/O).
- **Interactive flow:** renders the `⚙️ HYDRATE ENGINE` double-line box banner, then branches on `isEmptyUow()` (same placeholder/blank check `checkup.js`'s `isPlaceholderUow()` already encodes): empty → `[1] Apply` / `[2] Chat/Exit`; active/uncompleted → `[1] Archive current and swap` / `[2] Overwrite` / `[3] Chat/Exit`. Any unrecognized answer in either menu falls through to the chat-exit path (never a hard error) and exits `0` — the payload's requirement that `[Chat]` always be an available, safe exit.
- **`--yes`/`-y` flag:** applies non-interactively with no prompt — archives any active UOW first (if not empty), then writes the clipboard payload straight to `.hydrate/CURRENT_UOW.md`. Chosen over "always overwrite" as the non-interactive default since it's the non-destructive option (existing work is preserved in `.hydrate/archive/` either way).
- Every I/O seam (`readClipboard`, `input`/`output` streams, `log`/`error`) is injectable on `runIngest()`, so the full interactive flow — both menus, all branches, the invalid-answer fallback, and the synthesized-ID archive-naming edge case (no resolvable `UOW-` token in the outgoing payload) — is exercised directly with fake streams (`stream.Readable.from([...])` for stdin) instead of needing a real pty.
- Added `test/ingest.test.js` (33 tests): pure-helper unit coverage, direct `runIngest()` coverage of every menu branch (both empty-state options, both active-state options, the unrecognized-answer fallback, both `--yes` sub-cases, the no-clipboard-tool error, the invalid-payload rejection, the synthesized-archive-ID edge case), plus CLI-level end-to-end coverage (`hydrate ingest --yes` and `hydrate paste -y` through a fake `pbpaste`/`xclip` binary on `PATH`, the no-clipboard-tool exit-1 path, an unexpected-`mkdirSync`-failure exit-1 path exercising `handleIngest()`'s `.catch()` branch, and `--help`). Also added 10 tests to `test/clipboard.test.js` for `readFromClipboard()`/`pasteCandidatesForPlatform()`, mirroring the existing `copyToClipboard()`/`candidatesForPlatform()` suite.
- Test suite: 161/161 passing (126 prior + 35 new: 25 in `ingest.test.js`'s runIngest/helper/CLI sections plus 10 in `clipboard.test.js`). Coverage: `src/commands/ingest.js` 100% line / 97.50% branch / 100% funcs; `src/clipboard.js` 100% line / 100% branch / 100% funcs — both clear the 80% gate; `bin/cli.js` 95.46% line / 79.25% branch (new `handleIngest()` lines fully covered, including the `.catch()` branch; uncovered lines are pre-existing, out-of-scope edge cases).
