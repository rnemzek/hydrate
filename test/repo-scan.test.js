const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isRepoRoot, findRepoRoots } = require('../src/utils/repo-scan');

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

test('findRepoRoots() finds the root itself plus nested repos, skipping node_modules', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.git'));
    fs.mkdirSync(path.join(dir, 'packages', 'a', '.git'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'node_modules', 'some-pkg'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'node_modules', 'some-pkg', 'package.json'), '{}');
    fs.mkdirSync(path.join(dir, 'packages', 'b'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'packages', 'b', 'package.json'), '{}');

    const roots = findRepoRoots(dir);

    assert.ok(roots.includes(dir));
    assert.ok(roots.includes(path.join(dir, 'packages', 'a')));
    assert.ok(roots.includes(path.join(dir, 'packages', 'b')));
    assert.ok(!roots.some((r) => r.includes('node_modules')));
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
    fs.mkdirSync(deepPath, { recursive: true });
    fs.writeFileSync(path.join(deepPath, 'package.json'), '{}');

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
