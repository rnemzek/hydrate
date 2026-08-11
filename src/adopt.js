const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { scaffold } = require('./init');

// Single-file heuristics for known legacy AI context/rule conventions.
const FILE_CANDIDATES = [
  '.cursorrules',
  'AGENTS.md',
  'CLAUDE.md',
  'CONTEXT.md',
  path.join('.github', 'copilot-instructions.md')
];

// Directory heuristics: scanned recursively for files with a matching extension.
const DIR_CANDIDATES = [
  { relDir: '.claude', extensions: ['.md'] },
  { relDir: '.codex', extensions: ['.md', '.yml', '.yaml', '.json'] }
];

const ADOPT_MARKER_PREFIX = '<!-- HYDRATE:ADOPTED source=';
const TRIAD_MARKER = '<!-- HYDRATE:TRIAD -->';

function mergeMarker(relPath) {
  return `${ADOPT_MARKER_PREFIX}"${relPath}" -->`;
}

function walkDir(absDir, extensions) {
  if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) return [];

  const results = [];
  const stack = [absDir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
      } else if (extensions.includes(path.extname(entry.name))) {
        results.push(abs);
      }
    }
  }
  return results;
}

// Scans the repo for known legacy AI context conventions. `excludePath`
// (typically the merge target) is never returned as a candidate — merging a
// file into itself would just duplicate it.
function discoverLegacyFiles(cwd, { excludePath } = {}) {
  const found = [];
  const seen = new Set();
  const excludeAbs = excludePath ? path.resolve(excludePath) : null;

  const addCandidate = (absPath) => {
    if (seen.has(absPath)) return;
    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) return;
    if (excludeAbs && path.resolve(absPath) === excludeAbs) return;
    seen.add(absPath);

    found.push({
      relPath: path.relative(cwd, absPath),
      absPath,
      sizeBytes: fs.statSync(absPath).size
    });
  };

  FILE_CANDIDATES.forEach((rel) => addCandidate(path.join(cwd, rel)));
  DIR_CANDIDATES.forEach(({ relDir, extensions }) => {
    walkDir(path.join(cwd, relDir), extensions).forEach(addCandidate);
  });

  found.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return found;
}

// Parses a raw readline answer into zero-based indices: "" / "all" / "a"
// selects everything, "none" / "n" selects nothing, otherwise a
// comma-separated list of 1-based numbers and ranges (e.g. "1,3-4").
function parseSelectionInput(answer, count) {
  const trimmed = (answer || '').trim().toLowerCase();

  if (trimmed === '' || trimmed === 'all' || trimmed === 'a') {
    return Array.from({ length: count }, (_, i) => i);
  }
  if (trimmed === 'none' || trimmed === 'n') {
    return [];
  }

  const indices = new Set();
  trimmed.split(',').map((s) => s.trim()).filter(Boolean).forEach((token) => {
    const rangeMatch = token.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      for (let n = Math.min(start, end); n <= Math.max(start, end); n++) {
        if (n >= 1 && n <= count) indices.add(n - 1);
      }
      return;
    }

    const n = parseInt(token, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= count) indices.add(n - 1);
  });

  return Array.from(indices).sort((a, b) => a - b);
}

// Interactive multi-select prompt. Falls back to selecting every candidate
// if the input stream closes before an answer is given (e.g. piped/empty
// stdin), so `hydrate adopt` never hangs in a non-interactive shell.
function promptForSelection(candidates, { input = process.stdin, output = process.stdout } = {}) {
  return new Promise((resolve) => {
    if (candidates.length === 0) {
      resolve([]);
      return;
    }

    const lines = ['', '💧 Legacy AI context files discovered:', ''];
    candidates.forEach((c, i) => lines.push(`  [${i + 1}] ${c.relPath} (${c.sizeBytes}b)`));
    lines.push('', 'Select files to merge — comma-separated numbers, ranges (e.g. 1,3-4), "all", or "none" [all]: ');

    const rl = readline.createInterface({ input, output, terminal: false });
    let settled = false;

    rl.question(lines.join('\n'), (answer) => {
      settled = true;
      rl.close();
      resolve(parseSelectionInput(answer, candidates.length).map((i) => candidates[i]));
    });

    rl.on('close', () => {
      if (!settled) {
        settled = true;
        resolve(candidates);
      }
    });
  });
}

function backupCandidate(candidate, backupRoot) {
  const backupPath = path.join(backupRoot, candidate.relPath);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.copyFileSync(candidate.absPath, backupPath);
  return backupPath;
}

