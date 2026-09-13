const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  getVisibleCommandNames,
  buildBashCompletion,
  buildZshCompletion,
  buildCompletionScript,
  detectShell
} = require('../src/commands/completion');
const { COMMANDS } = require('../src/help');

test('getVisibleCommandNames() excludes hidden aliases', () => {
  const names = getVisibleCommandNames();
  assert.ok(names.includes('checkup'));
  assert.ok(names.includes('sync'));
  assert.ok(names.includes('completion'));
  assert.ok(!names.includes('status'));
  assert.ok(!names.includes('export'));
  assert.ok(!names.includes('paste'));
  assert.ok(!names.includes('lfg'));
});

test('getVisibleCommandNames() matches COMMANDS exactly (no drift)', () => {
  const visible = Object.entries(COMMANDS).filter(([, meta]) => !meta.hidden).map(([name]) => name);
  assert.deepEqual(getVisibleCommandNames(), visible);
});

test('buildBashCompletion() lists every given command and registers hydrate + hz', () => {
  const script = buildBashCompletion(['checkup', 'ingest']);
  assert.match(script, /compgen -W "checkup ingest"/);
  assert.match(script, /complete -F _hydrate_completions hydrate/);
  assert.match(script, /complete -F _hydrate_completions hz/);
});

test('buildZshCompletion() lists every given command and declares a compdef', () => {
  const script = buildZshCompletion(['checkup', 'ingest']);
  assert.match(script, /^#compdef hydrate hz/);
  assert.match(script, /'checkup' 'ingest'/);
});

test('buildCompletionScript() dispatches on shell, defaulting to bash for unknown values', () => {
  assert.match(buildCompletionScript('zsh', ['checkup']), /#compdef/);
  assert.match(buildCompletionScript('bash', ['checkup']), /_hydrate_completions/);
  assert.match(buildCompletionScript('fish', ['checkup']), /_hydrate_completions/);
});

test('buildCompletionScript() defaults `commands` to every visible subcommand', () => {
  const script = buildCompletionScript('bash');
  assert.match(script, /checkup/);
  assert.match(script, /completion/);
});

test('detectShell() reads $SHELL, defaulting to bash', () => {
  assert.equal(detectShell({ SHELL: '/usr/bin/zsh' }), 'zsh');
  assert.equal(detectShell({ SHELL: '/bin/bash' }), 'bash');
  assert.equal(detectShell({}), 'bash');
});
