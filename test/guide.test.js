const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');
const { diagnose, findOpenTasks, STATE_UNINITIALIZED, STATE_UOW_IN_PROGRESS, STATE_UOW_COMPLETED } = require('../src/guide');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hydrate-guide-test-'));
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

test('diagnose() reports UNINITIALIZED with no .hydrate/ and recommends init for an empty dir', () => {
  withTempDir((dir) => {
    const diagnosis = diagnose(dir);
    assert.equal(diagnosis.state, STATE_UNINITIALIZED);
    assert.equal(diagnosis.recommendation, 'hydrate init');
  });
});

test('diagnose() recommends inject for an UNINITIALIZED dir that looks like an existing project', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'package.json'), '{}');
    const diagnosis = diagnose(dir);
    assert.equal(diagnosis.state, STATE_UNINITIALIZED);
    assert.equal(diagnosis.recommendation, 'hydrate inject');
  });
});

test('diagnose() reports UOW_IN_PROGRESS with open tasks and recommends iterate', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.hydrate'));
    fs.writeFileSync(
      path.join(dir, '.hydrate', 'CURRENT_UOW.md'),
      '## UOW-99: Fixture\n- **Status:** IN_PROGRESS\n\n- [ ] Task 99.1\n'
    );
    const diagnosis = diagnose(dir);
    assert.equal(diagnosis.state, STATE_UOW_IN_PROGRESS);
    assert.equal(diagnosis.recommendation, 'hydrate iterate "<reason>"');
  });
});

test('diagnose() reports UOW_IN_PROGRESS with no open tasks and recommends complete', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.hydrate'));
    fs.writeFileSync(
      path.join(dir, '.hydrate', 'CURRENT_UOW.md'),
      '## UOW-99: Fixture\n- **Status:** IN_PROGRESS\n\n- [x] Task 99.1\n'
    );
    const diagnosis = diagnose(dir);
    assert.equal(diagnosis.state, STATE_UOW_IN_PROGRESS);
    assert.equal(diagnosis.recommendation, 'hydrate complete');
  });
});

test('diagnose() reports UOW_COMPLETED when Status is COMPLETED', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.hydrate'));
    fs.writeFileSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md'), '## UOW-99\n- **Status:** COMPLETED\n');
    const diagnosis = diagnose(dir);
    assert.equal(diagnosis.state, STATE_UOW_COMPLETED);
  });
});

test('diagnose() reports UOW_COMPLETED for the legacy "All UOWs are complete!" sentinel', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.hydrate'));
    fs.writeFileSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md'), '# All UOWs are complete!\n');
    const diagnosis = diagnose(dir);
    assert.equal(diagnosis.state, STATE_UOW_COMPLETED);
  });
});

test('hydrate ? exits 0 and does not mutate .hydrate/', () => {
  withTempDir((dir) => {
    const result = runCli(['?'], dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Current Status/);
    assert.match(result.stdout, /Recommended Next Command/);
    assert.equal(fs.existsSync(path.join(dir, '.hydrate')), false);
  });
});

test('hydrate lost exits 0 and does not mutate .hydrate/', () => {
  withTempDir((dir) => {
    const result = runCli(['lost'], dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Current Status/);
    assert.equal(fs.existsSync(path.join(dir, '.hydrate')), false);
  });
});

test('hydrate next exits 0 and does not mutate .hydrate/', () => {
  withTempDir((dir) => {
    const result = runCli(['next'], dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Recommended Next Command/);
    assert.equal(fs.existsSync(path.join(dir, '.hydrate')), false);
  });
});

test('hydrate greenfield and hydrate brownfield exit 0 without touching .hydrate/', () => {
  withTempDir((dir) => {
    const greenfield = runCli(['greenfield'], dir);
    assert.equal(greenfield.status, 0);
    assert.match(greenfield.stdout, /GREENFIELD PLAYBOOK/);

    const brownfield = runCli(['brownfield'], dir);
    assert.equal(brownfield.status, 0);
    assert.match(brownfield.stdout, /BROWNFIELD PLAYBOOK/);

    assert.equal(fs.existsSync(path.join(dir, '.hydrate')), false);
  });
});

// findOpenTasks() -------------------------------------------------------------

test('findOpenTasks() returns an empty array when every task is checked', () => {
  const content = '## UOW-99\n- [x] Task 99.1\n- [x] Task 99.2\n';
  assert.deepEqual(findOpenTasks(content), []);
});

test('findOpenTasks() returns the raw open-task lines, trimmed', () => {
  const content = '## UOW-99\n  - [ ] Task 99.1\n- [x] Task 99.2\n- [ ] Task 99.3\n';
  assert.deepEqual(findOpenTasks(content), ['- [ ] Task 99.1', '- [ ] Task 99.3']);
});

test('findOpenTasks() ignores checked/unchecked markers embedded in prose', () => {
  const content = 'Discussing [ ] brackets and [x] markers in a sentence, not a checklist.\n';
  assert.deepEqual(findOpenTasks(content), []);
});

// `hydrate complete` strict validation ----------------------------------------

function initAndPromptWithUow(dir, uowBody) {
  runCli(['init'], dir);
  fs.writeFileSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md'), uowBody);
}

test('hydrate complete aborts and leaves state untouched when unchecked tasks remain', () => {
  withTempDir((dir) => {
    const uowBody = '## UOW-42: Fixture\n- **Status:** IN_PROGRESS\n\n- [x] Task 42.1\n- [ ] Task 42.2\n';
    initAndPromptWithUow(dir, uowBody);

    const result = runCli(['complete'], dir);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Cannot complete UOW-42/);
    assert.match(result.stderr, /Task 42\.2/);
    assert.equal(fs.readFileSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md'), 'utf8'), uowBody);
  });
});

test('hydrate complete succeeds when every task is checked', () => {
  withTempDir((dir) => {
    const uowBody = '## UOW-42: Fixture\n- **Status:** IN_PROGRESS\n\n- [x] Task 42.1\n- [x] Task 42.2\n';
    initAndPromptWithUow(dir, uowBody);

    const result = runCli(['complete'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /UOW-42 Officially Complete/);
    assert.match(fs.readFileSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md'), 'utf8'), /All UOWs are complete!/);
  });
});

test('hydrate complete --force closes the UOW out despite unchecked tasks', () => {
  withTempDir((dir) => {
    const uowBody = '## UOW-42: Fixture\n- **Status:** IN_PROGRESS\n\n- [ ] Task 42.1\n';
    initAndPromptWithUow(dir, uowBody);

    const result = runCli(['complete', '--force'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /UOW-42 Officially Complete/);
    assert.match(result.stdout, /Forced past 1 unchecked task/);
    assert.match(fs.readFileSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md'), 'utf8'), /All UOWs are complete!/);
  });
});

test('hydrate complete -f is the short form of --force', () => {
  withTempDir((dir) => {
    const uowBody = '## UOW-42: Fixture\n- **Status:** IN_PROGRESS\n\n- [ ] Task 42.1\n';
    initAndPromptWithUow(dir, uowBody);

    const result = runCli(['complete', '-f'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /UOW-42 Officially Complete/);
  });
});
