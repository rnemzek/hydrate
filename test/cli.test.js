const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');
const PKG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: 'utf8',
    cwd: options.cwd || process.cwd()
  });
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hydrate-cli-test-'));
}

test('hydrate --help exits 0 and shows usage/commands', () => {
  const result = runCli(['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /usage/i);
  assert.match(result.stdout, /commands/i);
});

test('hydrate -v prints the exact version from package.json', () => {
  const result = runCli(['-v']);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), `v${PKG.version}`);
});

test('hydrate prompt --help shows subcommand help without mutating .hydrate/', () => {
  const cwd = makeTempDir();
  try {
    const result = runCli(['prompt', '--help'], { cwd });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /hydrate prompt/);
    assert.match(result.stdout, /--architect/);
    assert.equal(fs.existsSync(path.join(cwd, '.hydrate')), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('hydrate unknown-cmd exits cleanly and falls back to global help', () => {
  const result = runCli(['unknown-cmd']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /commands/i);
});
