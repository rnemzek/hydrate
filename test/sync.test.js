const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runSync, syncRepo } = require('../src/commands/sync');
const { scaffold } = require('../src/init');
const { hasManagedBlock } = require('../src/utils/managed-block');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hydrate-sync-test-'));
}

function withTempDir(fn) {
  const dir = makeTempDir();
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('syncRepo() bootstraps a repo missing .hydrate/ via a full scaffold', () => {
  withTempDir((dir) => {
    const result = syncRepo(dir, { version: '1.0.0' });
    assert.equal(result.action, 'bootstrapped');
    assert.ok(fs.existsSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md')));
    assert.ok(fs.existsSync(path.join(dir, 'CLAUDE.md')));
  });
});

test('syncRepo() force-refreshes a stale slash command template', () => {
  withTempDir((dir) => {
    scaffold(dir);
    const target = path.join(dir, '.claude', 'commands', 'hydrate-checkup.md');
    fs.writeFileSync(target, 'stale content', 'utf8');

    const result = syncRepo(dir, { version: '1.0.0' });

    assert.equal(result.action, 'synced');
    assert.ok(result.updated.includes(target));
    assert.notEqual(fs.readFileSync(target, 'utf8'), 'stale content');
    assert.match(fs.readFileSync(target, 'utf8'), /hydrate checkup/);
  });
});

test('syncRepo() reports no updates when everything already matches the current templates', () => {
  withTempDir((dir) => {
    scaffold(dir);
    const result = syncRepo(dir, { version: '1.0.0' });
    assert.equal(result.action, 'synced');
    // CLAUDE.md is always touched at least once to tag the managed block
    // with the current version, so only assert the *command* templates
    // (already scaffolded fresh) needed no changes.
    assert.ok(!result.updated.some((f) => f.includes(path.join('.claude', 'commands'))));
  });
});

test('syncRepo() guards (leaves untouched) a brownfield CLAUDE.md with no markers when force is not set', () => {
  withTempDir((dir) => {
    scaffold(dir);
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# My Project\n- pnpm only\n', 'utf8');

    const result = syncRepo(dir, { version: '2.0.0' });

    assert.equal(result.guard, path.join(dir, 'CLAUDE.md'));
    assert.equal(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), '# My Project\n- pnpm only\n');
  });
});

test('syncRepo({ force: true }) wholesale-replaces a brownfield CLAUDE.md, discarding the legacy content', () => {
  withTempDir((dir) => {
    scaffold(dir);
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# My Project\n- pnpm only\n', 'utf8');

    const result = syncRepo(dir, { version: '2.0.0', force: true });

    assert.equal(result.guard, null);
    const claude = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    assert.doesNotMatch(claude, /pnpm only/);
    assert.ok(hasManagedBlock(claude));
    assert.match(claude, /v2\.0\.0/);
  });
});

test('syncRepo() never touches .hydrate/ journals or the active canvas', () => {
  withTempDir((dir) => {
    scaffold(dir);
    fs.writeFileSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md'), '# UOW-LIVE-01: In progress\n', 'utf8');
    fs.writeFileSync(path.join(dir, '.hydrate', 'PROJECT_JOURNAL.md'), '# custom journal\n', 'utf8');

    syncRepo(dir, { version: '1.0.0' });

    assert.equal(fs.readFileSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md'), 'utf8'), '# UOW-LIVE-01: In progress\n');
    assert.equal(fs.readFileSync(path.join(dir, '.hydrate', 'PROJECT_JOURNAL.md'), 'utf8'), '# custom journal\n');
  });
});

test('runSync() non-recursive only syncs the given directory even with nested repos present', () => {
  withTempDir((dir) => {
    scaffold(dir);
    fs.mkdirSync(path.join(dir, 'packages', 'nested'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'packages', 'nested', 'package.json'), '{}');

    const logs = [];
    const results = runSync(dir, { log: (m) => logs.push(m) });

    assert.equal(results.length, 1);
    assert.equal(results[0].repoDir, dir);
    assert.ok(!fs.existsSync(path.join(dir, 'packages', 'nested', '.hydrate')));
  });
});

test('runSync() --recursive syncs the root and every nested repo, bootstrapping the uninitialized one', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.git'));
    scaffold(dir);
    fs.mkdirSync(path.join(dir, 'packages', 'nested'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'packages', 'nested', 'package.json'), '{}');

    const logs = [];
    const results = runSync(dir, { recursive: true, log: (m) => logs.push(m) });

    assert.equal(results.length, 2);
    const nested = results.find((r) => r.repoDir === path.join(dir, 'packages', 'nested'));
    assert.equal(nested.action, 'bootstrapped');
    assert.ok(fs.existsSync(path.join(dir, 'packages', 'nested', '.hydrate', 'CURRENT_UOW.md')));
    assert.ok(logs.some((l) => l.includes('Bootstrapped')));
  });
});

test('runSync() logs a guard warning instead of "already up to date" when CLAUDE.md needs a greenfield reset', () => {
  withTempDir((dir) => {
    scaffold(dir);
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'legacy rules', 'utf8');

    const logs = [];
    runSync(dir, { log: (m) => logs.push(m) });

    assert.ok(logs.some((l) => l.includes('hydrate sync --force')));
    assert.ok(!logs.some((l) => l.includes('already up to date')));
  });
});

test('runSync({ recursive: true, force: true }) resets CLAUDE.md across every discovered repo', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.git'));
    scaffold(dir);
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'root legacy rules', 'utf8');

    fs.mkdirSync(path.join(dir, 'packages', 'nested'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'packages', 'nested', 'package.json'), '{}');
    scaffold(path.join(dir, 'packages', 'nested'));
    fs.writeFileSync(path.join(dir, 'packages', 'nested', 'CLAUDE.md'), 'nested legacy rules', 'utf8');

    const results = runSync(dir, { recursive: true, force: true, log: () => {} });

    assert.equal(results.length, 2);
    assert.doesNotMatch(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), /root legacy rules/);
    assert.doesNotMatch(fs.readFileSync(path.join(dir, 'packages', 'nested', 'CLAUDE.md'), 'utf8'), /nested legacy rules/);
  });
});

test('runSync() respects --path to target a directory other than cwd', () => {
  withTempDir((dir) => {
    const target = path.join(dir, 'other');
    fs.mkdirSync(target, { recursive: true });

    const results = runSync(dir, { targetPath: 'other', log: () => {} });

    assert.equal(results.length, 1);
    assert.equal(results[0].repoDir, target);
    assert.equal(results[0].action, 'bootstrapped');
  });
});
