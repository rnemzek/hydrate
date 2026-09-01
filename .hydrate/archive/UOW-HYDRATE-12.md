# UOW-HYDRATE-12: Enrich Context Compiler with System Architecture & Rule Artifacts

## 1. Description & Goal
Enhance `src/commands/context.js` in `@nemzilla/hydrate` so `npx hydrate context` compiles a complete, robust Architect Context payload. When compiling context, the CLI must automatically append `CLAUDE.md`, `docs/ARCHITECTURE.md`, and recent archived UOW titles (or `PROJECT_JOURNAL.md` history) alongside transient `.hydrate/` state.

## 2. Key Acceptance Criteria
- [ ] **Enrich `src/commands/context.js` Payload**:
  - Include `CLAUDE.md` content under a `## Project Guidelines (CLAUDE.md)` section (if present).
  - Include `docs/ARCHITECTURE.md` content under a `## Overall Architecture (docs/ARCHITECTURE.md)` section (if present).
  - Fall back gracefully to scanning `.hydrate/archive/*.md` titles or `PROJECT_JOURNAL.md` entries if `.hydrate/ARCHITECT_JOURNAL.md` is empty.
- [ ] **Maintain Clipboard Export Behavior**:
  - Ensure enriched payload pipes seamlessly to the OS clipboard without truncating.
- [ ] **Automated Test Coverage**:
  - Update `test/commands/context.test.js` to assert that `CLAUDE.md` and `docs/ARCHITECTURE.md` sections are included in the generated output when files exist.

## 3. Affected Files
- `src/commands/context.js`
- `test/commands/context.test.js`

## 4. Verification Steps
1. Run `npm test` to confirm all tests pass.
2. Run `npx hydrate context` in `@nemzilla/hydrate` and verify `CLAUDE.md` and `docs/ARCHITECTURE.md` are present in the output.
