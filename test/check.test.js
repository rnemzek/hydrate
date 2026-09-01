const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hydrate-check-test-'));
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

function writeHydrateFile(dir, name, content) {
  fs.writeFileSync(path.join(dir, '.hydrate', name), content);
}

function writeArchivedUow(dir, uowId, content = `# ${uowId}: Fixture\n`) {
  fs.mkdirSync(path.join(dir, '.hydrate', 'archive'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.hydrate', 'archive', `${uowId}.md`), content);
}

test('hydrate check exits 1 with a descriptive error when .hydrate/ is missing', () => {
  withTempDir((dir) => {
    const result = runCli(['check'], dir);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /\.hydrate\/ directory not found/);
  });
});

test('hydrate check exits 0 on an empty .hydrate/ structure with no archived UOWs', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);

    const result = runCli(['check'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /No archived UOWs found/);
  });
});

test('hydrate check exits 0 when every archived UOW is fully logged', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    writeArchivedUow(dir, 'UOW-HYDRATE-01');
    writeHydrateFile(dir, 'PROJECT_JOURNAL.md', '# Journal\n\n- [x] **[UOW-HYDRATE-01]** Title — 2026-09-01 | Pass: 5/5 tests\n');
    writeHydrateFile(dir, 'DEV_JOURNAL.md', '# Dev Journal\n\n### UOW-HYDRATE-01 — completed 2026-09-01\n- did the thing\n');
    writeHydrateFile(dir, 'ARCHITECT_JOURNAL.md', '# Architect Journal\n\n## [UOW-HYDRATE-01]\n- architecture notes\n');

    const result = runCli(['check'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /UOW-HYDRATE-01 — journals consistent/);
    assert.match(result.stdout, /All 1 archived UOW verified clean/);
  });
});

test('hydrate check exits 1 and reports a missing PROJECT_JOURNAL.md entry', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    writeArchivedUow(dir, 'UOW-HYDRATE-01');
    writeHydrateFile(dir, 'PROJECT_JOURNAL.md', '# Journal\n');
    writeHydrateFile(dir, 'DEV_JOURNAL.md', '### UOW-HYDRATE-01 — completed 2026-09-01\n');
    writeHydrateFile(dir, 'ARCHITECT_JOURNAL.md', '## [UOW-HYDRATE-01]\n');

    const result = runCli(['check'], dir);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /missing completed checklist entry "- \[x\] \*\*\[UOW-HYDRATE-01\]\*\*" in \.hydrate\/PROJECT_JOURNAL\.md/);
  });
});

test('hydrate check exits 1 and reports a missing DEV_JOURNAL.md section header', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    writeArchivedUow(dir, 'UOW-HYDRATE-01');
    writeHydrateFile(dir, 'PROJECT_JOURNAL.md', '- [x] **[UOW-HYDRATE-01]** Title — 2026-09-01 | Pass: 5/5 tests\n');
    writeHydrateFile(dir, 'DEV_JOURNAL.md', '# Dev Journal\n(no entry logged)\n');
    writeHydrateFile(dir, 'ARCHITECT_JOURNAL.md', '## [UOW-HYDRATE-01]\n');

    const result = runCli(['check'], dir);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /missing section header referencing UOW-HYDRATE-01 in \.hydrate\/DEV_JOURNAL\.md/);
  });
});

test('hydrate check exits 1 and reports a missing ARCHITECT_JOURNAL.md section header', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    writeArchivedUow(dir, 'UOW-HYDRATE-01');
    writeHydrateFile(dir, 'PROJECT_JOURNAL.md', '- [x] **[UOW-HYDRATE-01]** Title — 2026-09-01 | Pass: 5/5 tests\n');
    writeHydrateFile(dir, 'DEV_JOURNAL.md', '### UOW-HYDRATE-01 — completed 2026-09-01\n');
    writeHydrateFile(dir, 'ARCHITECT_JOURNAL.md', '# Architect Journal\n(no entry logged)\n');

    const result = runCli(['check'], dir);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /missing section header referencing UOW-HYDRATE-01 in \.hydrate\/ARCHITECT_JOURNAL\.md/);
  });
});

