const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { scaffold, runInit, scaffoldClaudeCommands, pruneDeprecatedCommands, CLAUDE_COMMANDS, HYDRATE_ARTIFACTS, DOCS_ARTIFACTS } = require('../src/init');
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

// UOW-HYDRATE-ROOT-GUARD-AND-TEMPLATE-FIX: regression guard — every template
// path referenced by CLAUDE_COMMANDS/HYDRATE_ARTIFACTS/DOCS_ARTIFACTS must
// actually exist on disk under templates/, so `hydrate init`/`hydrate sync`
// can never hit an ENOENT partway through a scaffold or sync run.
test('every CLAUDE_COMMANDS/HYDRATE_ARTIFACTS/DOCS_ARTIFACTS template resolves without throwing', () => {
  for (const { name } of CLAUDE_COMMANDS) {
    assert.doesNotThrow(() => loadTemplate(path.join('.claude', 'commands', name)), `.claude/commands/${name}.template should exist`);
  }
  for (const { name } of HYDRATE_ARTIFACTS) {
    assert.doesNotThrow(() => loadTemplate(path.join('.hydrate', name)), `.hydrate/${name}.template should exist`);
  }
  for (const { name } of DOCS_ARTIFACTS) {
    assert.doesNotThrow(() => loadTemplate(path.join('docs', name)), `docs/${name}.template should exist`);
  }
  assert.doesNotThrow(() => loadTemplate('CLAUDE.md'));
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

test('scaffold() is idempotent for every artifact, and guards (does not touch) an unmarked CLAUDE.md', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.hydrate'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'custom rules');
    fs.writeFileSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md'), 'custom canvas');
    fs.writeFileSync(path.join(dir, '.hydrate', 'ROADMAP.md'), 'custom roadmap');

    const created = scaffold(dir);

    // CLAUDE.md is intentionally NOT skip-if-exists (UOW-HYDRATE-14 Item 1.1)
    // — but a brownfield CLAUDE.md with no markers is guarded, not appended
    // to (UOW-HYDRATE-15): a "greenfield reset required" entry is returned
    // and the file itself is left completely untouched.
    const claudeEntry = created.find((c) => c.path.endsWith('CLAUDE.md'));
    assert.ok(claudeEntry);
    assert.equal(claudeEntry.guard, true);
    assert.ok(!created.some((c) => c.path.endsWith(path.join('.hydrate', 'CURRENT_UOW.md'))));
    assert.ok(!created.some((c) => c.path.endsWith(path.join('.hydrate', 'ROADMAP.md'))));

    assert.equal(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), 'custom rules');
    assert.equal(fs.readFileSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md'), 'utf8'), 'custom canvas');
    assert.equal(fs.readFileSync(path.join(dir, '.hydrate', 'ROADMAP.md'), 'utf8'), 'custom roadmap');
  });
});

test('scaffold({ force: true }) wholesale-resets an unmarked CLAUDE.md, discarding the legacy content', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.hydrate'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'custom rules');

    const created = scaffold(dir, { force: true });

    const claudeEntry = created.find((c) => c.path.endsWith('CLAUDE.md'));
    assert.ok(claudeEntry);
    assert.ok(!claudeEntry.guard);

    const claude = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    assert.doesNotMatch(claude, /custom rules/);
    assert.match(claude, /BEGIN HYDRATE MANAGED BLOCK/);
  });
});

test('scaffold() run twice on the same repo does not duplicate or change an already-managed CLAUDE.md', () => {
  withTempDir((dir) => {
    scaffold(dir);
    const first = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');

    const created = scaffold(dir);

    assert.ok(!created.some((c) => c.path.endsWith('CLAUDE.md')));
    assert.equal(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), first);
  });
});

test('scaffold() only creates the files that are missing, guarding an unmarked pre-existing CLAUDE.md', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'already here');

    const created = scaffold(dir);

    assert.equal(created.length, 21);
    const claudeEntry = created.find((c) => c.path.endsWith('CLAUDE.md'));
    assert.ok(claudeEntry);
    assert.equal(claudeEntry.guard, true);
    assert.equal(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), 'already here');
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

test('scaffold({ force: true }) overwrites a customized slash command file to match the current template', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.claude', 'commands'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude', 'commands', 'hydrate-checkup.md'), 'custom command');

    const created = scaffold(dir, { force: true });

    const entry = created.find((c) => c.path.endsWith(path.join('.claude', 'commands', 'hydrate-checkup.md')));
    assert.ok(entry);
    assert.match(entry.label, /^Updated/);
    assert.notEqual(fs.readFileSync(path.join(dir, '.claude', 'commands', 'hydrate-checkup.md'), 'utf8'), 'custom command');
  });
});

// pruneDeprecatedCommands() / deprecated command purge ---------------------

test('pruneDeprecatedCommands() removes a hydrate-owned file not in the canonical registry', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.claude', 'commands'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude', 'commands', 'hydrate-architect.md'), 'legacy content');

    const removed = pruneDeprecatedCommands(dir);

    assert.deepEqual(removed, ['hydrate-architect.md']);
    assert.equal(fs.existsSync(path.join(dir, '.claude', 'commands', 'hydrate-architect.md')), false);
  });
});

