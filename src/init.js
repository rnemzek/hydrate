const fs = require('fs');
const path = require('path');

function runInit() {
  const cwd = process.cwd();
  const projectName = path.basename(cwd);

  const hydrateDir = path.join(cwd, '.hydrate');
  if (!fs.existsSync(hydrateDir)) {
    fs.mkdirSync(hydrateDir, { recursive: true });
  }

  const journalsDir = path.join(cwd, 'docs', 'journals');
  if (!fs.existsSync(journalsDir)) {
    fs.mkdirSync(journalsDir, { recursive: true });
  }

  // 1. System Execution Rules & AI Contract
  const rulesPath = path.join(cwd, 'AI_PROJECT_RULES.md');
  if (!fs.existsSync(rulesPath)) {
    const rulesContent = `# AI PROJECT EXECUTION RULES — ${projectName}

## 1. Operating Triad Contract
- **Product Owner (Human):** Final authority on scope, acceptance, and repo commits.
- **Lead Architect (Gemini):** System design, stack boundaries, multi-file architectural consistency.
- **Lead Developer (Claude Code):** Surgical file edits, unit testing, local execution.

## 2. Technical Stack Constraints
- **Primary Language:** Vanilla JavaScript / ES Modules (or specify project target)
- **Runtime Environment:** Node.js / Web Browsers
- **Testing Standard:** Unit tests must pass via \`npm test\` before committing.

## 3. Surgical Execution Boundaries
- Focus ONLY on the scope defined in \`.hydrate/CURRENT_UOW.md\`.
- Do NOT rewrite unrelated modules or introduce unrequested frameworks/dependencies.
- Always log completed tasks, modified files, and test results to \`docs/journals/dev-journal.md\`.
`;
    fs.writeFileSync(rulesPath, rulesContent, 'utf8');
    console.log('  ✔ Created AI_PROJECT_RULES.md (Triad Contract & Stack Rules)');
  }

  // 2. High-Level Roadmap
  const roadmapPath = path.join(cwd, 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) {
    const roadmapContent = `# ${projectName} — Product Roadmap

> High-level milestone tracking. Granular active tasks live in .hydrate/CURRENT_UOW.md.

## Core Milestones

- [ ] **UOW-01:** Scaffold Repository & Core Architecture
- [ ] **UOW-02:** Primary Data Ingestion & Storage Models
- [ ] **UOW-03:** User Interface & Command Canvas
`;
    fs.writeFileSync(roadmapPath, roadmapContent, 'utf8');
    console.log('  ✔ Created ROADMAP.md (High-Level Milestones)');
  }

  // 3. Active Execution Canvas
  const currentUowPath = path.join(hydrateDir, 'CURRENT_UOW.md');
  if (!fs.existsSync(currentUowPath)) {
    const currentUowContent = `# HYDRATE ACTIVE EXECUTION CANVAS

## Target Task Scope: UOW-01 — Scaffold Repository & Core Architecture

- [ ] **Task 1.1:** Setup package.json and project folder layout
- [ ] **Task 1.2:** Implement primary entry point and core exports
- [ ] **Task 1.3:** Configure unit test runner and write initial test suite
- [ ] **Task 1.4:** Verify full build pass via \`npm test\`
`;
    fs.writeFileSync(currentUowPath, currentUowContent, 'utf8');
    console.log('  ✔ Created .hydrate/CURRENT_UOW.md (Isolated Active Sprint Scope)');
  }

  // 4. Dev Journal Log
  const devJournalPath = path.join(journalsDir, 'dev-journal.md');
  if (!fs.existsSync(devJournalPath)) {
    const devJournalContent = `# Developer Journal & Telemetry Log

## [Day Zero] — Harness Initialized
- **Date:** ${new Date().toLocaleDateString()}
- **Status:** Scaffolding complete via @nemzilla/hydrate. Ready for UOW-01 execution.
`;
    fs.writeFileSync(devJournalPath, devJournalContent, 'utf8');
    console.log('  ✔ Created docs/journals/dev-journal.md (Execution Telemetry Log)');
  }

  console.log(`
💧 @nemzilla/hydrate Harness Initialized!
=====================================================
1. Review/edit AI_PROJECT_RULES.md to set your exact stack.
2. Define your milestone sequence in ROADMAP.md.
3. Run 'hydrate prompt' to lock Claude Code onto UOW-01.
`);
}

module.exports = { runInit };

