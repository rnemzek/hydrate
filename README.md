# 💧 @nemzilla/hydrate

**Deterministic event-sourced context harness for AI-assisted engineering.**

## The Problem

AI coding assistants degrade over long sessions:

- **Context rot** — critical constraints get pushed out of the window by chatter.
- **Stack hallucinations** — the model invents APIs, files, or conventions that don't exist in your repo.
- **Sprawling prompts** — every session starts from a hand-assembled wall of copy-pasted context.

## The Solution

**The 3-Persona Triad** splits responsibility so no single actor (human or AI) is overloaded:

| Persona | Role | Owns |
|---|---|---|
| **Product Owner** (Human) | Final authority on scope, acceptance, and commits | Priorities, sign-off |
| **Lead Architect** (Gemini) | System design, stack boundaries, multi-file consistency | `AI_PROJECT_RULES.md`, architecture calls |
| **Lead Developer** (Claude Code) | Surgical file edits, unit testing, local execution | The diff |

**Dual-Document Architecture** keeps the two things an AI actually needs to see current at all times:

- **`ROADMAP.md`** — the high-level milestone list. Slow-moving, human-curated.
- **`.hydrate/CURRENT_UOW.md`** — the active Unit of Work (UOW). Fast-moving, regenerated per task, always the single source of truth for "what am I doing right now."

`hydrate` is the CLI that keeps these documents in sync and hands each persona exactly the context it needs — no more, no less.

## Lost? Just ask

Don't dig through this README to figure out what to run next — ask the CLI directly:

```bash
hydrate ?
hydrate lost
hydrate next
```

All three are aliases for the same **Smart State Detector**. It inspects the current repo (`.hydrate/`, `ROADMAP.md`) and prints a live diagnosis:

```
🔍 Current Status
  UOW-03 is in progress with open checklist items.

🎯 Recommended Next Command
  $ hydrate iterate "<reason>"
```

It even figures out whether you're starting fresh or retrofitting: no `.hydrate/` yet plus an existing `package.json`/`.git`/`go.mod`/`Cargo.toml` points you at `hydrate inject`; a genuinely empty repo points you at `hydrate init`.

### Greenfield vs. Brownfield playbooks

For the full step-by-step walkthrough — not just "what's next" but "why" — run the playbook for your situation:

```bash
hydrate greenfield   # starting a brand-new project
hydrate brownfield   # retrofitting hydrate onto an existing codebase
```

Both print directly to the terminal, formatted and numbered, so an AI Product Owner (or a human) can move at full speed without ever opening this file. `hydrate --help` also leads with both paths — labeled **GREENFIELD PATH (1-2-3)** and **BROWNFIELD PATH (4-5-6)** — right above the full command list.

## Installation

```bash
npx @nemzilla/hydrate init
```

No global install required. `npx` always resolves the latest published version.

## Quickstart & Help

Every command is discoverable from the CLI itself — you should never need to leave the terminal to find the right flag.

```bash
# Global help: lists every command with a one-line summary
npx @nemzilla/hydrate --help
npx @nemzilla/hydrate -h

# Print the installed version
npx @nemzilla/hydrate --version
npx @nemzilla/hydrate -v

# Per-command help: usage, options, and examples for one command
npx @nemzilla/hydrate prompt --help
npx @nemzilla/hydrate iterate --help

# Not sure what to run at all? Ask the Smart State Detector.
npx @nemzilla/hydrate ?
```

