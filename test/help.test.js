const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const { COMMANDS } = require('../src/help');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: 'utf8',
    cwd: options.cwd || process.cwd()
  });
}

test('COMMANDS.lfg is registered as a hidden alias wrapping ingest', () => {
  assert.ok(COMMANDS.lfg);
  assert.equal(COMMANDS.lfg.hidden, true);
  assert.match(COMMANDS.lfg.usage, /hydrate lfg/);
});

test('hydrate lfg --help prints command help without exiting via the ingest flow', () => {
  const result = runCli(['lfg', '--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /hydrate lfg/);
});

test('hydrate --help does not list the lfg easter egg in the visible command table', () => {
  const result = runCli(['--help']);
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /\blfg\b/i);
});
