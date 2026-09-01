const fs = require('fs');
const path = require('path');

const DEFAULT_DEPTH = 3;

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

// Small, deliberately-duplicated copy of bin/cli.js's getProjectName() —
// bin/cli.js runs top-level command dispatch on require, so it can't be
// required as a library from here without side effects.
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

// ARCHITECT_JOURNAL.md is a flat sequence of "### <heading>" decision-log
// blocks (see .hydrate/ARCHITECT_JOURNAL.md). Splits on that heading level
// and returns the tail `depth` blocks, most-recent-last.
function extractRecentArchitectEntries(text, depth) {
  if (!text) return [];

  const lines = text.split('\n');
  const entries = [];
  let current = null;

  for (const line of lines) {
    if (/^###\s/.test(line)) {
      if (current) entries.push(current.join('\n').trimEnd());
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) entries.push(current.join('\n').trimEnd());

  return depth > 0 ? entries.slice(-depth) : [];
}

// Extracts .hydrate/ROADMAP.md's "## Section 1: Scheduled Roadmap Items"
// section — the same "## Section 1" prefix convention findNextPendingUow()
// in bin/cli.js already relies on. Falls back to the full trimmed text when
// that heading isn't present, so a roadmap that hasn't adopted the section
// convention yet still contributes something useful.
function extractActiveEpics(text) {
  if (!text) return null;

  const lines = text.split('\n');
  const idx = lines.findIndex((line) => /^##\s*Section 1\b/i.test(line));
  if (idx === -1) return text.trim();

  const sectionLines = [lines[idx]];
  for (let i = idx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;
    sectionLines.push(lines[i]);
  }
  return sectionLines.join('\n').trim();
}

// Fallback for when ARCHITECT_JOURNAL.md has no "### " entries: pulls the
// title line (the leading "# " heading) out of the tail `depth` archived
// UOW payloads in .hydrate/archive/, most-recent-last (archive filenames
// sort chronologically, e.g. UOW-HYDRATE-11.md after UOW-HYDRATE-09.md).
function extractArchiveTitles(cwd, depth) {
  if (depth <= 0) return [];
  const archiveDir = path.join(cwd, '.hydrate', 'archive');

  let files;
  try {
    files = fs.readdirSync(archiveDir).filter((name) => name.endsWith('.md')).sort();
  } catch {
    return [];
  }

  const titles = [];
  for (const file of files.slice(-depth)) {
    const content = readIfExists(path.join(archiveDir, file));
    if (!content) continue;
    const firstLine = content.split('\n')[0].trim();
    titles.push(firstLine.replace(/^#+\s*/, ''));
  }
  return titles;
}

// Second-tier fallback: pulls the tail `depth` checklist lines out of
// PROJECT_JOURNAL.md (see the "- [x] **[UOW-XX]** Title — date" format
// mandated by CLAUDE.md's Completion Logging Protocol).
function extractProjectJournalEntries(text, depth) {
  if (!text || depth <= 0) return [];
  const entries = text.split('\n').filter((line) => /^-\s*\[x\]/i.test(line.trim()));
  return entries.slice(-depth);
}

// Compiles a token-dense, zero-fluff context payload from the .hydrate/
// journal artifacts, suitable for seeding a fresh AI LLM prompt session.
// Pure function of disk state — `hydrate context`'s CLI handler owns
// printing/clipboard side effects.
function buildContext(cwd, { depth = DEFAULT_DEPTH } = {}) {
  const hydrateDir = path.join(cwd, '.hydrate');
  const currentUowText = readIfExists(path.join(hydrateDir, 'CURRENT_UOW.md'));
  const architectJournalText = readIfExists(path.join(hydrateDir, 'ARCHITECT_JOURNAL.md'));
  const roadmapText = readIfExists(path.join(hydrateDir, 'ROADMAP.md'));
  const projectJournalText = readIfExists(path.join(hydrateDir, 'PROJECT_JOURNAL.md'));
  const claudeMdText = readIfExists(path.join(cwd, 'CLAUDE.md'));
  const architectureMdText = readIfExists(path.join(cwd, 'docs', 'ARCHITECTURE.md'));

  const activeScope = currentUowText && currentUowText.trim()
    ? currentUowText.trim()
    : 'No active UOW assigned. Run `hydrate prompt` to load one.';

  let architecturalContext;
  const architectEntries = extractRecentArchitectEntries(architectJournalText, depth);
  if (architectEntries.length) {
    architecturalContext = architectEntries.join('\n\n');
  } else {
    const archiveTitles = extractArchiveTitles(cwd, depth);
    const journalEntries = extractProjectJournalEntries(projectJournalText, depth);
    if (archiveTitles.length) {
      architecturalContext = archiveTitles.join('\n');
    } else if (journalEntries.length) {
      architecturalContext = journalEntries.join('\n');
    } else {
      architecturalContext = 'No architectural journal entries found.';
    }
  }

  const activeEpics = roadmapText !== null
    ? (extractActiveEpics(roadmapText) || 'No active epics found in .hydrate/ROADMAP.md.')
    : 'No .hydrate/ROADMAP.md found.';

  const guidelinesSection = claudeMdText
    ? `\n## Project Guidelines (CLAUDE.md)\n${claudeMdText.trim()}\n`
    : '';
  const architectureSection = architectureMdText
    ? `\n## Overall Architecture (docs/ARCHITECTURE.md)\n${architectureMdText.trim()}\n`
    : '';

  return `# HYDRATE CONTEXT COMPILATION
Project: ${getProjectName(cwd)}
Generated: ${new Date().toISOString()}

## Active Scope (.hydrate/CURRENT_UOW.md)
${activeScope}

## Architectural Context (.hydrate/ARCHITECT_JOURNAL.md, last ${depth})
${architecturalContext}

## Macro Roadmap (.hydrate/ROADMAP.md — Active Epics)
${activeEpics}
${guidelinesSection}${architectureSection}`;
}

module.exports = {
  buildContext,
  extractRecentArchitectEntries,
  extractActiveEpics,
  extractArchiveTitles,
  extractProjectJournalEntries
};