Running `hydrate` with no arguments is equivalent to `--help`. See [Lost? Just ask](#lost-just-ask) below for the full guidance engine.

## Execution Workflow

The core loop is four commands, run in order:

```
hydrate init  ->  hydrate prompt  ->  hydrate iterate "..."  ->  hydrate complete
```

### 1. `hydrate init`

Bootstraps the harness in the current repo. Creates (non-destructively — existing files are never overwritten):

- `AI_PROJECT_RULES.md` — the Triad contract and stack constraints
- `ROADMAP.md` — high-level milestone tracking
- `.hydrate/CURRENT_UOW.md` — the active execution canvas
- `docs/journals/dev-journal.md` — a running telemetry log

```bash
hydrate init
```

### 2. `hydrate prompt`

Assembles the active UOW context — pulling `AI_PROJECT_RULES.md` (or `CLAUDE.md`), the current dev journal tail, and the pending task block from `ROADMAP.md` — and writes it to `.hydrate/CURRENT_UOW.md` as the Lead Developer's execution payload.

Every payload opens with a **repo fingerprint safety header** — the project name and absolute working directory, plus a note instructing the AI to verify its cwd matches before making any edits. This guards against a stale or copy-pasted payload being applied against the wrong repo.

```bash
hydrate prompt

# Generate a chunked dump formatted for the Lead Architect (Gemini) instead
hydrate prompt --architect

# Override the chunk size used when splitting large architect payloads
hydrate prompt --architect --chunk-size=4000

# Also copy the generated payload straight to the system clipboard
hydrate prompt --copy
```

### `hydrate clip` / `hydrate copy`

Copies the current `.hydrate/CURRENT_UOW.md` contents to the system clipboard — `pbcopy` on macOS, `xclip`/`xsel` on Linux, `clip` on Windows. If none of those are installed, it falls back to printing the context to stdout instead of failing.

```bash
hydrate clip
hydrate copy   # alias
```

### 3. `hydrate iterate "<message>"`

Logs a progress/bug-fix pass against the active UOW without losing its original scope. Appends a numbered `[Iteration Pass]` block (`UOW-XX.i1`, `.i2`, …) to `.hydrate/CURRENT_UOW.md`.

```bash
hydrate iterate "Fix off-by-one in the chunker"
```

### 4. `hydrate complete`

**When to run:** every unit test passes and every task in `.hydrate/CURRENT_UOW.md` is checked off.

**What it does:**
1. Scans `.hydrate/CURRENT_UOW.md` for unchecked `- [ ]` tasks. If any remain, completion is aborted and the offending tasks are printed — pass `--force` to close it out anyway.
2. Archives the finished canvas to `.hydrate/archive/<UOW-id>.md`.
3. Checks the UOW off in `ROADMAP.md` (matching either a `## [ ] UOW-id` heading or a `- [ ] **UOW-id**: ...` list item), logging the total iteration count alongside it.
4. Resets `.hydrate/CURRENT_UOW.md` so the canvas is ready for the next task.
5. Prints a suggested `git commit` command summarizing the completed UOW.

```bash
hydrate complete

# Skip the unchecked-task check
hydrate complete --force
```

## Brownfield Projects: `hydrate inject`

Already have a codebase? `hydrate inject` retrofits the harness onto an existing repo instead of scaffolding from scratch — zero prompts, runs in well under 5 seconds.

It inspects `package.json`, `tsconfig.json`, `go.mod`/`Cargo.toml`/`requirements.txt`, directory layout, and recent `git log` history to auto-detect your stack and build/test/lint commands, then:

- Non-destructively syncs a generated section of `CLAUDE.md` (anything you write outside the `<!-- HYDRATE:BEGIN -->` / `<!-- HYDRATE:END -->` markers is left untouched on re-runs)
- Writes `.hydrate/session.json` with the detected stack/commands, preserving any existing UOW state and feature memory

```bash
npx @nemzilla/hydrate inject
```

Re-run it any time to refresh detected commands as your `package.json` evolves.

## Universal Adoption: `hydrate adopt`

Already juggling AI context files from other tools? `hydrate adopt` scans for the conventions other assistants use — `.cursorrules`, `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.claude/*.md`, `.codex/*` — and lets you consolidate them into a single `CONTEXT.md` without touching the originals.

```bash
hydrate adopt
```

You'll get an interactive multi-select prompt listing everything discovered:

```
💧 Legacy AI context files discovered:

  [1] .cursorrules (412b)
  [2] AGENTS.md (1203b)

Select files to merge — comma-separated numbers, ranges (e.g. 1,3-4), "all", or "none" [all]:
```

Every run is non-destructive and idempotent:

- Selected sources are **backed up** to `.hydrate/backups/<timestamp>/` before anything is merged.
- Originals are **never modified or deleted**.
- Each merged section is marker-guarded, so re-running `adopt` skips files already folded into `CONTEXT.md` instead of duplicating them.
- The hydrate workflow directives (Triad contract, `ROADMAP.md` / `.hydrate/CURRENT_UOW.md` pointers) are appended once.
- `ROADMAP.md` and `.hydrate/CURRENT_UOW.md` are guaranteed to exist afterward, same as `hydrate init`.
- `.gitignore` is idempotently patched with `.hydrate/backups/` and `.hydrate/session.json` (created if it doesn't exist yet) so adoption backups and the session cache never show up as working-tree noise.
- A non-blocking `git status --porcelain` check runs before any files are written, and the summary reassures you that your in-flight (uncommitted/untracked) work is left completely untouched.

```bash
# Skip the prompt and adopt everything discovered
hydrate adopt --all

# Merge into a different target file
hydrate adopt --target=docs/CONTEXT.md
```

## Claude Code Integration: `hydrate setup-cc`

Scaffolds `.claude/commands/hydrate.md` so Claude Code users can type `/hydrate` to run `hydrate prompt --copy` and load the active UOW straight into context.

```bash
hydrate setup-cc
```

## Command Reference

| Command | Description |
|---|---|
| `hydrate init` | Scaffold the Hydrate harness in the current repo. |
| `hydrate inject` | Zero-config retrofit for existing repos (see above). |
| `hydrate prompt [--architect] [--chunk-size=<bytes>] [--copy]` | Sync active UOW payload (with a repo fingerprint safety header) to `.hydrate/CURRENT_UOW.md`. |
| `hydrate iterate "<reason>"` | Spawn an iteration pass for bug fixes / polish. |
| `hydrate complete [--force]` | Mark the current UOW complete, archive its canvas, reset `.hydrate/CURRENT_UOW.md`, and print a suggested commit; aborts if unchecked tasks remain unless `--force` is passed. |
| `hydrate clip` / `hydrate copy` | Copy the active UOW context to the system clipboard (falls back to stdout if no clipboard tool is found). |
| `hydrate adopt [--all] [--target=<path>]` | Discover legacy AI context files, non-destructively merge them into `CONTEXT.md`, patch `.gitignore`, and report git status (see above). |
| `hydrate setup-cc` | Scaffold `.claude/commands/hydrate.md` so `/hydrate` runs `hydrate prompt --copy` in Claude Code. |
| `hydrate ?` / `hydrate lost` / `hydrate next` | Diagnose the current repo state and recommend the next command. |
| `hydrate greenfield` | Print the full playbook for starting a brand-new project. |
| `hydrate brownfield` | Print the full playbook for retrofitting an existing repo. |
| `-h`, `--help` | Display help for the CLI or a specific command. |
| `-v`, `--version` | Print the installed hydrate version. |

## License

MIT
