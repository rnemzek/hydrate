const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');
const {
  buildPortfolio,
  buildOverview,
  buildArchitecture,
  buildStack,
  buildRoadmap,
  extractCompletedUows,
  parseRoadmapLine
} = require('../src/commands/export-portfolio');

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

function writeHydrateFile(dir, name, content) {
  fs.mkdirSync(path.join(dir, '.hydrate'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.hydrate', name), content);
}

function projectJournalLine(id, title, date, passed, total) {
  return `- [x] **[${id}]** ${title} — ${date} | Pass: ${passed}/${total} tests`;
}

function architectEntry(id, n, body = `- decision ${n}`) {
  return `### ${id} — completed 2026-09-0${n}\n${body}\n`;
}

// extractCompletedUows() ------------------------------------------------------

test('extractCompletedUows() returns [] for null/empty input', () => {
  assert.deepEqual(extractCompletedUows(null), []);
  assert.deepEqual(extractCompletedUows(''), []);
});

test('extractCompletedUows() parses PROJECT_JOURNAL.md completion lines in order', () => {
  const text = [
    projectJournalLine('UOW-HYDRATE-01', 'First thing', '2026-08-31', 48, 48),
    projectJournalLine('UOW-HYDRATE-02', 'Second thing', '2026-09-01', 64, 64)
  ].join('\n');

  const entries = extractCompletedUows(text);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0], { id: 'UOW-HYDRATE-01', title: 'First thing', date: '2026-08-31', testsPassed: 48, testsTotal: 48 });
  assert.deepEqual(entries[1], { id: 'UOW-HYDRATE-02', title: 'Second thing', date: '2026-09-01', testsPassed: 64, testsTotal: 64 });
});

test('extractCompletedUows() ignores non-matching lines', () => {
  const text = '# Project Plan Journal\n\nsome preamble\n- [ ] not done yet\n';
  assert.deepEqual(extractCompletedUows(text), []);
});

// buildOverview() --------------------------------------------------------------

test('buildOverview() falls back to dirname and empty description when package.json is absent', () => {
  const overview = buildOverview('/tmp/some-project', {}, null);
  assert.equal(overview.name, 'some-project');
  assert.equal(overview.description, '');
  assert.equal(overview.totalCompletedUows, 0);
  assert.equal(overview.latestMilestone, null);
});

test('buildOverview() reports the total count and the last-listed entry as the latest milestone', () => {
  const text = [
    projectJournalLine('UOW-01', 'First', '2026-08-31', 10, 10),
    projectJournalLine('UOW-02', 'Second', '2026-09-01', 20, 20)
  ].join('\n');

  const overview = buildOverview('/tmp/proj', { name: '@acme/widgets', description: 'Widgets.' }, text);
  assert.equal(overview.name, '@acme/widgets');
  assert.equal(overview.description, 'Widgets.');
  assert.equal(overview.totalCompletedUows, 2);
  assert.equal(overview.latestMilestone.id, 'UOW-02');
});

// buildArchitecture() -----------------------------------------------------------

test('buildArchitecture() returns [] for null input', () => {
  assert.deepEqual(buildArchitecture(null), []);
});

test('buildArchitecture() parses every decision-log block into a structured entry', () => {
  const text = [architectEntry('UOW-01', 1, '- Chose X over Y'), architectEntry('UOW-02', 2, '- Migrated Z')].join('\n');
  const entries = buildArchitecture(text);

  assert.equal(entries.length, 2);
  assert.equal(entries[0].id, 'UOW-01');
  assert.equal(entries[0].date, '2026-09-01');
  assert.match(entries[0].body, /Chose X over Y/);
  assert.equal(entries[1].id, 'UOW-02');
});

test('buildArchitecture() tolerates headings with no resolvable UOW ID or date', () => {
  const text = '### Miscellaneous notes\n- just a note\n';
  const entries = buildArchitecture(text);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, null);
  assert.equal(entries[0].date, null);
  assert.equal(entries[0].title, 'Miscellaneous notes');
});

// buildStack() --------------------------------------------------------------------

