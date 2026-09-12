const fs = require('fs');
const path = require('path');

const HELP_FLAGS = ['--help', '-h', '?'];
const VERSION_FLAGS = ['--version', '-v'];

const GLOBAL_FLAGS = [
  ['-h, --help, ?', 'Display help for the CLI or a specific command.'],
  ['-v, --version', 'Print the installed hydrate version.']
];

const COMMANDS = {
  init: {
    summary: 'Scaffold the Hydrate harness (CLAUDE.md and the .hydrate/ journal files) in the current repo.',
    usage: 'hydrate init [--force|-f]',
    whatItDoes: [
      'Creates CLAUDE.md, the 5-artifact .hydrate/ journal layout, .hydrate/archive/, the .claude/commands/hydrate-*.md slash commands, and docs/ARCHITECTURE*.md — skipping any file that already exists.',
      'If CLAUDE.md already carries the Hydrate managed block, refreshes only the text inside those markers.',
      'If CLAUDE.md exists with no Hydrate markers, leaves it untouched and reports that --force is required (no silent merge).',
      '--force wholesale-resets CLAUDE.md (discarding any unmarked legacy content) and overwrites every .claude/commands/hydrate-*.md to the current template — .hydrate/ journals, archive, and ROADMAP.md are never touched by --force.'
    ],
    options: [
      ['-f, --force', 'Greenfield reset: replace an unmarked CLAUDE.md and overwrite .claude/commands/*.md templates. Never touches .hydrate/.']
    ],
    examples: ['hydrate init', 'hydrate init --force']
  },
  prompt: {
    summary: 'Sync active UOW payload to .hydrate/CURRENT_UOW.md.',
    usage: 'hydrate prompt [--architect] [--chunk-size=<bytes>] [--copy]',
    options: [
      ['--architect', 'Generate a chunked context dump for Gemini (Lead Architect).'],
      ['--chunk-size=<bytes>', 'Override the default chunk size for the architect dump (default: 3000).'],
      ['-c, --copy', 'Also copy the generated payload to the system clipboard.']
    ],
    examples: ['hydrate prompt', 'hydrate prompt --copy', 'hydrate prompt --architect', 'hydrate prompt --architect --chunk-size=4000']
  },
  complete: {
    summary: 'Mark current UOW complete in .hydrate/ROADMAP.md and log iteration count.',
    usage: 'hydrate complete [--force]',
    whenToRun: 'All unit tests pass and the active UOW is done — every task in .hydrate/CURRENT_UOW.md is checked off.',
    whatItDoes: [
      'Aborts with no changes if unchecked "- [ ]" tasks remain in .hydrate/CURRENT_UOW.md (unless --force is passed).',
      'Flips the matching UOW line in .hydrate/ROADMAP.md (Section 1: Scheduled Roadmap Items) to [x], logging the total iteration-pass count.',
      'Appends a completion entry to .hydrate/PROJECT_JOURNAL.md.',
      'Archives the finished canvas to .hydrate/archive/<UOW-id>.md.',
      'Resets .hydrate/CURRENT_UOW.md to the templated "All UOWs are complete" placeholder, ready for the next hydrate prompt.',
      'Prints a recommended `git commit` command summarizing the completed UOW.'
    ],
    options: [
      ['-f, --force', 'Close the UOW out even if unchecked tasks remain in .hydrate/CURRENT_UOW.md.']
    ],
    examples: ['hydrate complete', 'hydrate complete --force']
  },
  clip: {
    summary: 'Copy the active .hydrate/CURRENT_UOW.md context to the system clipboard.',
    usage: 'hydrate clip',
    options: [],
    examples: ['hydrate clip']
  },
  check: {
    summary: 'Validate that archived UOWs are fully logged across the .hydrate/ journals.',
    usage: 'hydrate check',
    whenToRun: 'Any time you want to confirm .hydrate/archive/ and the journal files (PROJECT_JOURNAL.md, DEV_JOURNAL.md, ARCHITECT_JOURNAL.md) are consistent.',
    whatItDoes: [
      'For every archived UOW in .hydrate/archive/, verifies a completed checklist entry exists in .hydrate/PROJECT_JOURNAL.md.',
      'Verifies a matching section header exists in .hydrate/DEV_JOURNAL.md and .hydrate/ARCHITECT_JOURNAL.md.',
      'Warns if .hydrate/CURRENT_UOW.md holds a fully-checked-off UOW that has not yet been archived.',
      'Prints a pass/fail report and exits 0 when clean, 1 when any journal entry or archive step is missing.'
    ],
    options: [],
    examples: ['hydrate check']
  },
  checkup: {
    summary: 'Reconcile session state — dirty working tree, unarchived completions, or a broken test build.',
    usage: 'hydrate checkup',
    whenToRun: 'At the start (or any point) of a session to see exactly what state the project is in before deciding what to do next.',
    whatItDoes: [
      'Reports "Ready for next task" when .hydrate/CURRENT_UOW.md is empty/reset, noting whether .hydrate/ROADMAP.md has pending items.',
      'Reports a concise in-progress summary (modified file count + remaining tasks) when .hydrate/CURRENT_UOW.md is active.',
      'Runs `npm test` once every task in .hydrate/CURRENT_UOW.md is checked off, reporting either "complete but unarchived" (tests pass) or a broken-build warning (tests fail).'
    ],
    options: [],
    examples: ['hydrate checkup', 'hydrate status']
  },
  status: {
    summary: 'Alias for hydrate checkup.',
    usage: 'hydrate status',
    options: [],
    hidden: true
  },
  context: {
    summary: 'Compile a token-dense context payload from .hydrate/ for seeding a fresh AI prompt session.',
    usage: 'hydrate context [--clip] [--depth <n>]',
    whenToRun: 'Any time you need to hand a fresh AI session (or a new chat/model) a compact snapshot of the active task, recent architecture decisions, and the macro roadmap.',
    whatItDoes: [
      'Prints the full contents of .hydrate/CURRENT_UOW.md (or a fallback notice if no UOW is assigned).',
      'Pulls the last <n> decision-log entries from .hydrate/ARCHITECT_JOURNAL.md (default: 3).',
      'Pulls the "Section 1: Scheduled Roadmap Items" section from .hydrate/ROADMAP.md.',
      'Optionally copies the compiled payload straight to the system clipboard with --clip.'
    ],
    options: [
      ['-c, --clip', 'Copy the compiled context payload to the system clipboard.'],
      ['--depth <n>', 'Number of recent .hydrate/ARCHITECT_JOURNAL.md entries to include (default: 3).']
    ],
    examples: ['hydrate context', 'hydrate context --clip', 'hydrate context --depth 5']
  },
  'export-portfolio': {
    summary: 'Export a structured tech-overview.json from .hydrate/ journals, package.json, and ROADMAP.md.',
    usage: 'hydrate export-portfolio [--out <path>|-o <path>] [--stdout]',
    whenToRun: 'Any time you need a portfolio/showcase-ready JSON snapshot of this project\'s overview, architecture, stack, and roadmap.',
    whatItDoes: [
      'overview: project name/description from package.json, total completed UOW count and latest milestone from .hydrate/PROJECT_JOURNAL.md.',
      'architecture: structured decision-log entries parsed from .hydrate/ARCHITECT_JOURNAL.md.',
      'stack: runtime/dependency taxonomy extracted from package.json.',
      'roadmap: { scheduled, backlog } arrays parsed from .hydrate/ROADMAP.md\'s "## Section 1" and "## Section 2".',
      'Writes the JSON payload to --out (default: ./tech-overview.json), or streams it to stdout with --stdout instead of writing a file.'
    ],
    options: [
      ['-o, --out <path>', 'Output file path for the exported JSON (default: ./tech-overview.json).'],
      ['--stdout', 'Stream the JSON payload to stdout instead of writing a file.']
    ],
    examples: ['hydrate export-portfolio', 'hydrate export-portfolio --out ./dist/tech-overview.json', 'hydrate export-portfolio --stdout']
  },
  export: {
    summary: 'Alias for hydrate export-portfolio.',
    usage: 'hydrate export [--out <path>|-o <path>] [--stdout]',
    options: [],
    hidden: true
  },
  ingest: {
    summary: 'Interactively ingest a clipboard UOW payload into .hydrate/CURRENT_UOW.md.',
    usage: 'hydrate ingest [--yes|-y]',
    whenToRun: 'When the AI Architect (Gemini) has generated a new UOW spec and copied it to your clipboard.',
    whatItDoes: [
      'Reads the OS clipboard and validates it looks like a UOW spec (a "# UOW-..." header plus a Goal & Context / Surgical Scope / Acceptance Criteria section).',
      'Rejects invalid clipboard content with a diagnostic and leaves .hydrate/CURRENT_UOW.md untouched.',
      'Renders the ⚙️ HYDRATE ENGINE banner; if .hydrate/CURRENT_UOW.md already has active/uncompleted work, offers to archive-and-swap, overwrite, or hand off to chat instead.',
      'With --yes, applies non-interactively: archives any active UOW first, then writes the clipboard payload straight to .hydrate/CURRENT_UOW.md.'
    ],
    options: [
      ['-y, --yes', 'Skip the interactive prompt — archive any active UOW and apply the clipboard payload directly.']
    ],
    examples: ['hydrate ingest', 'hydrate ingest --yes']
  },
  paste: {
    summary: 'Alias for hydrate ingest.',
    usage: 'hydrate paste [--yes|-y]',
    options: [],
    hidden: true
  },
  uow: {
    summary: 'Inspect UOWs — list all, show the last completed, or show one by ID.',
    usage: 'hydrate uow [list|last|<uow-id>]',
    whenToRun: 'Any time you want to inspect the active UOW or a past one without opening .hydrate/ files directly.',
    whatItDoes: [
      'hydrate uow list: prints the active UOW (if any) and every archived UOW in .hydrate/archive/, chronological.',
      'hydrate uow last: prints the full content of the most recently archived UOW.',
      'hydrate uow <uow-id>: prints the full content of a specific UOW, checked against the active canvas first, then .hydrate/archive/.'
    ],
    options: [],
    examples: ['hydrate uow', 'hydrate uow list', 'hydrate uow last', 'hydrate uow UOW-HYDRATE-09']
  },
  artifacts: {
    summary: 'Print a plain-English map of .hydrate/ and .claude/commands/ plus .gitignore guidance.',
    usage: 'hydrate artifacts',
    whenToRun: 'Any time you want a quick orientation on what Hydrate has scaffolded in this repo, or copy-pasteable .gitignore entries.',
    whatItDoes: [
      'Prints a tree of .hydrate/ (journals + .hydrate/archive/) with a one-line description of each file.',
      'Prints a tree of .claude/commands/ with a one-line description of each slash command.',
      'Prints a recommended .gitignore block for Hydrate-generated local/derived files.'
    ],
    options: [],
    examples: ['hydrate artifacts']
  },
  lfg: {
    summary: 'Easter egg: runs hydrate checkup, then hydrate ingest in one shot.',
    usage: 'hydrate lfg [--yes|-y]',
    whenToRun: 'Zero-touch session launch — reconcile state and ingest a clipboard UOW payload in a single command (case-insensitive: lfg, LFG, Lfg).',
    whatItDoes: [
      'Runs the same state reconciliation as `hydrate checkup` and prints its report.',
      'Immediately continues into `hydrate ingest`, same options and clipboard flow as the ingest command.'
    ],
    options: [
      ['-y, --yes', 'Skip the interactive prompt — archive any active UOW and apply the clipboard payload directly.']
    ],
    examples: ['hydrate lfg', 'hydrate lfg --yes'],
    hidden: true
  },
  sync: {
    summary: 'Align .claude/commands/*.md templates and the CLAUDE.md managed block to the running hydrate version.',
    usage: 'hydrate sync [--recursive|-r] [--force|-f] [--path <dir>]',
    whenToRun: 'After upgrading hydrate, or any time you want a repo\'s slash-command templates and Hydrate CLAUDE.md rules brought current without touching .hydrate/ history.',
    whatItDoes: [
      'Force-refreshes every .claude/commands/hydrate-*.md template to match the installed hydrate version, regardless of --force.',
      'If CLAUDE.md already carries the Hydrate managed block, refreshes only the delimited text — any surrounding custom content is untouched.',
      'If CLAUDE.md has no Hydrate markers, leaves it untouched and reports that a greenfield reset (--force) is required, instead of guessing.',
      '--force wholesale-replaces an unmarked CLAUDE.md with the clean managed-block template, discarding the legacy content.',
      'Bootstraps a quiet `hydrate init` (passing --force through) in any target repo missing .hydrate/ instead of syncing nothing.',
      '--recursive scans downward from --path (default: cwd) for nested .git/package.json roots and syncs each one.',
      'Never modifies .hydrate/ journals, archive, or CURRENT_UOW.md — with or without --force.'
    ],
    options: [
      ['-r, --recursive', 'Recursively sync every repo found beneath --path (default: cwd).'],
      ['-f, --force', 'Greenfield reset: wholesale-replace an unmarked CLAUDE.md instead of leaving it untouched.'],
      ['--path <dir>', 'Root directory to sync (or scan from, with --recursive). Defaults to the current directory.']
    ],
    examples: ['hydrate sync', 'hydrate sync --recursive', 'hydrate sync --recursive --force --path ~/Projects']
  },
  update: {
    summary: 'Upgrade the installed @nemzilla/hydrate package and re-sync the current workspace.',
    usage: 'hydrate update [--local|-l]',
    whenToRun: 'When `hydrate checkup` reports a newer version is available.',
    whatItDoes: [
      'Runs `npm install -g @nemzilla/hydrate` (or a local install with --local).',
      'Immediately re-runs `hydrate sync` on the current repo so templates reflect the upgraded version.'
    ],
    options: [
      ['-l, --local', 'Update the local project dependency instead of the global install.']
    ],
    examples: ['hydrate update', 'hydrate update --local']
  },
  eject: {
    summary: 'Remove .hydrate/, .claude/commands/hydrate-*.md, and the CLAUDE.md managed block from a repo.',
    usage: 'hydrate eject [--recursive|-r] [--path <dir>] [--dry-run] [--force|-f]',
    whenToRun: 'When you want to fully remove the Hydrate harness from a repo (or a whole directory tree).',
    whatItDoes: [
      'Deletes the .hydrate/ directory (journals, archive, active canvas).',
      'Deletes every .claude/commands/hydrate-*.md slash command file.',
      'Strips just the delimited Hydrate managed block from CLAUDE.md (deletes the file if nothing else remains).',
      'Prompts for confirmation unless --force is passed; --dry-run previews the plan without removing anything.',
      '--recursive scans downward from --path (default: cwd) and ejects from every repo found.'
    ],
    options: [
      ['-r, --recursive', 'Eject from every repo found beneath --path (default: cwd).'],
      ['--path <dir>', 'Root directory to eject from (or scan from, with --recursive). Defaults to the current directory.'],
      ['--dry-run', 'Preview exactly what would be removed without deleting anything.'],
      ['-f, --force', 'Skip the confirmation prompt.']
    ],
    examples: ['hydrate eject --dry-run', 'hydrate eject --force', 'hydrate eject --recursive --dry-run']
  },
  hook: {
    summary: 'Install/remove a shell hook that auto-runs `hydrate init` after every `git init`.',
    usage: 'hydrate hook <enable|disable|status>',
    whenToRun: 'Once, to have every future `git init` on your machine automatically bootstrap the Hydrate harness.',
    whatItDoes: [
      'enable: installs a `git` shell-function wrapper into your shell rc (~/.zshrc or ~/.bashrc) that runs `hydrate init --quiet` after `git init`.',
      'disable: removes that wrapper.',
      'status: reports whether the wrapper is currently installed.'
    ],
    options: [],
    examples: ['hydrate hook enable', 'hydrate hook status', 'hydrate hook disable']
  }
};

