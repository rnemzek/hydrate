const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable, Writable } = require('node:stream');
const { runEject, planEject } = require('../src/commands/eject');
const { scaffold } = require('../src/init');
const { renderManagedBlock } = require('../src/utils/managed-block');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hydrate-eject-test-'));
}

async function withTempDir(fn) {
  const dir = makeTempDir();
  try {
    await fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function nullOutput() {
  return new Writable({ write(_chunk, _enc, cb) { cb(); } });
}

function answerStream(answer) {
  return Readable.from([`${answer}\n`]);
}

function collectLogs() {
  const lines = [];
  return { lines, log: (m) => lines.push(String(m)) };
}

test('planEject() is empty for a repo with no Hydrate artifacts', () => {
  const dir = makeTempDir();
  try {
    assert.deepEqual(planEject(dir), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('planEject() plans removal of .hydrate/, hydrate-* commands, and the CLAUDE.md managed block', () => {
  const dir = makeTempDir();
  try {
    scaffold(dir);
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), `# Custom\n\n${renderManagedBlock('rules', '1.0.0')}\n`, 'utf8');

    const actions = planEject(dir);
    const types = actions.map((a) => a.type);

    assert.ok(types.includes('remove-dir'));
    assert.ok(actions.some((a) => a.type === 'remove-file' && a.target.includes('hydrate-checkup.md')));
    assert.ok(actions.some((a) => a.type === 'rewrite-file' && a.target.endsWith('CLAUDE.md')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('planEject() removes CLAUDE.md outright when the managed block was its only content', () => {
  const dir = makeTempDir();
  try {
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), renderManagedBlock('rules', '1.0.0'), 'utf8');
    const actions = planEject(dir);
    assert.ok(actions.some((a) => a.type === 'remove-file' && a.target.endsWith('CLAUDE.md')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('runEject() reports nothing to do when the repo has no Hydrate artifacts', async () => {
  await withTempDir(async (dir) => {
    const { lines, log } = collectLogs();
    const result = await runEject(dir, { log });
    assert.equal(result.action, 'noop');
    assert.match(lines.join('\n'), /Nothing to eject/);
  });
});

test('runEject({ dryRun: true }) previews without deleting anything', async () => {
  await withTempDir(async (dir) => {
    scaffold(dir);
    const { log } = collectLogs();

    const result = await runEject(dir, { dryRun: true, log });

    assert.equal(result.action, 'dry-run');
    assert.ok(fs.existsSync(path.join(dir, '.hydrate')));
    assert.ok(fs.existsSync(path.join(dir, 'CLAUDE.md')));
  });
});

test('runEject({ force: true }) removes artifacts without prompting', async () => {
  await withTempDir(async (dir) => {
    scaffold(dir);
    const { log } = collectLogs();

    const result = await runEject(dir, { force: true, log });

    assert.equal(result.action, 'ejected');
    assert.equal(fs.existsSync(path.join(dir, '.hydrate')), false);
    assert.equal(fs.existsSync(path.join(dir, '.claude', 'commands', 'hydrate-checkup.md')), false);
    // CLAUDE.md's managed block was its entire content -> file is removed too.
    assert.equal(fs.existsSync(path.join(dir, 'CLAUDE.md')), false);
  });
});

test('runEject() preserves custom CLAUDE.md content, stripping only the managed block', async () => {
  await withTempDir(async (dir) => {
    scaffold(dir);
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), `# Custom\n- keep me\n\n${renderManagedBlock('rules', '1.0.0')}\n`, 'utf8');

    await runEject(dir, { force: true, log: () => {} });

    const claude = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    assert.match(claude, /# Custom\n- keep me/);
    assert.doesNotMatch(claude, /HYDRATE MANAGED BLOCK/);
  });
});

test('runEject() interactive prompt: "y" proceeds with ejection', async () => {
  await withTempDir(async (dir) => {
    scaffold(dir);
    const { log } = collectLogs();

    const result = await runEject(dir, { input: answerStream('y'), output: nullOutput(), log });

    assert.equal(result.action, 'ejected');
    assert.equal(fs.existsSync(path.join(dir, '.hydrate')), false);
  });
});

test('runEject() interactive prompt: declining leaves everything in place', async () => {
  await withTempDir(async (dir) => {
    scaffold(dir);
    const { lines, log } = collectLogs();

    const result = await runEject(dir, { input: answerStream('n'), output: nullOutput(), log });

    assert.equal(result.action, 'aborted');
    assert.ok(fs.existsSync(path.join(dir, '.hydrate')));
    assert.match(lines.join('\n'), /Aborted/);
  });
});

test('runEject({ recursive: true }) ejects from the root and every nested repo', async () => {
  await withTempDir(async (dir) => {
    fs.mkdirSync(path.join(dir, '.git'));
    scaffold(dir);
    fs.mkdirSync(path.join(dir, 'packages', 'nested'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'packages', 'nested', 'package.json'), '{}');
    scaffold(path.join(dir, 'packages', 'nested'));

    const result = await runEject(dir, { recursive: true, force: true, log: () => {} });

    assert.equal(result.plan.length, 2);
    assert.equal(fs.existsSync(path.join(dir, '.hydrate')), false);
    assert.equal(fs.existsSync(path.join(dir, 'packages', 'nested', '.hydrate')), false);
  });
});

test('runEject() respects --path to target a directory other than cwd', async () => {
  await withTempDir(async (dir) => {
    const target = path.join(dir, 'other');
    scaffold(target);

    const result = await runEject(dir, { targetPath: 'other', force: true, log: () => {} });

    assert.equal(result.action, 'ejected');
    assert.equal(fs.existsSync(path.join(target, '.hydrate')), false);
  });
});