// Non-destructively merges the selected candidates into the target context
// file: originals are never modified, each source is backed up under
// .hydrate/backups/<timestamp>/, and every merge is marker-guarded so
// re-running adopt against the same target is idempotent (no duplicate
// sections, no repeated backups of already-merged sources).
function adoptFiles(cwd, candidates, { targetRelPath = 'CONTEXT.md', now = new Date() } = {}) {
  const targetPath = path.join(cwd, targetRelPath);
  const existingTarget = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : '';
  const isNewTarget = existingTarget === '';

  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const backupRoot = path.join(cwd, '.hydrate', 'backups', stamp);

  const merged = [];
  const skipped = [];
  const backups = [];
  const sections = [];

  candidates.forEach((candidate) => {
    const marker = mergeMarker(candidate.relPath);
    if (existingTarget.includes(marker)) {
      skipped.push(candidate.relPath);
      return;
    }

    backups.push(backupCandidate(candidate, backupRoot));
    const content = fs.readFileSync(candidate.absPath, 'utf8').trim();
    sections.push(`${marker}\n## Merged from \`${candidate.relPath}\`\n\n${content}\n`);
    merged.push(candidate.relPath);
  });

  const needsTriad = !existingTarget.includes(TRIAD_MARKER);
  if (sections.length === 0 && !needsTriad) {
    return { targetPath, merged, skipped, backups, written: false };
  }

  const parts = [];
  parts.push(isNewTarget
    ? '# CONTEXT.md\n\nConsolidated AI context, assembled by `hydrate adopt`. Originals are preserved unmodified; backups live under `.hydrate/backups/`.\n'
    : existingTarget.replace(/\n*$/, '\n'));
  parts.push(...sections);
  if (needsTriad) {
    parts.push(`${TRIAD_MARKER}\n## Hydrate Workflow Directives\n\n- Product Owner, Lead Architect, and Lead Developer roles follow \`AI_PROJECT_RULES.md\`.\n- The active Unit of Work always lives in \`.hydrate/CURRENT_UOW.md\`; the milestone list lives in \`ROADMAP.md\`.\n- Run \`hydrate prompt\` to sync the active UOW before starting work, and \`hydrate ?\` any time you're unsure what to run next.\n`);
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, parts.join('\n'), 'utf8');
  return { targetPath, merged, skipped, backups, written: true };
}

function renderAdoptSummary({ candidates, selected, mergeResult, scaffoldResult, targetRelPath }) {
  const lines = [''];

  if (candidates.length === 0) {
    lines.push('💧 No legacy AI context files detected — nothing to adopt.');
  } else {
    lines.push('💧 Brownfield Adoption Complete!');
    lines.push('=====================================================');
    if (mergeResult.merged.length) {
      lines.push(`  ✔ Merged ${mergeResult.merged.length} file(s) into ${targetRelPath}:`);
      mergeResult.merged.forEach((relPath) => lines.push(`      - ${relPath}`));
    }
    if (mergeResult.skipped.length) {
      lines.push(`  • Skipped ${mergeResult.skipped.length} already-adopted file(s):`);
      mergeResult.skipped.forEach((relPath) => lines.push(`      - ${relPath}`));
    }
    if (mergeResult.backups.length) {
      lines.push(`  ✔ Backed up ${mergeResult.backups.length} original(s) to .hydrate/backups/`);
    }
    const unselected = candidates.length - selected.length;
    if (unselected > 0) {
      lines.push(`  • Left ${unselected} discovered file(s) untouched (not selected).`);
    }
  }

  if (scaffoldResult.length) {
    lines.push('  ✔ Canonical setup completed:');
    scaffoldResult.forEach(({ label }) => lines.push(`      - ${label}`));
  } else {
    lines.push('  ✔ Canonical setup already in place (ROADMAP.md / .hydrate/CURRENT_UOW.md).');
  }

  lines.push('');
  lines.push('⚡ NEXT STEPS:');
  lines.push(`   1. Review ${targetRelPath} — originals are untouched, backups live in .hydrate/backups/.`);
  lines.push('   2. Run \'hydrate setup-cc\' to wire up the /hydrate slash command in Claude Code.');
  lines.push('   3. Run \'hydrate prompt\' to sync the active UOW.');
  lines.push('');

  return lines.join('\n');
}

async function runAdopt(options = {}) {
  const cwd = options.cwd || process.cwd();
  const targetRelPath = options.target || 'CONTEXT.md';
  const selectAll = Boolean(options.all);
  const input = options.input || process.stdin;
  const output = options.output || process.stdout;

  const targetAbsPath = path.join(cwd, targetRelPath);
  const candidates = discoverLegacyFiles(cwd, { excludePath: targetAbsPath });

  let selected = [];
  if (candidates.length > 0) {
    selected = selectAll ? candidates : await promptForSelection(candidates, { input, output });
  }

  const mergeResult = selected.length > 0
    ? adoptFiles(cwd, selected, { targetRelPath })
    : { targetPath: targetAbsPath, merged: [], skipped: [], backups: [], written: false };

  const scaffoldResult = scaffold(cwd);

  const summary = { candidates, selected, mergeResult, scaffoldResult };
  output.write(renderAdoptSummary({ ...summary, targetRelPath }));

  return summary;
}

module.exports = {
  runAdopt,
  discoverLegacyFiles,
  parseSelectionInput,
  promptForSelection,
  adoptFiles,
  FILE_CANDIDATES,
  DIR_CANDIDATES
};
