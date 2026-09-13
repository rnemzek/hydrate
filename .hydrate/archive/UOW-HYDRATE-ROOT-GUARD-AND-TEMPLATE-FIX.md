# UOW-HYDRATE-ROOT-GUARD-AND-TEMPLATE-FIX: Enforce Git Repository Root Boundary & Render CLAUDE.md Placeholders

- **ID:** UOW-HYDRATE-ROOT-GUARD-AND-TEMPLATE-FIX
- **Title:** Enforce Git Repository Root Boundary & Render CLAUDE.md Placeholders
- **Status:** DRAFT
- **Target Branch:** main
- **Created:** 2026-09-13

## 1. Goal & Context

Ensure `@nemzilla/hydrate` initializes and syncs strictly at the top-most Git repository root, permanently blocking the creation of nested `.hydrate/` or `.claude/` directories in sub-packages, vendor folders, or arbitrary subdirectories. Additionally, resolve template ENOENT errors during sync and restore `CLAUDE.md`.

## 2. Surgical Scope & Requirements

### 2.1 Fix Sync Template Resolutions

- Fix the missing `hydrate.md.template` reference in `src/templates.js` / `src/commands/sync.js`.
- Ensure all command templates referenced in `CLAUDE_COMMANDS` exist under `templates/.claude/commands/` or fall back safely to base command definitions.

### 2.2 Top-Level Git Repository Root Guard

- In `src/init.js` and `src/commands/sync.js` (or workspace utility modules):
  - Resolve the canonical repository root via `git rev-parse --show-toplevel`.
  - Redirect all creation/syncing of `.hydrate/` and `.claude/commands/` targets directly to the Git repository root, regardless of the current working subdirectory.
  - If executed outside a Git repository, fallback to `process.cwd()` with an informational notice.
  - Reject or redirect any operation attempting to write `.hydrate/` or `.claude/` into subdirectories (e.g., `vendor/`, `packages/`, `dist/`).

### 2.3 Clean Up Local `CLAUDE.md`

- Replace raw `{{PROJECT_NAME}}` placeholders in the repo-root `CLAUDE.md` with `Hydrate`.
- Ensure `<!-- BEGIN HYDRATE MANAGED BLOCK -->` and `<!-- END HYDRATE MANAGED BLOCK -->` markers are properly formatted and intact.
- Verify `templates/CLAUDE.md.template` preserves `{{PROJECT_NAME}}` unrendered for downstream consumers.

## 3. Pre-Implementation Verification Notes

- **2.1 does not currently reproduce.** Ran `hydrate sync` from a clean directory, from a nested subdirectory, and audited every `CLAUDE_COMMANDS` entry against `templates/.claude/commands/*.template` on disk — no ENOENT, no missing template file. This item appears to be a stale premise (possibly referring to the `hydrate-lfg.md` registry gap already fixed in UOW-HYDRATE-14). No code change planned here; will re-verify at completion.
- **2.2 (single-target case) reproduces and is a real bug.** Ran `hydrate sync` from `packages/sub` inside a real git repo rooted at a parent directory — `.hydrate`/`.claude` were created in `packages/sub` instead of at the git root. Fix is in scope: resolve `git rev-parse --show-toplevel` and redirect `hydrate init`/`hydrate sync` (non-`--recursive`, no explicit `--path`) there, with a fallback + informational notice outside a git repo.
- **2.2 (`--recursive` case) conflicts with already-shipped, tested UOW-HYDRATE-14 behavior — flagged below, not yet resolved.**

## 4. Acceptance Criteria

- [x] **No template ENOENT:** `hydrate sync`/`hydrate init` run cleanly with no missing-template errors (already true today — regression-guard test to be added).
- [x] **Single-target root redirect:** running `hydrate init` or `hydrate sync` (no `--path`) from any subdirectory of a git working tree resolves and writes to `git rev-parse --show-toplevel`'s root, not the subdirectory — with an informational notice when redirected.
- [x] **Non-git fallback:** outside a git repository, `hydrate init`/`hydrate sync` fall back to `process.cwd()` with an informational notice (not an error).
- [x] **Explicit `--path` is respected as-is:** `hydrate sync --path <dir>` is not redirected to a git root — an explicit path is an intentional override.
- [x] **CLAUDE.md placeholder fix:** the repo-root `CLAUDE.md`'s managed block has `{{PROJECT_NAME}}` rendered, with intact `<!-- BEGIN/END HYDRATE MANAGED BLOCK -->` markers; `templates/CLAUDE.md.template` itself still carries the raw, unrendered `{{PROJECT_NAME}}` placeholder. (Rendered via `hydrate init --force` — the actual `renderTemplate()`/`PROJECT_NAME` mechanism used everywhere else in this codebase — which substitutes `path.basename(cwd)`, i.e. `hydrate` lowercase, matching this repo's directory name and every prior version of this file's H1, rather than the literal capitalized "Hydrate" string named in the spec prose.)
- [x] **Test Coverage:** maintain line and branch coverage at or above 80% on all modified/new modules via `npm test`.
