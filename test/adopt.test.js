const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { Readable, Writable } = require('node:stream');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');
const {
  discoverLegacyFiles,
  parseSelectionInput,
  promptForSelection,
  adoptFiles,
  runAdopt,
  ensureGitignoreHygiene
} = require('../src/adopt');

function makeTempDir(prefix = 'hydrate-adopt-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function runCli(args, cwd, options = {}) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: 'utf8',
    cwd,
    input: options.input,
    env: { ...process.env, ...(options.env || {}) }
  });
}

// A readable stream that emits `text` then ends, for feeding readline
// without needing a real TTY or child process.
function inputStream(text) {
  return Readable.from([text]);
}

function nullOutputStream() {
  return new Writable({ write(chunk, enc, cb) { cb(); } });
}

// discoverLegacyFiles() ------------------------------------------------------

test('discoverLegacyFiles() finds known single-file heuristics', () => {
  const cwd = makeTempDir();
  try {
    fs.writeFileSync(path.join(cwd, '.cursorrules'), 'a');
    fs.writeFileSync(path.join(cwd, 'AGENTS.md'), 'b');
    fs.writeFileSync(path.join(cwd, 'CLAUDE.md'), 'c');
    fs.mkdirSync(path.join(cwd, '.github'));
    fs.writeFileSync(path.join(cwd, '.github', 'copilot-instructions.md'), 'd');

    const found = discoverLegacyFiles(cwd);
    const relPaths = found.map((f) => f.relPath).sort();

    assert.deepEqual(relPaths, [
      '.cursorrules',
      'AGENTS.md',
      'CLAUDE.md',
      path.join('.github', 'copilot-instructions.md')
    ].sort());
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('discoverLegacyFiles() recursively scans .claude/ and .codex/ for matching extensions', () => {
  const cwd = makeTempDir();
  try {
    fs.mkdirSync(path.join(cwd, '.claude', 'commands'), { recursive: true });
    fs.writeFileSync(path.join(cwd, '.claude', 'commands', 'foo.md'), 'claude cmd');
    fs.writeFileSync(path.join(cwd, '.claude', 'settings.json'), '{}'); // wrong extension, ignored

    fs.mkdirSync(path.join(cwd, '.codex'), { recursive: true });
    fs.writeFileSync(path.join(cwd, '.codex', 'notes.md'), 'codex notes');
    fs.writeFileSync(path.join(cwd, '.codex', 'config.yaml'), 'key: value');

    const found = discoverLegacyFiles(cwd);
    const relPaths = found.map((f) => f.relPath).sort();

    assert.deepEqual(relPaths, [
      path.join('.claude', 'commands', 'foo.md'),
      path.join('.codex', 'config.yaml'),
      path.join('.codex', 'notes.md')
    ].sort());
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('discoverLegacyFiles() excludes the merge target itself', () => {
  const cwd = makeTempDir();
  try {
    fs.writeFileSync(path.join(cwd, 'CONTEXT.md'), 'pre-existing target');
    fs.writeFileSync(path.join(cwd, '.cursorrules'), 'rules');

    const found = discoverLegacyFiles(cwd, { excludePath: path.join(cwd, 'CONTEXT.md') });

    assert.deepEqual(found.map((f) => f.relPath), ['.cursorrules']);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('discoverLegacyFiles() returns an empty array when nothing is present', () => {
  const cwd = makeTempDir();
  try {
    assert.deepEqual(discoverLegacyFiles(cwd), []);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

// parseSelectionInput() -------------------------------------------------------

test('parseSelectionInput() treats empty answer as "select all"', () => {
  assert.deepEqual(parseSelectionInput('', 3), [0, 1, 2]);
});

test('parseSelectionInput() supports "all"', () => {
  assert.deepEqual(parseSelectionInput('all', 3), [0, 1, 2]);
});

test('parseSelectionInput() supports "none"', () => {
  assert.deepEqual(parseSelectionInput('none', 3), []);
});

test('parseSelectionInput() parses comma-separated indices', () => {
  assert.deepEqual(parseSelectionInput('1,3', 3), [0, 2]);
});

test('parseSelectionInput() parses ranges', () => {
  assert.deepEqual(parseSelectionInput('1-3', 4), [0, 1, 2]);
});

test('parseSelectionInput() dedupes and sorts mixed indices/ranges', () => {
  assert.deepEqual(parseSelectionInput('3, 1-2, 2', 3), [0, 1, 2]);
});

test('parseSelectionInput() ignores out-of-range and garbage tokens', () => {
  assert.deepEqual(parseSelectionInput('0, 99, foo, 2', 3), [1]);
});

// promptForSelection() -- interactive fallback -------------------------------

test('promptForSelection() resolves to an empty array when there are no candidates', async () => {
  const selected = await promptForSelection([], { input: inputStream(''), output: nullOutputStream() });
  assert.deepEqual(selected, []);
});

test('promptForSelection() returns the chosen subset from a scripted answer', async () => {
  const candidates = [
    { relPath: 'a.md', absPath: '/a.md', sizeBytes: 1 },
    { relPath: 'b.md', absPath: '/b.md', sizeBytes: 2 },
    { relPath: 'c.md', absPath: '/c.md', sizeBytes: 3 }
  ];
  const selected = await promptForSelection(candidates, { input: inputStream('1,3\n'), output: nullOutputStream() });
  assert.deepEqual(selected.map((c) => c.relPath), ['a.md', 'c.md']);
});

test('promptForSelection() defaults to every candidate when the answer line is empty', async () => {
  const candidates = [
    { relPath: 'a.md', absPath: '/a.md', sizeBytes: 1 },
    { relPath: 'b.md', absPath: '/b.md', sizeBytes: 2 }
  ];
  const selected = await promptForSelection(candidates, { input: inputStream('\n'), output: nullOutputStream() });
  assert.deepEqual(selected.map((c) => c.relPath), ['a.md', 'b.md']);
});

test('promptForSelection() falls back to selecting everything if the input stream closes with no answer', async () => {
  const candidates = [
    { relPath: 'a.md', absPath: '/a.md', sizeBytes: 1 },
    { relPath: 'b.md', absPath: '/b.md', sizeBytes: 2 }
  ];
  // Empty stream: ends immediately without ever emitting a line.
  const selected = await promptForSelection(candidates, { input: inputStream(''), output: nullOutputStream() });
  assert.deepEqual(selected.map((c) => c.relPath), ['a.md', 'b.md']);
});

// adoptFiles() -- non-destructive merge + backup -----------------------------

test('adoptFiles() merges selected sources into the target without touching originals', () => {
  const cwd = makeTempDir();
  try {
    fs.writeFileSync(path.join(cwd, '.cursorrules'), 'Original cursor rules content.');
    const candidates = discoverLegacyFiles(cwd);

    const result = adoptFiles(cwd, candidates, { now: new Date('2026-01-01T00:00:00.000Z') });

    assert.equal(result.merged.length, 1);
    assert.equal(result.skipped.length, 0);
    assert.equal(result.written, true);

    // Original untouched.
    assert.equal(fs.readFileSync(path.join(cwd, '.cursorrules'), 'utf8'), 'Original cursor rules content.');

    // Target contains the merged content and the triad directives.
    const target = fs.readFileSync(path.join(cwd, 'CONTEXT.md'), 'utf8');
    assert.match(target, /Original cursor rules content\./);
    assert.match(target, /HYDRATE:TRIAD/);
    assert.match(target, /HYDRATE:ADOPTED source="\.cursorrules"/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('adoptFiles() backs up every merged original under .hydrate/backups/', () => {
  const cwd = makeTempDir();
  try {
    fs.writeFileSync(path.join(cwd, 'AGENTS.md'), 'Agent instructions.');
    const candidates = discoverLegacyFiles(cwd);

    const result = adoptFiles(cwd, candidates, { now: new Date('2026-02-02T00:00:00.000Z') });

    assert.equal(result.backups.length, 1);
    const backupPath = result.backups[0];
    assert.ok(backupPath.startsWith(path.join(cwd, '.hydrate', 'backups')));
    assert.equal(fs.readFileSync(backupPath, 'utf8'), 'Agent instructions.');
    // Original still present and unmodified alongside the backup.
    assert.equal(fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf8'), 'Agent instructions.');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('adoptFiles() is idempotent: re-running against an already-merged source skips it and makes no new backup', () => {
  const cwd = makeTempDir();
  try {
    fs.writeFileSync(path.join(cwd, '.cursorrules'), 'Rules content.');
    const candidates = discoverLegacyFiles(cwd);

    const first = adoptFiles(cwd, candidates, { now: new Date('2026-03-01T00:00:00.000Z') });
    assert.equal(first.merged.length, 1);

    const second = adoptFiles(cwd, candidates, { now: new Date('2026-03-02T00:00:00.000Z') });
    assert.equal(second.merged.length, 0);
    assert.deepEqual(second.skipped, ['.cursorrules']);
    assert.equal(second.backups.length, 0);

    // Only one backup timestamp directory should exist.
    const backupDirs = fs.readdirSync(path.join(cwd, '.hydrate', 'backups'));
    assert.equal(backupDirs.length, 1);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('adoptFiles() honors a custom target path', () => {
  const cwd = makeTempDir();
  try {
    fs.writeFileSync(path.join(cwd, '.cursorrules'), 'Custom target test.');
    const candidates = discoverLegacyFiles(cwd);

    const result = adoptFiles(cwd, candidates, { targetRelPath: path.join('docs', 'CONTEXT.md'), now: new Date('2026-04-01T00:00:00.000Z') });

    assert.equal(result.targetPath, path.join(cwd, 'docs', 'CONTEXT.md'));
    assert.ok(fs.existsSync(result.targetPath));
    assert.equal(fs.existsSync(path.join(cwd, 'CONTEXT.md')), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

// ensureGitignoreHygiene() ----------------------------------------------------

test('ensureGitignoreHygiene() creates .gitignore when missing', () => {
  const cwd = makeTempDir();
  try {
    const result = ensureGitignoreHygiene(cwd);

    assert.equal(result.created, true);
    assert.deepEqual(result.added.sort(), ['.hydrate/backups/', '.hydrate/session.json'].sort());

    const content = fs.readFileSync(path.join(cwd, '.gitignore'), 'utf8');
    assert.match(content, /\.hydrate\/backups\//);
    assert.match(content, /\.hydrate\/session\.json/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('ensureGitignoreHygiene() appends missing entries without touching existing lines', () => {
  const cwd = makeTempDir();
  try {
    fs.writeFileSync(path.join(cwd, '.gitignore'), 'node_modules/\n.hydrate/backups/\n');

    const result = ensureGitignoreHygiene(cwd);

    assert.equal(result.created, false);
    assert.deepEqual(result.added, ['.hydrate/session.json']);

    const content = fs.readFileSync(path.join(cwd, '.gitignore'), 'utf8');
    const lines = content.split('\n').filter(Boolean);
    assert.deepEqual(lines, ['node_modules/', '.hydrate/backups/', '.hydrate/session.json']);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('ensureGitignoreHygiene() is idempotent: re-running never duplicates entries', () => {
  const cwd = makeTempDir();
  try {
    ensureGitignoreHygiene(cwd);
    const first = fs.readFileSync(path.join(cwd, '.gitignore'), 'utf8');

    const second = ensureGitignoreHygiene(cwd);
    const contentAfterSecond = fs.readFileSync(path.join(cwd, '.gitignore'), 'utf8');

    assert.equal(second.added.length, 0);
    assert.equal(contentAfterSecond, first);

    const occurrences = contentAfterSecond.split('\n').filter((l) => l.trim() === '.hydrate/backups/').length;
    assert.equal(occurrences, 1);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('ensureGitignoreHygiene() handles a .gitignore with no trailing newline', () => {
  const cwd = makeTempDir();
  try {
    fs.writeFileSync(path.join(cwd, '.gitignore'), 'dist/');

    ensureGitignoreHygiene(cwd);

    const content = fs.readFileSync(path.join(cwd, '.gitignore'), 'utf8');
    const lines = content.split('\n').filter(Boolean);
    assert.deepEqual(lines, ['dist/', '.hydrate/backups/', '.hydrate/session.json']);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

// Git hygiene check: hydrate adopt must never touch in-flight repo changes ---

test('hydrate adopt leaves uncommitted/untracked changes completely untouched', () => {
  const cwd = makeTempDir();
  try {
    spawnSync('git', ['init'], { cwd, encoding: 'utf8' });
    fs.writeFileSync(path.join(cwd, 'work-in-progress.js'), 'const wip = true;\n');
    fs.writeFileSync(path.join(cwd, '.cursorrules'), 'rules');

    const result = runCli(['adopt', '--all'], cwd);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /uncommitted\/untracked change\(s\) detected/);
    assert.match(result.stdout, /will remain completely untouched/);
    // The uncommitted file is reported, never modified or removed.
    assert.equal(
      fs.readFileSync(path.join(cwd, 'work-in-progress.js'), 'utf8'),
      'const wip = true;\n'
    );
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('hydrate adopt reports a clean working tree when there are no changes', () => {
  const cwd = makeTempDir();
  try {
    spawnSync('git', ['init'], { cwd, encoding: 'utf8' });

    const result = runCli(['adopt'], cwd, { input: '' });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /working tree clean/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('hydrate adopt skips the git hygiene check gracefully outside a git repo', () => {
  const cwd = makeTempDir();
  try {
    const result = runCli(['adopt'], cwd, { input: '' });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /not a repository \(or git unavailable\)/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

// runAdopt() -- end-to-end orchestration --------------------------------------

test('runAdopt() with no discovered files still guarantees canonical ROADMAP.md/.hydrate/CURRENT_UOW.md', async () => {
  const cwd = makeTempDir();
  try {
    const summary = await runAdopt({ cwd, output: nullOutputStream(), input: inputStream('') });

    assert.deepEqual(summary.candidates, []);
    assert.ok(fs.existsSync(path.join(cwd, 'ROADMAP.md')));
    assert.ok(fs.existsSync(path.join(cwd, '.hydrate', 'CURRENT_UOW.md')));
    assert.equal(fs.existsSync(path.join(cwd, 'CONTEXT.md')), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('runAdopt() with { all: true } merges every discovered file without prompting', async () => {
  const cwd = makeTempDir();
  try {
    fs.writeFileSync(path.join(cwd, '.cursorrules'), 'r');
    fs.writeFileSync(path.join(cwd, 'AGENTS.md'), 'a');

    const summary = await runAdopt({ cwd, all: true, output: nullOutputStream() });

    assert.equal(summary.mergeResult.merged.length, 2);
    assert.ok(fs.existsSync(path.join(cwd, 'CONTEXT.md')));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

// CLI-level integration -------------------------------------------------------

test('hydrate adopt --all merges discovered legacy files end-to-end', () => {
  const cwd = makeTempDir();
  try {
    fs.writeFileSync(path.join(cwd, '.cursorrules'), 'CLI cursor rules.');
    fs.writeFileSync(path.join(cwd, 'AGENTS.md'), 'CLI agent rules.');

    const result = runCli(['adopt', '--all'], cwd);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Brownfield Adoption Complete/);
    assert.match(result.stdout, /Merged 2 file\(s\)/);

    const target = fs.readFileSync(path.join(cwd, 'CONTEXT.md'), 'utf8');
    assert.match(target, /CLI cursor rules\./);
    assert.match(target, /CLI agent rules\./);
    assert.ok(fs.existsSync(path.join(cwd, 'ROADMAP.md')));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('hydrate adopt (interactive) respects a piped stdin selection', () => {
  const cwd = makeTempDir();
  try {
    fs.writeFileSync(path.join(cwd, '.cursorrules'), 'first');
    fs.writeFileSync(path.join(cwd, 'AGENTS.md'), 'second');

    const result = runCli(['adopt'], cwd, { input: '1\n' });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Legacy AI context files discovered/);
    assert.match(result.stdout, /Merged 1 file\(s\)/);

    const target = fs.readFileSync(path.join(cwd, 'CONTEXT.md'), 'utf8');
    assert.match(target, /first/);
    assert.doesNotMatch(target, /second/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('hydrate adopt reports cleanly when nothing is discovered', () => {
  const cwd = makeTempDir();
  try {
    const result = runCli(['adopt'], cwd, { input: '' });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /No legacy AI context files detected/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('hydrate adopt --target=<path> writes to the custom target', () => {
  const cwd = makeTempDir();
  try {
    fs.writeFileSync(path.join(cwd, '.cursorrules'), 'target test');

    const result = runCli(['adopt', '--all', '--target=docs/CONTEXT.md'], cwd);

    assert.equal(result.status, 0);
    assert.ok(fs.existsSync(path.join(cwd, 'docs', 'CONTEXT.md')));
    assert.equal(fs.existsSync(path.join(cwd, 'CONTEXT.md')), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
