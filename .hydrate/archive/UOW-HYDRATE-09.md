# UOW-HYDRATE-09: Add Triad Workflow Guide (`hydrate help` / `/hydrate-help`)

## 1. Goal & Context
Add an explicit **Triad Workflow Guide** section to CLI help output and create a dedicated `/hydrate-help` slash command. This provides a clear, step-by-step checklist for starting fresh contexts across the AI Lead Developer (Claude Code), AI Architect (Gemini), and Product Owner.

## 2. Surgical Scope & Requirements
- **Help Documentation Engine (`src/help.js`):**
  - Add the `⚙️ HYDRATE ENGINE — TRIAD WORKFLOW GUIDE` block detailing the 6-step boot sequence (launch CC in yolo mode, run `hydrate init`, extract `/hydrate-context`, hydrate AI Architect, copy generated spec to OS clipboard, fire `/hydrate-lfg`).
  - Ensure `hydrate help`, `hydrate --help`, and `hydrate -h` display the updated guide cleanly formatted.
- **Slash Command Provisioning (`templates/.claude/commands/hydrate-help.md` & `.claude/commands/hydrate-help.md`):**
  - Create the `/hydrate-help` slash command definition wrapping `hydrate help`.
  - Update `src/init.js` to provision `hydrate-help.md` alongside existing slash commands.
- **Unit & Integration Test Coverage:**
  - Update `test/help.test.js` and `test/init.test.js` to verify `hydrate-help` output and file scaffolding.
  - Maintain line and branch coverage quality gates (>80%).

## 3. File Access Restrictions & Protocol
- **READ-ONLY:** `.hydrate/CURRENT_UOW.md`, `.hydrate/ROADMAP.md`
- **APPEND-ONLY (Upon Completion):** `.hydrate/PROJECT_JOURNAL.md`, `.hydrate/DEV_JOURNAL.md`, `.hydrate/ARCHITECT_JOURNAL.md`
- **MOVE/ARCHIVE (Upon Completion):** `.hydrate/CURRENT_UOW.md` -> `.hydrate/archive/UOW-HYDRATE-09.md`

## 4. Acceptance Criteria
1. Running `hydrate help` or `hydrate --help` outputs the Triad Workflow Guide banner and step-by-step sequence.
2. `hydrate init` provisions `.claude/commands/hydrate-help.md` into target repos.
3. Running `npm test` passes 100% of unit tests with zero regressions.
4. Auto-commit working tree upon clean test verification using `feat(cli): add triad workflow guide and hydrate-help command`.
