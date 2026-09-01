const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { scaffold } = require('../src/init');
const { loadTemplate, renderTemplate } = require('../src/templates');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hydrate-claude-hooks-test-'));
}

function withTempDir(fn) {
  const dir = makeTempDir();
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const SLASH_COMMANDS = [
  { file: 'hydrate-checkup.md', cliVerb: 'hydrate checkup' },
  { file: 'hydrate-ingest.md', cliVerb: 'hydrate ingest --yes' },
  { file: 'hydrate-context.md', cliVerb: 'hydrate context --clip' }
];

// templates/.claude/commands/*.md.template ---------------------------------

test('every /hydrate-* slash command template loads and declares a description', () => {
  for (const { file } of SLASH_COMMANDS) {
    const content = loadTemplate(path.join('.claude', 'commands', file));
    assert.match(content, /^---\ndescription:.+\n---/, `${file} should start with a description frontmatter block`);
  }
});

test('each slash command template invokes its corresponding hydrate CLI verb', () => {
  for (const { file, cliVerb } of SLASH_COMMANDS) {
    const content = loadTemplate(path.join('.claude', 'commands', file));
    assert.ok(content.includes(cliVerb), `${file} should invoke \`${cliVerb}\``);
  }
});

test('renderTemplate() leaves slash command templates untouched (no placeholders)', () => {
  for (const { file } of SLASH_COMMANDS) {
    const name = path.join('.claude', 'commands', file);
    assert.equal(renderTemplate(name, { PROJECT_NAME: 'acme-widgets' }), loadTemplate(name));
  }
});

// scaffold() wiring for .claude/commands/ ----------------------------------

test('scaffold() provisions .claude/commands/ with all three /hydrate-* slash commands', () => {
  withTempDir((dir) => {
    const created = scaffold(dir);

    for (const { file } of SLASH_COMMANDS) {
      const filePath = path.join(dir, '.claude', 'commands', file);
      assert.ok(fs.existsSync(filePath), `expected .claude/commands/${file} to exist`);
      assert.equal(fs.readFileSync(filePath, 'utf8'), loadTemplate(path.join('.claude', 'commands', file)));
    }

    assert.ok(created.some((c) => c.label.includes('/hydrate-checkup')));
    assert.ok(created.some((c) => c.label.includes('/hydrate-ingest')));
    assert.ok(created.some((c) => c.label.includes('/hydrate-context')));
  });
});

test('scaffold() is idempotent for .claude/commands/: never overwrites an existing slash command', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.claude', 'commands'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude', 'commands', 'hydrate-context.md'), 'custom context command');

    scaffold(dir);

    assert.equal(fs.readFileSync(path.join(dir, '.claude', 'commands', 'hydrate-context.md'), 'utf8'), 'custom context command');
  });
});

// CLAUDE.md template Fast-Start Boot Protocol ------------------------------

test('CLAUDE.md template instructs Claude Code to run `hydrate checkup` on session boot', () => {
  const rendered = renderTemplate('CLAUDE.md', { PROJECT_NAME: 'acme-widgets' });
  assert.match(rendered, /## 0\. Fast-Start Boot Protocol/);
  assert.match(rendered, /run `hydrate checkup`/);
});

test('CLAUDE.md template declares the canonical context sources and suppresses legacy CONTEXT.md lookups', () => {
  const rendered = renderTemplate('CLAUDE.md', { PROJECT_NAME: 'acme-widgets' });
  assert.match(rendered, /`\.hydrate\/CURRENT_UOW\.md`, `\.hydrate\/ROADMAP\.md`, and `\.hydrate\/ARCHITECT_JOURNAL\.md`/);
  assert.match(rendered, /CONTEXT\.md.*suppressed/);
});

test('CLAUDE.md template documents all three zero-touch slash commands', () => {
  const rendered = renderTemplate('CLAUDE.md', { PROJECT_NAME: 'acme-widgets' });
  assert.match(rendered, /`\/hydrate-checkup`/);
  assert.match(rendered, /`\/hydrate-ingest`/);
  assert.match(rendered, /`\/hydrate-context`/);
});

test('scaffolded CLAUDE.md carries the Fast-Start Boot Protocol into target repos', () => {
  withTempDir((dir) => {
    scaffold(dir);
    const claude = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    assert.match(claude, /## 0\. Fast-Start Boot Protocol/);
    assert.match(claude, /hydrate checkup/);
  });
});
