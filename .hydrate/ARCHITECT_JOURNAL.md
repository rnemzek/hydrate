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
