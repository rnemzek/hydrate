const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { discoverProject } = require('../src/discover');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hydrate-discover-test-'));
}

function withTempDir(fn) {
  const dir = makeTempDir();
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function writePkg(dir, pkg) {
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));
}

test('discoverProject() falls back to Node.js and the directory name with no package.json', () => {
  withTempDir((dir) => {
    const result = discoverProject(dir);
    assert.equal(result.projectName, path.basename(dir));
    assert.deepEqual(result.stack, ['Node.js']);
    assert.equal(result.packageManager, null);
    assert.equal(result.testCommand, null);
  });
});

test('discoverProject() reads name, scripts, and infers a Node stack from dependencies', () => {
  withTempDir((dir) => {
    writePkg(dir, {
      name: '@acme/widgets',
      scripts: { test: 'vitest run', build: 'vite build', lint: 'eslint .', dev: 'vite' },
      dependencies: { react: '^18.0.0', vite: '^5.0.0' },
      devDependencies: { typescript: '^5.0.0', vitest: '^1.0.0' }
    });

    const result = discoverProject(dir);

    assert.equal(result.projectName, '@acme/widgets');
    assert.equal(result.testCommand, 'npm test');
    assert.equal(result.buildCommand, 'npm run build');
    assert.equal(result.lintCommand, 'npm run lint');
    assert.equal(result.startCommand, 'npm run dev');
    assert.deepEqual(result.stack.sort(), ['React', 'TypeScript', 'Vite', 'Vitest'].sort());
  });
});

test('discoverProject() detects pnpm/yarn/npm lockfiles', () => {
  withTempDir((dir) => {
    writePkg(dir, { name: 'x' });
    fs.writeFileSync(path.join(dir, 'pnpm-lock.yaml'), '');
    assert.equal(discoverProject(dir).packageManager, 'pnpm');
  });

  withTempDir((dir) => {
    writePkg(dir, { name: 'x' });
    fs.writeFileSync(path.join(dir, 'yarn.lock'), '');
    assert.equal(discoverProject(dir).packageManager, 'yarn');
  });

  withTempDir((dir) => {
    writePkg(dir, { name: 'x' });
    fs.writeFileSync(path.join(dir, 'package-lock.json'), '');
    assert.equal(discoverProject(dir).packageManager, 'npm');
  });
});

test('discoverProject() detects non-Node stacks via marker files', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'go.mod'), 'module x');
    assert.ok(discoverProject(dir).stack.includes('Go'));
  });

  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'Cargo.toml'), '[package]');
    assert.ok(discoverProject(dir).stack.includes('Rust'));
  });

  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'requirements.txt'), '');
    assert.ok(discoverProject(dir).stack.includes('Python'));
  });
});

test('discoverProject() adds TypeScript from a bare tsconfig.json even without the dependency', () => {
  withTempDir((dir) => {
    writePkg(dir, { name: 'x' });
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), '{}');
    const result = discoverProject(dir);
    assert.deepEqual(result.stack, ['TypeScript']);
  });
});

test('discoverProject() falls back to the directory name on malformed package.json', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'package.json'), '{ not valid json');
    const result = discoverProject(dir);
    assert.equal(result.projectName, path.basename(dir));
  });
});

test('discoverProject() lists known top-level directories that exist', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.mkdirSync(path.join(dir, 'test'));
    const result = discoverProject(dir);
    assert.deepEqual(result.directories.sort(), ['src', 'test']);
  });
});

test('discoverProject() flags known existing AI rule files', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '');
    fs.writeFileSync(path.join(dir, '.cursorrules'), '');
    const result = discoverProject(dir);
    assert.deepEqual(result.existingRules.sort(), ['.cursorrules', 'CLAUDE.md'].sort());
  });
});

test('discoverProject() scans recent git log when the target is a repo', () => {
  withTempDir((dir) => {
    spawnSync('git', ['init'], { cwd: dir, encoding: 'utf8' });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir, encoding: 'utf8' });
    spawnSync('git', ['config', 'user.name', 'Test'], { cwd: dir, encoding: 'utf8' });
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
    spawnSync('git', ['add', 'a.txt'], { cwd: dir, encoding: 'utf8' });
    spawnSync('git', ['commit', '-m', 'first commit'], { cwd: dir, encoding: 'utf8' });

    const result = discoverProject(dir);
    assert.equal(result.recentCommits.length, 1);
    assert.match(result.recentCommits[0], /first commit/);
  });
});

test('discoverProject() returns no commits outside a git repository', () => {
  withTempDir((dir) => {
    const result = discoverProject(dir);
    assert.deepEqual(result.recentCommits, []);
  });
});
