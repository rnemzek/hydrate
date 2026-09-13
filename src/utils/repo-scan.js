const fs = require('fs');
const path = require('path');

// Directory names never worth descending into during a recursive workspace
// scan — vendored/derived trees that can't themselves be a distinct repo
// root worth syncing.
const SKIP_DIR_NAMES = new Set(['node_modules', '.git']);

function hasOwnGit(dir) {
  return fs.existsSync(path.join(dir, '.git'));
}

function isRepoRoot(dir) {
  return hasOwnGit(dir) || fs.existsSync(path.join(dir, 'package.json'));
}

// Recursively finds repo roots at or beneath `startDir` (downward-only —
// scanning upward toward the filesystem root would be unbounded and unsafe
// for a --recursive flag, so `hydrate sync --recursive`/`hydrate eject
// --recursive` always scope to `startDir` and below). Dotfiles/dotdirs other
// than the repo itself are skipped so scans don't wander into tool caches.
//
// UOW-HYDRATE-ROOT-GUARD-AND-TEMPLATE-FIX: only `startDir` itself may
// qualify via `package.json` alone. Anything found *beneath* it must have
// its own `.git` to count as a distinct root — a `package.json` nested
// inside a larger git working tree (a monorepo workspace package, a
// `vendor/`/`packages/` subdirectory) is part of that outer repo, not an
// independent one, and must never get its own `.hydrate/`/`.claude/`.
function findRepoRoots(startDir, { maxDepth = 6 } = {}) {
  const found = [];

  function walk(dir, depth) {
    const isRoot = depth === 0 ? isRepoRoot(dir) : hasOwnGit(dir);
    if (isRoot) found.push(dir);
    if (depth >= maxDepth) return;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKIP_DIR_NAMES.has(entry.name) || entry.name.startsWith('.')) continue;
      walk(path.join(dir, entry.name), depth + 1);
    }
  }

  walk(startDir, 0);
  return found;
}

module.exports = { isRepoRoot, hasOwnGit, findRepoRoots };
