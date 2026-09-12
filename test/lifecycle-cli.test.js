const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');

function runCli(args, cwd, input) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: 'utf8', cwd, input });
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hydrate-lifecycle-cli-test-'));
}

function withTempDir(fn) {
  const dir = makeTempDir();
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// sync ----------------------------------------------------------------------

test('hydrate sync --help prints command help', () => {
  withTempDir((dir) => {
    const result = runCli(['sync', '--help'], dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /hydrate sync/);
  });
});

test('hydrate sync bootstraps an uninitialized repo', () => {
  withTempDir((dir) => {
    const result = runCli(['sync'], dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Sync complete/);
    assert.ok(fs.existsSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md')));
  });
});

test('hydrate sync on an already-initialized repo reports it checked the repo', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    const result = runCli(['sync'], dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /1 repo checked/);
  });
});

test('hydrate sync guards an unmarked brownfield CLAUDE.md and reports --force is required', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'legacy rules', 'utf8');

    const result = runCli(['sync'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /hydrate sync --force/);
    assert.equal(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), 'legacy rules');
  });
});

test('hydrate sync --force wholesale-resets an unmarked brownfield CLAUDE.md', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'legacy rules', 'utf8');

    const result = runCli(['sync', '--force'], dir);

    assert.equal(result.status, 0);
    assert.doesNotMatch(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), /legacy rules/);
  });
});

// init --force -----------------------------------------------------------------

test('hydrate init without --force guards an unmarked brownfield CLAUDE.md', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'legacy rules', 'utf8');
    const result = runCli(['init'], dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /hydrate init --force/);
    assert.equal(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), 'legacy rules');
  });
});

test('hydrate init --force wholesale-resets an unmarked brownfield CLAUDE.md', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'legacy rules', 'utf8');
    const result = runCli(['init', '--force'], dir);
    assert.equal(result.status, 0);
    assert.doesNotMatch(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), /legacy rules/);
    assert.match(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), /BEGIN HYDRATE MANAGED BLOCK/);
  });
});

// eject -----------------------------------------------------------------------

test('hydrate eject --help prints command help', () => {
  withTempDir((dir) => {
    const result = runCli(['eject', '--help'], dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /hydrate eject/);
  });
});

test('hydrate eject --dry-run previews without deleting', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    const result = runCli(['eject', '--dry-run'], dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /dry run/);
    assert.ok(fs.existsSync(path.join(dir, '.hydrate')));
  });
});

test('hydrate eject --force removes the harness non-interactively', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    const result = runCli(['eject', '--force'], dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Ejected Hydrate artifacts/);
    assert.equal(fs.existsSync(path.join(dir, '.hydrate')), false);
  });
});

test('hydrate eject prompts interactively and aborts on "n"', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    const result = runCli(['eject'], dir, 'n\n');
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Aborted/);
    assert.ok(fs.existsSync(path.join(dir, '.hydrate')));
  });
});

// hook ------------------------------------------------------------------------

test('hydrate hook --help prints command help', () => {
  withTempDir((dir) => {
    const result = runCli(['hook', '--help'], dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /hydrate hook/);
  });
});

test('hydrate hook with no action exits 1 with a diagnostic', () => {
  withTempDir((dir) => {
    const result = runCli(['hook'], dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unknown hook action/);
  });
});

// update ------------------------------------------------------------------------

test('hydrate update --help prints command help', () => {
  withTempDir((dir) => {
    const result = runCli(['update', '--help'], dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /hydrate update/);
  });
});
