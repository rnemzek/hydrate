const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');
const { listUows, getLastUow, getUowById, formatUowList } = require('../src/commands/uow');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hydrate-uow-test-'));
}

function withTempDir(fn) {
  const dir = makeTempDir();
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runCli(args, cwd) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: 'utf8', cwd });
}

function writeArchivedUow(dir, uowId, content, mtimeMs) {
  const archiveDir = path.join(dir, '.hydrate', 'archive');
  fs.mkdirSync(archiveDir, { recursive: true });
  const filePath = path.join(archiveDir, `${uowId}.md`);
  fs.writeFileSync(filePath, content);
  if (mtimeMs !== undefined) {
    const date = new Date(mtimeMs);
    fs.utimesSync(filePath, date, date);
  }
  return filePath;
}

function writeCurrentUow(dir, content) {
  fs.mkdirSync(path.join(dir, '.hydrate'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md'), content);
}

// listUows() -----------------------------------------------------------------

test('listUows() reports no active UOW and no archive when .hydrate/ is empty', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.hydrate'), { recursive: true });
    const result = listUows(dir);
    assert.equal(result.active, null);
    assert.deepEqual(result.archived, []);
  });
});

test('listUows() treats the "All UOWs are complete!" placeholder as no active UOW', () => {
  withTempDir((dir) => {
    writeCurrentUow(dir, '# All UOWs are complete!\nRun \'hydrate prompt\' when ready for next task.');
    const result = listUows(dir);
    assert.equal(result.active, null);
  });
});

test('listUows() reports the active UOW ID', () => {
  withTempDir((dir) => {
    writeCurrentUow(dir, '# UOW-HYDRATE-10: Zero-Touch\n\n## Acceptance Criteria\n- [ ] Do the thing\n');
    const result = listUows(dir);
    assert.equal(result.active.id, 'UOW-HYDRATE-10');
  });
});

test('listUows() sorts archived UOWs chronologically by mtime, oldest first', () => {
  withTempDir((dir) => {
    writeArchivedUow(dir, 'UOW-HYDRATE-02', '# UOW-HYDRATE-02\n', Date.parse('2026-01-02'));
    writeArchivedUow(dir, 'UOW-HYDRATE-01', '# UOW-HYDRATE-01\n', Date.parse('2026-01-01'));
    writeArchivedUow(dir, 'UOW-HYDRATE-03', '# UOW-HYDRATE-03\n', Date.parse('2026-01-03'));

    const result = listUows(dir);
    assert.deepEqual(result.archived.map((u) => u.id), ['UOW-HYDRATE-01', 'UOW-HYDRATE-02', 'UOW-HYDRATE-03']);
  });
});

// getLastUow() -----------------------------------------------------------------

test('getLastUow() returns null when .hydrate/archive/ has no entries', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.hydrate'), { recursive: true });
    assert.equal(getLastUow(dir), null);
  });
});

test('getLastUow() returns the content of the most recently archived UOW', () => {
  withTempDir((dir) => {
    writeArchivedUow(dir, 'UOW-HYDRATE-01', '# UOW-HYDRATE-01 content\n', Date.parse('2026-01-01'));
    writeArchivedUow(dir, 'UOW-HYDRATE-02', '# UOW-HYDRATE-02 content\n', Date.parse('2026-01-05'));

    const last = getLastUow(dir);
    assert.equal(last.id, 'UOW-HYDRATE-02');
    assert.match(last.content, /UOW-HYDRATE-02 content/);
  });
});

// getUowById() -----------------------------------------------------------------

test('getUowById() finds a match in the active canvas', () => {
  withTempDir((dir) => {
    writeCurrentUow(dir, '# UOW-HYDRATE-10: Zero-Touch\n\n- [ ] task\n');
    const found = getUowById(dir, 'UOW-HYDRATE-10');
    assert.ok(found);
    assert.equal(found.active, true);
    assert.match(found.content, /Zero-Touch/);
  });
});

test('getUowById() finds a match in .hydrate/archive/, case-insensitively', () => {
  withTempDir((dir) => {
    writeArchivedUow(dir, 'UOW-HYDRATE-07', '# UOW-HYDRATE-07 content\n');
    const found = getUowById(dir, 'uow-hydrate-07');
    assert.ok(found);
    assert.equal(found.active, false);
    assert.equal(found.id, 'UOW-HYDRATE-07');
  });
});

test('getUowById() returns null for an unknown ID', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.hydrate'), { recursive: true });
    assert.equal(getUowById(dir, 'UOW-NOPE'), null);
  });
});

// formatUowList() -----------------------------------------------------------------

test('formatUowList() reports "none" when nothing is active or archived', () => {
  const output = formatUowList({ active: null, archived: [] });
  assert.match(output, /Active: none/);
  assert.match(output, /Archived: none yet/);
});

test('formatUowList() lists archived UOWs in order', () => {
  const output = formatUowList({
    active: { id: 'UOW-HYDRATE-10' },
    archived: [{ id: 'UOW-HYDRATE-01' }, { id: 'UOW-HYDRATE-02' }]
  });
  assert.match(output, /Active: UOW-HYDRATE-10/);
  assert.match(output, /1\. UOW-HYDRATE-01/);
  assert.match(output, /2\. UOW-HYDRATE-02/);
});

// CLI integration -----------------------------------------------------------------

test('hydrate uow (no args) defaults to list', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    const result = runCli(['uow'], dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Hydrate UOW Index/);
    assert.match(result.stdout, /Archived: none yet/);
  });
});

test('hydrate uow list prints the active and archived UOWs', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    writeCurrentUow(dir, '# UOW-HYDRATE-10: Zero-Touch\n\n- [ ] task\n');
    writeArchivedUow(dir, 'UOW-HYDRATE-09', '# UOW-HYDRATE-09\n');

    const result = runCli(['uow', 'list'], dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /UOW-HYDRATE-10/);
    assert.match(result.stdout, /UOW-HYDRATE-09/);
  });
});

test('hydrate uow last prints the most recently archived UOW content', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    writeArchivedUow(dir, 'UOW-HYDRATE-01', '# UOW-HYDRATE-01 details\n');

    const result = runCli(['uow', 'last'], dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /UOW-HYDRATE-01 details/);
  });
});

test('hydrate uow last exits 1 with a diagnostic when the archive is empty', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    const result = runCli(['uow', 'last'], dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /No archived UOWs found/);
  });
});

test('hydrate uow <id> prints a specific archived UOW by ID', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    writeArchivedUow(dir, 'UOW-HYDRATE-05', '# UOW-HYDRATE-05 payload\n');

    const result = runCli(['uow', 'UOW-HYDRATE-05'], dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /UOW-HYDRATE-05 payload/);
  });
});

test('hydrate uow <id> exits 1 with a diagnostic for an unknown ID', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    const result = runCli(['uow', 'UOW-NOPE'], dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /No UOW found matching "UOW-NOPE"/);
  });
});
