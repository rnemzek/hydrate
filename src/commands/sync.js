const fs = require('fs');
const path = require('path');
const { scaffold, CLAUDE_COMMANDS } = require('../init');
const { renderTemplate } = require('../templates');
const { applyManagedBlock } = require('../utils/managed-block');
const { getPackageVersion } = require('../utils/pkg');
const { findRepoRoots } = require('../utils/repo-scan');

// Force-refreshes one repo's `.claude/commands/hydrate-*.md` templates and
// CLAUDE.md managed block to the running package version, leaving
// `.hydrate/` history/journals/state completely untouched. Unlike
// `scaffoldClaudeCommands()` (skip-if-exists, used by `hydrate init`), sync
// always overwrites so the templates stay in parity with the installed
// hydrate version — that parity is the entire point of `hydrate sync`.
function syncRepo(repoDir, { version = getPackageVersion() } = {}) {
  if (!fs.existsSync(path.join(repoDir, '.hydrate'))) {
    return { repoDir, action: 'bootstrapped', created: scaffold(repoDir) };
  }

  const projectName = path.basename(repoDir);
  const updated = [];

  const commandsDir = path.join(repoDir, '.claude', 'commands');
  fs.mkdirSync(commandsDir, { recursive: true });
  for (const { name } of CLAUDE_COMMANDS) {
    const filePath = path.join(commandsDir, name);
    const rendered = renderTemplate(path.join('.claude', 'commands', name), { PROJECT_NAME: projectName });
    const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
    if (existing !== rendered) {
      fs.writeFileSync(filePath, rendered, 'utf8');
      updated.push(filePath);
    }
  }

  const claudePath = path.join(repoDir, 'CLAUDE.md');
  const existingClaude = fs.existsSync(claudePath) ? fs.readFileSync(claudePath, 'utf8') : null;
  const body = renderTemplate('CLAUDE.md', { PROJECT_NAME: projectName });
  const nextClaude = applyManagedBlock(existingClaude, body, version);
  if (existingClaude !== nextClaude) {
    fs.writeFileSync(claudePath, nextClaude, 'utf8');
    updated.push(claudePath);
  }

  return { repoDir, action: 'synced', updated };
}

// `--recursive` scans downward from `targetPath` (default: cwd) for nested
// `.git`/`package.json` roots — deliberately downward-only. Scanning
// *upward* toward the filesystem root (as a literal reading of "parent
// directories" might suggest) would be unbounded and unsafe for a flag a
// Product Owner can run from anywhere; scoping to "this directory and
// below" is the safe, predictable interpretation.
function runSync(cwd, { recursive = false, targetPath, version, log = console.log } = {}) {
  const root = targetPath ? path.resolve(cwd, targetPath) : cwd;
  const roots = recursive ? findRepoRoots(root) : [root];

  const results = roots.map((repoDir) => syncRepo(repoDir, { version }));

  for (const result of results) {
    if (result.action === 'bootstrapped') {
      log(`  ✔ Bootstrapped ${path.relative(cwd, result.repoDir) || '.'} (no .hydrate/ found — ran hydrate init)`);
    } else if (result.updated.length > 0) {
      log(`  ✔ Synced ${path.relative(cwd, result.repoDir) || '.'} (${result.updated.length} file${result.updated.length === 1 ? '' : 's'} updated)`);
    } else {
      log(`  • ${path.relative(cwd, result.repoDir) || '.'} already up to date`);
    }
  }

  return results;
}

module.exports = { runSync, syncRepo };
