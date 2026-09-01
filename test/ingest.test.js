const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable, Writable } = require('node:stream');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');
const {
  runIngest,
  isValidUowPayload,
  isEmptyUow,
  extractUowId,
  renderBanner
} = require('../src/commands/ingest');

const VALID_UOW = `# UOW-TEST-01: Sample

## 1. Goal & Context
Do the thing.

## 2. Surgical Scope & Requirements
- Do it surgically.

## 4. Acceptance Criteria
1. It works.
`;

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hydrate-ingest-test-'));
}

async function withTempDir(fn) {
  const dir = makeTempDir();
  try {
    await fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function currentUowPath(dir) {
  return path.join(dir, '.hydrate', 'CURRENT_UOW.md');
}

function writeCurrentUow(dir, content) {
  fs.mkdirSync(path.join(dir, '.hydrate'), { recursive: true });
  fs.writeFileSync(currentUowPath(dir), content, 'utf8');
}

// A readable stream that immediately yields `answer` (newline-terminated,
// as readline expects) then ends — used to drive runIngest()'s interactive
// prompt without a real TTY.
function answerStream(answer) {
  return Readable.from([`${answer}\n`]);
}

// Swallows writes so the interactive banner/prompt text doesn't hit the
// real terminal during tests.
function nullOutput() {
  return new Writable({ write(_chunk, _enc, cb) { cb(); } });
}

function collectLogs() {
  const lines = [];
  return { lines, log: (msg) => lines.push(String(msg)), error: (msg) => lines.push(String(msg)) };
}

// Pure helpers -----------------------------------------------------------

test('isValidUowPayload() accepts a well-formed UOW spec', () => {
  assert.equal(isValidUowPayload(VALID_UOW), true);
});

test('isValidUowPayload() rejects empty/blank content', () => {
  assert.equal(isValidUowPayload(''), false);
  assert.equal(isValidUowPayload('   \n  '), false);
  assert.equal(isValidUowPayload(null), false);
});

test('isValidUowPayload() rejects text with a UOW header but no section marker', () => {
  assert.equal(isValidUowPayload('# UOW-99: Just a title\nNo real sections here.'), false);
});

test('isValidUowPayload() rejects text with a section marker but no UOW header', () => {
  assert.equal(isValidUowPayload('## Acceptance Criteria\n1. Works.'), false);
});

test('isValidUowPayload() rejects unrelated clipboard text', () => {
  assert.equal(isValidUowPayload('just some random text I copied'), false);
});

test('isEmptyUow() treats missing/blank/placeholder content as empty', () => {
  assert.equal(isEmptyUow(''), true);
  assert.equal(isEmptyUow(null), true);
  assert.equal(isEmptyUow('   '), true);
  assert.equal(isEmptyUow("# All UOWs are complete!\nRun 'hydrate prompt' when ready for next task."), true);
});

test('isEmptyUow() treats an active UOW payload as non-empty', () => {
  assert.equal(isEmptyUow(VALID_UOW), false);
});

test('extractUowId() pulls the UOW id out of a payload', () => {
  assert.equal(extractUowId(VALID_UOW), 'UOW-TEST-01');
});

test('extractUowId() returns null when no UOW id is present', () => {
  assert.equal(extractUowId('no id here'), null);
  assert.equal(extractUowId(''), null);
});

test('renderBanner() renders the HYDRATE ENGINE identity', () => {
  assert.match(renderBanner(), /HYDRATE ENGINE/);
});

// runIngest() — direct, dependency-injected -------------------------------

test('runIngest() errors and exits 1 when no clipboard tool is found', async () => {
  await withTempDir(async (dir) => {
    const { lines, error } = collectLogs();
    const result = await runIngest(dir, { readClipboard: () => null, error });
    assert.equal(result.code, 1);
    assert.equal(result.action, 'no-clipboard-tool');
    assert.match(lines.join('\n'), /Unable to read the system clipboard/);
  });
});

test('runIngest() rejects non-UOW clipboard content without touching CURRENT_UOW.md', async () => {
  await withTempDir(async (dir) => {
    writeCurrentUow(dir, VALID_UOW);
    const { lines, error } = collectLogs();
    const result = await runIngest(dir, { readClipboard: () => 'not a uow at all', error });

    assert.equal(result.code, 1);
    assert.equal(result.action, 'rejected-invalid-payload');
    assert.match(lines.join('\n'), /does not resemble a valid UOW spec/);
    assert.equal(fs.readFileSync(currentUowPath(dir), 'utf8'), VALID_UOW);
  });
});

test('runIngest() --yes applies directly when CURRENT_UOW.md is empty', async () => {
  await withTempDir(async (dir) => {
    writeCurrentUow(dir, "# All UOWs are complete!\nRun 'hydrate prompt' when ready for next task.");
    const { lines, log } = collectLogs();

    const result = await runIngest(dir, { yes: true, readClipboard: () => VALID_UOW, log });

    assert.equal(result.code, 0);
    assert.equal(result.action, 'applied');
    assert.equal(fs.readFileSync(currentUowPath(dir), 'utf8'), VALID_UOW);
    assert.equal(fs.existsSync(path.join(dir, '.hydrate', 'archive')), false);
    assert.match(lines.join('\n'), /applied to \.hydrate\/CURRENT_UOW\.md/);
  });
});

test('runIngest() --yes archives the active UOW then swaps in the clipboard payload', async () => {
  await withTempDir(async (dir) => {
    writeCurrentUow(dir, '# UOW-OLD-01: In progress\n## Goal & Context\nStill working.\n');
    const { log } = collectLogs();

    const result = await runIngest(dir, { yes: true, readClipboard: () => VALID_UOW, log });

    assert.equal(result.code, 0);
    assert.equal(result.action, 'archived-and-swapped');
    assert.equal(fs.readFileSync(currentUowPath(dir), 'utf8'), VALID_UOW);
    const archived = fs.readFileSync(path.join(dir, '.hydrate', 'archive', 'UOW-OLD-01.md'), 'utf8');
    assert.match(archived, /In progress/);
  });
});

test('runIngest() empty-state interactive [1] applies the clipboard payload', async () => {
  await withTempDir(async (dir) => {
    writeCurrentUow(dir, '');
    const { log } = collectLogs();

    const result = await runIngest(dir, {
      readClipboard: () => VALID_UOW,
      input: answerStream('1'),
      output: nullOutput(),
      log
    });

    assert.equal(result.code, 0);
    assert.equal(result.action, 'applied');
    assert.equal(fs.readFileSync(currentUowPath(dir), 'utf8'), VALID_UOW);
  });
});

test('runIngest() empty-state interactive [2] hands off to chat without writing', async () => {
  await withTempDir(async (dir) => {
    writeCurrentUow(dir, '');
    const { lines, log } = collectLogs();

    const result = await runIngest(dir, {
      readClipboard: () => VALID_UOW,
      input: answerStream('2'),
      output: nullOutput(),
      log
    });

    assert.equal(result.code, 0);
    assert.equal(result.action, 'chat-exit');
    assert.equal(fs.readFileSync(currentUowPath(dir), 'utf8'), '');
    assert.match(lines.join('\n'), /Handing off to AI Architect/);
  });
});

test('runIngest() active-state interactive [1] archives current and swaps in the clipboard payload', async () => {
  await withTempDir(async (dir) => {
    writeCurrentUow(dir, '# UOW-OLD-02: In progress\n## Surgical Scope\nStuff.\n');
    const { log } = collectLogs();

    const result = await runIngest(dir, {
      readClipboard: () => VALID_UOW,
      input: answerStream('1'),
      output: nullOutput(),
      log
    });

    assert.equal(result.code, 0);
    assert.equal(result.action, 'archived-and-swapped');
    assert.equal(fs.readFileSync(currentUowPath(dir), 'utf8'), VALID_UOW);
    assert.ok(fs.existsSync(path.join(dir, '.hydrate', 'archive', 'UOW-OLD-02.md')));
  });
});

test('runIngest() active-state interactive [2] overwrites current UOW without archiving', async () => {
  await withTempDir(async (dir) => {
    writeCurrentUow(dir, '# UOW-OLD-03: In progress\n## Acceptance Criteria\n1. Stuff.\n');
    const { log } = collectLogs();

    const result = await runIngest(dir, {
      readClipboard: () => VALID_UOW,
      input: answerStream('2'),
      output: nullOutput(),
      log
    });

    assert.equal(result.code, 0);
    assert.equal(result.action, 'overwritten');
    assert.equal(fs.readFileSync(currentUowPath(dir), 'utf8'), VALID_UOW);
    assert.equal(fs.existsSync(path.join(dir, '.hydrate', 'archive', 'UOW-OLD-03.md')), false);
  });
});

test('runIngest() active-state interactive [3] hands off to chat, leaving CURRENT_UOW.md untouched', async () => {
  await withTempDir(async (dir) => {
    const original = '# UOW-OLD-04: In progress\n## Goal & Context\nStuff.\n';
    writeCurrentUow(dir, original);
    const { lines, log } = collectLogs();

    const result = await runIngest(dir, {
      readClipboard: () => VALID_UOW,
      input: answerStream('3'),
      output: nullOutput(),
      log
    });

    assert.equal(result.code, 0);
    assert.equal(result.action, 'chat-exit');
    assert.equal(fs.readFileSync(currentUowPath(dir), 'utf8'), original);
    assert.match(lines.join('\n'), /Handing off to AI Architect/);
  });
});

test('runIngest() active-state interactive falls back to chat-exit on an unrecognized answer', async () => {
  await withTempDir(async (dir) => {
    const original = '# UOW-OLD-05: In progress\n## Goal & Context\nStuff.\n';
    writeCurrentUow(dir, original);
    const { log } = collectLogs();

    const result = await runIngest(dir, {
      readClipboard: () => VALID_UOW,
      input: answerStream('nonsense'),
      output: nullOutput(),
      log
    });

    assert.equal(result.code, 0);
    assert.equal(result.action, 'chat-exit');
    assert.equal(fs.readFileSync(currentUowPath(dir), 'utf8'), original);
  });
});

test('runIngest() archives an active UOW with no recoverable id under a synthesized name', async () => {
  await withTempDir(async (dir) => {
    writeCurrentUow(dir, '## Goal & Context\nMystery work with no id header.\n');
    const { log } = collectLogs();

    const result = await runIngest(dir, { yes: true, readClipboard: () => VALID_UOW, log });

    assert.equal(result.code, 0);
    assert.equal(result.action, 'archived-and-swapped');
    const archiveDir = path.join(dir, '.hydrate', 'archive');
    const archived = fs.readdirSync(archiveDir);
    assert.equal(archived.length, 1);
    assert.match(archived[0], /^UOW-UNKNOWN-\d+\.md$/);
  });
});

// CLI-level wiring ---------------------------------------------------------

function runCli(args, cwd, extraEnv = {}, input) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: 'utf8',
    cwd,
    input,
    env: { ...process.env, ...extraEnv }
  });
}

