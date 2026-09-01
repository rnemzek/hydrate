const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hydrate-checkup-test-'));
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

// Blanks PATH so cli.js's internal `git`/`npm` spawnSync calls fail to
// resolve the binary at all (ENOENT), exercising the spawn-failure branch
// distinct from "ran but exited non-zero" / "not a git repo".
function runCliWithNoPath(args, cwd) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: 'utf8', cwd, env: { ...process.env, PATH: '' } });
}

function writeHydrateFile(dir, name, content) {
  fs.writeFileSync(path.join(dir, '.hydrate', name), content);
}

function writeArchivedUow(dir, uowId, content = `# ${uowId}: Fixture\n`) {
  fs.mkdirSync(path.join(dir, '.hydrate', 'archive'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.hydrate', 'archive', `${uowId}.md`), content);
}

function gitInit(dir) {
  spawnSync('git', ['init'], { cwd: dir });
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
}

function gitCommitAll(dir, message = 'commit') {
  spawnSync('git', ['add', '-A'], { cwd: dir });
  spawnSync('git', ['commit', '-m', message], { cwd: dir });
}

function writeTestScript(dir, exitCode) {
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '1.0.0', scripts: { test: `node -e "process.exit(${exitCode})"` } }, null, 2)
  );
}

test('hydrate checkup exits 1 with a descriptive error when .hydrate/ is missing', () => {
  withTempDir((dir) => {
    const result = runCli(['checkup'], dir);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /\.hydrate\/ directory not found/);
  });
});

test('hydrate checkup reports clean slate with pending roadmap items', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    writeHydrateFile(dir, 'ROADMAP.md', '# Roadmap\n\n- [ ] Ship the thing\n');

    const result = runCli(['checkup'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Ready for next task\. Pending items available in \.hydrate\/ROADMAP\.md\./);
  });
});

test('hydrate checkup reports clean slate with no pending roadmap items', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    writeHydrateFile(dir, 'ROADMAP.md', '# Roadmap\n');

    const result = runCli(['checkup'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /No pending items found in \.hydrate\/ROADMAP\.md yet\./);
  });
});

test('hydrate status is an alias for hydrate checkup', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    writeHydrateFile(dir, 'ROADMAP.md', '# Roadmap\n');

    const result = runCli(['status'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Ready for next task/);
  });
});

test('hydrate checkup reports a dirty working tree with remaining tasks', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    gitInit(dir);
    gitCommitAll(dir, 'initial');
    writeHydrateFile(dir, 'CURRENT_UOW.md', '## UOW-HYDRATE-99: Fixture\n- [x] Task 1\n- [ ] Task 2\n');

    const result = runCli(['checkup'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /UOW-HYDRATE-99 is in progress with 1 modified file and 1 task remaining\./);
    assert.match(result.stdout, /Modified files:/);
    assert.match(result.stdout, /CURRENT_UOW\.md/);
  });
});

test('hydrate checkup reports an in-progress UOW with a clean working tree', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    writeHydrateFile(dir, 'CURRENT_UOW.md', '## UOW-HYDRATE-99: Fixture\n- [x] Task 1\n- [ ] Task 2\n');
    gitInit(dir);
    gitCommitAll(dir, 'initial');

    const result = runCli(['checkup'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /UOW-HYDRATE-99 is in progress with 1 task remaining\. Working tree is clean\./);
  });
});

test('hydrate checkup reports complete-but-unarchived when every task is checked and tests pass', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    writeHydrateFile(dir, 'CURRENT_UOW.md', '## UOW-HYDRATE-99: Fixture\n- [x] Task 1\n- [x] Task 2\n');
    writeTestScript(dir, 0);

    const result = runCli(['checkup'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /UOW-HYDRATE-99 is complete but unarchived\. Run `hydrate complete` to archive\./);
  });
});

test('hydrate checkup reports a broken build when every task is checked but tests fail', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    writeHydrateFile(dir, 'CURRENT_UOW.md', '## UOW-HYDRATE-99: Fixture\n- [x] Task 1\n- [x] Task 2\n');
    writeTestScript(dir, 1);

    const result = runCli(['checkup'], dir);

    assert.equal(result.status, 1);
    assert.match(
      result.stdout,
      /UOW-HYDRATE-99 has every task checked off, but `npm test` is failing\. Fix the test suite before running `hydrate complete`\./
    );
  });
});

test('hydrate checkup treats a missing CURRENT_UOW.md file as a clean slate', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    fs.rmSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md'));
    fs.rmSync(path.join(dir, '.hydrate', 'ROADMAP.md'));

    const result = runCli(['checkup'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /No pending items found in \.hydrate\/ROADMAP\.md yet\./);
  });
});

test('hydrate checkup treats a whitespace-only CURRENT_UOW.md as a clean slate', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    writeHydrateFile(dir, 'CURRENT_UOW.md', '   \n\n  ');

    const result = runCli(['checkup'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Ready for next task/);
  });
});

test('hydrate checkup falls back to a generic label when no UOW ID is present', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    writeHydrateFile(dir, 'CURRENT_UOW.md', '## Untitled task\n- [ ] Do the thing\n');
    gitInit(dir);
    gitCommitAll(dir, 'initial');

    const result = runCli(['checkup'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /the active UOW is in progress with 1 task remaining\. Working tree is clean\./);
  });
});

test('hydrate checkup degrades gracefully when `git` itself cannot be spawned', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    writeHydrateFile(dir, 'CURRENT_UOW.md', '## UOW-HYDRATE-99: Fixture\n- [ ] Task 1\n');

    const result = runCliWithNoPath(['checkup'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /UOW-HYDRATE-99 is in progress with 1 task remaining\. Working tree is clean\./);
  });
});

test('hydrate checkup treats an unrunnable test suite as complete but unarchived', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    writeHydrateFile(dir, 'CURRENT_UOW.md', '## UOW-HYDRATE-99: Fixture\n- [x] Task 1\n');
    writeTestScript(dir, 0);

    const result = runCliWithNoPath(['checkup'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /UOW-HYDRATE-99 is complete but unarchived\. Run `hydrate complete` to archive\./);
  });
});

test('hydrate checkup does not re-flag a UOW that is already archived', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    writeArchivedUow(dir, 'UOW-HYDRATE-99');
    writeHydrateFile(dir, 'CURRENT_UOW.md', '## UOW-HYDRATE-99: Fixture\n- [x] Task 1\n');
    gitInit(dir);
    gitCommitAll(dir, 'initial');

    const result = runCli(['checkup'], dir);

    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /complete but unarchived/);
    assert.match(result.stdout, /UOW-HYDRATE-99 is in progress with 0 tasks remaining\. Working tree is clean\./);
  });
});
