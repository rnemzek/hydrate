const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hydrate-complete-test-'));
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

test('hydrate complete archives the finished canvas to .hydrate/archive/', () => {
  withTempDir((dir) => {
    const uowBody = '## UOW-42: Fixture\n- **Status:** IN_PROGRESS\n\n- [x] Task 42.1\n';
    initAndPromptWithUow(dir, uowBody);

    const result = runCli(['complete'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Archived canvas to .hydrate[\\/]archive[\\/]UOW-42\.md/);

    const archived = fs.readFileSync(path.join(dir, '.hydrate', 'archive', 'UOW-42.md'), 'utf8');
    assert.equal(archived, uowBody);
  });
});

test('hydrate complete prints a suggested git commit command including the UOW title', () => {
  withTempDir((dir) => {
    const uowBody = '## UOW-42: Fixture\n**Title:** Widget Overhaul\n- **Status:** IN_PROGRESS\n\n- [x] Task 42.1\n';
    initAndPromptWithUow(dir, uowBody);

    const result = runCli(['complete'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /git add -A && git commit -m "feat: complete UOW-42 — Widget Overhaul"/);
  });
});

test('hydrate complete marks a list-style .hydrate/ROADMAP.md entry (- [ ] **UOW-id**: ...) as [x] and logs to PROJECT_JOURNAL.md', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    fs.writeFileSync(
      path.join(dir, '.hydrate', 'ROADMAP.md'),
      '# Test Roadmap\n\n## Section 1: Scheduled Roadmap Items\n- [ ] **UOW-42**: Fixture Sprint\n- [ ] **UOW-43**: Later Sprint\n\n---\n\n## Section 2: Future features\n'
    );
    fs.writeFileSync(
      path.join(dir, '.hydrate', 'CURRENT_UOW.md'),
      '## UOW-42: Fixture\n- **Status:** IN_PROGRESS\n\n- [x] Task 42.1\n'
    );

    const result = runCli(['complete'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Marked UOW-42 as \[x\] in \.hydrate[\\/]ROADMAP\.md \(Iterated: 0\)/);
    assert.match(result.stdout, /Logged completion to \.hydrate[\\/]PROJECT_JOURNAL\.md/);

    const roadmap = fs.readFileSync(path.join(dir, '.hydrate', 'ROADMAP.md'), 'utf8');
    assert.match(roadmap, /- \[x\] \*\*UOW-42\*\*: Fixture Sprint \(Iterated: 0\)/);
    assert.match(roadmap, /- \[ \] \*\*UOW-43\*\*: Later Sprint/);

    const projectJournal = fs.readFileSync(path.join(dir, '.hydrate', 'PROJECT_JOURNAL.md'), 'utf8');
    assert.match(projectJournal, /### UOW-42 — completed \d{4}-\d{2}-\d{2}/);
    assert.match(projectJournal, /Suggested commit: `feat: complete UOW-42`/);
  });
});

test('hydrate complete logs a completion entry to .hydrate/PROJECT_JOURNAL.md even without a matching roadmap bullet', () => {
  withTempDir((dir) => {
    const uowBody = '## UOW-42: Fixture\n- **Status:** IN_PROGRESS\n\n- [x] Task 42.1\n';
    initAndPromptWithUow(dir, uowBody);

    const result = runCli(['complete'], dir);

    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /Marked UOW-42 as \[x\]/);
    assert.match(result.stdout, /Logged completion to \.hydrate[\\/]PROJECT_JOURNAL\.md/);

    const projectJournal = fs.readFileSync(path.join(dir, '.hydrate', 'PROJECT_JOURNAL.md'), 'utf8');
    assert.match(projectJournal, /### UOW-42 — completed \d{4}-\d{2}-\d{2}/);
  });
});

test('hydrate complete succeeds even when .hydrate/PROJECT_JOURNAL.md does not exist', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.hydrate'));
    fs.writeFileSync(
      path.join(dir, '.hydrate', 'CURRENT_UOW.md'),
      '## UOW-42: Fixture\n- **Status:** IN_PROGRESS\n\n- [x] Task 42.1\n'
    );

    const result = runCli(['complete'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /UOW-42 Officially Complete/);
    assert.doesNotMatch(result.stdout, /Logged completion to/);
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

// Multi-hyphenated UOW IDs -------------------------------------------------
// Regression coverage for the UOW-[\d\w]+ regex truncating hyphenated IDs
// (e.g. "UOW-HYDRATE-01" -> "UOW-HYDRATE") fixed in UOW-HYDRATE-01-HOTFIX.

for (const uowId of ['UOW-HYDRATE-01', 'UOW-HOTFIX-03', 'UOW-CARBOYZ-12']) {
  test(`hydrate complete preserves the full multi-hyphenated UOW ID "${uowId}" without truncation`, () => {
    withTempDir((dir) => {
      const uowBody = `## ${uowId}: Fixture\n- **Status:** IN_PROGRESS\n\n- [x] Task 1\n`;
      initAndPromptWithUow(dir, uowBody);

      const result = runCli(['complete'], dir);

      assert.equal(result.status, 0);
      assert.match(result.stdout, new RegExp(`${uowId} Officially Complete`));
      assert.match(result.stdout, new RegExp(`git commit -m "feat: complete ${uowId}"`));

      const archived = fs.readFileSync(path.join(dir, '.hydrate', 'archive', `${uowId}.md`), 'utf8');
      assert.equal(archived, uowBody);

      const projectJournal = fs.readFileSync(path.join(dir, '.hydrate', 'PROJECT_JOURNAL.md'), 'utf8');
      assert.match(projectJournal, new RegExp(`### ${uowId} — completed \\d{4}-\\d{2}-\\d{2}`));
    });
  });
}

test('hydrate complete marks a multi-hyphenated UOW ID as [x] in .hydrate/ROADMAP.md without truncation', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    fs.writeFileSync(
      path.join(dir, '.hydrate', 'ROADMAP.md'),
      '# Test Roadmap\n\n## Section 1: Scheduled Roadmap Items\n- [ ] **UOW-HYDRATE-01**: Scaffold Engine\n- [ ] **UOW-HYDRATE-02**: Later Sprint\n\n---\n\n## Section 2: Future features\n'
    );
    fs.writeFileSync(
      path.join(dir, '.hydrate', 'CURRENT_UOW.md'),
      '## UOW-HYDRATE-01: Fixture\n- **Status:** IN_PROGRESS\n\n- [x] Task 1\n'
    );

    const result = runCli(['complete'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Marked UOW-HYDRATE-01 as \[x\] in \.hydrate[\\/]ROADMAP\.md \(Iterated: 0\)/);

    const roadmap = fs.readFileSync(path.join(dir, '.hydrate', 'ROADMAP.md'), 'utf8');
    assert.match(roadmap, /- \[x\] \*\*UOW-HYDRATE-01\*\*: Scaffold Engine \(Iterated: 0\)/);
    assert.match(roadmap, /- \[ \] \*\*UOW-HYDRATE-02\*\*: Later Sprint/);
  });
});