function makeFakeClipboardReadBin(dir, name, text) {
  const binPath = path.join(dir, name);
  const script = `#!/usr/bin/env node\nprocess.stdout.write(${JSON.stringify(text)});\n`;
  fs.writeFileSync(binPath, script, { mode: 0o755 });
  return binPath;
}

test('hydrate ingest --yes wires through the CLI end-to-end', { skip: process.platform === 'win32' }, () => {
  return withTempDir((dir) => {
    const binDir = makeTempDir();
    try {
      runCli(['init'], dir);
      const binName = process.platform === 'darwin' ? 'pbpaste' : 'xclip';
      makeFakeClipboardReadBin(binDir, binName, VALID_UOW);

      const result = runCli(['ingest', '--yes'], dir, { PATH: `${binDir}${path.delimiter}${process.env.PATH}` });

      assert.equal(result.status, 0);
      assert.match(result.stdout, /HYDRATE ENGINE/);
      assert.equal(fs.readFileSync(currentUowPath(dir), 'utf8'), VALID_UOW);
    } finally {
      fs.rmSync(binDir, { recursive: true, force: true });
    }
  });
});

test('hydrate paste is an alias for hydrate ingest', { skip: process.platform === 'win32' }, () => {
  return withTempDir((dir) => {
    const binDir = makeTempDir();
    try {
      runCli(['init'], dir);
      const binName = process.platform === 'darwin' ? 'pbpaste' : 'xclip';
      makeFakeClipboardReadBin(binDir, binName, VALID_UOW);

      const result = runCli(['paste', '-y'], dir, { PATH: `${binDir}${path.delimiter}${process.env.PATH}` });

      assert.equal(result.status, 0);
      assert.equal(fs.readFileSync(currentUowPath(dir), 'utf8'), VALID_UOW);
    } finally {
      fs.rmSync(binDir, { recursive: true, force: true });
    }
  });
});

