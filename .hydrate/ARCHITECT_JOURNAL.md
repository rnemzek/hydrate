# Architect Journal - hydrate

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

- **Architecture change:** `hydrate init` now scaffolds a 6-artifact harness — `CLAUDE.md` (project root) plus `.hydrate/{CURRENT_UOW,ROADMAP,PROJECT_JOURNAL,DEV_JOURNAL,ARCHITECT_JOURNAL}.md` and `.hydrate/archive/` — replacing the prior 3-artifact `CLAUDE.md` / `.hydrate/CURRENT_UOW.md` / `docs/SYSTEM.md` split. `docs/SYSTEM.md` is no longer part of bootstrap.
- **New abstraction:** `.hydrate/ROADMAP.md` (format: `## Section 1: Scheduled Roadmap Items` / `## Section 2: Future features`) now owns the task index that `docs/SYSTEM.md` Section 2 previously owned; `.hydrate/PROJECT_JOURNAL.md` now owns the completion/decision log that `docs/SYSTEM.md` Section 4 previously owned. `DEV_JOURNAL.md` and `ARCHITECT_JOURNAL.md` (this file) remain append-only, hand-maintained by the Lead Developer/Architect per CLAUDE.md Section 4 — `hydrate complete` does not write to them automatically.
- **Contract:** `hydrate complete`'s roadmap-bullet-flip regex is unchanged (`^([-#]+) \[ \] (.*\bUOW-XX\b.*)$`), just retargeted from `docs/SYSTEM.md` to `.hydrate/ROADMAP.md`; `findNextPendingUow()` retargeted from `docs/SYSTEM.md`'s `## 2.` heading to `.hydrate/ROADMAP.md`'s `## Section 1` heading (case-insensitive prefix match).
- **Trade-off:** Chose a full migration (scaffold + `bin/cli.js` prompt/complete + tests) over a hybrid that kept `docs/SYSTEM.md` generation alongside the new journals — confirmed with the Product Owner, since a hybrid would have left `hydrate prompt`/`hydrate complete` internally inconsistent with the new architecture and violated the UOW's "zero legacy references" requirement.
- **Deferred:** the `hydrate complete` UOW-ID regex (`/UOW-[\d\w]+/`) still truncates hyphenated IDs like `UOW-HYDRATE-01` to `UOW-HYDRATE` — a pre-existing limitation, out of this UOW's surgical scope, left for a future UOW.

### UOW-HYDRATE-01-HOTFIX — completed 2026-09-01
**Fix UOW ID Regex Parser for Hyphenated & Alphanumeric Identifiers**

- **Contract:** the UOW-ID token that `hydrate complete` extracts from `.hydrate/CURRENT_UOW.md` — and reuses to flip the matching bullet in `.hydrate/ROADMAP.md`, name the archived canvas under `.hydrate/archive/`, and build the suggested commit message — now matches `/UOW-[A-Za-z0-9-]+/` instead of `/UOW-[\d\w]+/`, so hyphenated multi-segment IDs (`UOW-HYDRATE-01`, `UOW-<slug>-<hotfix-n>`) round-trip intact. No other contract changed; single-segment IDs (`UOW-42`) behave identically to before.
- **Closes the deferred item** noted in UOW-HYDRATE-01's entry above.

### UOW-HYDRATE-02 — completed 2026-09-01
**Implement Journal & Archive Validation Utility (`hydrate check`)**

