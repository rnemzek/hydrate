const fs = require('fs');
const path = require('path');
const { bold, dim, cyan, green, yellow } = require('./help');

const STATE_UNINITIALIZED = 'UNINITIALIZED';
const STATE_HYDRATE_DIR_ONLY = 'HYDRATE_DIR_ONLY';
const STATE_UOW_IN_PROGRESS = 'UOW_IN_PROGRESS';
const STATE_UOW_COMPLETED = 'UOW_COMPLETED';

function looksLikeExistingProject(cwd) {
  return (
    fs.existsSync(path.join(cwd, 'package.json')) ||
    fs.existsSync(path.join(cwd, '.git')) ||
    fs.existsSync(path.join(cwd, 'go.mod')) ||
    fs.existsSync(path.join(cwd, 'Cargo.toml'))
  );
}

function diagnose(cwd) {
  const hydrateDir = path.join(cwd, '.hydrate');
  const sessionPath = path.join(hydrateDir, 'session.json');
  const currentUowPath = path.join(hydrateDir, 'CURRENT_UOW.md');
  const roadmapPath = path.join(cwd, 'ROADMAP.md');

  const hasHydrateDir = fs.existsSync(hydrateDir);
  const hasSession = fs.existsSync(sessionPath);
  const hasCurrentUow = fs.existsSync(currentUowPath);
  const hasRoadmap = fs.existsSync(roadmapPath);

  if (!hasHydrateDir) {
    const brownfield = looksLikeExistingProject(cwd);
    return {
      state: STATE_UNINITIALIZED,
      status: 'No .hydrate/ directory found — this repo has not been onboarded yet.',
      recommendation: brownfield ? 'hydrate inject' : 'hydrate init',
      reason: brownfield
        ? 'Existing project files detected (package.json / .git / go.mod / Cargo.toml) — retrofit with inject.'
        : 'No existing project markers detected — scaffold fresh with init.'
    };
  }

  if (!hasCurrentUow) {
    return {
      state: STATE_HYDRATE_DIR_ONLY,
      status: `.hydrate/ exists${hasSession ? ' (session.json found)' : ''} but no CURRENT_UOW.md yet.`,
      recommendation: 'hydrate prompt',
      reason: hasRoadmap
        ? 'ROADMAP.md is present — prompt will pull the next pending UOW into scope.'
        : 'Run `hydrate init` first if you also want ROADMAP.md milestone tracking.'
    };
  }

  const content = fs.readFileSync(currentUowPath, 'utf8');
  const isAllComplete = content.includes('All UOWs are complete!');
  const statusMatch = content.match(/\*\*Status:\*\*\s*(\S+)/i);
  const status = statusMatch ? statusMatch[1].toUpperCase() : null;

  if (isAllComplete || status === 'COMPLETED') {
    return {
      state: STATE_UOW_COMPLETED,
      status: 'The active UOW is marked COMPLETED — the canvas is reset and ready for the next task.',
      recommendation: 'hydrate prompt',
      reason: hasRoadmap
        ? 'Pulls the next pending `[ ]` UOW out of ROADMAP.md.'
        : 'Add a new milestone to ROADMAP.md, then run prompt again.'
    };
  }

  const uowMatch = content.match(/UOW-[\w.-]+/);
  const uowId = uowMatch ? uowMatch[0] : 'the active UOW';
  const hasOpenTasks = /- \[ \]/.test(content);

  return {
    state: STATE_UOW_IN_PROGRESS,
    status: `${uowId} is in progress${hasOpenTasks ? ' with open checklist items' : ''}.`,
    recommendation: hasOpenTasks ? 'hydrate iterate "<reason>"' : 'hydrate complete',
    reason: hasOpenTasks
      ? 'Open tasks remain — log a pass with iterate as you fix/polish, or work the checklist directly.'
      : 'No open tasks left on the checklist — mark it done.'
  };
}

// Reuses the same "- [ ]" checklist convention `diagnose()` already scans
// for, but returns the actual lines so `hydrate complete` can print exactly
// which tasks are still open instead of just a yes/no.
function findOpenTasks(content) {
  return content
    .split('\n')
    .filter((line) => /^\s*-\s\[\s\]/.test(line))
    .map((line) => line.trim());
}

