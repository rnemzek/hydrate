const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { readFromClipboard } = require('../utils/clipboard');

// A clipboard payload must carry a "# UOW-..." id header AND at least one of
// the UOW spec's standard section markers — requiring both keeps a stray
// "# UOW-" mention in unrelated text from being treated as a real payload.
const UOW_HEADER_RE = /^#{1,3}\s*UOW-[A-Za-z0-9-]+/m;
const SECTION_MARKER_RE = /Goal\s*&\s*Context|Surgical Scope|Acceptance Criteria/i;

function isValidUowPayload(text) {
  return Boolean(text && text.trim() && UOW_HEADER_RE.test(text) && SECTION_MARKER_RE.test(text));
}

// Mirrors the "All UOWs are complete!" placeholder hydrate complete resets
// .hydrate/CURRENT_UOW.md to — see bin/cli.js's handleComplete().
function isEmptyUow(text) {
  return !text || !text.trim() || /All UOWs are complete!/.test(text);
}

function extractUowId(text) {
  const match = text && text.match(/UOW-[A-Za-z0-9-]+/);
  return match ? match[0] : null;
}

function renderBanner({ lfg = false } = {}) {
  const lines = [
    '',
    '╔══════════════════════════════════════╗',
    '║        ⚙️  HYDRATE ENGINE             ║',
    '╚══════════════════════════════════════╝'
  ];
  if (lfg) lines.push('🚀 LFG! Reconciling session state and diving in...');
  lines.push('');
  return lines.join('\n');
}

function archiveCurrentUow(cwd, currentUowText) {
  const uowId = extractUowId(currentUowText) || `UOW-UNKNOWN-${Date.now()}`;
  const archiveDir = path.join(cwd, '.hydrate', 'archive');
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.writeFileSync(path.join(archiveDir, `${uowId}.md`), currentUowText, 'utf8');
  return uowId;
}

function applyClipboardPayload(cwd, clipboardText) {
  const currentUowPath = path.join(cwd, '.hydrate', 'CURRENT_UOW.md');
  fs.mkdirSync(path.dirname(currentUowPath), { recursive: true });
  fs.writeFileSync(currentUowPath, clipboardText, 'utf8');
}

function askOption(question, { input, output }) {
  const rl = readline.createInterface({ input, output });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(String(answer || '').trim());
    });
  });
}

const CHAT_EXIT_MESSAGE = '👋 Handing off to AI Architect — chat with Claude Code to continue.';

// Core of `hydrate ingest` / `hydrate paste`. Every I/O seam (clipboard,
// stdin/stdout, logging) is injectable so this can be exercised directly in
// tests without a real clipboard tool or a pty.
async function runIngest(cwd, options = {}) {
  const {
    yes = false,
    lfg = false,
    readClipboard = readFromClipboard,
    input = process.stdin,
    output = process.stdout,
    log = console.log,
    error = console.error
  } = options;

  const clipboardText = readClipboard();

  if (clipboardText === null || clipboardText === undefined) {
    error('❌ Error: Unable to read the system clipboard (no clipboard tool found).');
    return { code: 1, action: 'no-clipboard-tool' };
  }

  if (!isValidUowPayload(clipboardText)) {
    error(
      '\n❌ Error: Clipboard content does not resemble a valid UOW spec.\n' +
        '   Expected a "# UOW-..." header plus a Goal & Context / Surgical Scope / Acceptance Criteria section.\n' +
        '   .hydrate/CURRENT_UOW.md was NOT modified.\n'
    );
    return { code: 1, action: 'rejected-invalid-payload' };
  }

  const currentUowPath = path.join(cwd, '.hydrate', 'CURRENT_UOW.md');
  const currentUowText = fs.existsSync(currentUowPath) ? fs.readFileSync(currentUowPath, 'utf8') : '';
  const empty = isEmptyUow(currentUowText);

  log(renderBanner({ lfg }));

  if (yes) {
    if (!empty) archiveCurrentUow(cwd, currentUowText);
    applyClipboardPayload(cwd, clipboardText);
    log(`✔ Clipboard UOW payload applied to .hydrate/CURRENT_UOW.md${empty ? '' : ' (previous UOW archived)'}.`);
    return { code: 0, action: empty ? 'applied' : 'archived-and-swapped' };
  }

  if (empty) {
    log('.hydrate/CURRENT_UOW.md is empty.\n\n  [1] Apply clipboard payload to CURRENT_UOW.md\n  [2] Chat / Exit\n');
    const answer = await askOption('Select an option: ', { input, output });

    if (answer === '1') {
      applyClipboardPayload(cwd, clipboardText);
      log('✔ Clipboard UOW payload applied to .hydrate/CURRENT_UOW.md.');
      return { code: 0, action: 'applied' };
    }

    log(CHAT_EXIT_MESSAGE);
    return { code: 0, action: 'chat-exit' };
  }

  log(
    '.hydrate/CURRENT_UOW.md has active/uncompleted work.\n\n' +
      '  [1] Archive current and swap with clipboard UOW\n' +
      '  [2] Overwrite current UOW\n' +
      '  [3] Chat / Exit\n'
  );
  const answer = await askOption('Select an option: ', { input, output });

  if (answer === '1') {
    archiveCurrentUow(cwd, currentUowText);
    applyClipboardPayload(cwd, clipboardText);
    log('✔ Archived previous UOW and applied clipboard payload to .hydrate/CURRENT_UOW.md.');
    return { code: 0, action: 'archived-and-swapped' };
  }

  if (answer === '2') {
    applyClipboardPayload(cwd, clipboardText);
    log('✔ Overwrote .hydrate/CURRENT_UOW.md with clipboard payload.');
    return { code: 0, action: 'overwritten' };
  }

  log(CHAT_EXIT_MESSAGE);
  return { code: 0, action: 'chat-exit' };
}

module.exports = {
  runIngest,
  isValidUowPayload,
  isEmptyUow,
  extractUowId,
  renderBanner
};
