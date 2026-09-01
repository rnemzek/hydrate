const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');
const { buildArtifactsReport, RECOMMENDED_GITIGNORE } = require('../src/commands/artifacts');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hydrate-artifacts-test-'));
}

function withTempDir(fn) {
  const dir = makeTempDir();
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runCli(args, cwd) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: 'utf8', cwd });
}

// buildArtifactsReport() -----------------------------------------------------------------

test('buildArtifactsReport() notes missing .hydrate/ and .claude/commands/', () => {
  withTempDir((dir) => {
    const report = buildArtifactsReport(dir);
    assert.match(report, /\.hydrate\/[\s\S]*not found — run `hydrate init`/);
    assert.match(report, /\.claude\/commands\/[\s\S]*not found/);
  });
});

test('buildArtifactsReport() lists .hydrate/ journal files with descriptions after `hydrate init`', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    const report = buildArtifactsReport(dir);

    assert.match(report, /CURRENT_UOW\.md — Active Execution Canvas/);
    assert.match(report, /ROADMAP\.md — Tactical Roadmap/);
    assert.match(report, /archive\/ \(0 completed UOWs\)/);
  });
});

test('buildArtifactsReport() lists archived UOWs under archive/', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    fs.mkdirSync(path.join(dir, '.hydrate', 'archive'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.hydrate', 'archive', 'UOW-HYDRATE-01.md'), '# UOW-HYDRATE-01\n');

    const report = buildArtifactsReport(dir);
    assert.match(report, /archive\/ \(1 completed UOW\)/);
    assert.match(report, /UOW-HYDRATE-01\.md/);
  });
});

test('buildArtifactsReport() lists .claude/commands/ with descriptions after `hydrate init`', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    const report = buildArtifactsReport(dir);

    assert.match(report, /hydrate\.md — Unified master \/hydrate command/);
    assert.match(report, /hydrate-checkup\.md — Runs `hydrate checkup`/);
    assert.match(report, /hydrate-uow\.md — Inspect UOWs/);
    assert.match(report, /hydrate-artifacts\.md — Prints this artifact map/);
  });
});

test('buildArtifactsReport() prints the recommended .gitignore block', () => {
  withTempDir((dir) => {
    const report = buildArtifactsReport(dir);
    for (const entry of RECOMMENDED_GITIGNORE) {
      assert.ok(report.includes(entry), `expected report to include gitignore entry "${entry}"`);
    }
  });
});

// CLI integration -----------------------------------------------------------------

test('hydrate artifacts prints the artifact map', () => {
  withTempDir((dir) => {
    runCli(['init'], dir);
    const result = runCli(['artifacts'], dir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Hydrate Artifact Map/);
    assert.match(result.stdout, /Recommended \.gitignore/);
  });
});
