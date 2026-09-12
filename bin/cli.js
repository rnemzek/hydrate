#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { runInit } = require('../src/init');
const { HELP_FLAGS, VERSION_FLAGS, COMMANDS, printVersion, printGlobalHelp, printCommandHelp } = require('../src/help');
const { copyToClipboard } = require('../src/utils/clipboard');
const { loadTemplate } = require('../src/templates');
const { runCheck, formatReport } = require('../src/commands/check');
const { runCheckup, formatCheckupReport } = require('../src/commands/checkup');
const { buildContext } = require('../src/commands/context');
const { buildPortfolio } = require('../src/commands/export-portfolio');
const { runIngest } = require('../src/commands/ingest');
const { listUows, getLastUow, getUowById, formatUowList } = require('../src/commands/uow');
const { buildArtifactsReport } = require('../src/commands/artifacts');
const { runSync } = require('../src/commands/sync');
const { runUpdate } = require('../src/commands/update');
const { runEject } = require('../src/commands/eject');
const { runHook } = require('../src/commands/hook');
const { checkVersionDrift, formatDriftBanner } = require('../src/utils/version-check');
const { getPackageVersion } = require('../src/utils/pkg');

const args = process.argv.slice(2);
const command = args[0];
const rest = args.slice(1);
const isLfgCommand = Boolean(command) && command.toLowerCase() === 'lfg';

if (VERSION_FLAGS.includes(command)) {
  printVersion();
  process.exit(0);
}

if (!command || command === 'help' || HELP_FLAGS.includes(command)) {
  printGlobalHelp();
  process.exit(0);
}

if (COMMANDS[command] && rest.some((arg) => HELP_FLAGS.includes(arg))) {
  printCommandHelp(command);
  process.exit(0);
}

if (isLfgCommand) {
  handleLfg(rest);
} else {
  switch (command) {
    case 'init':
      runInit();
      break;

    case 'prompt':
      generatePrompt(rest);
      break;

    case 'complete':
      handleComplete(rest);
      break;

    case 'clip':
      handleClip();
      break;

    case 'check':
      handleCheck();
      break;

    case 'checkup':
    case 'status':
      handleCheckup();
      break;

    case 'context':
      handleContext(rest);
      break;

    case 'export-portfolio':
    case 'export':
      handleExportPortfolio(rest);
      break;

    case 'ingest':
    case 'paste':
      handleIngest(rest);
      break;

    case 'uow':
      handleUow(rest);
      break;

    case 'artifacts':
      handleArtifacts();
      break;

    case 'sync':
      handleSync(rest);
      break;

    case 'update':
      handleUpdate(rest);
      break;

    case 'eject':
      handleEject(rest);
      break;

    case 'hook':
      handleHook(rest);
      break;

    default:
      printGlobalHelp();
      break;
  }
}

function getProjectName(cwd) {
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name) return pkg.name;
    } catch {
      // Malformed package.json — fall through to the directory name.
    }
  }
  return path.basename(cwd);
}

// Prepended to the Lead Developer payload so an agent reading it can confirm
// its cwd matches the repo the payload was generated for before editing —
// guards against a stale/copy-pasted payload being applied in the wrong repo.
function renderRepoFingerprint(cwd) {
  return `# 🔒 REPO FINGERPRINT — VERIFY BEFORE EDITING
Project: ${getProjectName(cwd)}
Working Directory (absolute): ${cwd}

⚠ SAFETY: Before executing any file edits, confirm your current working
directory and open project match the path above exactly. If they do not
match, STOP and alert the Product Owner instead of proceeding.
`;
}

function getPaths() {
  const cwd = process.cwd();
  return {
    cwd,
    claudePath: path.join(cwd, 'CLAUDE.md'),
    roadmapPath: path.join(cwd, '.hydrate', 'ROADMAP.md'),
    projectJournalPath: path.join(cwd, '.hydrate', 'PROJECT_JOURNAL.md'),
    hydrateDir: path.join(cwd, '.hydrate'),
    currentUowPath: path.join(cwd, '.hydrate', 'CURRENT_UOW.md')
  };
}

// Reuses the "- [ ]" checklist convention .hydrate/ROADMAP.md and
// .hydrate/CURRENT_UOW.md share, but returns the actual lines so
// `hydrate complete` can print exactly which tasks are still open instead of
// just a yes/no.
function findOpenTasks(content) {
  return content
    .split('\n')
    .filter((line) => /^\s*-\s\[\s\]/.test(line))
    .map((line) => line.trim());
}

