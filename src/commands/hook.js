const fs = require('fs');
const path = require('path');
const os = require('os');

// Git has no "post-init" hook event (hooks only fire once a repo has
// commits/checkouts), so a global git-template hooks dir can't reliably
// auto-run on a bare `git init`. A shell function wrapping `git` (installed
// into the user's shell rc) is the deterministic mechanism: it runs after
// every `git init` regardless of whether the new repo ever gets a commit.
const BEGIN_MARKER = '# >>> hydrate git hook >>>';
const END_MARKER = '# <<< hydrate git hook <<<';
const BLOCK_RE = /# >>> hydrate git hook >>>[\s\S]*?# <<< hydrate git hook <<</;

const HOOK_SNIPPET = `${BEGIN_MARKER}
# Installed by \`hydrate hook enable\`. Wraps \`git\` so a plain \`git init\`
# auto-bootstraps the Hydrate harness in the new repo. Remove with
# \`hydrate hook disable\`.
git() {
  command git "$@"
  if [ "$1" = "init" ] && command -v hydrate >/dev/null 2>&1; then
    hydrate init --quiet >/dev/null 2>&1 || true
  fi
}
${END_MARKER}
`;

function defaultRcPath(homeDir = os.homedir()) {
  const shell = process.env.SHELL || '';
  const name = shell.includes('bash') ? '.bashrc' : '.zshrc';
  return path.join(homeDir, name);
}

function readRc(rcPath) {
  return fs.existsSync(rcPath) ? fs.readFileSync(rcPath, 'utf8') : '';
}

function hookStatus(rcPath) {
  return { installed: BLOCK_RE.test(readRc(rcPath)), rcPath };
}

function enableHook(rcPath) {
  const content = readRc(rcPath);
  if (BLOCK_RE.test(content)) return { changed: false, rcPath };

  fs.mkdirSync(path.dirname(rcPath), { recursive: true });
  const next = content && content.trim() ? `${content.trimEnd()}\n\n${HOOK_SNIPPET}` : HOOK_SNIPPET;
  fs.writeFileSync(rcPath, next, 'utf8');
  return { changed: true, rcPath };
}

function disableHook(rcPath) {
  const content = readRc(rcPath);
  if (!BLOCK_RE.test(content)) return { changed: false, rcPath };

  const next = content.replace(BLOCK_RE, '').replace(/\n{3,}/g, '\n\n').trimEnd();
  fs.writeFileSync(rcPath, next ? `${next}\n` : '', 'utf8');
  return { changed: true, rcPath };
}

function runHook(action, { rcPath = defaultRcPath(), log = console.log, error = console.error } = {}) {
  if (action === 'enable') {
    const result = enableHook(rcPath);
    log(
      result.changed
        ? `✔ Installed git-init hook in ${rcPath}. Restart your shell (or 'source ${rcPath}') to activate it.`
        : `Hook already installed in ${rcPath}.`
    );
    return { code: 0, action, ...result };
  }

  if (action === 'disable') {
    const result = disableHook(rcPath);
    log(result.changed ? `✔ Removed git-init hook from ${rcPath}.` : `No hook installed in ${rcPath}.`);
    return { code: 0, action, ...result };
  }

  if (action === 'status') {
    const result = hookStatus(rcPath);
    log(result.installed ? `✔ git-init hook is installed in ${rcPath}.` : `git-init hook is NOT installed in ${rcPath}.`);
    return { code: 0, action, ...result };
  }

  error(`❌ Error: Unknown hook action "${action}". Use enable, disable, or status.`);
  return { code: 1, action };
}

module.exports = { runHook, enableHook, disableHook, hookStatus, defaultRcPath, HOOK_SNIPPET, BLOCK_RE };
