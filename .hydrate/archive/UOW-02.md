# 🔒 REPO FINGERPRINT — VERIFY BEFORE EDITING
Project: hydrate
Working Directory (absolute): /Users/rnemzek/Projects/personal/hydrate

# HYDRATE LEAD DEVELOPER EXECUTION PAYLOAD

## Target Task Scope

### UOW-02 — CLI Command Surface Pruning & v2 Help Text Synchronization

**Objective**
Prune legacy v1 CLI command entry points (`inject`, `adopt`, `iterate`, `setup-cc`, `greenfield`, `brownfield`) and update `src/help.js` so `hydrate --help` accurately reflects the streamlined v2 3-artifact workflow.

**Acceptance Criteria**
1. **Command Surface Pruning**:
   - Update CLI router (main entry binary) to support strictly `init`, `prompt`, `clip`, `complete`, and `help` (plus aliases `-h`, `-v`, `?`).
   - Remove or deprecate unused legacy handler modules (`src/adopt.js`, `src/inject.js`, `src/guide.js`, `src/setupCc.js`, etc.).
2. **v2 Help Text Realignment**:
   - Update `src/help.js` to remove all references to `ROADMAP.md`, `CONTEXT.md`, and `AI_PROJECT_RULES.md`.
   - Print clean usage output explaining the 3-artifact workflow (`CLAUDE.md`, `.hydrate/CURRENT_UOW.md`, `docs/SYSTEM.md`).
3. **Tests & Verification**:
   - Update CLI router unit tests to match pruned command surface.
   - Run `npm test` and verify zero test failures.