- **New module:** `src/commands/check.js` exports `runCheck(cwd)` (pure logic, returns `{ ok, errors, warnings, checkedUows }`) and `formatReport(result)` (pure string rendering) — kept separate from `bin/cli.js` so the validation logic is independently unit-testable, consistent with `src/init.js`'s `scaffold()` split.
- **New CLI surface:** `hydrate check` — non-mutating, read-only across all of `.hydrate/`. Exit code `0` = clean, `1` = any journal-entry error or unarchived-UOW warning.
- **Contract — archived-UOW discovery:** the filename stem of each `.hydrate/archive/<UOW-ID>.md` file is treated as the canonical UOW ID list to validate against (matches the naming contract `hydrate complete` already writes, per UOW-HYDRATE-01-HOTFIX above).
- **Contract — journal-entry assertions per archived UOW ID:**
  - `.hydrate/PROJECT_JOURNAL.md`: exact-format check for `- [x] **[<UOW-ID>]**` (matches this repo's real `PROJECT_JOURNAL.md` convention exactly).
  - `.hydrate/DEV_JOURNAL.md` / `.hydrate/ARCHITECT_JOURNAL.md`: lenient check — any markdown heading line (`#` through `######`) containing the UOW-ID token.
- **Trade-off / spec deviation (confirmed against real repo state, not re-litigated with the Product Owner given the Fast-Path Protocol):** UOW-HYDRATE-02's payload specified `## [<UOW-ID>]` literally for the dev/architect journal headings. This repo's actual hand-maintained convention (established across UOW-HYDRATE-01 and -01-HOTFIX, both journals) is `### <UOW-ID> — completed <date>` — no brackets, three hashes. A literal implementation would report every existing archived UOW as broken, which is inconsistent with both journals' real content and with Acceptance Criterion 1 (a complete `.hydrate/` structure must pass). Chose the lenient heading matcher over amending the two hand-maintained journal files to fit the spec's format, since `DEV_JOURNAL.md`/`ARCHITECT_JOURNAL.md` are explicitly hand-maintained artifacts under CLAUDE.md §4, not `hydrate`-generated ones — `hydrate check`'s job is to validate against this project's actual established convention, not to prescribe a new one.
- **New heuristic:** `findUnarchivedCompletedUow()` reuses the same "no remaining `- [ ]` tasks" signal `handleComplete()`'s `findOpenTasks()` already encodes in `bin/cli.js`, applied read-only to flag (not act on) a fully-checked-off `CURRENT_UOW.md` that hasn't been archived yet.

### UOW-HYDRATE-03 — completed 2026-09-01
**Implement High-Density Context Compiler (`hydrate context`)**

- **New module:** `src/commands/context.js` exports `buildContext(cwd, { depth })` (pure logic, returns the compiled string) plus two testable extraction helpers (`extractRecentArchitectEntries()`, `extractActiveEpics()`) — continues the `src/commands/*.js` pattern established by `check.js`: business logic lives outside `bin/cli.js`, which only owns argv parsing and I/O side effects (`handleContext()`).
- **New CLI surface:** `hydrate context [--clip|-c] [--depth <n>|--depth=<n>]` — read-only across `.hydrate/`. Prints the compiled payload to stdout unconditionally; `--clip` additionally pipes it through `copyWithFeedback()` (the same clipboard utility `hydrate clip`/`hydrate prompt --copy` already use) without reprinting it on the no-tool-found fallback.
- **Contract — payload shape:** header (project name via `package.json`/dirname, ISO timestamp) → `## Active Scope` (full trimmed `.hydrate/CURRENT_UOW.md`, or a "no active UOW" notice) → `## Architectural Context` (tail `depth` `### `-delimited blocks from `.hydrate/ARCHITECT_JOURNAL.md`, most-recent-last) → `## Macro Roadmap` (`.hydrate/ROADMAP.md`'s `## Section 1: Scheduled Roadmap Items` section, reusing the same "## Section 1" prefix convention `findNextPendingUow()` in `bin/cli.js` already relies on). Each section degrades independently to its own fallback notice when the source file/section is absent, rather than failing the whole command — deliberate, since `hydrate context` is meant to be usable at any point in a repo's `.hydrate/` lifecycle (freshly-initted, mid-UOW, or between UOWs).
- **Trade-off:** `context.js` duplicates a small `getProjectName()` helper rather than importing `bin/cli.js`'s — `bin/cli.js` runs its full command-dispatch switch as top-level side-effecting code on require, so it is not safe to `require()` from a library module or test file. Same constraint `check.js`/`check.test.js` already work around by driving `hydrate check` through `spawnSync` at the CLI boundary instead.
- **Depth parsing convention:** `--depth <n>` (space form) and `--depth=<n>` (equals form) are both accepted, mirroring `hydrate prompt --chunk-size=<bytes>`'s existing precedent; a non-positive or non-numeric value is silently ignored and the default (3) is used, rather than erroring — consistent with how `--chunk-size` already degrades.

### UOW-HYDRATE-04 — completed 2026-09-01
**Implement Static Portfolio Overview Exporter (`hydrate export-portfolio`)**

- **New module:** `src/commands/export-portfolio.js` exports a pure `buildPortfolio(cwd)` — returns `{ generatedAt, overview, architecture, stack, roadmap }` — plus the underlying testable helpers, continuing the `src/commands/*.js` split (pure logic vs. `bin/cli.js`'s argv-parsing/I/O) established by `check.js`/`context.js`.
- **New CLI surface:** `hydrate export-portfolio` (alias `hydrate export`) with `-o`/`--out <path>` (default `./tech-overview.json`, creates parent directories) and `--stdout` (prints the JSON to stdout instead of writing a file — mutually exclusive with the write, not additive).
- **Reused abstraction:** `architecture` extraction imports and reuses `context.js`'s `extractRecentArchitectEntries(text, depth)` for the `### `-delimited block split (called with `Infinity` to get every block) rather than re-implementing the parse — the only cross-command-module import introduced so far in the `src/commands/` layer.
- **New contract — roadmap schema:** `.hydrate/ROADMAP.md`'s `## Section 1: Scheduled Roadmap Items` / `## Section 2: Future features` headings (the same convention `context.js`'s `extractActiveEpics()` and `bin/cli.js`'s `findNextPendingUow()` already key off of) are parsed line-by-line into `{ id, title, status, description }` via `parseRoadmapLine()`. Two bullet dialects are recognized: checkbox (`- [ ] **UOW-ID:** ...` → status `scheduled`/`done` from the `[ ]`/`[x]`) and plain concept bullets (`- **UOW-ID:** Title (detail)` → status `backlog`); a trailing ` — description` or `(parenthetical)` on the bullet becomes `description`.
- **New contract — overview/milestone extraction:** `totalCompletedUows` and `latestMilestone` are derived from `.hydrate/PROJECT_JOURNAL.md`'s real completion-line format (`- [x] **[<UOW-ID>]** <title> — <date> | Pass: <n>/<n> tests`) via `extractCompletedUows()`; `latestMilestone` is simply the last matching line in file order (this repo's journal is append-only, so "last" already means "most recent").
- **Scope decision:** the UOW spec's `stack` requirement mentioned "package.json (and DEV_JOURNAL.md annotations)" — skipped the `DEV_JOURNAL.md` half. `DEV_JOURNAL.md` is a hand-maintained prose decision log (CLAUDE.md §4) with no structured stack-annotation convention to parse; inventing one to satisfy a parenthetical would be scope creep beyond what `package.json` alone (name/version/license/runtime via `type`/engines/bin/dependency taxonomy) already fully covers.
- **Resilience:** every top-level key degrades independently — a missing `.hydrate/` directory, missing individual journal/roadmap files, or a malformed `package.json` (`JSON.parse` throw caught, falls back to `{}`) all produce empty arrays/null fields rather than throwing, matching `check.js`/`context.js`'s existing per-section-fallback precedent (this is also why `hydrate export-portfolio` runs cleanly against a freshly-initted or even `.hydrate/`-less repo).
- Added `tech-overview.json` to `.gitignore` (generated build artifact, mirrors the existing `.hydrate/session.json` entry).
