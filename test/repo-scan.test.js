const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isRepoRoot, hasOwnGit, findRepoRoots } = require('../src/utils/repo-scan');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hydrate-repo-scan-test-'));
}

function withTempDir(fn) {
  const dir = makeTempDir();
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('isRepoRoot() detects a .git directory', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.git'));
    assert.equal(isRepoRoot(dir), true);
  });
});

test('isRepoRoot() detects a package.json', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'package.json'), '{}');
    assert.equal(isRepoRoot(dir), true);
  });
});

test('isRepoRoot() is false for a plain directory', () => {
  withTempDir((dir) => {
    assert.equal(isRepoRoot(dir), false);
  });
});

test('findRepoRoots() finds the root itself plus nested repos with their own .git, skipping node_modules', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.git'));
    fs.mkdirSync(path.join(dir, 'packages', 'a', '.git'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'node_modules', 'some-pkg'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'node_modules', 'some-pkg', 'package.json'), '{}');

    const roots = findRepoRoots(dir);

    assert.ok(roots.includes(dir));
    assert.ok(roots.includes(path.join(dir, 'packages', 'a')));
    assert.ok(!roots.some((r) => r.includes('node_modules')));
  });
});

// UOW-HYDRATE-ROOT-GUARD-AND-TEMPLATE-FIX -----------------------------------

test('hasOwnGit() checks for a .git directory directly beneath the given path', () => {
  withTempDir((dir) => {
    assert.equal(hasOwnGit(dir), false);
    fs.mkdirSync(path.join(dir, '.git'));
    assert.equal(hasOwnGit(dir), true);
  });
});

test('findRepoRoots() does NOT treat a nested package.json-only directory as its own root (monorepo/vendor guard)', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.git'));
    fs.mkdirSync(path.join(dir, 'packages', 'workspace-pkg'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'packages', 'workspace-pkg', 'package.json'), '{}');

    const roots = findRepoRoots(dir);

    assert.deepEqual(roots, [dir]);
  });
});

test('findRepoRoots() still treats the scan\'s own starting directory as a root via package.json alone', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'package.json'), '{}');
    assert.deepEqual(findRepoRoots(dir), [dir]);
  });
});

test('findRepoRoots() treats a nested directory with its own .git as a distinct root even without package.json', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.git'));
    fs.mkdirSync(path.join(dir, 'vendor', 'submodule-repo', '.git'), { recursive: true });

    const roots = findRepoRoots(dir);

    assert.ok(roots.includes(path.join(dir, 'vendor', 'submodule-repo')));
  });
});

test('findRepoRoots() skips dotdirs other than the repo root itself', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.hidden', 'nested'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.hidden', 'nested', 'package.json'), '{}');

    const roots = findRepoRoots(dir);

    assert.equal(roots.length, 0);
  });
});

test('findRepoRoots() returns nothing for a directory with no repos', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, 'plain'));
    assert.deepEqual(findRepoRoots(dir), []);
  });
});

test('findRepoRoots() respects maxDepth', () => {
  withTempDir((dir) => {
    const deepPath = path.join(dir, 'a', 'b', 'c', 'd', 'e', 'f', 'g');
    fs.mkdirSync(path.join(deepPath, '.git'), { recursive: true });

    const roots = findRepoRoots(dir, { maxDepth: 2 });
    assert.equal(roots.length, 0);
  });
});

test('findRepoRoots() tolerates an unreadable directory without throwing', () => {
  withTempDir((dir) => {
    // Deleting the directory mid-scan simulates an unreadable entry —
    // readdirSync throwing should be swallowed, not propagate.
    const ghost = path.join(dir, 'ghost');
    fs.mkdirSync(ghost);
    fs.rmSync(ghost, { recursive: true, force: true });
    assert.doesNotThrow(() => findRepoRoots(ghost));
  });
});
