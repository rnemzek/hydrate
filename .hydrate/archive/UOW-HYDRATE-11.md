# UOW-HYDRATE-11: System Architecture Maintenance & Decision Logging Protocol

## 1. Description & Goal
Establish system architecture boundaries between `docs/ARCHITECTURE.md` (high-level state maintained by CC) and `docs/ARCHITECTURE_JOURNAL.md` (narrative decision logs, sequence diagrams, and trade-offs). Add slash commands for `/hydrate-arch-sync` and `/hydrate-digest`, and update `templates/` so `hydrate init` / auto-provisioning scaffolds `docs/ARCHITECTURE.md` and `docs/ARCHITECTURE_JOURNAL.md`.

## 2. Key Acceptance Criteria
- [ ] **Scaffold Template Additions**:
  - Add `templates/docs/ARCHITECTURE.md.template` and `templates/docs/ARCHITECTURE_JOURNAL.md.template`.
  - Update `src/init.js` to scaffold `docs/ARCHITECTURE.md` and `docs/ARCHITECTURE_JOURNAL.md` on project initialization.
- [ ] **Slash Command Provisioning**:
  - Add `templates/.claude/commands/hydrate-arch-sync.md.template`: Instructs CC to scan workspace dependencies and refresh `docs/ARCHITECTURE.md`.
  - Add `templates/.claude/commands/hydrate-digest.md.template`: Spits out `"Hey dumb-dumb, just type 'Generate Architect Journal Digest' into the Architect's prompt!"`
  - Register new command templates in `src/init.js`.
- [ ] **Update `CLAUDE.md` Instructions**:
  - Add Section 7 explicitly defining `docs/ARCHITECTURE.md` scope (2 sections only: Overall System Architecture + Technology Stack & Dependencies).
  - Add rule instructing CC how to handle `/hydrate-arch-sync` and `/hydrate-digest`.
- [ ] **Seed Repository `docs/`**:
  - Create `docs/ARCHITECTURE.md` adhering to the two-section layout.
  - Create `docs/ARCHITECTURE_JOURNAL.md` with historical decision log, sequence diagrams, and gotchas covering UOW-HYDRATE-01 through 10.
- [ ] **Automated Test Suite**:
  - Verify `docs/` files and new slash templates are correctly scaffolded during `hydrate init` / `runInit` assertions.

## 3. Affected Files
- `CLAUDE.md`
- `src/init.js`
- `templates/CLAUDE.md.template`
- `templates/docs/ARCHITECTURE.md.template` (NEW)
- `templates/docs/ARCHITECTURE_JOURNAL.md.template` (NEW)
- `templates/.claude/commands/hydrate-arch-sync.md.template` (NEW)
- `templates/.claude/commands/hydrate-digest.md.template` (NEW)
- `docs/ARCHITECTURE.md`
- `docs/ARCHITECTURE_JOURNAL.md` (NEW)
- `test/init.test.js`

## 4. Verification Steps
1. Run `npm test` to ensure all tests pass.
2. Run `/hydrate-digest` in Claude Code to confirm the reminder output.
3. Run `/hydrate-arch-sync` in Claude Code and verify `docs/ARCHITECTURE.md` adheres strictly to the two-section layout.
