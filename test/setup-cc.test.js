const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hydrate-setup-cc-test-'));
}

function runCli(args, cwd) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: 'utf8', cwd });
}

test('hydrate setup-cc creates .claude/commands/hydrate.md', () => {
  const cwd = makeTempDir();
  try {
    const result = runCli(['setup-cc'], cwd);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Created \.claude\/commands\/hydrate\.md/);

    const commandPath = path.join(cwd, '.claude', 'commands', 'hydrate.md');
    assert.ok(fs.existsSync(commandPath));
    const content = fs.readFileSync(commandPath, 'utf8');
    assert.match(content, /hydrate prompt --copy/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('hydrate setup-cc is idempotent and reports "Updated" on re-run', () => {
  const cwd = makeTempDir();
  try {
    runCli(['setup-cc'], cwd);
    const result = runCli(['setup-cc'], cwd);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Updated \.claude\/commands\/hydrate\.md/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
