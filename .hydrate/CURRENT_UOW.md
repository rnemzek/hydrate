# HYDRATE ACTIVE EXECUTION CANVAS

## UOW-03: Embedded Guidance Engine, Interactive Playbooks, and State Inspection
- **ID:** UOW-03
- **Status:** COMPLETED
- **Scope:** Give the CLI a self-orienting layer — smart state detection reachable via aliases (`?`, `lost`, `next`), embedded greenfield/brownfield playbooks, and a `--help` screen that surfaces both workflows up front.

## Implementation Checklist

- [x] **Task 3.1:** Create `src/guide.js` — a Smart State Detector that inspects the cwd for `.hydrate/` (present? has `session.json`? has `CURRENT_UOW.md`? what's its status?) and `ROADMAP.md` (present? any pending `[ ]` UOWs?), then renders a **Current Diagnosis** block plus a **Recommended Next Action** block (e.g. "no `.hydrate/` found → run `hydrate inject` (existing repo) or `hydrate init` (new repo)"; "`.hydrate/CURRENT_UOW.md` says all UOWs complete → run `hydrate prompt`"; "UOW in progress → run `hydrate iterate` or `hydrate complete`").
- [x] **Task 3.2:** Wire `hydrate ?`, `hydrate lost`, and `hydrate next` in `bin/cli.js` as aliases that all call the same `runGuide()` entry point from `src/guide.js`. No new state is written — this is a read-only diagnostic.
- [x] **Task 3.3:** Add a `hydrate greenfield` playbook — a static, detailed walkthrough for starting a brand-new project: `init` → `prompt` → `iterate` → `complete`, with the "why" for each step (mirrors the README workflow section but scoped to new repos).
- [x] **Task 3.4:** Add a `hydrate brownfield` playbook — a static, detailed walkthrough for retrofitting an existing repo: `inject` → review generated `CLAUDE.md` → optionally `init` for UOW tracking → `prompt` → `iterate` → `complete`.
- [x] **Task 3.5:** Extend the command table in `src/help.js` to register `next` (with `?`/`lost` as hidden aliases resolving to the same metadata), `greenfield`, and `brownfield` so `hydrate <cmd> --help` and the global command list stay consistent with Task 2.7's shared-table pattern — no duplicated usage strings.
- [x] **Task 3.6:** Update `printGlobalHelp()` in `src/help.js` to add prominent "GREENFIELD PATH (1-2-3)" and "BROWNFIELD PATH (4-5-6)" sections ahead of COMMANDS, pointing at `hydrate greenfield` / `hydrate brownfield` for the full walkthrough, and calling out `hydrate ?` / `lost` / `next` as the "don't know what to do next" escape hatch.
- [x] **Task 3.7:** Manual verification pass (run in scratch/temp directories, per the UOW-02 incident note — never against this repo's live `.hydrate/`):
  - `hydrate ?` / `hydrate lost` / `hydrate next` in a directory with no `.hydrate/` at all (both brownfield- and greenfield-looking dirs — confirms inject vs init recommendation)
  - same aliases with `.hydrate/CURRENT_UOW.md` mid-progress (open tasks → iterate; no open tasks → complete)
  - same aliases where the current UOW is COMPLETED (status field and legacy sentinel text both handled)
  - `.hydrate/` present but no `CURRENT_UOW.md` yet
  - `hydrate greenfield` and `hydrate brownfield` render correctly and take no arguments
  - `hydrate --help` shows the new GREENFIELD/BROWNFIELD PATH sections
  - All confirmed against `/tmp` scratch dirs; this repo's own `.hydrate/CURRENT_UOW.md` was untouched (verified via `git status`).
- [x] **Task 3.8:** Add `node:test` coverage in `test/guide.test.js` — unit tests against `diagnose()` for all four states plus process-level tests for `?`/`lost`/`next`/`greenfield`/`brownfield`, each asserting exit code 0 and no `.hydrate/` mutation in an isolated `fs.mkdtempSync` cwd. 14/14 tests passing across both suites.
- [x] **Task 3.9:** Update `README.md` with a "Lost? Just ask" subsection documenting `hydrate ?` / `lost` / `next`, and a "Greenfield vs. Brownfield" callout linking to the two playbook commands.
- [x] **Task 3.10:** Run `npm test` and confirm no regressions against the UOW-02 suite.

## Notes
- `src/guide.js` is read-only — no writes to `.hydrate/` or any repo file. It exports `diagnose(cwd)` as a pure function (unit-testable) plus `runGuide()` as the console-printing entry point.
- Reused the `src/help.js` shared command table (Task 2.7 precedent): `next` is canonical, `?` and `lost` are registered as `{ ...COMMANDS.next, hidden: true }` so they resolve for `--help` lookups but don't duplicate the global command list.
- Also exported the ANSI helpers (`bold`/`dim`/`cyan`/`green`/`yellow`) and `printTable` from `src/help.js` so `guide.js` reuses the same color/no-color logic instead of a second implementation.
- README updated: new "Lost? Just ask" section (with a Greenfield vs. Brownfield playbook callout) placed right after "The Solution" — near the top, ahead of Installation — plus a pointer to `hydrate ?` in Quickstart & Help and three new rows in the Command Reference table.
- Final verification: `npm test` → 14/14 passing (4 from UOW-02's `test/cli.test.js`, 10 from UOW-03's `test/guide.test.js`). No regressions.
