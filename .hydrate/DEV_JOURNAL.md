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
