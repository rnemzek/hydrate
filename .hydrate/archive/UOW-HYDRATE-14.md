# UOW-HYDRATE-14: Global Lifecycle Engine & Workspace Sync

- **ID:** UOW-HYDRATE-14
- **Title:** Global Lifecycle Engine & Workspace Sync
- **Status:** APPROVED
- **Target Branch:** main
- **Created:** 2026-09-12

## 1. Executive Summary & Architectural Scope

This UOW expands @nemzilla/hydrate from a single-repository prompt harness into a zero-friction workspace lifecycle engine. It covers two primary operational tracks:

1. **Runtime Polish & Prompt Loop:** Delimited comment block boundary management inside CLAUDE.md, automatic context clipboard copying on `/hydrate`, clipboard-first "Andiamo" parsing for seamless UOW ingest, and zero-touch completion/archive/commit automation.
2. **Global Lifecycle Engine:** Recursive multi-repo workspace sync (`hydrate sync [--recursive]`), version drift detection and one-tap updates (`hydrate update`), clean workspace ejection (`hydrate eject`), and global git hook integration (`hydrate hook enable`).

## 2. Detailed Technical Requirements

### Track 1: Runtime Polish & Prompt Loop

#### Item 1.1: Managed Block Boundaries in CLAUDE.md

- **Goal & Context:** Prevent full overwrites of pre-existing CLAUDE.md files in brownfield repositories.
- **Marker Standard:**
  ```
  <!-- BEGIN HYDRATE MANAGED BLOCK v1.4.0 -->
  ... hydrate operating rules ...
  <!-- END HYDRATE MANAGED BLOCK -->
  ```
- **Execution Logic:**
  - `hydrate init` and `hydrate sync` check if CLAUDE.md exists.
  - If markers exist, replace only the text between `<!-- BEGIN HYDRATE MANAGED BLOCK -->` and `<!-- END HYDRATE MANAGED BLOCK -->`.
  - If no markers exist but CLAUDE.md is present, append the block to the bottom of CLAUDE.md.
  - If CLAUDE.md does not exist, create it containing only the managed block.

#### Item 1.2: Auto-Copy Architect Context on /hydrate

- **Goal & Context:** Eliminate manually typing or calling export commands before asking for design updates.
- **Execution Logic:**
  - Update `.claude/commands/hydrate.md` and default execution rules.
  - Executing `/hydrate` performs its local checkup and automatically triggers `hydrate context --clip`, copying the token-dense context payload directly to the OS clipboard (pbcopy / xclip / powershell).

#### Item 1.3: Clipboard-First "Andiamo" Execution

- **Goal & Context:** Allow instant UOW execution without manual `hydrate ingest` or file saving.
- **Execution Protocol:**
  - Update `.claude/commands/hydrate-lfg.md` and default trigger execution rules.
  - When trigger words ("Andiamo", "LFG", "Make it so", etc.) are received, Claude Code checks the system clipboard FIRST via `pbpaste` / `xclip` / `powershell`.
  - If valid UOW dump markdown (containing `# Unit of Work Specification` or `## Active Scope`) is present in the clipboard, Claude Code automatically writes it to `.hydrate/CURRENT_UOW.md` and starts work immediately.
  - If no UOW payload is found in the clipboard, fallback to reading `.hydrate/CURRENT_UOW.md`.

#### Item 1.4: Autonomous Zero-Touch Cleanup Gate

- **Goal & Context:** Full automated cycle end-to-end upon task completion.
- **Execution Protocol:** Upon passing `npm test` and satisfying all quality gates:
  1. Archive `.hydrate/CURRENT_UOW.md` to `.hydrate/archive/UOW-HYDRATE-14.md`.
  2. Append completion entries to `.hydrate/PROJECT_JOURNAL.md`, `.hydrate/DEV_JOURNAL.md`, and `.hydrate/ARCHITECT_JOURNAL.md`.
  3. Clear `.hydrate/CURRENT_UOW.md`.
  4. Execute `git commit -m "feat(lifecycle): complete UOW-HYDRATE-14 implementation and verification"`.

