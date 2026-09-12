# UOW-HYDRATE-15: Greenfield Harness Reset & Force Sync

- **ID:** UOW-HYDRATE-15
- **Title:** Greenfield Harness Reset & Force Sync
- **Status:** APPROVED
- **Target Branch:** main
- **Created:** 2026-09-12

## 1. Architectural Strategy

- **Greenfield Policy (`--force`):** When `hydrate sync --recursive --force` or `hydrate init --force` is run on a repository, any existing `CLAUDE.md` is wholesale replaced with the standard v3.0.0 scaffold wrapped in comment markers (`<!-- BEGIN HYDRATE MANAGED BLOCK v3.0.0 -->`).
- **Default In-Place Upgrades:** Normal `hydrate sync` operates strictly inside the comment markers. If markers are present, update inside them. If markers are missing and `--force` is omitted, prompt/flag that a greenfield reset (`--force`) is required.

## 2. Technical Requirements

### 1. Hard Overwrite Flag (`--force`)

- Add `--force` handling to `src/commands/sync.js` and `src/init.js`.
- When `--force` is passed:
  - Overwrite `CLAUDE.md` with the clean managed template (wiping legacy un-marked content).
  - Overwrite `.claude/commands/*.md` templates with latest version binaries.
  - Preserve `.hydrate/` history (journals, archives, ROADMAP.md).

### 2. Recursive Force Command

- Support `hydrate sync --recursive --force` to wipe and standardize all `CLAUDE.md` files down a folder tree in a single command.

## 3. One-Shot Execution Command

Once implemented, your single command to reset your entire `personal` directory to the modern baseline will be:

```bash
hydrate sync --recursive --force
```

## 4. Acceptance Criteria

- [x] **Default (no `--force`) behavior on an already-marked CLAUDE.md is unchanged:** `hydrate sync`/`hydrate init` without `--force` still only update-inside-markers when markers are present (never wholesale-replace), and never touch `.hydrate/` history. (Note: the unmarked case no longer auto-appends per UOW-HYDRATE-14 — see the Missing-markers guard criterion below, which supersedes that behavior; this criterion's original "append-if-unmarked" wording was corrected during implementation to match the approved Architectural Strategy.)
- [x] **Missing-markers guard:** `hydrate sync` (no `--force`) on a `CLAUDE.md` with no managed-block markers reports that a greenfield reset (`--force`) is required, without modifying the file.
- [x] **`--force` wholesale replace:** `hydrate init --force` / `hydrate sync --force` replace `CLAUDE.md` outright with the clean managed-block-wrapped template, discarding any unmarked legacy content.
- [x] **`--force` recursive:** `hydrate sync --recursive --force` applies the wholesale-replace policy across every discovered repo root.
- [x] **`.hydrate/` untouched:** journals, archive, and `ROADMAP.md` are never modified by `--force`.
- [x] **Test Coverage:** maintain line and branch coverage at or above 80% on all modified/new modules via `npm test`.
