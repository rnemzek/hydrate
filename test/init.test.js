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
const CLAUDE_COMMAND_FILES = ['hydrate.md', 'hydrate-checkup.md', 'hydrate-ingest.md', 'hydrate-context.md', 'hydrate-help.md', 'hydrate-uow.md', 'hydrate-artifacts.md', 'hydrate-arch-sync.md', 'hydrate-digest.md', 'hydrate-complete.md', 'hydrate-check.md', 'hydrate-export-portfolio.md', 'hydrate-lfg.md'];
const DOCS_FILES = ['ARCHITECTURE.md', 'ARCHITECTURE_JOURNAL.md'];

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

test('scaffold() creates CLAUDE.md, the 5-artifact .hydrate/ layout, .hydrate/archive/, the /hydrate-* slash commands, and the docs/ architecture layout', () => {
  withTempDir((dir) => {
    const created = scaffold(dir);

    assert.equal(created.length, 21);
    assert.ok(fs.existsSync(path.join(dir, 'CLAUDE.md')));
    assert.ok(fs.existsSync(path.join(dir, '.hydrate', 'archive')));
    for (const file of HYDRATE_FILES) {
      assert.ok(fs.existsSync(path.join(dir, '.hydrate', file)), `expected .hydrate/${file} to exist`);
    }
    for (const file of CLAUDE_COMMAND_FILES) {
      assert.ok(fs.existsSync(path.join(dir, '.claude', 'commands', file)), `expected .claude/commands/${file} to exist`);
    }
    for (const file of DOCS_FILES) {
      assert.ok(fs.existsSync(path.join(dir, 'docs', file)), `expected docs/${file} to exist`);
    }

    const claude = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    assert.match(claude, new RegExp(`# ${path.basename(dir)} — Operating Rules`));
    assert.match(claude, /## 0\. Fast-Start Boot Protocol/);
    assert.match(claude, /hydrate checkup/);

    const currentUow = fs.readFileSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md'), 'utf8');
    assert.match(currentUow, /All UOWs are complete!/);

    const roadmap = fs.readFileSync(path.join(dir, '.hydrate', 'ROADMAP.md'), 'utf8');
    assert.match(roadmap, /## Section 1: Scheduled Roadmap Items/);
    assert.match(roadmap, /## Section 2: Future features/);

    const projectJournal = fs.readFileSync(path.join(dir, '.hydrate', 'PROJECT_JOURNAL.md'), 'utf8');
    assert.match(projectJournal, new RegExp(`# ${path.basename(dir)} Project Journal`));

    const architecture = fs.readFileSync(path.join(dir, 'docs', 'ARCHITECTURE.md'), 'utf8');
    assert.match(architecture, /## 1\. Overall System Architecture/);
    assert.match(architecture, /## 2\. Technology Stack & Dependencies/);

    const architectureJournal = fs.readFileSync(path.join(dir, 'docs', 'ARCHITECTURE_JOURNAL.md'), 'utf8');
    assert.match(architectureJournal, /# Architecture Journal/);
  });
});

test('scaffold() is idempotent for every artifact except CLAUDE.md, which gets the Hydrate managed block appended', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.hydrate'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'custom rules');
    fs.writeFileSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md'), 'custom canvas');
    fs.writeFileSync(path.join(dir, '.hydrate', 'ROADMAP.md'), 'custom roadmap');

    const created = scaffold(dir);

    // CLAUDE.md is intentionally NOT skip-if-exists (UOW-HYDRATE-14 Item 1.1):
    // a brownfield CLAUDE.md gets the delimited Hydrate managed block
    // appended so its custom content survives untouched.
    assert.ok(created.some((c) => c.path.endsWith('CLAUDE.md')));
    assert.ok(!created.some((c) => c.path.endsWith(path.join('.hydrate', 'CURRENT_UOW.md'))));
    assert.ok(!created.some((c) => c.path.endsWith(path.join('.hydrate', 'ROADMAP.md'))));

    const claude = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    assert.match(claude, /^custom rules/);
    assert.match(claude, /BEGIN HYDRATE MANAGED BLOCK/);
    assert.equal(fs.readFileSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md'), 'utf8'), 'custom canvas');
    assert.equal(fs.readFileSync(path.join(dir, '.hydrate', 'ROADMAP.md'), 'utf8'), 'custom roadmap');
  });
});

test('scaffold() run twice on the same repo does not duplicate or change the CLAUDE.md managed block', () => {
  withTempDir((dir) => {
    scaffold(dir);
    const first = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');

    const created = scaffold(dir);

    assert.ok(!created.some((c) => c.path.endsWith('CLAUDE.md')));
    assert.equal(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), first);
  });
});

test('scaffold() only creates the files that are missing, refreshing CLAUDE.md\'s managed block', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'already here');

    const created = scaffold(dir);

    assert.equal(created.length, 21);
    assert.ok(created.some((c) => c.path.endsWith('CLAUDE.md')));
    assert.match(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), /^already here/);
    for (const file of HYDRATE_FILES) {
      assert.ok(fs.existsSync(path.join(dir, '.hydrate', file)));
    }
    for (const file of CLAUDE_COMMAND_FILES) {
      assert.ok(fs.existsSync(path.join(dir, '.claude', 'commands', file)));
    }
    for (const file of DOCS_FILES) {
      assert.ok(fs.existsSync(path.join(dir, 'docs', file)));
    }
  });
});

test('scaffold() does not overwrite an existing slash command file', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.claude', 'commands'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude', 'commands', 'hydrate-checkup.md'), 'custom command');

    const created = scaffold(dir);

    assert.ok(!created.some((c) => c.path.endsWith(path.join('.claude', 'commands', 'hydrate-checkup.md'))));
    assert.equal(fs.readFileSync(path.join(dir, '.claude', 'commands', 'hydrate-checkup.md'), 'utf8'), 'custom command');
    assert.ok(fs.existsSync(path.join(dir, '.claude', 'commands', 'hydrate-ingest.md')));
    assert.ok(fs.existsSync(path.join(dir, '.claude', 'commands', 'hydrate-context.md')));
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
    assert.match(output, /Created \.claude\/commands\/hydrate\.md/);
    assert.match(output, /Created \.claude\/commands\/hydrate-checkup\.md/);
    assert.match(output, /Created \.claude\/commands\/hydrate-ingest\.md/);
    assert.match(output, /Created \.claude\/commands\/hydrate-context\.md/);
    assert.match(output, /Created \.claude\/commands\/hydrate-help\.md/);
    assert.match(output, /Created \.claude\/commands\/hydrate-uow\.md/);
    assert.match(output, /Created \.claude\/commands\/hydrate-artifacts\.md/);
    assert.match(output, /Created \.claude\/commands\/hydrate-arch-sync\.md/);
    assert.match(output, /Created \.claude\/commands\/hydrate-digest\.md/);
    assert.match(output, /Created \.claude\/commands\/hydrate-complete\.md/);
    assert.match(output, /Created \.claude\/commands\/hydrate-check\.md/);
    assert.match(output, /Created \.claude\/commands\/hydrate-export-portfolio\.md/);
    assert.match(output, /Created \.claude\/commands\/hydrate-lfg\.md/);
    assert.match(output, /Created docs\/ARCHITECTURE\.md/);
    assert.match(output, /Created docs\/ARCHITECTURE_JOURNAL\.md/);
    assert.match(output, /hydrate-checkup/);
    assert.match(output, /hydrate-help/);
    assert.match(output, /Harness Initialized/);
  });
});