test('hydrate ingest exits 1 and leaves CURRENT_UOW.md untouched when the clipboard has no clipboard tool', () => {
  return withTempDir((dir) => {
    runCli(['init'], dir);
    const before = fs.readFileSync(currentUowPath(dir), 'utf8');

    const result = runCli(['ingest'], dir, { PATH: '' });

    assert.equal(result.status, 1);
    assert.match(result.stdout + result.stderr, /Unable to read the system clipboard/);
    assert.equal(fs.readFileSync(currentUowPath(dir), 'utf8'), before);
  });
});

test('hydrate ingest reports an unexpected error and exits 1', { skip: process.platform === 'win32' }, () => {
  return withTempDir((dir) => {
    const binDir = makeTempDir();
    try {
      // A plain file at .hydrate (not a directory) makes applyClipboardPayload's
      // mkdirSync(..., { recursive: true }) throw, exercising handleIngest's
      // catch() branch in bin/cli.js instead of the normal success/reject paths.
      fs.writeFileSync(path.join(dir, '.hydrate'), 'not a directory');
      const binName = process.platform === 'darwin' ? 'pbpaste' : 'xclip';
      makeFakeClipboardReadBin(binDir, binName, VALID_UOW);

      const result = runCli(['ingest', '--yes'], dir, { PATH: `${binDir}${path.delimiter}${process.env.PATH}` });

      assert.equal(result.status, 1);
      assert.match(result.stderr, /❌ Error:/);
    } finally {
      fs.rmSync(binDir, { recursive: true, force: true });
    }
  });
});

test('hydrate ingest --help prints command help', () => {
  return withTempDir((dir) => {
    const result = runCli(['ingest', '--help'], dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /hydrate ingest/);
  });
});
