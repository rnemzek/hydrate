const fs = require('fs');
const path = require('path');

const { extractRecentArchitectEntries } = require('./context');

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

function readPackageJson(cwd) {
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    // Malformed package.json — degrade to an empty manifest rather than crash.
    return {};
  }
}

// Matches .hydrate/PROJECT_JOURNAL.md's real completion-line convention:
// "- [x] **[<UOW-ID>]** <title> — <YYYY-MM-DD> | Pass: <n>/<n> tests"
// (same format hydrate check's hasProjectJournalEntry() already asserts).
function extractCompletedUows(text) {
  if (!text) return [];

  const re = /^-\s\[x\]\s\*\*\[([^\]]+)\]\*\*\s*(.+?)\s*—\s*(\d{4}-\d{2}-\d{2})\s*\|\s*Pass:\s*(\d+)\/(\d+)\s*tests?/;
  const entries = [];

  for (const rawLine of text.split('\n')) {
    const match = rawLine.trim().match(re);
    if (!match) continue;
    entries.push({
      id: match[1],
      title: match[2].trim(),
      date: match[3],
      testsPassed: Number(match[4]),
      testsTotal: Number(match[5])
    });
  }

  return entries;
}

function buildOverview(cwd, pkg, projectJournalText) {
  const completedUows = extractCompletedUows(projectJournalText);
  return {
    name: pkg.name || path.basename(cwd),
    description: pkg.description || '',
    totalCompletedUows: completedUows.length,
    latestMilestone: completedUows.length ? completedUows[completedUows.length - 1] : null
  };
}

// Reuses context.js's block-splitting logic (tail-slice with Infinity keeps
// the full list) instead of re-implementing the "### "-delimited parse.
function buildArchitecture(architectJournalText) {
  const blocks = extractRecentArchitectEntries(architectJournalText, Infinity);

  return blocks.map((block) => {
    const lines = block.split('\n');
    const heading = lines[0].replace(/^###\s*/, '').trim();
    const idMatch = heading.match(/UOW-[A-Za-z0-9-]+/);
    const dateMatch = heading.match(/\d{4}-\d{2}-\d{2}/);

    return {
      id: idMatch ? idMatch[0] : null,
      title: heading,
      date: dateMatch ? dateMatch[0] : null,
      body: lines.slice(1).join('\n').trim()
    };
  });
}

function buildStack(pkg) {
  const toEntries = (deps) => Object.entries(deps || {}).map(([name, version]) => ({ name, version }));

  return {
    name: pkg.name || null,
    version: pkg.version || null,
    license: pkg.license || null,
    runtime: pkg.type === 'module' ? 'ESM' : 'CommonJS',
    engines: pkg.engines || {},
    bin: pkg.bin || {},
    dependencies: toEntries(pkg.dependencies),
    devDependencies: toEntries(pkg.devDependencies)
  };
}

// Extracts the lines belonging to the first "## " heading matching
// `headingPattern`, stopping at the next "## " heading — the same
// section-slicing convention context.js's extractActiveEpics() uses for
// .hydrate/ROADMAP.md's "## Section 1" heading.
function extractSection(text, headingPattern) {
  if (!text) return [];

  const lines = text.split('\n');
  const idx = lines.findIndex((line) => headingPattern.test(line));
  if (idx === -1) return [];

  const section = [];
  for (let i = idx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;
    section.push(lines[i]);
  }
  return section;
}

// Parses a single .hydrate/ROADMAP.md bullet into { id, title, status, description }.
// Handles both this repo's checkbox convention ("- [ ] **UOW-05:** Title") and
// plain concept bullets ("- **UOW-06:** Title (description)"); returns null
// for blank lines / horizontal rules / non-bullet lines.
function parseRoadmapLine(line, defaultStatus) {
  const trimmed = line.trim();
  if (!trimmed || /^-{3,}$/.test(trimmed)) return null;

  const checkboxMatch = trimmed.match(/^[-#]+\s\[([ xX])\]\s*(.*)$/);
  const bulletMatch = !checkboxMatch && trimmed.match(/^[-*]\s+(.*)$/);
  if (!checkboxMatch && !bulletMatch) return null;

  const status = checkboxMatch ? (checkboxMatch[1].toLowerCase() === 'x' ? 'done' : 'scheduled') : defaultStatus;
  const rest = (checkboxMatch ? checkboxMatch[2] : bulletMatch[1]).trim();
  if (!rest) return null;

  const idMatch = rest.match(/UOW-[A-Za-z0-9-]+/);
  const id = idMatch ? idMatch[0] : null;

  let body = idMatch ? rest.slice(idMatch.index + idMatch[0].length) : rest;
  body = body.replace(/^\*\*/, '').replace(/^:?\*\*/, '').replace(/^:\s*/, '');
  body = body.replace(/\*\*/g, '').trim();
  if (!body) body = rest.replace(/\*\*/g, '').trim();

  let title = body;
  let description = '';

  const dashParts = body.split(/\s+—\s+/);
  if (dashParts.length > 1) {
    title = dashParts[0].trim();
    description = dashParts.slice(1).join(' — ').trim();
  } else {
    const parenMatch = body.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (parenMatch) {
      title = parenMatch[1].trim();
      description = parenMatch[2].trim();
    }
  }

  return { id, title, status, description };
}

function buildRoadmap(roadmapText) {
  const scheduledLines = extractSection(roadmapText, /^##\s*Section 1\b/i);
  const backlogLines = extractSection(roadmapText, /^##\s*Section 2\b/i);

  return {
    scheduled: scheduledLines.map((line) => parseRoadmapLine(line, 'scheduled')).filter(Boolean),
    backlog: backlogLines.map((line) => parseRoadmapLine(line, 'backlog')).filter(Boolean)
  };
}

// Pure function of disk state — the CLI handler owns argv parsing and the
// write/stdout side effects, mirroring src/commands/check.js and context.js.
function buildPortfolio(cwd) {
  const pkg = readPackageJson(cwd);
  const hydrateDir = path.join(cwd, '.hydrate');

  const projectJournalText = readIfExists(path.join(hydrateDir, 'PROJECT_JOURNAL.md'));
  const architectJournalText = readIfExists(path.join(hydrateDir, 'ARCHITECT_JOURNAL.md'));
  const roadmapText = readIfExists(path.join(hydrateDir, 'ROADMAP.md'));

  return {
    generatedAt: new Date().toISOString(),
    overview: buildOverview(cwd, pkg, projectJournalText),
    architecture: buildArchitecture(architectJournalText),
    stack: buildStack(pkg),
    roadmap: buildRoadmap(roadmapText)
  };
}

module.exports = {
  buildPortfolio,
  buildOverview,
  buildArchitecture,
  buildStack,
  buildRoadmap,
  extractCompletedUows,
  parseRoadmapLine
};
