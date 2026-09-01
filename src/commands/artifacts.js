const fs = require('fs');
const path = require('path');

const HYDRATE_FILE_DESCRIPTIONS = {
  'CURRENT_UOW.md': 'Active Execution Canvas — the in-progress Unit of Work.',
  'ROADMAP.md': 'Tactical Roadmap & Task Index.',
  'PROJECT_JOURNAL.md': 'Decision & Execution Log (Product Owner-facing).',
  'DEV_JOURNAL.md': 'Lead Developer implementation journal.',
  'ARCHITECT_JOURNAL.md': 'Lead Architect design/decision journal.',
  'session.json': 'Local session cache — safe to gitignore.'
};

const CLAUDE_COMMAND_DESCRIPTIONS = {
  'hydrate.md': 'Unified master /hydrate command (checkup, auto-archive, clipboard sync).',
  'hydrate-checkup.md': 'Runs `hydrate checkup` — session state reconciler.',
  'hydrate-ingest.md': 'Runs `hydrate ingest --yes` — apply a clipboard UOW payload.',
  'hydrate-context.md': 'Runs `hydrate context` — token-dense context payload.',
  'hydrate-help.md': 'Shows the Triad Workflow Guide and command reference.',
  'hydrate-lfg.md': 'Zero-touch checkup + ingest launch alias.',
  'hydrate-uow.md': 'Inspect UOWs — list / last / by ID.',
  'hydrate-artifacts.md': 'Prints this artifact map and .gitignore guidance.'
};

const RECOMMENDED_GITIGNORE = ['.hydrate/backups/', '.hydrate/session.json', 'tech-overview.json'];

function listDir(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath).sort();
}

function treeLines(names, descriptions, indent) {
  return names.map((name, i) => {
    const prefix = i === names.length - 1 ? '└─' : '├─';
    const desc = descriptions[name];
    return `${indent}${prefix} ${name}${desc ? ` — ${desc}` : ''}`;
  });
}

// Like treeLines(), but every entry uses the "mid-branch" prefix — for a
// list that is always followed by another sibling line (.hydrate/'s file
// list is always followed by the archive/ summary line).
function midTreeLines(names, descriptions, indent) {
  return names.map((name) => {
    const desc = descriptions[name];
    return `${indent}├─ ${name}${desc ? ` — ${desc}` : ''}`;
  });
}

// Compiles a plain-English tree of .hydrate/ and .claude/commands/ plus a
// copy-pasteable .gitignore block. Pure function of disk state — `hydrate
// artifacts`'s CLI handler owns printing.
function buildArtifactsReport(cwd) {
  const hydrateDir = path.join(cwd, '.hydrate');
  const archiveDir = path.join(hydrateDir, 'archive');
  const claudeCommandsDir = path.join(cwd, '.claude', 'commands');

  const lines = ['', '💧 Hydrate Artifact Map', ''];

  lines.push('.hydrate/');
  if (!fs.existsSync(hydrateDir)) {
    lines.push('  (not found — run `hydrate init`)');
  } else {
    const topLevel = listDir(hydrateDir).filter((name) => name !== 'archive');
    lines.push(...midTreeLines(topLevel, HYDRATE_FILE_DESCRIPTIONS, '  '));

    const archived = listDir(archiveDir);
    lines.push(`  └─ archive/ (${archived.length} completed UOW${archived.length === 1 ? '' : 's'})`);
    if (archived.length > 0) {
      lines.push(...treeLines(archived, {}, '       ').map((line) => `  ${line}`));
    }
  }

  lines.push('');
  lines.push('.claude/commands/');
  if (!fs.existsSync(claudeCommandsDir)) {
    lines.push('  (not found — run `hydrate init`, or reinstall this package to auto-provision)');
  } else {
    const commands = listDir(claudeCommandsDir);
    lines.push(...treeLines(commands, CLAUDE_COMMAND_DESCRIPTIONS, '  '));
  }

  lines.push('');
  lines.push('📋 Recommended .gitignore (copy-paste):');
  RECOMMENDED_GITIGNORE.forEach((entry) => lines.push(`  ${entry}`));
  lines.push('');
  lines.push('  Everything else under .hydrate/ and .claude/commands/ should stay');
  lines.push('  committed — it is the shared, versioned context the triad relies on.');
  lines.push('');

  return lines.join('\n');
}

module.exports = { buildArtifactsReport, RECOMMENDED_GITIGNORE };
