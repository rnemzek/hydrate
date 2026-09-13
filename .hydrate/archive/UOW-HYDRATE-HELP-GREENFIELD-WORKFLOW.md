# UOW-HYDRATE-HELP-GREENFIELD-WORKFLOW: Document Greenfield Repository Bootstrap in CLI & Slash Command Help

- **ID:** UOW-HYDRATE-HELP-GREENFIELD-WORKFLOW
- **Title:** Document Greenfield Repository Bootstrap in CLI & Slash Command Help
- **Status:** DRAFT
- **Target Branch:** main
- **Created:** 2026-09-13

## 1. Goal & Context

Formally document the recommended end-to-end greenfield repository bootstrap workflow inside both the `hydrate --help` CLI printer and the `/hydrate-help` slash command output so users have a clear, step-by-step guide for starting fresh projects across the Triad (PO, Architect, Developer).

## 2. Surgical Scope & Requirements

### 2.1 Update CLI `--help` Printer (`src/help.js`)

- Add an explicit **🌱 GREENFIELD REPO BOOTSTRAP (RECOMMENDED)** section right above or within the Triad Workflow guide in the `hydrate --help` output.
- Document the 6 core setup steps clearly:
  1. `$ git init`
  2. `$ hydrate init` (scaffolds `CLAUDE.md`, `.hydrate/`, `.claude/commands/`)
  3. Edit `.hydrate/ROADMAP.md` (seed high-level project vision & initial milestone checks)
  4. `$ hydrate context --clip` (copy token-dense payload for the Lead Architect)
  5. Paste into Lead Architect (Gemini) chat -> copy generated `UOW-01` spec to clipboard
  6. `$ claude --dangerously-skip-permissions` -> run `/hydrate-lfg` (or `hydrate lfg --yes`) to ingest clipboard & execute zero-touch

### 2.2 Update `/hydrate-help` Command Template (`templates/.claude/commands/hydrate-help.md.template`)

- Mirror the **🌱 GREENFIELD REPO BOOTSTRAP** workflow into the slash command template so calling `/hydrate-help` inside Claude Code displays the same guidance.

### 2.3 Update Sync Output

- Run `node bin/cli.js sync` within the UOW implementation to re-sync `.claude/commands/hydrate-help.md`.

## 3. Pre-Implementation Notes

- The actual help printer is `src/help.js` (spec named `src/commands/help.js`, which doesn't exist) — building against the real file.
- `src/help.js` already has an "⚙️ HYDRATE ENGINE — TRIAD WORKFLOW GUIDE" section covering similar but not identical ground (no `git init` step, no ROADMAP.md-editing step, ordered differently — "launch Claude Code" first rather than last). Plan: add the new 🌱 GREENFIELD REPO BOOTSTRAP section as a **distinct, additional** section (placed above the existing Triad Workflow Guide, before the `COMMANDS` table, per "right above or within"), rather than rewriting/replacing the existing guide — avoids destructively changing already-tested, working help text that serves an "ongoing work" boot sequence rather than a from-scratch bootstrap.

## 4. Acceptance Criteria

- [x] **CLI help section:** `hydrate --help`/`hydrate -h`/`hydrate help` print a "🌱 GREENFIELD REPO BOOTSTRAP (RECOMMENDED)" section listing all 6 steps in order, appearing before the `COMMANDS` table.
- [x] **Slash command mirror:** `templates/.claude/commands/hydrate-help.md.template` documents the same 6-step Greenfield workflow.
- [x] **Repo dogfooding:** this repo's own `.claude/commands/hydrate-help.md` is re-synced via `hydrate sync` to match the updated template.
- [x] **Existing help tests still pass:** the pre-existing Triad Workflow Guide banner/tests are unaffected.
- [x] **Test Coverage:** maintain line and branch coverage at or above 80% via `npm test`.