// Scans .hydrate/ROADMAP.md's "## Section 1" (Scheduled Roadmap Items)
// section for the first unchecked `- [ ] ...` bullet, used as a fallback
// active-UOW scope when .hydrate/CURRENT_UOW.md is empty/reset. Returns null
// if the section is missing or every item is checked off.
function findNextPendingUow(roadmapText) {
  const lines = roadmapText.split('\n');
  let inSection1 = false;

  for (const line of lines) {
    if (/^##\s*Section 1\b/i.test(line)) {
      inSection1 = true;
      continue;
    }
    if (inSection1 && /^##\s/.test(line)) break;
    if (!inSection1) continue;

    const match = line.match(/^\s*-\s\[ \]\s*(.+)$/);
    if (match) return match[1].trim();
  }

  return null;
}

function generatePrompt(options) {
  const { cwd, claudePath, roadmapPath, hydrateDir, currentUowPath } = getPaths();

  if (!fs.existsSync(roadmapPath) || !fs.existsSync(claudePath)) {
    console.error("❌ Error: Missing .hydrate/ROADMAP.md or CLAUDE.md. Run `hydrate init` first!");
    process.exit(1);
  }

  const roadmapText = fs.readFileSync(roadmapPath, 'utf8');
  const rulesText = fs.readFileSync(claudePath, 'utf8');

  // Read active UOW from .hydrate/CURRENT_UOW.md if it exists
  let activeUowScope = "";
  if (fs.existsSync(currentUowPath)) {
    activeUowScope = fs.readFileSync(currentUowPath, 'utf8');
  }

  if (!activeUowScope || activeUowScope.includes("All UOWs are complete!")) {
    // Fall back to scanning .hydrate/ROADMAP.md's Task Index for the next pending UOW
    const pending = findNextPendingUow(roadmapText);
    activeUowScope = pending || "All UOWs are complete!";
  }

  const isArchitect = options.includes('--architect');
  const shouldCopy = options.includes('--copy') || options.includes('-c');

  let chunkSize = 3000;
  const chunkSizeArg = options.find(arg => arg.startsWith('--chunk-size='));
  if (chunkSizeArg) {
    const parsed = parseInt(chunkSizeArg.split('=')[1], 10);
    if (!isNaN(parsed) && parsed > 0) chunkSize = parsed;
  }

  if (isArchitect) {
    const rawPayload = `
PROJECT: ${path.basename(cwd)}
DATE: ${new Date().toLocaleDateString()}

### 1. ARCHITECTURAL & EXECUTION CONSTRAINTS
${rulesText}

### 2. ACTIVE SPRINT SCOPE (.hydrate/CURRENT_UOW.md)
${activeUowScope}
`;

    outputChunkedArchitectPayload(rawPayload, chunkSize);
    // Chunks are already on stdout, so a failed copy doesn't need to reprint them.
    if (shouldCopy) copyWithFeedback(rawPayload, { printFallback: false });
    return;
  }

  // Lead Developer payload written to disk
  const devPayload = `${renderRepoFingerprint(cwd)}
# HYDRATE LEAD DEVELOPER EXECUTION PAYLOAD
# Generated by @nemzilla/hydrate at ${new Date().toISOString()}

## Architectural & System Execution Rules
${rulesText}

## Target Task Scope & Active Sprint
${activeUowScope}

## Execution Instruction
Read this payload and stand by. Do not execute destructive file edits until instructed by the Product Owner.
`;

  if (!fs.existsSync(hydrateDir)) {
    fs.mkdirSync(hydrateDir, { recursive: true });
  }

  fs.writeFileSync(currentUowPath, devPayload, 'utf8');

  console.log(`
💧 Hydrate Context Synced!
  ✔ Wrote active payload to: .hydrate/CURRENT_UOW.md

⚡ NEXT STEPS:
   1. Run 'hydrate prompt --architect' to get Gemini's sync payload.
   2. Launch 'yolo' and type 'hydrate' to lock Claude Code onto this task.
   3. Run 'hydrate complete' once every task above is checked off.
  `);

  if (shouldCopy) copyWithFeedback(devPayload);
}

// Shared by `hydrate prompt --copy` and `hydrate clip`: tries the platform
// clipboard tool and falls back to printing `text` to stdout so the payload
// is never just silently lost when pbcopy/xclip/xsel/clip aren't installed.
function copyWithFeedback(text, { printFallback = true } = {}) {
  const copied = copyToClipboard(text);

  if (copied) {
    console.log('✔ Copied UOW context to clipboard!');
  } else if (printFallback) {
    console.log(`
⚠ No clipboard tool found (pbcopy/xclip/xsel/clip) — printing context instead:

${text}`);
  } else {
    console.log('⚠ No clipboard tool found (pbcopy/xclip/xsel/clip) — context already printed above.');
  }

  return copied;
}

function handleClip() {
  const { currentUowPath } = getPaths();

  if (!fs.existsSync(currentUowPath)) {
    console.error("❌ Error: No active .hydrate/CURRENT_UOW.md found. Run `hydrate prompt` first!");
    process.exit(1);
  }

  const content = fs.readFileSync(currentUowPath, 'utf8');
  copyWithFeedback(content);
}

function handleComplete(options = []) {
  const { cwd, roadmapPath, projectJournalPath, currentUowPath } = getPaths();
  const force = options.includes('--force') || options.includes('-f');

  if (!fs.existsSync(currentUowPath)) {
    console.error("❌ Error: No active .hydrate/CURRENT_UOW.md found!");
    process.exit(1);
  }

  const uowContent = fs.readFileSync(currentUowPath, 'utf8');
  // Hyphens are part of the ID itself (e.g. "UOW-HYDRATE-01", "UOW-HOTFIX-03"),
  // so \w alone (which excludes "-") would truncate at the first sub-slug.
  const uowMatch = uowContent.match(/UOW-[A-Za-z0-9-]+/);
  if (!uowMatch) {
    console.error("❌ Error: Could not determine active UOW ID from .hydrate/CURRENT_UOW.md");
    process.exit(1);
  }

  const openTasks = findOpenTasks(uowContent);
  if (openTasks.length > 0 && !force) {
    console.error(`
❌ Cannot complete ${uowMatch[0]}: ${openTasks.length} unchecked task${openTasks.length === 1 ? '' : 's'} remain in .hydrate/CURRENT_UOW.md

${openTasks.map((line) => `  ${line}`).join('\n')}

⚡ Check off every task above, or run 'hydrate complete --force' to close it out anyway.
`);
    process.exit(1);
  }

  const baseUow = uowMatch[0];
  const iterCount = ([...uowContent.matchAll(/\[Iteration Pass\]/g)] || []).length;
  const titleMatch = uowContent.match(/\*\*Title:\*\*\s*(.+)/);
  const commitSubject = titleMatch ? `feat: complete ${baseUow} — ${titleMatch[1].trim()}` : `feat: complete ${baseUow}`;
  const roadmapRelPath = path.relative(cwd, roadmapPath);
  const projectJournalRelPath = path.relative(cwd, projectJournalPath);

  let markedInRoadmap = false;
  if (fs.existsSync(roadmapPath)) {
    let roadmapText = fs.readFileSync(roadmapPath, 'utf8');

    // Matches both heading style ("## [ ] UOW-05: Title") and list-item
    // style ("- [ ] **UOW-05**: Title" / "- [ ] **UOW-05:** Title") inside
    // .hydrate/ROADMAP.md's Scheduled Roadmap Items section.
    const activeRegex = new RegExp(`^([-#]+) \\[ \\] (.*\\b${baseUow}\\b.*)$`, 'm');
    if (activeRegex.test(roadmapText)) {
      roadmapText = roadmapText.replace(activeRegex, (_match, prefix, rest) => `${prefix} [x] ${rest} (Iterated: ${iterCount})`);
      markedInRoadmap = true;
      fs.writeFileSync(roadmapPath, roadmapText, 'utf8');
    }
  }

  const loggedToJournal = fs.existsSync(projectJournalPath);
  if (loggedToJournal) {
    // Append-only completion entry to the end of .hydrate/PROJECT_JOURNAL.md.
    let journalText = fs.readFileSync(projectJournalPath, 'utf8');
    const completedAt = new Date().toISOString().slice(0, 10);
    const logEntry = `### ${baseUow} — completed ${completedAt}\n- Iterations logged: ${iterCount}\n- Suggested commit: \`${commitSubject}\`\n`;
    journalText = `${journalText.trimEnd()}\n\n${logEntry}`;

    fs.writeFileSync(projectJournalPath, journalText, 'utf8');
  }

  // Archive the finished canvas before resetting it, so completed UOWs
  // remain inspectable under .hydrate/archive/ instead of being overwritten.
  const archiveDir = path.join(path.dirname(currentUowPath), 'archive');
  fs.mkdirSync(archiveDir, { recursive: true });
  const archivePath = path.join(archiveDir, `${baseUow}.md`);
  fs.writeFileSync(archivePath, uowContent, 'utf8');
  const archiveRelPath = path.relative(process.cwd(), archivePath);

  // Clear CURRENT_UOW.md for next task
  fs.writeFileSync(currentUowPath, loadTemplate(path.join('.hydrate', 'CURRENT_UOW.md')), 'utf8');

  console.log(`
🎉 ${baseUow} Officially Complete!
  ${markedInRoadmap ? `✔ Marked ${baseUow} as [x] in ${roadmapRelPath} (Iterated: ${iterCount})\n  ` : ''}✔ Archived canvas to ${archiveRelPath}
  ${loggedToJournal ? `✔ Logged completion to ${projectJournalRelPath}\n  ` : ''}✔ Sprint scope reset in .hydrate/CURRENT_UOW.md
  ✔ Total iteration passes logged: ${iterCount}${openTasks.length > 0 ? `\n  ⚠ Forced past ${openTasks.length} unchecked task${openTasks.length === 1 ? '' : 's'} (--force)` : ''}

⚡ Suggested commit:
   git add -A && git commit -m "${commitSubject}"
`);
}

function handleCheck() {
  const { cwd } = getPaths();
  const result = runCheck(cwd);
  console.log(formatReport(result));
  process.exit(result.ok ? 0 : 1);
}

// Update nags only render for a real interactive terminal session — a
// spawned/piped invocation (`isTTY` false, e.g. every CLI-level test, or a
// script capturing output) never triggers the npm registry lookup. This is
// the same convention tools like npm's own update-notifier use to stay
// silent in CI/non-interactive contexts, and it keeps `hydrate checkup`
// fully offline/hermetic under `npm test`.
function shouldCheckForUpdates() {
  return Boolean(process.stdout.isTTY) && !process.env.CI;
}

function printUpdateBannerIfStale() {
  if (!shouldCheckForUpdates()) return;
  try {
    const drift = checkVersionDrift(getPackageVersion());
    if (drift.driftDetected) console.log(formatDriftBanner(drift));
  } catch {
    // Best-effort — the update check must never break `hydrate checkup`.
  }
}

function handleCheckup() {
  const { cwd } = getPaths();
  const result = runCheckup(cwd);
  console.log(formatCheckupReport(result));
  printUpdateBannerIfStale();
  process.exit(result.state === 'error' || result.state === 'broken-build' ? 1 : 0);
}

function handleContext(options = []) {
  const { cwd } = getPaths();
  const shouldCopy = options.includes('--clip') || options.includes('-c');

  let depth = 3;
  const depthFlagIndex = options.findIndex((arg) => arg === '--depth');
  if (depthFlagIndex !== -1 && options[depthFlagIndex + 1] !== undefined) {
    const parsed = parseInt(options[depthFlagIndex + 1], 10);
    if (!isNaN(parsed) && parsed > 0) depth = parsed;
  }
  const depthEqArg = options.find((arg) => arg.startsWith('--depth='));
  if (depthEqArg) {
    const parsed = parseInt(depthEqArg.split('=')[1], 10);
    if (!isNaN(parsed) && parsed > 0) depth = parsed;
  }

  const payload = buildContext(cwd, { depth });
  console.log(payload);

  if (shouldCopy) copyWithFeedback(payload, { printFallback: false });
}

function handleExportPortfolio(options = []) {
  const { cwd } = getPaths();
  const toStdout = options.includes('--stdout');

  let outPath = './tech-overview.json';
  const outFlagIndex = options.findIndex((arg) => arg === '--out' || arg === '-o');
  if (outFlagIndex !== -1 && options[outFlagIndex + 1] !== undefined) {
    outPath = options[outFlagIndex + 1];
  }
  const outEqArg = options.find((arg) => arg.startsWith('--out='));
  if (outEqArg) outPath = outEqArg.split('=')[1];

  const portfolio = buildPortfolio(cwd);
  const json = JSON.stringify(portfolio, null, 2);

  if (toStdout) {
    console.log(json);
    return;
  }

  const resolvedOutPath = path.resolve(cwd, outPath);
  fs.mkdirSync(path.dirname(resolvedOutPath), { recursive: true });
  fs.writeFileSync(resolvedOutPath, `${json}\n`, 'utf8');

  console.log(`
💧 Portfolio Overview Exported!
  ✔ Wrote ${path.relative(cwd, resolvedOutPath)}
`);
}

function handleIngest(options = [], { lfg = false } = {}) {
  const { cwd } = getPaths();
  const yes = options.includes('--yes') || options.includes('-y');

  runIngest(cwd, { yes, lfg })
    .then((result) => {
      process.exit(result.code);
    })
    .catch((err) => {
      console.error(`❌ Error: ${err.message}`);
      process.exit(1);
    });
}

// Easter egg alias: `hydrate lfg` (case-insensitive) runs the state
// checkup pre-flight, then hands straight into the clipboard ingest flow —
// a single command reconciling session state and launching execution.
function handleLfg(options = []) {
  const { cwd } = getPaths();
  const result = runCheckup(cwd);
  console.log(formatCheckupReport(result));
  handleIngest(options, { lfg: true });
}

// Routes `hydrate uow [list|last|<id>]`. Defaults to `list` so the
// /hydrate-uow slash command can shell out to `hydrate uow $ARGUMENTS`
// even when no argument was given.
function handleUow(options = []) {
  const { cwd } = getPaths();
  const sub = options[0] || 'list';

  if (sub === 'list') {
    console.log(formatUowList(listUows(cwd)));
    return;
  }

  if (sub === 'last') {
    const last = getLastUow(cwd);
    if (!last) {
      console.error('❌ Error: No archived UOWs found in .hydrate/archive/.');
      process.exit(1);
    }
    console.log(last.content);
    return;
  }

  const found = getUowById(cwd, sub);
  if (!found) {
    console.error(`❌ Error: No UOW found matching "${sub}" (checked active canvas and .hydrate/archive/).`);
    process.exit(1);
  }
  console.log(found.content);
}

function handleArtifacts() {
  const { cwd } = getPaths();
  console.log(buildArtifactsReport(cwd));
}

// Shared `--flag <value>` / `--flag=<value>` reader used by the Track 2
// lifecycle commands (sync/eject's `--path`).
function findFlagValue(options, flag) {
  const idx = options.findIndex((arg) => arg === flag);
  if (idx !== -1 && options[idx + 1] !== undefined) return options[idx + 1];
  const eqArg = options.find((arg) => arg.startsWith(`${flag}=`));
  return eqArg ? eqArg.split('=').slice(1).join('=') : undefined;
}

function handleSync(options = []) {
  const { cwd } = getPaths();
  const recursive = options.includes('--recursive') || options.includes('-r');
  const targetPath = findFlagValue(options, '--path');

  console.log('\n💧 Hydrate Workspace Sync\n');
  const results = runSync(cwd, { recursive, targetPath });
  console.log(`\n✔ Sync complete — ${results.length} repo${results.length === 1 ? '' : 's'} checked.\n`);
}

function handleUpdate(options = []) {
  const { cwd } = getPaths();
  const global = !(options.includes('--local') || options.includes('-l'));

  console.log('\n💧 Hydrate Self-Update\n');
  const result = runUpdate(cwd, { global });
  process.exit(result.code);
}

function handleEject(options = []) {
  const { cwd } = getPaths();
  const recursive = options.includes('--recursive') || options.includes('-r');
  const dryRun = options.includes('--dry-run');
  const force = options.includes('--force') || options.includes('-f');
  const targetPath = findFlagValue(options, '--path');

  runEject(cwd, { recursive, targetPath, dryRun, force })
    .then((result) => process.exit(result.code))
    .catch((err) => {
      console.error(`❌ Error: ${err.message}`);
      process.exit(1);
    });
}

function handleHook(options = []) {
  const action = options[0];
  const result = runHook(action, {});
  process.exit(result.code);
}

function outputChunkedArchitectPayload(payload, chunkSize) {
  if (payload.length <= chunkSize) {
    console.log(`
=================== 💧 HYDRATE ARCHITECT SYNC DUMP ===================
${payload}
======================================================================
⚡ Copy the block above and paste it into Gemini (Lead Architect)!
`);
    return;
  }

  const chunks = [];
  let currentPos = 0;
  while (currentPos < payload.length) {
    chunks.push(payload.slice(currentPos, currentPos + chunkSize));
    currentPos += chunkSize;
  }

  console.log(`\n⚠️  Payload exceeds limit (${payload.length} chars, limit ${chunkSize}). Split into ${chunks.length} chunks:\n`);

  chunks.forEach((chunk, index) => {
    const isLast = index === chunks.length - 1;
    console.log(`
=================== 💧 HYDRATE ARCHITECT DUMP [CHUNK ${index + 1} OF ${chunks.length}] ===================
${chunk}
========================================================================================
${isLast ? '⚡ ALL CHUNKS PRINTED. Copy and paste chunks into Gemini, then type "Andiamo" when done!' : '👇 NEXT CHUNK BELOW 👇'}
`);
  });
}
