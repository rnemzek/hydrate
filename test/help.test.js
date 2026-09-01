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
  const commandsSection = result.stdout.split('COMMANDS')[1].split('GLOBAL FLAGS')[0];
  assert.doesNotMatch(commandsSection, /\blfg\b/i);
});

test('hydrate help prints the Triad Workflow Guide banner and 6-step boot sequence', () => {
  const result = runCli(['help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /HYDRATE ENGINE — TRIAD WORKFLOW GUIDE/);
  assert.match(result.stdout, /claude --dangerously-skip-permissions/);
  assert.match(result.stdout, /hydrate init/);
  assert.match(result.stdout, /\/hydrate-context/);
  assert.match(result.stdout, /AI Architect/);
  assert.match(result.stdout, /\/hydrate-lfg/);
});

test('hydrate --help and hydrate -h also print the Triad Workflow Guide banner', () => {
  for (const flag of ['--help', '-h']) {
    const result = runCli([flag]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /HYDRATE ENGINE — TRIAD WORKFLOW GUIDE/);
  }
});