let cachedPkg = null;
function getPkg() {
  if (cachedPkg) return cachedPkg;
  const pkgPath = path.join(__dirname, '..', 'package.json');
  cachedPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return cachedPkg;
}

const supportsColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

function ansi(code, text) {
  return supportsColor ? `\x1b[${code}m${text}\x1b[0m` : text;
}

const bold = (t) => ansi('1', t);
const dim = (t) => ansi('2', t);
const cyan = (t) => ansi('36', t);
const green = (t) => ansi('32', t);
const yellow = (t) => ansi('33', t);

function printTable(pairs, indent = '  ') {
  const width = Math.max(...pairs.map(([label]) => label.length));
  pairs.forEach(([label, desc]) => {
    console.log(`${indent}${yellow(label.padEnd(width))}   ${desc}`);
  });
}

function printVersion() {
  console.log(`v${getPkg().version}`);
}

function printGlobalHelp() {
  const pkg = getPkg();

  console.log('');
  console.log(bold(cyan(`💧 ${pkg.name} v${pkg.version}`)));
  console.log(dim(pkg.description));
  console.log('');

  console.log(bold('USAGE'));
  console.log('  $ hydrate <command> [flags]');
  console.log('');

  console.log(bold(yellow('💧 THE HYDRATE WORKFLOW (1-2-3)')));
  console.log(`  1. ${green('hydrate init')}       Scaffold CLAUDE.md & the .hydrate/ journal files`);
  console.log(`  2. ${green('hydrate prompt')}     Load the active UOW into .hydrate/CURRENT_UOW.md`);
  console.log(`  3. ${green('hydrate complete')}   Close out the UOW when every task is checked off`);
  console.log(dim('  Use ') + green('hydrate clip') + dim(' any time to copy the active UOW payload to your clipboard.'));
  console.log('');

  console.log(bold(yellow('⚙️  HYDRATE ENGINE — TRIAD WORKFLOW GUIDE')));
  console.log(dim('  Boot sequence for starting a fresh context across the triad:'));
  console.log(dim('  Product Owner (you) · Lead Architect (Gemini) · Lead Developer (Claude Code).'));
  console.log(`  1. Launch Claude Code in yolo mode (auto-approve edits/commands).`);
  console.log(`     ${green('$ claude --dangerously-skip-permissions')}`);
  console.log(`  2. Scaffold or refresh the harness in the target repo.`);
  console.log(`     ${green('$ hydrate init')}`);
  console.log(`  3. Extract a token-dense context payload for the Lead Architect.`);
  console.log(`     ${green('/hydrate-context')}  ${dim('(or: hydrate context --clip)')}`);
  console.log(`  4. Paste that payload into the AI Architect (Gemini) chat and`);
  console.log(`     have it generate the next UOW spec.`);
  console.log(`  5. Copy the AI Architect's generated UOW spec to your OS clipboard.`);
  console.log(`  6. Fire the zero-touch launch in Claude Code to reconcile state`);
  console.log(`     and ingest the clipboard payload in one shot.`);
  console.log(`     ${green('/hydrate-lfg')}  ${dim('(or: hydrate lfg --yes)')}`);
  console.log('');

  console.log(bold('COMMANDS'));
  const visibleCommands = Object.entries(COMMANDS).filter(([, meta]) => !meta.hidden);
  const commandWidth = Math.max(...visibleCommands.map(([name]) => name.length));
  visibleCommands.forEach(([name, meta]) => {
    console.log(`  ${green(name.padEnd(commandWidth))}   ${meta.summary}`);
  });
  console.log('');

  console.log(bold('GLOBAL FLAGS'));
  printTable(GLOBAL_FLAGS);
  console.log('');

  console.log(bold('EXAMPLES'));
  console.log('  $ hydrate init');
  console.log('  $ hydrate prompt --architect');
  console.log('  $ hydrate prompt --copy');
  console.log('  $ hydrate clip');
  console.log('  $ hydrate check');
  console.log('  $ hydrate checkup');
  console.log('  $ hydrate context --clip');
  console.log('  $ hydrate export-portfolio --out ./tech-overview.json');
  console.log('  $ hydrate ingest');
  console.log('  $ hydrate complete --force');
  console.log('  $ hydrate uow list');
  console.log('  $ hydrate artifacts');
  console.log('  $ hydrate sync --recursive');
  console.log('  $ hydrate update');
  console.log('  $ hydrate eject --dry-run');
  console.log('  $ hydrate hook enable');
  console.log('  $ hydrate <command> --help');
  console.log('  $ hydrate --version');
  console.log('');
}

