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

const HYDRATE_FILES = ['CURRENT_UOW.md', 'ROADMAP.md', 'PROJECT_JOURNAL.md', 'DEV_JOURNAL.md', 'ARCHITECT_JOURNAL.md'];

// src/templates.js -------------------------------------------------------

test('loadTemplate() returns the raw template contents', () => {
  const content = loadTemplate(path.join('.hydrate', 'CURRENT_UOW.md'));
  assert.match(content, /All UOWs are complete!/);
});

test('renderTemplate() substitutes every occurrence of a placeholder', () => {
  const rendered = renderTemplate('CLAUDE.md', { PROJECT_NAME: 'acme-widgets' });
  assert.match(rendered, /# acme-widgets — Operating Rules/);
  assert.doesNotMatch(rendered, /\{\{PROJECT_NAME\}\}/);
});

test('renderTemplate() leaves unmatched placeholders untouched', () => {
  const name = path.join('.hydrate', 'CURRENT_UOW.md');
  const rendered = renderTemplate(name, { UNUSED_KEY: 'x' });
  assert.equal(rendered, loadTemplate(name));
});

// scaffold() ---------------------------------------------------------------

test('scaffold() creates CLAUDE.md, the 5-artifact .hydrate/ layout, and .hydrate/archive/', () => {
  withTempDir((dir) => {
    const created = scaffold(dir);

    assert.equal(created.length, 6);
    assert.ok(fs.existsSync(path.join(dir, 'CLAUDE.md')));
    assert.ok(fs.existsSync(path.join(dir, '.hydrate', 'archive')));
    for (const file of HYDRATE_FILES) {
      assert.ok(fs.existsSync(path.join(dir, '.hydrate', file)), `expected .hydrate/${file} to exist`);
    }

    const claude = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    assert.match(claude, new RegExp(`# ${path.basename(dir)} — Operating Rules`));

    const currentUow = fs.readFileSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md'), 'utf8');
    assert.match(currentUow, /All UOWs are complete!/);

    const roadmap = fs.readFileSync(path.join(dir, '.hydrate', 'ROADMAP.md'), 'utf8');
    assert.match(roadmap, /## Section 1: Scheduled Roadmap Items/);
    assert.match(roadmap, /## Section 2: Future features/);

    const projectJournal = fs.readFileSync(path.join(dir, '.hydrate', 'PROJECT_JOURNAL.md'), 'utf8');
    assert.match(projectJournal, new RegExp(`# ${path.basename(dir)} Project Journal`));
  });
});

test('scaffold() is idempotent: never overwrites existing files', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.hydrate'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'custom rules');
    fs.writeFileSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md'), 'custom canvas');
    fs.writeFileSync(path.join(dir, '.hydrate', 'ROADMAP.md'), 'custom roadmap');

    const created = scaffold(dir);

    assert.ok(!created.some((c) => c.path.endsWith('CLAUDE.md')));
    assert.ok(!created.some((c) => c.path.endsWith(path.join('.hydrate', 'CURRENT_UOW.md'))));
    assert.ok(!created.some((c) => c.path.endsWith(path.join('.hydrate', 'ROADMAP.md'))));
    assert.equal(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), 'custom rules');
    assert.equal(fs.readFileSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md'), 'utf8'), 'custom canvas');
    assert.equal(fs.readFileSync(path.join(dir, '.hydrate', 'ROADMAP.md'), 'utf8'), 'custom roadmap');
  });
});

test('scaffold() only creates the files that are missing', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'already here');

    const created = scaffold(dir);

    assert.equal(created.length, 5);
    assert.ok(!created.some((c) => c.path.endsWith('CLAUDE.md')));
    for (const file of HYDRATE_FILES) {
      assert.ok(fs.existsSync(path.join(dir, '.hydrate', file)));
    }
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
    assert.match(output, /Created \.hydrate\/ROADMAP\.md/);
    assert.match(output, /Created \.hydrate\/PROJECT_JOURNAL\.md/);
    assert.match(output, /Created \.hydrate\/DEV_JOURNAL\.md/);
    assert.match(output, /Created \.hydrate\/ARCHITECT_JOURNAL\.md/);
    assert.match(output, /Harness Initialized/);
  });
});
