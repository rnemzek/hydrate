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
    usage: 'hydrate init',
    options: [],
    examples: ['hydrate init']
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
  console.log('  $ hydrate context --clip');
  console.log('  $ hydrate complete --force');
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