function printCommandHelp(name) {
  const meta = COMMANDS[name];
  if (!meta) {
    printGlobalHelp();
    return;
  }

  console.log('');
  console.log(bold(cyan(`💧 hydrate ${name}`)));
  console.log(dim(meta.summary));
  console.log('');

  console.log(bold('USAGE'));
  console.log(`  $ ${meta.usage}`);

  if (meta.whenToRun) {
    console.log('');
    console.log(bold('WHEN TO RUN'));
    console.log(`  ${meta.whenToRun}`);
  }

  if (meta.whatItDoes && meta.whatItDoes.length) {
    console.log('');
    console.log(bold('WHAT IT DOES'));
    meta.whatItDoes.forEach((step, i) => console.log(`  ${i + 1}. ${step}`));
  }

  if (meta.options.length) {
    console.log('');
    console.log(bold('OPTIONS'));
    printTable(meta.options);
  }

  if (meta.examples && meta.examples.length) {
    console.log('');
    console.log(bold('EXAMPLES'));
    meta.examples.forEach((example) => console.log(`  $ ${example}`));
  }

  console.log('');
}

module.exports = {
  HELP_FLAGS,
  VERSION_FLAGS,
  COMMANDS,
  printVersion,
  printGlobalHelp,
  printCommandHelp,
  ansi,
  bold,
  dim,
  cyan,
  green,
  yellow,
  printTable
};