test('hydrate check reports missing journal files as errors', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.hydrate'));
    writeArchivedUow(dir, 'UOW-HYDRATE-01');

    const result = runCli(['check'], dir);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /\.hydrate\/PROJECT_JOURNAL\.md not found/);
    assert.match(result.stdout, /\.hydrate\/DEV_JOURNAL\.md not found/);
    assert.match(result.stdout, /\.hydrate\/ARCHITECT_JOURNAL\.md not found/);
  });
});

test('hydrate check warns and exits 1 when CURRENT_UOW.md holds a completed but unarchived UOW', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    writeHydrateFile(dir, 'CURRENT_UOW.md', '## UOW-HYDRATE-03: Fixture\n- [x] Task 1\n- [x] Task 2\n');

    const result = runCli(['check'], dir);

    assert.equal(result.status, 1);
    assert.match(
      result.stdout,
      /\.hydrate\/CURRENT_UOW\.md contains a completed UOW payload \(UOW-HYDRATE-03\) that has not been moved to \.hydrate\/archive\//
    );
  });
});

test('hydrate check does not warn when CURRENT_UOW.md still has open tasks', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    writeHydrateFile(dir, 'CURRENT_UOW.md', '## UOW-HYDRATE-03: Fixture\n- [x] Task 1\n- [ ] Task 2\n');

    const result = runCli(['check'], dir);

    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /has not been moved to/);
  });
});

test('hydrate check does not warn when CURRENT_UOW.md is reset to the placeholder', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);

    const result = runCli(['check'], dir);

    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /has not been moved to/);
  });
});

test('hydrate check does not warn when the CURRENT_UOW.md payload is already archived', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    writeArchivedUow(dir, 'UOW-HYDRATE-01', '## UOW-HYDRATE-01: Fixture\n- [x] Task 1\n');
    writeHydrateFile(dir, 'PROJECT_JOURNAL.md', '- [x] **[UOW-HYDRATE-01]** Title — 2026-09-01 | Pass: 1/1 tests\n');
    writeHydrateFile(dir, 'DEV_JOURNAL.md', '### UOW-HYDRATE-01 — completed 2026-09-01\n');
    writeHydrateFile(dir, 'ARCHITECT_JOURNAL.md', '## [UOW-HYDRATE-01]\n');
    writeHydrateFile(dir, 'CURRENT_UOW.md', '## UOW-HYDRATE-01: Fixture\n- [x] Task 1\n');

    const result = runCli(['check'], dir);

    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /has not been moved to/);
  });
});

test('hydrate check reports multiple archived UOWs independently', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    writeArchivedUow(dir, 'UOW-HYDRATE-01');
    writeArchivedUow(dir, 'UOW-HYDRATE-02');
    writeHydrateFile(dir, 'PROJECT_JOURNAL.md', '- [x] **[UOW-HYDRATE-01]** Title — 2026-09-01 | Pass: 1/1 tests\n');
    writeHydrateFile(dir, 'DEV_JOURNAL.md', '### UOW-HYDRATE-01 — completed 2026-09-01\n### UOW-HYDRATE-02 — completed 2026-09-01\n');
    writeHydrateFile(dir, 'ARCHITECT_JOURNAL.md', '## [UOW-HYDRATE-01]\n## [UOW-HYDRATE-02]\n');

    const result = runCli(['check'], dir);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /UOW-HYDRATE-01 — journals consistent/);
    assert.match(result.stdout, /UOW-HYDRATE-02 — 1 issue/);
    assert.match(result.stdout, /missing completed checklist entry "- \[x\] \*\*\[UOW-HYDRATE-02\]\*\*" in \.hydrate\/PROJECT_JOURNAL\.md/);
  });
});
