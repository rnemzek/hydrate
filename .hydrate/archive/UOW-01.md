# 🔒 REPO FINGERPRINT — VERIFY BEFORE EDITING
Project: hydrate
Working Directory (absolute): /Users/rnemzek/Projects/personal/hydrate

# HYDRATE LEAD DEVELOPER EXECUTION PAYLOAD

## Target Task Scope

### UOW-01 (v2 Refactor) — Streamlined CLI Harness & 3-Artifact Scaffolding

**Objective**
Refactor the `@nemzilla/hydrate` CLI package to scaffold, sync, and maintain the streamlined 3-artifact workflow (`CLAUDE.md`, `.hydrate/CURRENT_UOW.md`, and `docs/SYSTEM.md`), consolidating CLI commands and eliminating legacy document drift.

**Acceptance Criteria**
1. **Consolidated Command Suite**:
   - `hydrate init` — Scaffolds `CLAUDE.md`, `.hydrate/CURRENT_UOW.md`, and `docs/SYSTEM.md` using the files in `templates/`.
   - `hydrate prompt` — Syncs active UOW payload into `.hydrate/CURRENT_UOW.md`.
   - `hydrate clip` — Copies current active `.hydrate/CURRENT_UOW.md` context directly to the system clipboard.
   - `hydrate complete` — Appends completed task summary directly to `docs/SYSTEM.md` (Section 4: Decision & Execution Log), checks off the active UOW in Section 2, and resets `.hydrate/CURRENT_UOW.md` to `CURRENT_UOW.md.template`.
2. **Template Integration**:
   - Wire `src/` to read directly from `templates/CLAUDE.md.template`, `templates/SYSTEM.md.template`, and `templates/CURRENT_UOW.md.template` during initialization.
3. **Tests & Verification**:
   - Update unit test suite in `hydrate` to verify file scaffolding, prompt syncing, and append operations.
   - Run `npm test` and verify all tests pass with core logic coverage ≥ 80%.
Run 'hydrate prompt' when ready for next task.
