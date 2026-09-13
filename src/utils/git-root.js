const { spawnSync } = require('child_process');

// Resolves the canonical top-level directory of the git working tree
// containing `cwd`, via `git rev-parse --show-toplevel`. Returns null (not
// an error) when `cwd` isn't inside a git repository, or when `git` itself
// isn't available — callers are expected to fall back to `cwd` in that case.
// `spawn` is injectable so callers/tests never need a real git repository.
function getGitRepoRoot(cwd, { spawn = spawnSync } = {}) {
  const result = spawn('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' });
  if (!result || result.error || result.status !== 0) return null;

  const root = String(result.stdout || '').trim();
  return root || null;
}

// Resolves where `hydrate init`/`hydrate sync` (single-target mode, no
// explicit --path) should actually operate: the git repository's top-level
// root when `startDir` is inside one, else `startDir` itself unchanged.
// `redirected` is true exactly when the resolved root differs from
// `startDir`, so callers can print an informational notice rather than
// silently writing somewhere the operator didn't ask for.
function resolveHarnessRoot(startDir, options = {}) {
  const gitRoot = getGitRepoRoot(startDir, options);
  if (!gitRoot) return { root: startDir, redirected: false, inGitRepo: false };
  return { root: gitRoot, redirected: gitRoot !== startDir, inGitRepo: true };
}

module.exports = { getGitRepoRoot, resolveHarnessRoot };
