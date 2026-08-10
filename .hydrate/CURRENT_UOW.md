# HYDRATE ACTIVE EXECUTION CANVAS

## UOW-02: CLI Help, Flags, and Command Usage System
- **ID:** UOW-02
- **Status:** COMPLETED
- **Scope:** Add clean `--help` (`-h`) and `--version` (`-v`) output for the global CLI and each subcommand (`init`, `prompt`, `iterate`, `complete`).

## Implementation Checklist

- [x] **Task 2.1:** Add a global `--version` / `-v` flag to `bin/cli.js` that reads `version` from `package.json` and prints only `vX.Y.Z`, then exits.
- [x] **Task 2.2:** Confirm the existing `showHelp()` stays the single source of truth for top-level `--help` / `-h` usage text (no duplicated copies).
- [x] **Task 2.3:** Add `--help` / `-h` handling for `init` — print `init`-specific usage and short-circuit before calling `runInit()`.
- [x] **Task 2.4:** Add `--help` / `-h` handling for `prompt` — document the `--architect` and `--chunk-size=<bytes>` options.
- [x] **Task 2.5:** Add `--help` / `-h` handling for `iterate` — document the `"<reason>"` positional argument.
- [x] **Task 2.6:** Add `--help` / `-h` handling for `complete` — document that it takes no arguments.
- [x] **Task 2.7:** Extract a shared command → usage-text table so global help and per-subcommand help can't drift out of sync.
- [x] **Task 2.8:** Manually verify: `hydrate --version`, `hydrate -v`, `hydrate --help`, and `hydrate <cmd> --help` for all four subcommands; confirm unknown flags still fall through to existing default help behavior.
- [x] **Task 2.9:** Update README.md quickstart to mention `--help` / `--version` discoverability.
- [x] **Task 2.10:** Run `npm test` and confirm no regressions (currently a stub — note if it still needs a real suite).

## Notes
- Implementation landed in `bin/cli.js` + new `src/help.js` (shared command → usage-text table, matches Task 2.7).
- Also covers the `inject` command (added in UOW-01 dogfooding pass) for consistency, even though it wasn't in the original UOW-02 command list.
- `test/cli.test.js` added using `node:test` / `node:assert` (zero deps); `package.json` `test` script now runs `node --test test/*.test.js`. 4/4 passing.
- README overhauled (Task 2.9) with Quickstart & Help, persona/architecture overview, and full command reference.

## Incident Note
- An earlier manual verification pass ran the real `hydrate complete` command (not `--help`) against this file, which reset it to "All UOWs are complete!" and cleared this checklist. Restored from session context; no work was lost, but real state-mutating commands should be tested in a scratch directory, not this repo's live `.hydrate/CURRENT_UOW.md`, going forward.
