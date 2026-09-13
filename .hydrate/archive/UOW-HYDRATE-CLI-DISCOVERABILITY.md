# UOW-HYDRATE-CLI-DISCOVERABILITY: Implement Discoverability, Help Flags, and Lifecycle Cleanup

- **ID:** UOW-HYDRATE-CLI-DISCOVERABILITY
- **Title:** Implement Discoverability, Help Flags, and Lifecycle Cleanup
- **Status:** DRAFT
- **Target Branch:** main
- **Created:** 2026-09-13

## 1. Goal & Context

Transform `@nemzilla/hydrate` into a self-documenting, discoverable, and forgiving CLI harness. The CLI and slash command layers must support standard `--help`/`-h` flags, command routing, shell completion, and automatic cleanup of deprecated legacy slash command files (`hydrate-architect.md`, legacy `hydrate.md`) during `hydrate sync` or `hydrate init`.

## 2. Surgical Scope & Requirements

### 2.1 Terminal CLI Discoverability (CLI entrypoint: `bin/cli.js`)

- **Standard Help Flags:** Intercept `--help`, `-h`, `help`, or running `hydrate` with no arguments to print a clean, standard POSIX help manual detailing all subcommands (`checkup`, `ingest`, `sync`, `context`, `completion`).
- **Standard Version Flag:** Ensure `-v` and `--version` report the current package version from `package.json`.
- **Unknown Command Forgiveness:** If an unrecognized command or flag is passed (e.g., `hydrate foo`), output a clear error message along with the standard help manual and exit with code `1`.
- **Shell Auto-Completion (`hydrate completion`):** Add a `completion` command that outputs `zsh`/`bash` auto-complete definitions for subcommands.

### 2.2 Managed Slash Command Router (`.claude/commands/hydrate.md`)

- Update `.claude/commands/hydrate.md` to act as an interactive router/help screen:
  - If invoked as `/hydrate`, `/hydrate help`, or `/hydrate -h`, output a concise usage directory of all available slash commands (`/hydrate-ingest`, `/hydrate-checkup`, `/hydrate-context`, `/hydrate-arch-sync`).
  - If invoked with subcommands (e.g., `/hydrate ingest`), delegate directly to the clipboard ingestion workflow.

### 2.3 Automatic Deprecated Command Purge (`hydrate sync` / `hydrate init`)

- Update the template/command sync engine in the CLI to maintain a canonical registry of active slash command files.
- Implement automated orphan cleanup: when `hydrate sync` or `hydrate init` runs, scan `.claude/commands/` and automatically remove deprecated legacy files (specifically `hydrate-architect.md` or obsolete custom scripts not in the canonical registry).

## 3. Acceptance Criteria

- [x] **Help/no-args:** `hydrate --help`, `hydrate -h`, `hydrate help`, and bare `hydrate` (no args) all print the standard help manual and exit 0.
- [x] **Version:** `hydrate -v` / `hydrate --version` print the exact version from `package.json`.
- [x] **Unknown-command forgiveness:** an unrecognized command/flag prints a clear error plus the help manual and exits 1 (this is a behavior change — today the default case prints help but exits 0).
- [x] **Shell completion:** `hydrate completion [bash|zsh]` prints a valid completion script listing every visible subcommand.
- [x] **Slash command router:** `.claude/commands/hydrate.md` documents both the no-arg directory-listing behavior and the `/hydrate ingest`-style delegation behavior.
- [x] **Deprecated command purge:** `hydrate sync`/`hydrate init` remove any `.claude/commands/hydrate-*.md` file that is not part of the current canonical `CLAUDE_COMMANDS` registry (e.g. a stray `hydrate-architect.md`), while never touching non-`hydrate-*` files (a Product Owner's own unrelated slash commands) and never touching any of the 13 currently-active files.
- [x] **Test Coverage:** maintain line and branch coverage at or above 80% on all modified/new modules via `npm test`.
