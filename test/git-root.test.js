const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { getGitRepoRoot, resolveHarnessRoot } = require('../src/utils/git-root');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hydrate-git-root-test-'));
}

function withTempDir(fn) {
  const dir = makeTempDir();
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Injected-fake unit tests --------------------------------------------------

test('getGitRepoRoot() returns the trimmed stdout on a successful spawn', () => {
  const spawn = () => ({ status: 0, stdout: '/repo/root\n' });
  assert.equal(getGitRepoRoot('/repo/root/sub', { spawn }), '/repo/root');
});

test('getGitRepoRoot() returns null on a non-zero exit (not a git repository)', () => {
  const spawn = () => ({ status: 128, stdout: '' });
  assert.equal(getGitRepoRoot('/tmp/whatever', { spawn }), null);
});

test('getGitRepoRoot() returns null on a spawn error (git not installed)', () => {
  const spawn = () => ({ error: new Error('ENOENT') });
  assert.equal(getGitRepoRoot('/tmp/whatever', { spawn }), null);
});

test('getGitRepoRoot() returns null on empty stdout', () => {
  const spawn = () => ({ status: 0, stdout: '   \n' });
  assert.equal(getGitRepoRoot('/tmp/whatever', { spawn }), null);
});

test('resolveHarnessRoot() falls back to startDir, unredirected, outside a git repo', () => {
  const spawn = () => ({ status: 128, stdout: '' });
  const result = resolveHarnessRoot('/some/subdir', { spawn });
  assert.deepEqual(result, { root: '/some/subdir', redirected: false, inGitRepo: false });
});

test('resolveHarnessRoot() redirects to the git root when it differs from startDir', () => {
  const spawn = () => ({ status: 0, stdout: '/repo/root\n' });
  const result = resolveHarnessRoot('/repo/root/packages/sub', { spawn });
  assert.deepEqual(result, { root: '/repo/root', redirected: true, inGitRepo: true });
});

test('resolveHarnessRoot() reports no redirect when startDir already IS the git root', () => {
  const spawn = () => ({ status: 0, stdout: '/repo/root\n' });
  const result = resolveHarnessRoot('/repo/root', { spawn });
  assert.deepEqual(result, { root: '/repo/root', redirected: false, inGitRepo: true });
});

// Real-git integration tests (mirrors the precedent in test/checkup.test.js) -

test('getGitRepoRoot() resolves the real top-level root from a nested subdirectory', () => {
  withTempDir((dir) => {
    spawnSync('git', ['init', '-q'], { cwd: dir });
    const sub = path.join(dir, 'packages', 'sub');
    fs.mkdirSync(sub, { recursive: true });

    const root = getGitRepoRoot(sub);

    // Resolve both sides through fs.realpathSync so a symlinked tmp root
    // (e.g. macOS /var -> /private/var) doesn't fail a literal string compare.
    assert.equal(fs.realpathSync(root), fs.realpathSync(dir));
  });
});

test('getGitRepoRoot() returns null for a plain (non-git) directory', () => {
  withTempDir((dir) => {
    assert.equal(getGitRepoRoot(dir), null);
  });
});
