# UOW-HYDRATE-01-HOTFIX: Fix UOW ID Regex Parser for Hyphenated & Alphanumeric Identifiers

## 1. Goal & Context
`hydrate complete` uses a strict/limited UOW ID regex parser that truncates hyphenated or alphanumeric prefixes (e.g., parsing `UOW-HYDRATE-01` as `UOW-HYDRATE`). Update the regex parser to support full hyphenated, alphanumeric, and string-based UOW IDs without truncation.

## 2. Surgical Scope & Requirements
- **Regex Parser (`bin/cli.js` / `src/` core utils):**
  - Locate the UOW ID extraction regex used by `hydrate complete` and `hydrate prompt`.
  - Update the matching pattern from restrictive numeric/single-dash assumptions (e.g., `/UOW-\d+/` or `/UOW-[A-Z]+/`) to support full hyphenated alphanumeric strings (e.g., `/UOW-[A-Z0-9-]+/i` or equivalent).
  - Ensure full string retention for patterns like `UOW-HYDRATE-01`, `UOW-HOTFIX-03`, `UOW-CARBOYZ-12`.
- **Test Coverage:**
  - Add unit test cases in `test/complete.test.js` verifying that `hydrate complete` correctly parses and preserves multi-hyphenated UOW IDs without truncating the trailing digits or sub-slugs.
  - Assert 100% test pass rate across all 48+ unit tests ($>80\%$ coverage gate).

## 3. File Access Restrictions & Protocol
- **READ-ONLY:** `.hydrate/CURRENT_UOW.md`, `.hydrate/ROADMAP.md`
- **APPEND-ONLY (Upon Completion):** `.hydrate/PROJECT_JOURNAL.md`, `.hydrate/DEV_JOURNAL.md`, `.hydrate/ARCHITECT_JOURNAL.md`
- **MOVE/ARCHIVE (Upon Completion):** `.hydrate/CURRENT_UOW.md` -> `.hydrate/archive/UOW-HYDRATE-01-HOTFIX.md`

## 4. Acceptance Criteria
1. `hydrate complete` accurately parses `UOW-HYDRATE-01` without truncating to `UOW-HYDRATE`.
2. Running `npm test` passes 100% of unit tests with zero regressions.
3. Auto-commit working tree upon clean test verification using `fix(cli): complete UOW-HYDRATE-01-HOTFIX implementation and verification`.
