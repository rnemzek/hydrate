const { spawnSync } = require('child_process');
const { runSync } = require('./sync');

const DEFAULT_PACKAGE_NAME = '@nemzilla/hydrate';

// Upgrades the hydrate install (global by default, matching how most users
// run the CLI) and immediately re-runs `hydrate sync` on the current repo so
// its templates reflect whatever version was just installed. `spawn` is
// injectable so tests never actually shell out to npm.
function runUpdate(cwd, {
  global = true,
  packageName = DEFAULT_PACKAGE_NAME,
  spawn = spawnSync,
  sync = runSync,
  log = console.log,
  error = console.error
} = {}) {
  const args = global ? ['install', '-g', packageName] : ['install', packageName];
  const result = spawn('npm', args, { encoding: 'utf8', stdio: 'inherit' });

  if (!result || result.error || result.status !== 0) {
    error(`❌ Error: 'npm ${args.join(' ')}' failed${result && result.error ? `: ${result.error.message}` : ''}.`);
    return { code: 1, action: 'install-failed' };
  }

  log(`✔ Upgraded ${packageName}${global ? ' globally' : ''}.`);

  const syncResults = sync(cwd, { log });
  log('✔ Re-synced workspace templates to the upgraded version.');

  return { code: 0, action: 'updated', syncResults };
}

module.exports = { runUpdate };
