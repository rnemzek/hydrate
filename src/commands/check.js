const fs = require('fs');
const path = require('path');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function listArchivedUows(archiveDir) {
  if (!fs.existsSync(archiveDir)) return [];
  return fs
    .readdirSync(archiveDir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.slice(0, -3))
    .sort();
}

function hasProjectJournalEntry(text, uowId) {
  const re = new RegExp(`-\\s\\[x\\]\\s\\*\\*\\[${escapeRegex(uowId)}\\]\\*\\*`);
  return re.test(text);
}

// Hand-maintained journals use varying heading depths/styles across UOWs
// ("## [UOW-ID]" vs "### UOW-ID — completed ..."), so match any markdown
// heading line that references the UOW ID rather than one fixed format.
function hasJournalHeading(text, uowId) {
  const re = new RegExp(`^#{1,6}.*\\b${escapeRegex(uowId)}\\b`, 'm');
  return re.test(text);
}

// A "completed" active canvas is one with a resolvable UOW ID, no remaining
// unchecked "- [ ]" tasks, and not already reset to the "All UOWs are
// complete!" placeholder — mirrors the findOpenTasks() heuristic `hydrate
// complete` itself uses in bin/cli.js.
function findUnarchivedCompletedUow(currentUowText, archivedIds) {
  if (!currentUowText) return null;
  if (/All UOWs are complete!/.test(currentUowText)) return null;

  const match = currentUowText.match(/UOW-[A-Za-z0-9-]+/);
  if (!match) return null;

  const uowId = match[0];
  if (archivedIds.includes(uowId)) return null;

  const hasOpenTasks = /^\s*-\s\[\s\]/m.test(currentUowText);
  if (hasOpenTasks) return null;

  return uowId;
}

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

function runCheck(cwd) {
  const hydrateDir = path.join(cwd, '.hydrate');

  if (!fs.existsSync(hydrateDir)) {
    return {
      ok: false,
      errors: ['.hydrate/ directory not found. Run `hydrate init` first!'],
      warnings: [],
      checkedUows: []
    };
  }

  const archiveDir = path.join(hydrateDir, 'archive');
  const projectJournalPath = path.join(hydrateDir, 'PROJECT_JOURNAL.md');
  const devJournalPath = path.join(hydrateDir, 'DEV_JOURNAL.md');
  const architectJournalPath = path.join(hydrateDir, 'ARCHITECT_JOURNAL.md');
  const currentUowPath = path.join(hydrateDir, 'CURRENT_UOW.md');

  const archivedIds = listArchivedUows(archiveDir);
  const projectJournalText = readIfExists(projectJournalPath);
  const devJournalText = readIfExists(devJournalPath);
  const architectJournalText = readIfExists(architectJournalPath);

  const errors = [];
  const checkedUows = archivedIds.map((uowId) => {
    const uowErrors = [];

    if (projectJournalText === null) {
      uowErrors.push('.hydrate/PROJECT_JOURNAL.md not found');
    } else if (!hasProjectJournalEntry(projectJournalText, uowId)) {
      uowErrors.push(`missing completed checklist entry "- [x] **[${uowId}]**" in .hydrate/PROJECT_JOURNAL.md`);
    }

    if (devJournalText === null) {
      uowErrors.push('.hydrate/DEV_JOURNAL.md not found');
    } else if (!hasJournalHeading(devJournalText, uowId)) {
      uowErrors.push(`missing section header referencing ${uowId} in .hydrate/DEV_JOURNAL.md`);
    }

    if (architectJournalText === null) {
      uowErrors.push('.hydrate/ARCHITECT_JOURNAL.md not found');
    } else if (!hasJournalHeading(architectJournalText, uowId)) {
      uowErrors.push(`missing section header referencing ${uowId} in .hydrate/ARCHITECT_JOURNAL.md`);
    }

    errors.push(...uowErrors.map((msg) => `[${uowId}] ${msg}`));
    return { uowId, errors: uowErrors };
  });

  const warnings = [];
  const currentUowText = readIfExists(currentUowPath);
  const unarchivedUow = findUnarchivedCompletedUow(currentUowText, archivedIds);
  if (unarchivedUow) {
    warnings.push(
      `.hydrate/CURRENT_UOW.md contains a completed UOW payload (${unarchivedUow}) that has not been moved to .hydrate/archive/`
    );
  }

  return {
    ok: errors.length === 0 && warnings.length === 0,
    errors,
    warnings,
    checkedUows
  };
}

function formatReport(result) {
  const lines = ['', '💧 Hydrate Journal & Archive Validation', ''];

  if (result.checkedUows.length === 0 && result.errors.length > 0) {
    result.errors.forEach((msg) => lines.push(`  ✘ ${msg}`));
  } else if (result.checkedUows.length === 0) {
    lines.push('  ⚠ No archived UOWs found in .hydrate/archive/ — nothing to validate.');
  } else {
    result.checkedUows.forEach(({ uowId, errors }) => {
      if (errors.length === 0) {
        lines.push(`  ✔ ${uowId} — journals consistent`);
      } else {
        lines.push(`  ✘ ${uowId} — ${errors.length} issue${errors.length === 1 ? '' : 's'}`);
        errors.forEach((msg) => lines.push(`      - ${msg}`));
      }
    });
  }

  if (result.warnings.length) {
    lines.push('');
    result.warnings.forEach((msg) => lines.push(`  ⚠ ${msg}`));
  }

  lines.push('');
  if (result.ok) {
    lines.push(`✔ All ${result.checkedUows.length} archived UOW${result.checkedUows.length === 1 ? '' : 's'} verified clean.`);
  } else {
    const issueCount = result.errors.length + result.warnings.length;
    lines.push(`✘ ${issueCount} journal inconsistenc${issueCount === 1 ? 'y' : 'ies'} found.`);
  }
  lines.push('');

  return lines.join('\n');
}

module.exports = { runCheck, formatReport };
