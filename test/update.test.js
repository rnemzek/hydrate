const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runUpdate } = require('../src/commands/update');

function collectLogs() {
  const lines = [];
  return { lines, log: (m) => lines.push(String(m)), error: (m) => lines.push(String(m)) };
}

test('runUpdate() installs globally by default and re-syncs the workspace', () => {
  const spawnCalls = [];
  const spawn = (cmd, args) => {
    spawnCalls.push({ cmd, args });
    return { status: 0 };
  };
  let syncCalledWith = null;
  const sync = (cwd) => {
    syncCalledWith = cwd;
    return [{ repoDir: cwd, action: 'synced', updated: [] }];
  };
  const { lines, log } = collectLogs();

  const result = runUpdate('/repo', { spawn, sync, log });

  assert.equal(result.code, 0);
  assert.equal(result.action, 'updated');
  assert.deepEqual(spawnCalls[0], { cmd: 'npm', args: ['install', '-g', '@nemzilla/hydrate'] });
  assert.equal(syncCalledWith, '/repo');
  assert.match(lines.join('\n'), /Upgraded @nemzilla\/hydrate globally/);
  assert.match(lines.join('\n'), /Re-synced workspace/);
});

test('runUpdate({ global: false }) installs the local project dependency', () => {
  const spawnCalls = [];
  const spawn = (cmd, args) => {
    spawnCalls.push({ cmd, args });
    return { status: 0 };
  };
  const { log } = collectLogs();

  const result = runUpdate('/repo', { global: false, spawn, sync: () => [], log });

  assert.equal(result.code, 0);
  assert.deepEqual(spawnCalls[0], { cmd: 'npm', args: ['install', '@nemzilla/hydrate'] });
});

test('runUpdate() reports failure and exits 1 when npm install errors', () => {
  const spawn = () => ({ error: new Error('network down') });
  const { lines, error } = collectLogs();

  const result = runUpdate('/repo', { spawn, error, sync: () => [] });

  assert.equal(result.code, 1);
  assert.equal(result.action, 'install-failed');
  assert.match(lines.join('\n'), /network down/);
});

test('runUpdate() reports failure and exits 1 on a non-zero npm exit code', () => {
  const spawn = () => ({ status: 1 });
  const { lines, error } = collectLogs();

  const result = runUpdate('/repo', { spawn, error, sync: () => [] });

  assert.equal(result.code, 1);
  assert.equal(result.action, 'install-failed');
  assert.match(lines.join('\n'), /npm install/);
});
