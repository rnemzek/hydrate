# UOW-HYDRATE-04: Implement Static Portfolio Overview Exporter (`hydrate export-portfolio`)

## 1. Goal & Context
Implement a CLI command (`hydrate export-portfolio` / `hydrate export-portfolio --out <path>`) that parses `.hydrate/` journal artifacts, project manifests (`package.json`), and roadmap files into a structured JSON payload (`tech-overview.json`). This JSON powers interactive modal drawers and portfolio showcases on `nemzilla.net`.

## 2. Surgical Scope & Requirements
- **CLI Command Implementation (`bin/cli.js`, `src/commands/export-portfolio.js`, `src/help.js`):**
  - Add `hydrate export-portfolio` command (and alias `hydrate export`) to the CLI parser.
  - Support an optional `--out <path>` / `-o <path>` flag (defaulting to `./tech-overview.json`).
  - Support an optional `--stdout` flag to stream JSON to standard output.
- **Data Extractor & Schema Builder:**
  - **`overview`:** Aggregate key metrics (total completed UOW count from `PROJECT_JOURNAL.md`, project title/description from `package.json`, latest completed milestone).
  - **`architecture`:** Parse architectural decisions, state schema shifts, and system diagrams from `ARCHITECT_JOURNAL.md`.
  - **`stack`:** Extract runtime parameters and dependency taxonomy from `package.json` (and `DEV_JOURNAL.md` annotations).
  - **`roadmap`:** Parse Section 1 (Scheduled/In-Progress/Done) and Section 2 (Concept Backlog) from `.hydrate/ROADMAP.md` into structured array objects (`{ id, title, status, description }`).
- **Unit & Integration Test Coverage:**
  - Create `test/export-portfolio.test.js` verifying valid JSON extraction, default vs. custom output path writing, stdout streaming, and missing file resilience.
  - Maintain line and branch test coverage quality gates ($>80\%$).

## 3. File Access Restrictions & Protocol
- **READ-ONLY:** `.hydrate/CURRENT_UOW.md`, `.hydrate/ROADMAP.md`
- **APPEND-ONLY (Upon Completion):** `.hydrate/PROJECT_JOURNAL.md`, `.hydrate/DEV_JOURNAL.md`, `.hydrate/ARCHITECT_JOURNAL.md`
- **MOVE/ARCHIVE (Upon Completion):** `.hydrate/CURRENT_UOW.md` -> `.hydrate/archive/UOW-HYDRATE-04.md`

## 4. Acceptance Criteria
1. Running `hydrate export-portfolio` emits a valid, schema-compliant `tech-overview.json`.
2. Running `npm test` passes 100% of unit tests with zero regressions (including new `test/export-portfolio.test.js` suite).
3. Auto-commit working tree upon clean test verification using `feat(cli): complete UOW-HYDRATE-04 implementation and verification`.