test('buildStack() extracts runtime, engines, bin, and dependency taxonomy from package.json', () => {
  const pkg = {
    name: '@acme/widgets',
    version: '1.2.3',
    license: 'MIT',
    type: 'module',
    engines: { node: '>=18' },
    bin: { widgets: 'bin/widgets.js' },
    dependencies: { hono: '^4.0.0' },
    devDependencies: { eslint: '^9.0.0' }
  };

  const stack = buildStack(pkg);
  assert.equal(stack.name, '@acme/widgets');
  assert.equal(stack.version, '1.2.3');
  assert.equal(stack.runtime, 'ESM');
  assert.deepEqual(stack.engines, { node: '>=18' });
  assert.deepEqual(stack.bin, { widgets: 'bin/widgets.js' });
  assert.deepEqual(stack.dependencies, [{ name: 'hono', version: '^4.0.0' }]);
  assert.deepEqual(stack.devDependencies, [{ name: 'eslint', version: '^9.0.0' }]);
});

test('buildStack() defaults to CommonJS runtime and empty taxonomy for a bare/missing package.json', () => {
  const stack = buildStack({});
  assert.equal(stack.name, null);
  assert.equal(stack.runtime, 'CommonJS');
  assert.deepEqual(stack.dependencies, []);
  assert.deepEqual(stack.devDependencies, []);
});

// parseRoadmapLine() / buildRoadmap() ----------------------------------------------

test('parseRoadmapLine() returns null for blank lines and horizontal rules', () => {
  assert.equal(parseRoadmapLine('', 'scheduled'), null);
  assert.equal(parseRoadmapLine('   ', 'scheduled'), null);
  assert.equal(parseRoadmapLine('---', 'scheduled'), null);
});

test('parseRoadmapLine() parses a checkbox bullet with an em-dash description', () => {
  const item = parseRoadmapLine('- [ ] **UOW-10:** Do the thing — because reasons', 'scheduled');
  assert.deepEqual(item, { id: 'UOW-10', title: 'Do the thing', status: 'scheduled', description: 'because reasons' });
});

test('parseRoadmapLine() marks a checked bullet as done', () => {
  const item = parseRoadmapLine('- [x] **UOW-01:** Shipped it', 'scheduled');
  assert.equal(item.status, 'done');
  assert.equal(item.id, 'UOW-01');
});

test('parseRoadmapLine() parses a plain concept bullet with a parenthetical description', () => {
  const item = parseRoadmapLine('- **UOW-06:** Scope Guardrails (hydrate diff / File Boundary Inspector)', 'backlog');
  assert.equal(item.id, 'UOW-06');
  assert.equal(item.title, 'Scope Guardrails');
  assert.equal(item.description, 'hydrate diff / File Boundary Inspector');
  assert.equal(item.status, 'backlog');
});

test('parseRoadmapLine() handles a bullet with no UOW ID token', () => {
  const item = parseRoadmapLine('- Some future idea', 'backlog');
  assert.equal(item.id, null);
  assert.equal(item.title, 'Some future idea');
  assert.equal(item.status, 'backlog');
});

test('buildRoadmap() returns empty scheduled/backlog arrays for null input', () => {
  assert.deepEqual(buildRoadmap(null), { scheduled: [], backlog: [] });
});

test('buildRoadmap() parses Section 1 and Section 2 independently', () => {
  const text = [
    '# Roadmap',
    '',
    '## Section 1: Scheduled Roadmap Items',
    '- [ ] **UOW-10:** Next thing',
    '- [x] **UOW-09:** Done thing',
    '',
    '## Section 2: Future features',
    '- **UOW-06:** Concept idea (some detail)'
  ].join('\n');

  const roadmap = buildRoadmap(text);
  assert.equal(roadmap.scheduled.length, 2);
  assert.equal(roadmap.scheduled[0].status, 'scheduled');
  assert.equal(roadmap.scheduled[1].status, 'done');
  assert.equal(roadmap.backlog.length, 1);
  assert.equal(roadmap.backlog[0].id, 'UOW-06');
});

// buildPortfolio() ----------------------------------------------------------------

