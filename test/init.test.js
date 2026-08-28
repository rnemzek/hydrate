const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { scaffold, runInit } = require('../src/init');
const { loadTemplate, renderTemplate } = require('../src/templates');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hydrate-init-test-'));
}

function withTempDir(fn) {
  const dir = makeTempDir();
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// src/templates.js -------------------------------------------------------

test('loadTemplate() returns the raw template contents', () => {
  const content = loadTemplate('CURRENT_UOW.md');
  assert.match(content, /All UOWs are complete!/);
});

test('renderTemplate() substitutes every occurrence of a placeholder', () => {
  const rendered = renderTemplate('CLAUDE.md', { PROJECT_NAME: 'acme-widgets' });
  assert.match(rendered, /# acme-widgets — Operating Rules/);
  assert.doesNotMatch(rendered, /\{\{PROJECT_NAME\}\}/);
});

test('renderTemplate() leaves unmatched placeholders untouched', () => {
  const rendered = renderTemplate('CURRENT_UOW.md', { UNUSED_KEY: 'x' });
  assert.equal(rendered, loadTemplate('CURRENT_UOW.md'));
});

// scaffold() ---------------------------------------------------------------

test('scaffold() creates the 3 canonical artifacts from templates', () => {
  withTempDir((dir) => {
    const created = scaffold(dir);

    assert.equal(created.length, 3);
    assert.ok(fs.existsSync(path.join(dir, 'CLAUDE.md')));
    assert.ok(fs.existsSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md')));
    assert.ok(fs.existsSync(path.join(dir, 'docs', 'SYSTEM.md')));

    const claude = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    assert.match(claude, new RegExp(`# ${path.basename(dir)} — Operating Rules`));

    const currentUow = fs.readFileSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md'), 'utf8');
    assert.match(currentUow, /All UOWs are complete!/);

    const system = fs.readFileSync(path.join(dir, 'docs', 'SYSTEM.md'), 'utf8');
    assert.match(system, /## 2\. Tactical Roadmap & Task Index/);
    assert.match(system, /## 4\. Decision & Execution Log/);
  });
});

test('scaffold() is idempotent: never overwrites existing files', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.hydrate'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'custom rules');
    fs.writeFileSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md'), 'custom canvas');
    fs.writeFileSync(path.join(dir, 'docs', 'SYSTEM.md'), 'custom system doc');

    const created = scaffold(dir);

    assert.deepEqual(created, []);
    assert.equal(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), 'custom rules');
    assert.equal(fs.readFileSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md'), 'utf8'), 'custom canvas');
    assert.equal(fs.readFileSync(path.join(dir, 'docs', 'SYSTEM.md'), 'utf8'), 'custom system doc');
  });
});

test('scaffold() only creates the files that are missing', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'already here');

    const created = scaffold(dir);

    assert.equal(created.length, 2);
    assert.ok(!created.some((c) => c.path.endsWith('CLAUDE.md')));
    assert.ok(fs.existsSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md')));
    assert.ok(fs.existsSync(path.join(dir, 'docs', 'SYSTEM.md')));
  });
});

test('runInit() prints a checklist of created files and next steps', () => {
  withTempDir((dir) => {
    const originalCwd = process.cwd();
    const logs = [];
    const originalLog = console.log;
    console.log = (msg) => logs.push(msg);

    try {
      process.chdir(dir);
      runInit();
    } finally {
      console.log = originalLog;
      process.chdir(originalCwd);
    }

    const output = logs.join('\n');
    assert.match(output, /Created CLAUDE\.md/);
    assert.match(output, /Created \.hydrate\/CURRENT_UOW\.md/);
    assert.match(output, /Created docs\/SYSTEM\.md/);
    assert.match(output, /Harness Initialized/);
  });
});
