const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runHook, enableHook, disableHook, hookStatus, defaultRcPath } = require('../src/commands/hook');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hydrate-hook-test-'));
}

function withTempDir(fn) {
  const dir = makeTempDir();
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function collectLogs() {
  const lines = [];
  return { lines, log: (m) => lines.push(String(m)), error: (m) => lines.push(String(m)) };
}

test('defaultRcPath() picks .bashrc when $SHELL mentions bash, else .zshrc', () => {
  const originalShell = process.env.SHELL;
  try {
    process.env.SHELL = '/bin/bash';
    assert.equal(defaultRcPath('/home/x'), path.join('/home/x', '.bashrc'));
    process.env.SHELL = '/bin/zsh';
    assert.equal(defaultRcPath('/home/x'), path.join('/home/x', '.zshrc'));
  } finally {
    if (originalShell === undefined) delete process.env.SHELL;
    else process.env.SHELL = originalShell;
  }
});

test('hookStatus() reports not installed for a missing rc file', () => {
  withTempDir((dir) => {
    const rcPath = path.join(dir, '.zshrc');
    assert.equal(hookStatus(rcPath).installed, false);
  });
});

test('enableHook() creates the rc file with the hook block when none exists', () => {
  withTempDir((dir) => {
    const rcPath = path.join(dir, 'nested', '.zshrc');
    const result = enableHook(rcPath);

    assert.equal(result.changed, true);
    const content = fs.readFileSync(rcPath, 'utf8');
    assert.match(content, />>> hydrate git hook >>>/);
    assert.match(content, /hydrate init --quiet/);
  });
});

test('enableHook() appends after existing rc content without disturbing it', () => {
  withTempDir((dir) => {
    const rcPath = path.join(dir, '.zshrc');
    fs.writeFileSync(rcPath, 'export PATH=$PATH:/custom/bin\n', 'utf8');

    enableHook(rcPath);

    const content = fs.readFileSync(rcPath, 'utf8');
    assert.match(content, /export PATH=\$PATH:\/custom\/bin/);
    assert.match(content, />>> hydrate git hook >>>/);
    assert.ok(content.indexOf('export PATH') < content.indexOf('hydrate git hook'));
  });
});

test('enableHook() is idempotent — running twice does not duplicate the block', () => {
  withTempDir((dir) => {
    const rcPath = path.join(dir, '.zshrc');
    enableHook(rcPath);
    const second = enableHook(rcPath);

    assert.equal(second.changed, false);
    const occurrences = fs.readFileSync(rcPath, 'utf8').match(/>>> hydrate git hook >>>/g) || [];
    assert.equal(occurrences.length, 1);
  });
});

test('disableHook() removes the block and preserves surrounding content', () => {
  withTempDir((dir) => {
    const rcPath = path.join(dir, '.zshrc');
    fs.writeFileSync(rcPath, 'export PATH=$PATH:/custom/bin\n', 'utf8');
    enableHook(rcPath);

    const result = disableHook(rcPath);

    assert.equal(result.changed, true);
    const content = fs.readFileSync(rcPath, 'utf8');
    assert.match(content, /export PATH=\$PATH:\/custom\/bin/);
    assert.doesNotMatch(content, /hydrate git hook/);
  });
});

test('disableHook() is a no-op when nothing is installed', () => {
  withTempDir((dir) => {
    const rcPath = path.join(dir, '.zshrc');
    fs.writeFileSync(rcPath, 'plain content\n', 'utf8');
    const result = disableHook(rcPath);
    assert.equal(result.changed, false);
  });
});

test('runHook("enable"/"status"/"disable") drives the full lifecycle', () => {
  withTempDir((dir) => {
    const rcPath = path.join(dir, '.zshrc');

    const enableLogs = collectLogs();
    const enableResult = runHook('enable', { rcPath, ...enableLogs });
    assert.equal(enableResult.code, 0);
    assert.match(enableLogs.lines.join('\n'), /Installed git-init hook/);

    const statusLogs = collectLogs();
    const statusResult = runHook('status', { rcPath, ...statusLogs });
    assert.equal(statusResult.installed, true);
    assert.match(statusLogs.lines.join('\n'), /is installed/);

    const disableLogs = collectLogs();
    const disableResult = runHook('disable', { rcPath, ...disableLogs });
    assert.equal(disableResult.code, 0);
    assert.match(disableLogs.lines.join('\n'), /Removed git-init hook/);

    const finalStatus = runHook('status', { rcPath, log: () => {} });
    assert.equal(finalStatus.installed, false);
  });
});

test('runHook() rejects an unknown action', () => {
  withTempDir((dir) => {
    const rcPath = path.join(dir, '.zshrc');
    const { lines, error } = collectLogs();
    const result = runHook('bogus', { rcPath, error });

    assert.equal(result.code, 1);
    assert.match(lines.join('\n'), /Unknown hook action/);
  });
});
