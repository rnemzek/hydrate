const fs = require('fs');
const path = require('path');
const { loadTemplate, renderTemplate } = require('./templates');

// The 5 journal artifacts rendered into .hydrate/ on scaffold, each paired
// with the console label printed when it's actually created.
const HYDRATE_ARTIFACTS = [
  { name: 'CURRENT_UOW.md', label: 'Created .hydrate/CURRENT_UOW.md (Active Execution Canvas)' },
  { name: 'ROADMAP.md', label: 'Created .hydrate/ROADMAP.md (Tactical Roadmap & Task Index)' },
  { name: 'PROJECT_JOURNAL.md', label: 'Created .hydrate/PROJECT_JOURNAL.md (Decision & Execution Log)' },
  { name: 'DEV_JOURNAL.md', label: 'Created .hydrate/DEV_JOURNAL.md (Lead Developer Journal)' },
  { name: 'ARCHITECT_JOURNAL.md', label: 'Created .hydrate/ARCHITECT_JOURNAL.md (Lead Architect Journal)' }
];

// Zero-touch Claude Code slash commands scaffolded into .claude/commands/ —
// each wraps a `hydrate` CLI verb so a session can boot straight into the
// reconciler, ingest a clipboard UOW, or pull a token-dense context payload
// without the Product Owner typing raw hydrate commands.
const CLAUDE_COMMANDS = [
  { name: 'hydrate-checkup.md', label: 'Created .claude/commands/hydrate-checkup.md (/hydrate-checkup slash command)' },
  { name: 'hydrate-ingest.md', label: 'Created .claude/commands/hydrate-ingest.md (/hydrate-ingest slash command)' },
  { name: 'hydrate-context.md', label: 'Created .claude/commands/hydrate-context.md (/hydrate-context slash command)' },
  { name: 'hydrate-help.md', label: 'Created .claude/commands/hydrate-help.md (/hydrate-help slash command)' }
];

// Idempotently writes the canonical hydrate scaffold — CLAUDE.md plus the
// 5-artifact .hydrate/ journal layout (and .hydrate/archive/) — from
// templates/, skipping any file that already exists. Returns only the files
// it actually created, so callers can report exactly what changed instead of
// re-deriving it from disk.
function scaffold(cwd) {
  const projectName = path.basename(cwd);
  const created = [];

  const hydrateDir = path.join(cwd, '.hydrate');
  if (!fs.existsSync(hydrateDir)) {
    fs.mkdirSync(hydrateDir, { recursive: true });
  }

  const archiveDir = path.join(hydrateDir, 'archive');
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  // 1. Operating Rules & AI Execution Protocol
  const claudePath = path.join(cwd, 'CLAUDE.md');
  if (!fs.existsSync(claudePath)) {
    fs.writeFileSync(claudePath, renderTemplate('CLAUDE.md', { PROJECT_NAME: projectName }), 'utf8');
    created.push({ path: claudePath, label: 'Created CLAUDE.md (Operating Rules & AI Execution Protocol)' });
  }

  // 2-6. The 5-artifact .hydrate/ journal layout
  for (const { name, label } of HYDRATE_ARTIFACTS) {
    const filePath = path.join(hydrateDir, name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, renderTemplate(path.join('.hydrate', name), { PROJECT_NAME: projectName }), 'utf8');
      created.push({ path: filePath, label });
    }
  }

  // 7-9. Zero-touch /hydrate-* slash command definitions
  const claudeCommandsDir = path.join(cwd, '.claude', 'commands');
  if (!fs.existsSync(claudeCommandsDir)) {
    fs.mkdirSync(claudeCommandsDir, { recursive: true });
  }

  for (const { name, label } of CLAUDE_COMMANDS) {
    const filePath = path.join(claudeCommandsDir, name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, renderTemplate(path.join('.claude', 'commands', name), { PROJECT_NAME: projectName }), 'utf8');
      created.push({ path: filePath, label });
    }
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
2. Define your task index & roadmap in .hydrate/ROADMAP.md (Section 1).
3. Run 'hydrate prompt' to lock Claude Code onto the active UOW.
4. Use /hydrate-checkup, /hydrate-ingest, /hydrate-context, /hydrate-help in Claude Code for zero-touch interaction.
`);
}

module.exports = { runInit, scaffold };
