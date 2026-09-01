const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const POSTINSTALL_PATH = path.join(__dirname, '..', 'bin', 'postinstall.js');
const PKG_ROOT = path.join(__dirname, '..');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hydrate-postinstall-test-'));
}

function withTempDir(fn) {
  const dir = makeTempDir();
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runPostinstall(initCwd, cwd) {
  const env = { ...process.env };
  if (initCwd === undefined) {
    delete env.INIT_CWD;
  } else {
    env.INIT_CWD = initCwd;
  }
  return spawnSync(process.execPath, [POSTINSTALL_PATH], { encoding: 'utf8', cwd: cwd || initCwd, env });
}

test('postinstall scaffolds .claude/commands/ into the host project via INIT_CWD', () => {
  withTempDir((dir) => {
    const result = runPostinstall(dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /provisioned Claude Code slash commands/);
    assert.ok(fs.existsSync(path.join(dir, '.claude', 'commands', 'hydrate.md')));
    assert.ok(fs.existsSync(path.join(dir, '.claude', 'commands', 'hydrate-uow.md')));
    assert.ok(fs.existsSync(path.join(dir, '.claude', 'commands', 'hydrate-artifacts.md')));
    assert.ok(fs.existsSync(path.join(dir, '.claude', 'commands', 'hydrate-checkup.md')));
  });
});

test('postinstall does not require or touch .hydrate/ or CLAUDE.md — only .claude/commands/', () => {
  withTempDir((dir) => {
    runPostinstall(dir);

    assert.ok(!fs.existsSync(path.join(dir, 'CLAUDE.md')));
    assert.ok(!fs.existsSync(path.join(dir, '.hydrate')));
  });
});

test('postinstall falls back to process.cwd() when INIT_CWD is unset', () => {
  withTempDir((dir) => {
    const result = runPostinstall(undefined, dir);

    assert.equal(result.status, 0);
    assert.ok(fs.existsSync(path.join(dir, '.claude', 'commands', 'hydrate.md')));
  });
});

test('postinstall is non-destructive: does not overwrite an existing slash command file', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.claude', 'commands'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude', 'commands', 'hydrate-checkup.md'), 'custom command');

    runPostinstall(dir);

    assert.equal(fs.readFileSync(path.join(dir, '.claude', 'commands', 'hydrate-checkup.md'), 'utf8'), 'custom command');
  });
});

test('postinstall skips scaffolding when INIT_CWD is the package\'s own root (local `npm install`)', () => {
  const result = runPostinstall(PKG_ROOT);

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '');
});

test('postinstall fails quietly instead of crashing when the target path cannot be scaffolded', () => {
  withTempDir((dir) => {
    // Create a plain file where .claude/commands/ would need to be a
    // directory, forcing scaffoldClaudeCommands()'s mkdirSync to throw.
    fs.writeFileSync(path.join(dir, '.claude'), 'not a directory');

    const result = runPostinstall(dir);

    assert.equal(result.status, 0);
    assert.equal(result.stderr.trim(), '');
  });
});