test('pruneDeprecatedCommands() never touches a non-hydrate-named custom command file', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.claude', 'commands'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude', 'commands', 'my-custom-thing.md'), 'keep me');

    const removed = pruneDeprecatedCommands(dir);

    assert.deepEqual(removed, []);
    assert.ok(fs.existsSync(path.join(dir, '.claude', 'commands', 'my-custom-thing.md')));
  });
});

test('pruneDeprecatedCommands() never touches an active canonical command file', () => {
  withTempDir((dir) => {
    scaffold(dir);
    const removed = pruneDeprecatedCommands(dir);
    assert.deepEqual(removed, []);
    assert.ok(fs.existsSync(path.join(dir, '.claude', 'commands', 'hydrate-checkup.md')));
  });
});

test('pruneDeprecatedCommands() is a no-op when .claude/commands/ does not exist', () => {
  withTempDir((dir) => {
    assert.deepEqual(pruneDeprecatedCommands(dir), []);
  });
});

test('scaffoldClaudeCommands() prunes a deprecated file and reports it with a `removed` entry', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.claude', 'commands'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude', 'commands', 'hydrate-architect.md'), 'legacy content');

    const created = scaffoldClaudeCommands(dir);

    const entry = created.find((c) => c.path.endsWith('hydrate-architect.md'));
    assert.ok(entry);
    assert.equal(entry.removed, true);
    assert.equal(fs.existsSync(path.join(dir, '.claude', 'commands', 'hydrate-architect.md')), false);
  });
});

test('scaffold() prunes a deprecated slash command as part of a full scaffold and prints the 🗑 glyph', () => {
  withTempDir((dir) => {
    const originalCwd = process.cwd();
    const logs = [];
    const originalLog = console.log;
    console.log = (msg) => logs.push(msg);

    try {
      process.chdir(dir);
      runInit();
      fs.writeFileSync(path.join(dir, '.claude', 'commands', 'hydrate-architect.md'), 'legacy content');
      logs.length = 0;
      runInit();
    } finally {
      console.log = originalLog;
      process.chdir(originalCwd);
    }

    assert.equal(fs.existsSync(path.join(dir, '.claude', 'commands', 'hydrate-architect.md')), false);
    assert.match(logs.join('\n'), /🗑 Removed deprecated .*hydrate-architect\.md/);
  });
});

test('runInit(["--force"]) wholesale-resets an unmarked CLAUDE.md and prints the guard glyph for guarded entries', () => {
  withTempDir((dir) => {
    const originalCwd = process.cwd();
    const logs = [];
    const originalLog = console.log;
    console.log = (msg) => logs.push(msg);

    try {
      process.chdir(dir);
      fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'custom rules');
      runInit(['--force']);
    } finally {
      console.log = originalLog;
      process.chdir(originalCwd);
    }

    assert.doesNotMatch(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), /custom rules/);
    assert.match(logs.join('\n'), /Reset CLAUDE\.md/);
  });
});

test('runInit() without --force prints the guard glyph and leaves an unmarked CLAUDE.md untouched', () => {
  withTempDir((dir) => {
    const originalCwd = process.cwd();
    const logs = [];
    const originalLog = console.log;
    console.log = (msg) => logs.push(msg);

    try {
      process.chdir(dir);
      fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'custom rules');
      runInit();
    } finally {
      console.log = originalLog;
      process.chdir(originalCwd);
    }

    assert.equal(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), 'custom rules');
    assert.match(logs.join('\n'), /⚠.*hydrate init --force/);
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

// UOW-HYDRATE-ROOT-GUARD-AND-TEMPLATE-FIX: git repository root guard --------

test('runInit() run from a nested subdirectory of a real git repo scaffolds at the git root, not the subdirectory', () => {
  withTempDir((dir) => {
    spawnSync('git', ['init', '-q'], { cwd: dir });
    const sub = path.join(dir, 'packages', 'sub');
    fs.mkdirSync(sub, { recursive: true });

    const originalCwd = process.cwd();
    const logs = [];
    const originalLog = console.log;
    console.log = (msg) => logs.push(msg);

    try {
      process.chdir(sub);
      runInit();
    } finally {
      console.log = originalLog;
      process.chdir(originalCwd);
    }

    assert.ok(fs.existsSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md')));
    assert.ok(fs.existsSync(path.join(dir, 'CLAUDE.md')));
    assert.equal(fs.existsSync(path.join(sub, '.hydrate')), false);
    assert.match(logs.join('\n'), /Resolved git repository root/);
  });
});

test('runInit() run at the git repository root itself prints no redirect notice', () => {
  withTempDir((dir) => {
    spawnSync('git', ['init', '-q'], { cwd: dir });

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

    assert.doesNotMatch(logs.join('\n'), /Resolved git repository root/);
    assert.ok(fs.existsSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md')));
  });
});

test('runInit() outside a git repository falls back to process.cwd() with an informational notice', () => {
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

    assert.ok(fs.existsSync(path.join(dir, '.hydrate', 'CURRENT_UOW.md')));
    assert.match(logs.join('\n'), /Not inside a git repository/);
  });
});