test('buildPortfolio() degrades gracefully when package.json and .hydrate/ are entirely absent', () => {
  const dir = makeTempDir('hydrate-export-missing-');
  try {
    const portfolio = buildPortfolio(dir);
    assert.equal(portfolio.overview.totalCompletedUows, 0);
    assert.equal(portfolio.overview.latestMilestone, null);
    assert.deepEqual(portfolio.architecture, []);
    assert.deepEqual(portfolio.roadmap, { scheduled: [], backlog: [] });
    assert.ok(portfolio.generatedAt);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('buildPortfolio() degrades to an empty manifest when package.json is malformed JSON', () => {
  const dir = makeTempDir('hydrate-export-malformed-');
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), '{ not valid json');
    const portfolio = buildPortfolio(dir);
    assert.equal(portfolio.overview.name, path.basename(dir));
    assert.equal(portfolio.stack.name, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('buildPortfolio() compiles a full schema-compliant payload from a populated repo', () => {
  const dir = makeTempDir('hydrate-export-full-');
  try {
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: '@acme/widgets', description: 'Widgets.', version: '1.0.0', dependencies: { hono: '^4.0.0' } })
    );
    writeHydrateFile(dir, 'PROJECT_JOURNAL.md', projectJournalLine('UOW-01', 'First', '2026-08-31', 10, 10));
    writeHydrateFile(dir, 'ARCHITECT_JOURNAL.md', architectEntry('UOW-01', 1, '- decided X'));
    writeHydrateFile(
      dir,
      'ROADMAP.md',
      '## Section 1: Scheduled Roadmap Items\n- [ ] **UOW-02:** Next\n\n## Section 2: Future features\n- **UOW-03:** Idea (detail)\n'
    );

    const portfolio = buildPortfolio(dir);

    assert.equal(portfolio.overview.name, '@acme/widgets');
    assert.equal(portfolio.overview.totalCompletedUows, 1);
    assert.equal(portfolio.stack.dependencies[0].name, 'hono');
    assert.equal(portfolio.architecture[0].id, 'UOW-01');
    assert.equal(portfolio.roadmap.scheduled[0].id, 'UOW-02');
    assert.equal(portfolio.roadmap.backlog[0].id, 'UOW-03');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// CLI-level: `hydrate export-portfolio` ----------------------------------------------

test('hydrate export-portfolio writes valid JSON to the default ./tech-overview.json path', () => {
  const dir = makeTempDir('hydrate-export-cli-default-');
  try {
    runCli(['init'], dir);
    const result = runCli(['export-portfolio'], dir);

    assert.equal(result.status, 0);
    const outPath = path.join(dir, 'tech-overview.json');
    assert.ok(fs.existsSync(outPath));
    const parsed = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    assert.ok(parsed.overview);
    assert.ok(parsed.architecture);
    assert.ok(parsed.stack);
    assert.ok(parsed.roadmap);
    assert.match(result.stdout, /tech-overview\.json/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('hydrate export-portfolio --out writes to a custom path', () => {
  const dir = makeTempDir('hydrate-export-cli-out-');
  try {
    runCli(['init'], dir);
    const result = runCli(['export-portfolio', '--out', 'dist/custom.json'], dir);

    assert.equal(result.status, 0);
    const outPath = path.join(dir, 'dist', 'custom.json');
    assert.ok(fs.existsSync(outPath));
    JSON.parse(fs.readFileSync(outPath, 'utf8'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('hydrate export-portfolio -o is a short alias for --out', () => {
  const dir = makeTempDir('hydrate-export-cli-o-');
  try {
    runCli(['init'], dir);
    const result = runCli(['export-portfolio', '-o', 'short.json'], dir);

    assert.equal(result.status, 0);
    assert.ok(fs.existsSync(path.join(dir, 'short.json')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('hydrate export-portfolio --stdout streams JSON without writing a file', () => {
  const dir = makeTempDir('hydrate-export-cli-stdout-');
  try {
    runCli(['init'], dir);
    const result = runCli(['export-portfolio', '--stdout'], dir);

    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.ok(parsed.overview);
    assert.equal(fs.existsSync(path.join(dir, 'tech-overview.json')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('hydrate export alias behaves identically to export-portfolio', () => {
  const dir = makeTempDir('hydrate-export-cli-alias-');
  try {
    runCli(['init'], dir);
    const result = runCli(['export', '--stdout'], dir);

    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.ok(parsed.overview);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('hydrate export-portfolio is resilient to a completely missing .hydrate/ directory', () => {
  const dir = makeTempDir('hydrate-export-cli-nohydrate-');
  try {
    const result = runCli(['export-portfolio', '--stdout'], dir);

    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.overview.totalCompletedUows, 0);
    assert.deepEqual(parsed.roadmap, { scheduled: [], backlog: [] });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('hydrate export-portfolio --help shows subcommand help without mutating the tree', () => {
  const dir = makeTempDir('hydrate-export-cli-help-');
  try {
    const result = runCli(['export-portfolio', '--help'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /hydrate export-portfolio/);
    assert.match(result.stdout, /--stdout/);
    assert.equal(fs.existsSync(path.join(dir, 'tech-overview.json')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
