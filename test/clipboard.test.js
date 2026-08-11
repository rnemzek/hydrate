const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');
const { copyToClipboard, candidatesForPlatform } = require('../src/clipboard');

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

// Writes a fake clipboard binary that dumps stdin to `outFile`, so tests can
// exercise the real child_process piping path without touching the actual
// system clipboard.
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

// candidatesForPlatform() ----------------------------------------------------

test('candidatesForPlatform() returns pbcopy on darwin', () => {
  assert.deepEqual(candidatesForPlatform('darwin'), [{ cmd: 'pbcopy', args: [] }]);
});

test('candidatesForPlatform() returns clip on win32', () => {
  assert.deepEqual(candidatesForPlatform('win32'), [{ cmd: 'clip', args: [] }]);
});

test('candidatesForPlatform() tries xclip before xsel on linux', () => {
  const candidates = candidatesForPlatform('linux');
  assert.equal(candidates[0].cmd, 'xclip');
  assert.equal(candidates[1].cmd, 'xsel');
});

test('candidatesForPlatform() returns no candidates for an unknown platform', () => {
  assert.deepEqual(candidatesForPlatform('freebsd'), []);
});

// copyToClipboard() with an injected fake `spawn` ----------------------------

test('copyToClipboard() returns true when the platform tool succeeds', () => {
  const calls = [];
  const fakeSpawn = (cmd, args, opts) => {
    calls.push({ cmd, args, input: opts.input });
    return { status: 0, error: null };
  };
  const result = copyToClipboard('hello UOW', { platform: 'darwin', spawn: fakeSpawn });
  assert.equal(result, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, 'pbcopy');
  assert.equal(calls[0].input, 'hello UOW');
});

test('copyToClipboard() falls through to the next candidate on linux when the first is missing', () => {
  const calls = [];
  const fakeSpawn = (cmd) => {
    calls.push(cmd);
    if (cmd === 'xclip') return { status: null, error: { code: 'ENOENT' } };
    if (cmd === 'xsel') return { status: 0, error: null };
    return { status: 1, error: null };
  };
  const result = copyToClipboard('payload', { platform: 'linux', spawn: fakeSpawn });
  assert.equal(result, true);
  assert.deepEqual(calls, ['xclip', 'xsel']);
});

test('copyToClipboard() returns false when every candidate is missing', () => {
  const fakeSpawn = () => ({ status: null, error: { code: 'ENOENT' } });
  const result = copyToClipboard('payload', { platform: 'linux', spawn: fakeSpawn });
  assert.equal(result, false);
});

test('copyToClipboard() returns false when the tool exists but exits non-zero', () => {
  const fakeSpawn = () => ({ status: 1, error: null });
  const result = copyToClipboard('payload', { platform: 'darwin', spawn: fakeSpawn });
  assert.equal(result, false);
});

test('copyToClipboard() returns false on a platform with no known clipboard tool', () => {
  const fakeSpawn = () => ({ status: 0, error: null });
  const result = copyToClipboard('payload', { platform: 'freebsd', spawn: fakeSpawn });
  assert.equal(result, false);
});

// CLI-level: `hydrate clip` / `hydrate copy` ---------------------------------

test('hydrate clip errors when there is no active CURRENT_UOW.md', () => {
  const cwd = makeTempDir('hydrate-clip-test-');
  try {
    const result = runCli(['clip'], cwd);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /No active .hydrate\/CURRENT_UOW.md/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('hydrate clip pipes CURRENT_UOW.md content through the platform clipboard tool', { skip: process.platform === 'win32' }, () => {
  const cwd = makeTempDir('hydrate-clip-test-');
  const binDir = makeTempDir('hydrate-fakebin-');
  const outDir = makeTempDir('hydrate-clipout-');
  const outFile = path.join(outDir, 'clipboard.txt');
  try {
    fs.mkdirSync(path.join(cwd, '.hydrate'));
    fs.writeFileSync(path.join(cwd, '.hydrate', 'CURRENT_UOW.md'), '## UOW-77: Fixture\n- **Status:** IN_PROGRESS\n');

    const binName = process.platform === 'darwin' ? 'pbcopy' : 'xclip';
    makeFakeClipboardBin(binDir, binName, outFile);

    const result = runCli(['clip'], cwd, { PATH: `${binDir}${path.delimiter}${process.env.PATH}` });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Copied UOW context to clipboard/);
    assert.equal(fs.readFileSync(outFile, 'utf8'), '## UOW-77: Fixture\n- **Status:** IN_PROGRESS\n');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('hydrate copy is an alias for hydrate clip', () => {
  const cwd = makeTempDir('hydrate-copy-test-');
  try {
    fs.mkdirSync(path.join(cwd, '.hydrate'));
    fs.writeFileSync(path.join(cwd, '.hydrate', 'CURRENT_UOW.md'), '## UOW-77\n');
    // Deny lookup of any real clipboard tool so this only asserts the fallback path fires
    // (i.e. `copy` reached the same handler as `clip`), independent of host tooling.
    const result = runCli(['copy'], cwd, { PATH: '' });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /No clipboard tool found|Copied UOW context to clipboard/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('hydrate clip falls back to printing to stdout when no clipboard tool is found', () => {
  const cwd = makeTempDir('hydrate-clip-fallback-test-');
  try {
    fs.mkdirSync(path.join(cwd, '.hydrate'));
    fs.writeFileSync(path.join(cwd, '.hydrate', 'CURRENT_UOW.md'), '## UOW-88: Fixture\nSome context body.\n');

    const result = runCli(['clip'], cwd, { PATH: '' });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /No clipboard tool found/);
    assert.match(result.stdout, /UOW-88: Fixture/);
    assert.match(result.stdout, /Some context body\./);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

// CLI-level: `hydrate prompt --copy` -----------------------------------------

test('hydrate prompt --copy copies the generated payload to the clipboard', { skip: process.platform === 'win32' }, () => {
  const cwd = makeTempDir('hydrate-prompt-copy-test-');
  const binDir = makeTempDir('hydrate-fakebin-');
  const outDir = makeTempDir('hydrate-clipout-');
  const outFile = path.join(outDir, 'clipboard.txt');
  try {
    const initResult = runCli(['init'], cwd);
    assert.equal(initResult.status, 0);

    const binName = process.platform === 'darwin' ? 'pbcopy' : 'xclip';
    makeFakeClipboardBin(binDir, binName, outFile);

    const result = runCli(['prompt', '--copy'], cwd, { PATH: `${binDir}${path.delimiter}${process.env.PATH}` });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Copied UOW context to clipboard/);
    assert.ok(fs.existsSync(outFile), 'expected clipboard tool to receive the payload');
    assert.match(fs.readFileSync(outFile, 'utf8'), /HYDRATE LEAD DEVELOPER EXECUTION PAYLOAD/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('hydrate prompt without --copy does not touch the clipboard tool', { skip: process.platform === 'win32' }, () => {
  const cwd = makeTempDir('hydrate-prompt-nocopy-test-');
  const binDir = makeTempDir('hydrate-fakebin-');
  const outDir = makeTempDir('hydrate-clipout-');
  const outFile = path.join(outDir, 'clipboard.txt');
  try {
    runCli(['init'], cwd);
    const binName = process.platform === 'darwin' ? 'pbcopy' : 'xclip';
    makeFakeClipboardBin(binDir, binName, outFile);

    const result = runCli(['prompt'], cwd, { PATH: `${binDir}${path.delimiter}${process.env.PATH}` });

    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /Copied UOW context to clipboard/);
    assert.equal(fs.existsSync(outFile), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
