const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hydrate-prompt-test-'));
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

test('hydrate prompt errors when .hydrate/ROADMAP.md and CLAUDE.md are both missing', () => {
  withTempDir((dir) => {
    const result = runCli(['prompt'], dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Missing \.hydrate\/ROADMAP\.md or CLAUDE\.md/);
  });
});

test('hydrate prompt pulls the next pending UOW out of .hydrate/ROADMAP.md Section 1 when CURRENT_UOW.md is reset', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    fs.writeFileSync(
      path.join(dir, '.hydrate', 'ROADMAP.md'),
      '# Roadmap\n\n## Section 1: Scheduled Roadmap Items\n- [x] **UOW-01**: Done already\n- [ ] **UOW-02**: Next up\n\n---\n\n## Section 2: Future features\n'
    );

    const result = runCli(['prompt'], dir);
    assert.equal(result.status, 0);

    const payload = fs.readFileSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md'), 'utf8');
    assert.match(payload, /\*\*UOW-02\*\*: Next up/);
    assert.doesNotMatch(payload, /Done already/);
  });
});

test('hydrate prompt leaves an in-progress CURRENT_UOW.md untouched by the ROADMAP.md fallback', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    fs.writeFileSync(
      path.join(dir, '.hydrate', 'CURRENT_UOW.md'),
      '## UOW-77: In Flight\n- **Status:** IN_PROGRESS\n\n- [ ] Task 77.1\n'
    );

    const result = runCli(['prompt'], dir);
    assert.equal(result.status, 0);

    const payload = fs.readFileSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md'), 'utf8');
    assert.match(payload, /UOW-77: In Flight/);
    assert.match(payload, /Task 77\.1/);
  });
});

test('hydrate prompt --architect emits a chunked payload built from CLAUDE.md and the active scope, without dev-journal content', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);

    const result = runCli(['prompt', '--architect'], dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /HYDRATE ARCHITECT/);
    assert.match(result.stdout, /ARCHITECTURAL & EXECUTION CONSTRAINTS/);
    assert.match(result.stdout, /ACTIVE SPRINT SCOPE/);
    assert.doesNotMatch(result.stdout, /DEV JOURNAL/);
  });
});
