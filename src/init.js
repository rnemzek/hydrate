const fs = require('fs');
const path = require('path');
const { loadTemplate, renderTemplate } = require('./templates');

// Idempotently writes the canonical 3-artifact hydrate scaffold — CLAUDE.md,
// .hydrate/CURRENT_UOW.md, and docs/SYSTEM.md — from templates/, skipping
// any file that already exists. Returns only the files it actually created,
// so callers can report exactly what changed instead of re-deriving it from
// disk.
function scaffold(cwd) {
  const projectName = path.basename(cwd);
  const created = [];

  const hydrateDir = path.join(cwd, '.hydrate');
  if (!fs.existsSync(hydrateDir)) {
    fs.mkdirSync(hydrateDir, { recursive: true });
  }

  const docsDir = path.join(cwd, 'docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  // 1. Operating Rules & AI Execution Protocol
  const claudePath = path.join(cwd, 'CLAUDE.md');
  if (!fs.existsSync(claudePath)) {
    fs.writeFileSync(claudePath, renderTemplate('CLAUDE.md', { PROJECT_NAME: projectName }), 'utf8');
    created.push({ path: claudePath, label: 'Created CLAUDE.md (Operating Rules & AI Execution Protocol)' });
  }

  // 2. Active Execution Canvas
  const currentUowPath = path.join(hydrateDir, 'CURRENT_UOW.md');
  if (!fs.existsSync(currentUowPath)) {
    fs.writeFileSync(currentUowPath, loadTemplate('CURRENT_UOW.md'), 'utf8');
    created.push({ path: currentUowPath, label: 'Created .hydrate/CURRENT_UOW.md (Active Execution Canvas)' });
  }

  // 3. Living System Documentation (Architecture, Roadmap, Backlog, Decision Log)
  const systemPath = path.join(docsDir, 'SYSTEM.md');
  if (!fs.existsSync(systemPath)) {
    fs.writeFileSync(systemPath, renderTemplate('SYSTEM.md', { PROJECT_NAME: projectName }), 'utf8');
    created.push({ path: systemPath, label: 'Created docs/SYSTEM.md (Architecture, Roadmap & Decision Log)' });
  }

  return created;
}

function runInit() {
  const cwd = process.cwd();
  const created = scaffold(cwd);

  created.forEach(({ label }) => console.log(`  ✔ ${label}`));

  console.log(`
💧 @nemzilla/hydrate Harness Initialized!
=====================================================
1. Review CLAUDE.md and set your exact stack/quality gates.
2. Define your task index & roadmap in docs/SYSTEM.md (Section 2).
3. Run 'hydrate prompt' to lock Claude Code onto the active UOW.
`);
}

module.exports = { runInit, scaffold };