### Track 2: Product Lifecycle Engine

#### Item 2.1: Recursive Workspace Sync (hydrate sync [--recursive])

- **CLI Command:** `hydrate sync [--recursive|-r] [--path <dir>]`
- **Behavior:**
  - Non-recursive: Syncs the current repo's `.claude/commands/*.md` templates and CLAUDE.md managed block to the running package version. Preserves `.hydrate/` history, journals, and state.
  - `--recursive`: Scans parent/child directories for `.git` or `package.json` roots and applies sync across all discovered repos.
  - Uninitialized Repo Bootstrapping: If a discovered repo lacks `.hydrate/`, automatically run a quiet, idempotent `hydrate init`.

#### Item 2.2: Version Drift Detection & One-Tap Upgrade (hydrate update)

- **Version Check:**
  - Add a fast, non-blocking version check during `hydrate checkup` (with a 24-hour TTL local cache at `~/.hydrate/version-cache.json` or fast 1.5s timeout check against npm registry).
  - Print banner when drift is detected:
    `💡 @nemzilla/hydrate v1.4.0 is available (current: v1.2.4). Run 'hydrate update' to upgrade.`
- **CLI Command:** `hydrate update [--global|-g]`
- **Action:** Executes `npm install -g @nemzilla/hydrate` (or updates local project dependencies) and re-runs `hydrate sync` across the active workspace.

#### Item 2.3: Clean Workspace Ejection (hydrate eject)

- **CLI Command:** `hydrate eject [--recursive|-r] [--dry-run] [--force|-f]`
- **Action:**
  - Strips `.hydrate/` directory.
  - Removes `.claude/commands/hydrate-*.md` templates.
  - Strips `<!-- BEGIN HYDRATE MANAGED BLOCK -->` section from CLAUDE.md (deletes CLAUDE.md if empty after removal).
  - Prompts for confirmation unless `--force` is present. `--dry-run` previews actions without executing.

#### Item 2.4: Git Hook Auto-Init (hydrate hook)

- **CLI Command:** `hydrate hook <enable|disable|status>`
- **Action:** Installs a global Git hook (`~/.git-templates/hooks/post-init` or global `core.hooksPath` configuration) so running `git init` automatically executes `hydrate init --quiet` in the new directory.

## 3. Acceptance Criteria & Verification Tasks

- [x] **Managed Block Unit Tests:** Verify `src/utils/managed-block.js` updates only delimited sections in CLAUDE.md without modifying external developer rules.
- [x] **Clipboard Trigger Verification:** Verify `/hydrate` auto-clips context and "Andiamo" parses valid clipboard UOW blocks before falling back to disk.
- [x] **Sync Engine:** Verify `hydrate sync --recursive` discovers multi-repo roots and bootstraps uninitialized repos safely.
- [x] **Eject Engine:** Verify `hydrate eject --dry-run` and `--force` completely strip Hydrate artifacts while leaving user code untouched.
- [x] **Update & Drift Check:** Verify `hydrate checkup` displays the drift banner when a newer npm version exists and `hydrate update` triggers upgrade + resync.
- [x] **Test Coverage:** Maintain line and branch test coverage at or above 80% across all new CLI subcommands and utilities via `npm test`.

## 4. Architectural Decisions

| Decision | Selected | Alternative | Rationale |
|---|---|---|---|
| CLAUDE.md Scope | HTML Comment Boundaries | Full overwrite | Preserves custom team/linter rules in brownfield projects while enabling idempotent updates to Hydrate rules. |
| Drift Inspection | Local cached TTL file (24h) | Network call on every execution | Eliminates CLI lag during offline work or frequent `/hydrate-checkup` calls. |
| Ingest Fallback | Clipboard-first → Disk fallback | File-only ingest | Allows human developer to copy architect output directly from web UI and type "Andiamo" without intermediary saving steps. |
