const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

function listArchivedUows(archiveDir) {
  if (!fs.existsSync(archiveDir)) return [];
  return fs
    .readdirSync(archiveDir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.slice(0, -3));
}

// Mirrors the "All UOWs are complete!" template placeholder hydrate complete
// resets .hydrate/CURRENT_UOW.md to — see bin/cli.js's handleComplete().
function isPlaceholderUow(text) {
  return !text || !text.trim() || /All UOWs are complete!/.test(text);
}

function extractUowId(text) {
  const match = text.match(/UOW-[A-Za-z0-9-]+/);
  return match ? match[0] : null;
}

function countOpenTasks(text) {
  return (text.match(/^\s*-\s\[\s\]/gm) || []).length;
}

// .hydrate/ROADMAP.md has no single fixed format across projects (checklist
// items vs. free-form epic bullets), so "has pending items" just checks for
// any non-heading, non-blank content beneath the title.
function hasPendingRoadmapItems(text) {
  if (!text) return false;
  return text
    .split('\n')
    .map((line) => line.trim())
    .some((line) => line && !/^#/.test(line));
}

function getGitStatus(cwd) {
  const result = spawnSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    return { available: false, modifiedFiles: [] };
  }
  const modifiedFiles = result.stdout
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => line.slice(3).trim());
  return { available: true, modifiedFiles };
}

function runTestSuite(cwd) {
  const result = spawnSync('npm', ['test', '--silent'], { cwd, encoding: 'utf8', timeout: 120000 });
  if (result.error) return { ran: false, passed: false };
  return { ran: true, passed: result.status === 0 };
}

// Inspects .hydrate/CURRENT_UOW.md, .hydrate/archive/, .hydrate/ROADMAP.md,
// and `git status` to reconcile exactly which of the states below the
// session is in. Pure-ish: the only side effects are read-only `git status`
// and (only when every CURRENT_UOW.md task is checked off) an `npm test`
// run, both needed to tell "done" from "done and passing" from "broken".
function runCheckup(cwd) {
  const hydrateDir = path.join(cwd, '.hydrate');

  if (!fs.existsSync(hydrateDir)) {
    return {
      state: 'error',
      message: '.hydrate/ directory not found. Run `hydrate init` first!'
    };
  }

  const currentUowText = readIfExists(path.join(hydrateDir, 'CURRENT_UOW.md'));
  const roadmapText = readIfExists(path.join(hydrateDir, 'ROADMAP.md'));
  const archivedIds = listArchivedUows(path.join(hydrateDir, 'archive'));
  const gitStatus = getGitStatus(cwd);

  if (isPlaceholderUow(currentUowText)) {
    const pending = hasPendingRoadmapItems(roadmapText);
    return {
      state: 'clean-slate',
      message: pending
        ? 'Ready for next task. Pending items available in .hydrate/ROADMAP.md.'
        : 'Ready for next task. No pending items found in .hydrate/ROADMAP.md yet.',
      gitStatus
    };
  }

  const uowId = extractUowId(currentUowText) || 'the active UOW';
  const openTasks = countOpenTasks(currentUowText);

  if (openTasks === 0 && !archivedIds.includes(uowId)) {
    const tests = runTestSuite(cwd);

    if (tests.ran && !tests.passed) {
      return {
        state: 'broken-build',
        message: `${uowId} has every task checked off, but \`npm test\` is failing. Fix the test suite before running \`hydrate complete\`.`,
        uowId,
        gitStatus,
        tests
      };
    }

    return {
      state: 'unarchived-done',
      message: `${uowId} is complete but unarchived. Run \`hydrate complete\` to archive.`,
      uowId,
      gitStatus,
      tests
    };
  }

  if (gitStatus.available && gitStatus.modifiedFiles.length > 0) {
    return {
      state: 'in-progress-dirty',
      message: `${uowId} is in progress with ${gitStatus.modifiedFiles.length} modified file${gitStatus.modifiedFiles.length === 1 ? '' : 's'} and ${openTasks} task${openTasks === 1 ? '' : 's'} remaining.`,
      uowId,
      openTasks,
      modifiedFiles: gitStatus.modifiedFiles,
      gitStatus
    };
  }

  return {
    state: 'in-progress-clean',
    message: `${uowId} is in progress with ${openTasks} task${openTasks === 1 ? '' : 's'} remaining. Working tree is clean.`,
    uowId,
    openTasks,
    gitStatus
  };
}

const STATE_ICONS = {
  error: '✘',
  'broken-build': '✘',
  'in-progress-dirty': '⚠',
  'in-progress-clean': '⚠',
  'unarchived-done': '✔',
  'clean-slate': '✔'
};

function formatCheckupReport(result) {
  const lines = ['', '💧 Hydrate Session Checkup', ''];

  lines.push(`  ${STATE_ICONS[result.state] || 'ℹ'} ${result.message}`);

  if (result.modifiedFiles && result.modifiedFiles.length) {
    lines.push('');
    lines.push('  Modified files:');
    result.modifiedFiles.forEach((file) => lines.push(`    - ${file}`));
  }

  lines.push('');
  return lines.join('\n');
}

module.exports = { runCheckup, formatCheckupReport };
