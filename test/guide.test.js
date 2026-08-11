const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');
const { diagnose, STATE_UNINITIALIZED, STATE_UOW_IN_PROGRESS, STATE_UOW_COMPLETED } = require('../src/guide');

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
