const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');
const { buildContext, extractRecentArchitectEntries, extractActiveEpics } = require('../src/commands/context');

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function runCli(args, cwd, extraEnv = {}) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: 'utf8',
    cwd,
    env: { ...process.env, ...extraEnv }
  });
}

function writeHydrateFile(dir, name, content) {
  fs.mkdirSync(path.join(dir, '.hydrate'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.hydrate', name), content);
}

// Writes a fake clipboard binary that dumps stdin to `outFile` (mirrors
// clipboard.test.js's approach for exercising the real piping path without
// touching the actual system clipboard).
function makeFakeClipboardBin(dir, name, outFile) {
  const binPath = path.join(dir, name);
  const script = `#!/usr/bin/env node
const fs = require('fs');
let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { data += chunk; });
process.stdin.on('end', () => { fs.writeFileSync(${JSON.stringify(outFile)}, data); });
`;
  fs.writeFileSync(binPath, script, { mode: 0o755 });
  return binPath;
}

function architectEntry(id, n) {
  return `### ${id} — completed 2026-09-0${n}\n- decision ${n}\n`;
}

// extractRecentArchitectEntries() --------------------------------------------

test('extractRecentArchitectEntries() returns [] for null/empty input', () => {
  assert.deepEqual(extractRecentArchitectEntries(null, 3), []);
  assert.deepEqual(extractRecentArchitectEntries('', 3), []);
});

test('extractRecentArchitectEntries() returns [] when depth is 0', () => {
  const text = architectEntry('UOW-01', 1);
  assert.deepEqual(extractRecentArchitectEntries(text, 0), []);
});

test('extractRecentArchitectEntries() returns only the tail `depth` entries', () => {
  const text = [architectEntry('UOW-01', 1), architectEntry('UOW-02', 2), architectEntry('UOW-03', 3)].join('\n');
  const entries = extractRecentArchitectEntries(text, 2);
  assert.equal(entries.length, 2);
  assert.match(entries[0], /UOW-02/);
  assert.match(entries[1], /UOW-03/);
});

test('extractRecentArchitectEntries() returns all entries when depth exceeds the count', () => {
  const text = architectEntry('UOW-01', 1);
  const entries = extractRecentArchitectEntries(text, 10);
  assert.equal(entries.length, 1);
});

test('extractRecentArchitectEntries() ignores content before the first "### " heading', () => {
  const text = `# Architect Journal\nsome preamble\n${architectEntry('UOW-01', 1)}`;
  const entries = extractRecentArchitectEntries(text, 3);
  assert.equal(entries.length, 1);
  assert.match(entries[0], /^### UOW-01/);
});

// extractActiveEpics() -------------------------------------------------------

test('extractActiveEpics() returns null for null input', () => {
  assert.equal(extractActiveEpics(null), null);
});

test('extractActiveEpics() extracts the "## Section 1" block, stopping at the next "## " heading', () => {
  const text = '# Roadmap\n\n## Section 1: Scheduled Roadmap Items\n- [ ] UOW-10: Thing\n\n## Section 2: Future features\n- idea\n';
  const result = extractActiveEpics(text);
  assert.match(result, /Section 1: Scheduled Roadmap Items/);
  assert.match(result, /UOW-10: Thing/);
  assert.doesNotMatch(result, /Section 2/);
});

test('extractActiveEpics() falls back to the full trimmed text when no "## Section 1" heading exists', () => {
  const text = '# Roadmap\n\nno sections here\n';
  assert.equal(extractActiveEpics(text), text.trim());
});

// buildContext() --------------------------------------------------------------

test('buildContext() reports fallback notices when .hydrate/ is empty', () => {
  const dir = makeTempDir('hydrate-context-empty-');
  try {
    const text = buildContext(dir, { depth: 3 });
    assert.match(text, /No active UOW assigned\. Run `hydrate prompt` to load one\./);
    assert.match(text, /No architectural journal entries found\./);
    assert.match(text, /No \.hydrate\/ROADMAP\.md found\./);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('buildContext() compiles the header, active scope, architectural context and roadmap', () => {
  const dir = makeTempDir('hydrate-context-full-');
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: '@acme/widgets' }));
    writeHydrateFile(dir, 'CURRENT_UOW.md', '## UOW-77: Fixture\n- **Status:** IN_PROGRESS\n');
    writeHydrateFile(
      dir,
      'ARCHITECT_JOURNAL.md',
      [architectEntry('UOW-01', 1), architectEntry('UOW-02', 2), architectEntry('UOW-03', 3), architectEntry('UOW-04', 4)].join('\n')
    );
    writeHydrateFile(
      dir,
      'ROADMAP.md',
      '# Roadmap\n\n## Section 1: Scheduled Roadmap Items\n- [ ] UOW-99: Next thing\n\n## Section 2: Future features\n- idea\n'
    );

    const text = buildContext(dir, { depth: 3 });

    assert.match(text, /# HYDRATE CONTEXT COMPILATION/);
    assert.match(text, /Project: @acme\/widgets/);
    assert.match(text, /UOW-77: Fixture/);
    assert.doesNotMatch(text, /UOW-01 — completed/);
    assert.match(text, /UOW-02 — completed/);
    assert.match(text, /UOW-03 — completed/);
    assert.match(text, /UOW-04 — completed/);
    assert.match(text, /UOW-99: Next thing/);
    assert.doesNotMatch(text, /Section 2/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('buildContext() treats a whitespace-only CURRENT_UOW.md as unassigned', () => {
  const dir = makeTempDir('hydrate-context-blank-uow-');
  try {
    writeHydrateFile(dir, 'CURRENT_UOW.md', '   \n\n');
    const text = buildContext(dir, { depth: 3 });
    assert.match(text, /No active UOW assigned/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// CLI-level: `hydrate context` -------------------------------------------------

test('hydrate context prints a structured payload to stdout', () => {
  const dir = makeTempDir('hydrate-context-cli-');
  try {
    runCli(['init'], dir);
    writeHydrateFile(dir, 'CURRENT_UOW.md', '## UOW-42: Fixture\n- **Status:** IN_PROGRESS\n');

    const result = runCli(['context'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /HYDRATE CONTEXT COMPILATION/);
    assert.match(result.stdout, /UOW-42: Fixture/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('hydrate context --depth limits how many architect journal entries are pulled', () => {
  const dir = makeTempDir('hydrate-context-depth-');
  try {
    runCli(['init'], dir);
    writeHydrateFile(
      dir,
      'ARCHITECT_JOURNAL.md',
      [architectEntry('UOW-01', 1), architectEntry('UOW-02', 2), architectEntry('UOW-03', 3)].join('\n')
    );

    const result = runCli(['context', '--depth', '1'], dir);

    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /UOW-01 — completed/);
    assert.doesNotMatch(result.stdout, /UOW-02 — completed/);
    assert.match(result.stdout, /UOW-03 — completed/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('hydrate context --depth=<n> (equals form) also limits entries', () => {
  const dir = makeTempDir('hydrate-context-depth-eq-');
  try {
    runCli(['init'], dir);
    writeHydrateFile(
      dir,
      'ARCHITECT_JOURNAL.md',
      [architectEntry('UOW-01', 1), architectEntry('UOW-02', 2)].join('\n')
    );

    const result = runCli(['context', '--depth=1'], dir);

    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /UOW-01 — completed/);
    assert.match(result.stdout, /UOW-02 — completed/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('hydrate context ignores an invalid --depth and falls back to the default', () => {
  const dir = makeTempDir('hydrate-context-depth-invalid-');
  try {
    runCli(['init'], dir);
    const result = runCli(['context', '--depth', 'banana'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /last 3\)/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('hydrate context reports fallback notices on a bare .hydrate/ directory', () => {
  const dir = makeTempDir('hydrate-context-bare-');
  try {
    runCli(['init'], dir);
    // hydrate init seeds CURRENT_UOW.md with the "All UOWs are complete!" placeholder.
    const result = runCli(['context'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /All UOWs are complete!/);
    assert.match(result.stdout, /No architectural journal entries found\./);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('hydrate context --clip copies the compiled payload to the clipboard', { skip: process.platform === 'win32' }, () => {
  const dir = makeTempDir('hydrate-context-clip-');
  const binDir = makeTempDir('hydrate-fakebin-');
  const outDir = makeTempDir('hydrate-clipout-');
  const outFile = path.join(outDir, 'clipboard.txt');
  try {
    runCli(['init'], dir);
    writeHydrateFile(dir, 'CURRENT_UOW.md', '## UOW-42: Fixture\n');

    const binName = process.platform === 'darwin' ? 'pbcopy' : 'xclip';
    makeFakeClipboardBin(binDir, binName, outFile);

    const result = runCli(['context', '--clip'], dir, { PATH: `${binDir}${path.delimiter}${process.env.PATH}` });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /HYDRATE CONTEXT COMPILATION/);
    assert.doesNotMatch(result.stdout, /No clipboard tool found/);
    assert.ok(fs.existsSync(outFile), 'expected clipboard tool to receive the payload');
    assert.match(fs.readFileSync(outFile, 'utf8'), /HYDRATE CONTEXT COMPILATION/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('hydrate context -c is a short alias for --clip', { skip: process.platform === 'win32' }, () => {
  const dir = makeTempDir('hydrate-context-clip-short-');
  const binDir = makeTempDir('hydrate-fakebin-');
  const outDir = makeTempDir('hydrate-clipout-');
  const outFile = path.join(outDir, 'clipboard.txt');
  try {
    runCli(['init'], dir);
    const binName = process.platform === 'darwin' ? 'pbcopy' : 'xclip';
    makeFakeClipboardBin(binDir, binName, outFile);

    const result = runCli(['context', '-c'], dir, { PATH: `${binDir}${path.delimiter}${process.env.PATH}` });

    assert.equal(result.status, 0);
    assert.ok(fs.existsSync(outFile), 'expected clipboard tool to receive the payload');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('hydrate context --clip prints a "no clipboard tool" notice without reprinting the payload', () => {
  const dir = makeTempDir('hydrate-context-clip-fallback-');
  try {
    runCli(['init'], dir);
    const result = runCli(['context', '--clip'], dir, { PATH: '' });

    assert.equal(result.status, 0);
    const occurrences = result.stdout.split('HYDRATE CONTEXT COMPILATION').length - 1;
    assert.equal(occurrences, 1);
    assert.match(result.stdout, /No clipboard tool found/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('hydrate context without --clip does not touch the clipboard tool', { skip: process.platform === 'win32' }, () => {
  const dir = makeTempDir('hydrate-context-noclip-');
  const binDir = makeTempDir('hydrate-fakebin-');
  const outDir = makeTempDir('hydrate-clipout-');
  const outFile = path.join(outDir, 'clipboard.txt');
  try {
    runCli(['init'], dir);
    const binName = process.platform === 'darwin' ? 'pbcopy' : 'xclip';
    makeFakeClipboardBin(binDir, binName, outFile);

    const result = runCli(['context'], dir, { PATH: `${binDir}${path.delimiter}${process.env.PATH}` });

    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /Copied UOW context to clipboard/);
    assert.equal(fs.existsSync(outFile), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('hydrate context --help shows subcommand help without mutating .hydrate/', () => {
  const dir = makeTempDir('hydrate-context-help-');
  try {
    const result = runCli(['context', '--help'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /hydrate context/);
    assert.match(result.stdout, /--clip/);
    assert.equal(fs.existsSync(path.join(dir, '.hydrate')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
