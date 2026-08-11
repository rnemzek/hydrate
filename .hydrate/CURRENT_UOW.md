# Unit of Work: UOW-04

**Title:** Native Clipboard Integration & Strict Completion Validation
**Status:** IN_PROGRESS
**Target Version:** `@nemzilla/hydrate@1.1.0`

## Scope & Architectural Requirements
1. **Native System Clipboard Support (`hydrate clip` / `hydrate prompt --copy`)**:
   - Platform-agnostic execution using Node's `child_process` (`pbcopy` on macOS, `xclip`/`xsel` on Linux, `clip` on Windows).
   - Add shortcut command `hydrate clip` (and alias `hydrate copy`).
   - Add `--copy` / `-c` flag support to `hydrate prompt`.
   - Provide clean ANSI console feedback (`✔ Copied UOW context to clipboard!`) with silent fallback to standard stdout printing if clipboard tools aren't present.
2. **Strict Completion Validation (`hydrate complete`)**:
   - Inspect `.hydrate/CURRENT_UOW.md` before allowing status transition to `COMPLETED`.
   - If unchecked tasks (`[ ]`) remain, abort state closure and display explicit task warnings (overrideable via `hydrate complete --force`).
3. **Documentation & Tests**:
   - Update `bin/cli.js`, `src/help.js`, and `README.md` to feature `hydrate clip`.
   - Add comprehensive unit tests in `test/clipboard.test.js` and extend `test/guide.test.js` using `node:test`.

## Tasks
- [x] Implement `src/clipboard.js` for pure Node `child_process` OS clipboard piping.
- [x] Wire `hydrate clip`, `hydrate copy`, and `hydrate prompt --copy` into `bin/cli.js` & command table.
- [x] Implement unchecked task validation in `src/guide.js` (`findOpenTasks`) / `bin/cli.js` (`handleComplete`) for `hydrate complete`.
- [x] Add `--force` / `-f` flag support to bypass task validation on completion.
- [x] Update `src/help.js` and `README.md` with new commands and flag options.
- [x] Write unit tests covering clipboard fallbacks and strict completion checks (`npm test`).

## Notes
- `hydrate complete`'s task validation lives in `src/guide.js::findOpenTasks(content)` (a pure, unit-tested function reusing the same `- [ ]` convention `diagnose()` already scans for) — `bin/cli.js::handleComplete()` calls it and aborts with exit code 1, printing each open task line, unless `--force`/`-f` is passed.
- `src/clipboard.js::copyToClipboard(text, { platform, spawn })` takes injectable `platform`/`spawn` params so `test/clipboard.test.js` can unit-test every OS branch and failure mode (missing tool, non-zero exit, unknown platform) without touching a real clipboard.
- `bin/cli.js::copyWithFeedback()` is shared by `hydrate clip`/`copy` and `hydrate prompt --copy`; on failure it prints the payload to stdout (`printFallback: false` for the architect path, since chunks are already on stdout from `outputChunkedArchitectPayload`).
- CLI-level clipboard tests fake the platform binary (`pbcopy`/`xclip`) via a temp-dir `PATH` override rather than touching the real system clipboard, so `npm test` never mutates the developer's actual clipboard.
- Version bumped to `1.1.0` in `package.json` per the UOW's target version; not yet published to npm.
- `npm test`: 36/36 passing (14 pre-existing + 22 new: 8 clipboard unit tests, 7 clipboard CLI tests, 3 `findOpenTasks()` unit tests, 4 `hydrate complete` CLI tests).
- Manual verification run against a `/tmp` scratch dir only (never this repo's own `.hydrate/`), per the UOW-02 incident note reused from UOW-03: `hydrate clip` copied real payload via `pbcopy`/confirmed via `pbpaste`, `hydrate --help` lists `clip`, `hydrate complete` aborted correctly with 4 open tasks listed, `hydrate complete --force` closed it out and logged the forced-past count.
