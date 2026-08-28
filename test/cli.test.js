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

test('hydrate ? is an alias for global help', () => {
  const result = runCli(['?']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /usage/i);
  assert.match(result.stdout, /commands/i);
});

test('global help lists exactly the pruned v2 command surface', () => {
  const result = runCli(['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /init/);
  assert.match(result.stdout, /prompt/);
  assert.match(result.stdout, /clip/);
  assert.match(result.stdout, /complete/);
  assert.doesNotMatch(result.stdout, /\binject\b/);
  assert.doesNotMatch(result.stdout, /\badopt\b/);
  assert.doesNotMatch(result.stdout, /\biterate\b/);
  assert.doesNotMatch(result.stdout, /setup-cc/);
  assert.doesNotMatch(result.stdout, /greenfield/);
  assert.doesNotMatch(result.stdout, /brownfield/);
  assert.doesNotMatch(result.stdout, /ROADMAP\.md/);
  assert.doesNotMatch(result.stdout, /CONTEXT\.md/);
  assert.doesNotMatch(result.stdout, /AI_PROJECT_RULES\.md/);
});

for (const removed of ['inject', 'adopt', 'iterate', 'setup-cc', 'greenfield', 'brownfield']) {
  test(`hydrate ${removed} is pruned and falls back to global help`, () => {
    const cwd = makeTempDir();
    try {
      const result = runCli([removed], { cwd });
      assert.equal(result.status, 0);
      assert.match(result.stdout, /commands/i);
      assert.equal(fs.existsSync(path.join(cwd, '.hydrate')), false);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
}
