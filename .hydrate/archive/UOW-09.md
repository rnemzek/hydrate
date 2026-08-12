# Unit of Work: UOW-09

**Title:** Universal Git Hygiene, Brownfield Status Heuristics & Repo Fingerprinting
**Status:** IN_PROGRESS
**Target Version:** `@nemzilla/hydrate@1.3.0`

## Scope & Architectural Requirements
1. **`.gitignore` Auto-Patching (`ensureGitignoreHygiene`)**: idempotently append `.hydrate/backups/` and `.hydrate/session.json` to `.gitignore` during `hydrate adopt`, creating the file if missing.
2. **Mid-Task Brownfield Status Check**: run a non-destructive `git status --porcelain` check during `hydrate adopt` and print a clean, reassuring summary that in-flight work is untouched.
3. **Repo Fingerprint Safety Header**: prepend the `/hydrate` context payload (`.hydrate/CURRENT_UOW.md`, written by `hydrate prompt`) with a header block containing Project Name, absolute Working Directory, and a safety note instructing the AI to verify cwd before editing.
4. **`hydrate complete` Help & Behavior Polish**: document (and implement) archiving the finished canvas to `.hydrate/archive/<UOW-id>.md`, fix ROADMAP.md marking to match this repo's actual list-item bullet style, and print a suggested `git commit` command on completion.
5. **Unit Tests**: cover `.gitignore` idempotency/creation/non-destructive append, the git-hygiene check (clean/dirty/non-repo), the repo fingerprint header, and the new `hydrate complete` archive/commit-suggestion/ROADMAP-marking behavior. Confirm 100% suite pass.

## Tasks
- [x] **Task 9.1:** Implement `ensureGitignoreHygiene()` in `src/adopt.js`; wire into `runAdopt()`.
- [x] **Task 9.2:** Implement non-blocking `git status --porcelain` check in `src/adopt.js`, captured before adopt writes any files; render a reassuring summary line.
- [x] **Task 9.3:** Add `renderRepoFingerprint()` to `bin/cli.js` and prepend it to the Lead Developer payload written by `hydrate prompt`.
- [x] **Task 9.4:** Fix `hydrate complete`'s ROADMAP.md marking regex to match this repo's `- [ ] **UOW-id**: ...` list style (previously only matched an unused `## [ ] UOW-id` heading style).
- [x] **Task 9.5:** Add canvas archiving (`.hydrate/archive/<UOW-id>.md`) and a suggested `git commit` message to `hydrate complete`; update its `--help` text (`whenToRun` / `whatItDoes`) to match.
- [x] **Task 9.6:** Write unit tests for all of the above in `test/adopt.test.js`, `test/clipboard.test.js`, and `test/guide.test.js`; verify with `npm test` (74/74 passing).
- [x] **Task 9.7:** Update `README.md` to document the `.gitignore` hygiene, git status check, repo fingerprint header, and `hydrate complete`'s archive/commit-suggestion behavior.

## Execution Instruction
Read this payload and stand by. Do not execute destructive file edits until instructed by the Product Owner.
