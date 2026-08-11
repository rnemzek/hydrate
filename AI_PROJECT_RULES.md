# AI PROJECT EXECUTION RULES — hydrate

## 1. Operating Triad Contract
- **Product Owner (Human):** Final authority on scope, acceptance, and repo commits.
- **Lead Architect (Gemini):** System design, stack boundaries, multi-file architectural consistency.
- **Lead Developer (Claude Code):** Surgical file edits, unit testing, local execution.

## 2. Technical Stack Constraints
- **Primary Language:** Vanilla JavaScript / ES Modules (or specify project target)
- **Runtime Environment:** Node.js / Web Browsers
- **Testing Standard:** Unit tests must pass via `npm test` before committing.

## 3. Surgical Execution Boundaries
- Focus ONLY on the scope defined in `.hydrate/CURRENT_UOW.md`.
- Do NOT rewrite unrelated modules or introduce unrequested frameworks/dependencies.
- Always log completed tasks, modified files, and test results to `docs/journals/dev-journal.md`.
