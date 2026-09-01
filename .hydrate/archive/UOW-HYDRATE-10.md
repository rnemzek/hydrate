# UOW-HYDRATE-10: Zero-Touch Auto-Provisioning & Unified `/hydrate` Interface

## 1. Description & Goal
Transition `@nemzilla/hydrate` into a zero-touch, Claude Code CLI-first experience while preserving head-to-head terminal/CI compatibility. This introduces automatic slash-command provisioning via `postinstall`, a unified `/hydrate` master command with automatic OS clipboard export, and direct in-prompt inspection via `/hydrate uow` and `/hydrate artifacts`.

## 2. Key Acceptance Criteria
- [x] **Auto-Provisioning**:
  - Add `bin/postinstall.js` executed on package install (`npm i` / `npm link`).
  - Reads `process.env.INIT_CWD` to scaffold `.claude/commands/` into the host project non-destructively without requiring manual `hydrate init`.
  - Added `"postinstall": "node bin/postinstall.js"` to `package.json`.
- [x] **OS Clipboard Utility (`src/utils/clipboard.js`)**:
  - Implement OS-agnostic helper using platform utilities (`pbcopy` on macOS, `powershell.exe Set-Clipboard` on Windows, `xclip` on Linux).
  - Gracefully handles headless/TTY environments without crashing.
- [x] **UOW Inspection Engine (`src/commands/uow.js`)**:
  - Implement `hydrate uow list`: List active UOW and all archived UOWs chronologically.
  - Implement `hydrate uow last`: Print content of the most recently completed UOW.
  - Implement `hydrate uow <id>`: Print specific UOW content by ID (e.g., `hydrate uow UOW-HYDRATE-09`).
- [x] **Artifact Mapper (`src/commands/artifacts.js`)**:
  - Implement `hydrate artifacts`: Print plain-English tree of `.hydrate/` and `.claude/commands/` along with copy-pasteable `.gitignore` guidelines.
- [x] **Unified Master Slash Command & CLI Routing**:
  - Add `templates/commands/hydrate.md`, `hydrate-uow.md`, and `hydrate-artifacts.md`.
  - Register new templates in `src/init.js` (`CLAUDE_COMMANDS`).
  - Master `/hydrate` runs `hydrate checkup`, auto-archives complete UOWs, and copies Architect Context to clipboard.
  - Route `uow` and `artifacts` subcommands in `bin/cli.js`.
- [x] **Automated Test Suite**:
  - Add unit and integration tests covering `uow`, `artifacts`, `postinstall`, and `clipboard` modules.

## 3. Affected Files
- `package.json`
- `bin/cli.js`
- `bin/postinstall.js` (NEW)
- `src/init.js`
- `src/commands/uow.js` (NEW)
- `src/commands/artifacts.js` (NEW)
- `src/utils/clipboard.js` (NEW)
- `templates/commands/hydrate.md` (NEW)
- `templates/commands/hydrate-uow.md` (NEW)
- `templates/commands/hydrate-artifacts.md` (NEW)
- `test/uow.test.js` (NEW)
- `test/artifacts.test.js` (NEW)
- `test/postinstall.test.js` (NEW)

## 4. Verification Steps
1. Run `npm test` to verify all unit tests pass.
2. Run `npx hydrate uow list` and `npx hydrate artifacts` to verify terminal output.
3. Test `node bin/postinstall.js` in a temporary host folder to verify `.claude/commands/` scaffolding.
4. Execute `/hydrate` in Claude Code to verify auto-checkup, state clean up, and context clipboard copying.
