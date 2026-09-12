const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { stripManagedBlock } = require('../utils/managed-block');
const { findRepoRoots } = require('../utils/repo-scan');

// Builds the list of destructive actions for one repo without touching disk
// — used for both `--dry-run` previews and the real run, so the plan a
// Product Owner sees is exactly what gets executed.
function planEject(repoDir) {
  const actions = [];

  const hydrateDir = path.join(repoDir, '.hydrate');
  if (fs.existsSync(hydrateDir)) {
    actions.push({ type: 'remove-dir', target: hydrateDir });
  }

  const commandsDir = path.join(repoDir, '.claude', 'commands');
  if (fs.existsSync(commandsDir)) {
    for (const name of fs.readdirSync(commandsDir)) {
      if (name.startsWith('hydrate') && name.endsWith('.md')) {
        actions.push({ type: 'remove-file', target: path.join(commandsDir, name) });
      }
    }
  }

  const claudePath = path.join(repoDir, 'CLAUDE.md');
  if (fs.existsSync(claudePath)) {
    const { content: stripped, removed } = stripManagedBlock(fs.readFileSync(claudePath, 'utf8'));
    if (removed) {
      actions.push(
        stripped
          ? { type: 'rewrite-file', target: claudePath, content: stripped }
          : { type: 'remove-file', target: claudePath }
      );
    }
  }

  return actions;
}

function applyEjectActions(actions) {
  for (const action of actions) {
    if (action.type === 'remove-dir') fs.rmSync(action.target, { recursive: true, force: true });
    else if (action.type === 'remove-file') fs.rmSync(action.target, { force: true });
    else if (action.type === 'rewrite-file') fs.writeFileSync(action.target, action.content, 'utf8');
  }
}

function describeAction(repoDir, action) {
  const label = { 'remove-dir': 'remove', 'remove-file': 'remove', 'rewrite-file': 'strip managed block from' }[action.type];
  return `${label} ${path.relative(repoDir, action.target)}`;
}

function askYesNo(question, { input, output }) {
  const rl = readline.createInterface({ input, output });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(String(answer || '').trim()));
    });
  });
}

// `--recursive` mirrors `hydrate sync --recursive`: downward-only scan from
// `targetPath` (default: cwd), never upward toward the filesystem root.
async function runEject(cwd, {
  recursive = false,
  targetPath,
  dryRun = false,
  force = false,
  input = process.stdin,
  output = process.stdout,
  log = console.log
} = {}) {
  const root = targetPath ? path.resolve(cwd, targetPath) : cwd;
  const roots = recursive ? findRepoRoots(root) : [root];

  const plan = roots
    .map((repoDir) => ({ repoDir, actions: planEject(repoDir) }))
    .filter(({ actions }) => actions.length > 0);

  if (plan.length === 0) {
    log('Nothing to eject — no Hydrate artifacts found.');
    return { code: 0, action: 'noop', plan: [] };
  }

  for (const { repoDir, actions } of plan) {
    log(`\n${repoDir}`);
    actions.forEach((a) => log(`  - ${describeAction(repoDir, a)}`));
  }

  if (dryRun) {
    log('\n(dry run — nothing was removed)');
    return { code: 0, action: 'dry-run', plan };
  }

  if (!force) {
    const confirmed = await askYesNo('\nEject the artifacts listed above? [y/N] ', { input, output });
    if (!confirmed) {
      log('Aborted — no changes made.');
      return { code: 0, action: 'aborted', plan };
    }
  }

  for (const { actions } of plan) applyEjectActions(actions);
  log(`\n✔ Ejected Hydrate artifacts from ${plan.length} repo${plan.length === 1 ? '' : 's'}.`);
  return { code: 0, action: 'ejected', plan };
}

module.exports = { runEject, planEject, applyEjectActions };
