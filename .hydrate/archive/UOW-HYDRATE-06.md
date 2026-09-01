# UOW-HYDRATE-06: Implement Clipboard Ingress Engine & Interactive Prompting (`hydrate ingest`)

## 1. Goal & Context
Implement `hydrate ingest` (and alias `hydrate paste`) with an interactive terminal prompt styled after the `⚙️ HYDRATE ENGINE` visual identity. It sniffs the OS clipboard, validates UOW payload structure, evaluates existing `.hydrate/CURRENT_UOW.md` state, and presents clean choices to overwrite, complete-and-swap, or exit to `[Chat]`.

## 2. Surgical Scope & Requirements
- **CLI Command Implementation (`bin/cli.js`, `src/commands/ingest.js`, `src/help.js`):**
  - Add `hydrate ingest` command (and alias `hydrate paste`) to the CLI parser.
  - Support a non-interactive `--yes` / `-y` flag for automated headless environments.
- **Clipboard Heuristic & Parsing Engine:**
  - Read text from OS clipboard via `src/utils/clipboard.js`.
  - Validate clipboard content against UOW structural markers (e.g., `# UOW-`, `Goal & Context`, `Surgical Scope`, or `Acceptance Criteria`).
  - Report an error/warning if clipboard text does not resemble a valid UOW spec.
- **Interactive UI Engine (`src/utils/ui.js` or within `ingest.js`):**
  - Render the distinct `⚙️ HYDRATE ENGINE` double-line boxed banner with high contrast formatting.
  - If `CURRENT_UOW.md` is empty: Offer `[1] Apply clipboard payload to CURRENT_UOW.md`, `[2] Chat / Exit`.
  - If `CURRENT_UOW.md` has active/uncompleted work: Offer `[1] Archive current and swap with clipboard UOW`, `[2] Overwrite current UOW`, `[3] Chat / Exit`.
  - Always include option `[Chat] Hand off to AI Architect` (which exits process code `0` cleanly with a helpful prompt message for Claude Code).
- **Unit & Integration Test Coverage:**
  - Create `test/ingest.test.js` covering valid clipboard parsing, non-UOW clipboard rejection, non-interactive `--yes` flag execution, and state conflict paths.
  - Maintain line and branch test coverage quality gates (>80%).

## 3. File Access Restrictions & Protocol
- **READ-ONLY:** `.hydrate/CURRENT_UOW.md`, `.hydrate/ROADMAP.md`
- **APPEND-ONLY (Upon Completion):** `.hydrate/PROJECT_JOURNAL.md`, `.hydrate/DEV_JOURNAL.md`, `.hydrate/ARCHITECT_JOURNAL.md`
- **MOVE/ARCHIVE (Upon Completion):** `.hydrate/CURRENT_UOW.md` -> `.hydrate/archive/UOW-HYDRATE-06.md`

## 4. Acceptance Criteria
1. Running `hydrate ingest` correctly reads the clipboard and renders the `⚙️ HYDRATE ENGINE` terminal UI.
2. Invalid/non-UOW clipboard contents trigger clear diagnostic errors without modifying `.hydrate/CURRENT_UOW.md`.
3. Running `npm test` passes 100% of unit tests with zero regressions (including new `test/ingest.test.js` suite).
4. Auto-commit working tree upon clean test verification using `feat(cli): complete UOW-HYDRATE-06 implementation and verification`.
