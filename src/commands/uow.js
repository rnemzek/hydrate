const fs = require('fs');
const path = require('path');

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
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

// Archive filenames aren't a reliable sort key on their own (UOW-01 vs.
// UOW-HYDRATE-08 vs. UOW-HYDRATE-01-HOTFIX don't share a numbering scheme),
// so "chronologically" is derived from each archived file's mtime instead —
// the actual moment `hydrate complete` wrote it to .hydrate/archive/.
function listArchivedUows(archiveDir) {
  if (!fs.existsSync(archiveDir)) return [];

  return fs
    .readdirSync(archiveDir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const filePath = path.join(archiveDir, name);
      const stat = fs.statSync(filePath);
      return { id: name.slice(0, -3), path: filePath, mtimeMs: stat.mtimeMs };
    })
    .sort((a, b) => a.mtimeMs - b.mtimeMs);
}

// Lists the active UOW (if any) plus every archived UOW, oldest first.
function listUows(cwd) {
  const hydrateDir = path.join(cwd, '.hydrate');
  const currentUowText = readIfExists(path.join(hydrateDir, 'CURRENT_UOW.md'));
  const archived = listArchivedUows(path.join(hydrateDir, 'archive'));

  const active = isPlaceholderUow(currentUowText)
    ? null
    : { id: extractUowId(currentUowText) || 'UNKNOWN', path: path.join(hydrateDir, 'CURRENT_UOW.md') };

  return { active, archived };
}

// Returns { id, path, content } for the most recently archived UOW, or null
// if .hydrate/archive/ is empty.
function getLastUow(cwd) {
  const archiveDir = path.join(path.join(cwd, '.hydrate'), 'archive');
  const archived = listArchivedUows(archiveDir);
  if (archived.length === 0) return null;

  const last = archived[archived.length - 1];
  return { id: last.id, path: last.path, content: fs.readFileSync(last.path, 'utf8') };
}

// Resolves a UOW by ID (case-insensitive), checking the active canvas first
// and then .hydrate/archive/. Returns { id, path, content, active } or null.
function getUowById(cwd, id) {
  const hydrateDir = path.join(cwd, '.hydrate');
  const needle = id.toLowerCase();

  const currentUowPath = path.join(hydrateDir, 'CURRENT_UOW.md');
  const currentUowText = readIfExists(currentUowPath);
  if (!isPlaceholderUow(currentUowText)) {
    const activeId = extractUowId(currentUowText);
    if (activeId && activeId.toLowerCase() === needle) {
      return { id: activeId, path: currentUowPath, content: currentUowText, active: true };
    }
  }

  const archived = listArchivedUows(path.join(hydrateDir, 'archive'));
  const match = archived.find((entry) => entry.id.toLowerCase() === needle);
  if (!match) return null;

  return { id: match.id, path: match.path, content: fs.readFileSync(match.path, 'utf8'), active: false };
}

function formatUowList(result) {
  const lines = ['', '💧 Hydrate UOW Index', ''];

  lines.push(result.active ? `  ▶ Active: ${result.active.id}` : '  ▶ Active: none (ready for next task)');

  lines.push('');
  if (result.archived.length === 0) {
    lines.push('  Archived: none yet');
  } else {
    lines.push(`  Archived (${result.archived.length}, chronological):`);
    result.archived.forEach(({ id }, i) => lines.push(`    ${i + 1}. ${id}`));
  }

  lines.push('');
  return lines.join('\n');
}

module.exports = { listUows, getLastUow, getUowById, formatUowList };