function renderDiagnosis(diagnosis) {
  const lines = [];
  lines.push('');
  lines.push(bold(cyan('💧 Hydrate State Check')));
  lines.push('');
  lines.push(bold('🔍 Current Status'));
  lines.push(`  ${diagnosis.status}`);
  lines.push('');
  lines.push(bold('🎯 Recommended Next Command'));
  lines.push(`  $ ${green(diagnosis.recommendation)}`);
  if (diagnosis.reason) {
    lines.push(dim(`  ${diagnosis.reason}`));
  }
  lines.push('');
  lines.push(dim('  New here? Run ') + yellow('hydrate greenfield') + dim(' or ') + yellow('hydrate brownfield') + dim(' for the full playbook.'));
  lines.push('');
  return lines.join('\n');
}

function runGuide() {
  const diagnosis = diagnose(process.cwd());
  console.log(renderDiagnosis(diagnosis));
  return diagnosis;
}

function printStep(n, cmd, desc) {
  console.log(`  ${bold(`${n}.`)} ${green(cmd)}`);
  console.log(`     ${desc}`);
  console.log('');
}

function printGreenfieldPlaybook() {
  console.log('');
  console.log(bold(cyan('🌱 GREENFIELD PLAYBOOK — Starting a Brand-New Project')));
  console.log(dim('For repos with no existing code, where hydrate owns the scaffolding from day one.'));
  console.log('');

  printStep(1, 'hydrate init', 'Creates AI_PROJECT_RULES.md, ROADMAP.md, .hydrate/CURRENT_UOW.md, and docs/journals/dev-journal.md. Existing files are never overwritten.');
  printStep(2, 'Edit ROADMAP.md', 'Product Owner defines the milestone sequence as `## [ ] UOW-XX: ...` blocks.');
  printStep(3, 'hydrate prompt', "Assembles the active UOW into .hydrate/CURRENT_UOW.md as the Lead Developer's execution payload.");
  printStep(4, 'hydrate prompt --architect', '(optional) Generates a chunked sync payload for the Lead Architect (Gemini).');
  printStep(5, 'hydrate iterate "<reason>"', '(as needed) Logs a bug-fix/polish pass against the active UOW without losing its original scope.');
  printStep(6, 'hydrate complete', 'Checks the UOW off in ROADMAP.md and resets the canvas for the next one.');

  console.log(dim('Loop steps 3–6 for every UOW in ROADMAP.md.'));
  console.log('');
}

function printBrownfieldPlaybook() {
  console.log('');
  console.log(bold(cyan('🏗  BROWNFIELD PLAYBOOK — Retrofitting an Existing Repo')));
  console.log(dim('For repos with existing code, where you want hydrate context without disrupting anything.'));
  console.log('');

  printStep(1, 'hydrate inject', 'Auto-detects stack/commands from package.json, tsconfig.json, and git log, then non-destructively syncs CLAUDE.md + .hydrate/session.json. Zero prompts.');
  printStep(2, 'Review CLAUDE.md', 'Content inside the HYDRATE markers is regenerated on every inject; edit outside the markers for anything that should persist.');
  printStep(3, 'hydrate init', '(optional) Adds ROADMAP.md + .hydrate/CURRENT_UOW.md if you also want UOW tracking, not just the CLAUDE.md sync.');
  printStep(4, 'hydrate prompt', 'Assembles the active UOW into .hydrate/CURRENT_UOW.md.');
  printStep(5, 'hydrate iterate "<reason>"', '(as needed) Logs a bug-fix/polish pass against the active UOW.');
  printStep(6, 'hydrate complete', 'Checks the UOW off and resets the canvas for the next one.');

  console.log(dim('Re-run inject any time to refresh detected stack/commands as the repo evolves.'));
  console.log('');
}

module.exports = {
  diagnose,
  renderDiagnosis,
  runGuide,
  findOpenTasks,
  printGreenfieldPlaybook,
  printBrownfieldPlaybook,
  STATE_UNINITIALIZED,
  STATE_HYDRATE_DIR_ONLY,
  STATE_UOW_IN_PROGRESS,
  STATE_UOW_COMPLETED
};
