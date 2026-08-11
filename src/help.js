const fs = require('fs');
const path = require('path');

const HELP_FLAGS = ['--help', '-h'];
const VERSION_FLAGS = ['--version', '-v'];

const GLOBAL_FLAGS = [
  ['-h, --help', 'Display help for the CLI or a specific command.'],
  ['-v, --version', 'Print the installed hydrate version.']
];

const COMMANDS = {
  init: {
    summary: 'Scaffold the Hydrate harness in the current repo.',
    usage: 'hydrate init',
    options: [],
    examples: ['hydrate init']
  },
  inject: {
    summary: 'Zero-config retrofit: auto-discover stack/commands and sync CLAUDE.md + .hydrate/session.json.',
    usage: 'hydrate inject',
    options: [],
    examples: ['hydrate inject']
  },
  prompt: {
    summary: 'Sync active UOW payload to .hydrate/CURRENT_UOW.md.',
    usage: 'hydrate prompt [--architect] [--chunk-size=<bytes>]',
    options: [
      ['--architect', 'Generate a chunked context dump for Gemini (Lead Architect).'],
      ['--chunk-size=<bytes>', 'Override the default chunk size for the architect dump (default: 3000).']
    ],
    examples: ['hydrate prompt', 'hydrate prompt --architect', 'hydrate prompt --architect --chunk-size=4000']
  },
  iterate: {
    summary: 'Spawn an iteration pass (UOW-##.i1, i2) for bug fixes / UX polish.',
    usage: 'hydrate iterate "<reason>"',
    options: [
      ['"<reason>"', 'Free-text description of the bug fix or polish pass (positional).']
    ],
    examples: ['hydrate iterate "Fix off-by-one in chunker"']
  },
  complete: {
    summary: 'Mark current UOW complete in ROADMAP.md and log iteration count.',
    usage: 'hydrate complete',
    options: [],
    examples: ['hydrate complete']
  },
  greenfield: {
    summary: 'Show the step-by-step playbook for starting a brand-new project with hydrate.',
    usage: 'hydrate greenfield',
    options: [],
    examples: ['hydrate greenfield']
  },
  brownfield: {
    summary: 'Show the step-by-step playbook for retrofitting hydrate onto an existing repo.',
    usage: 'hydrate brownfield',
    options: [],
    examples: ['hydrate brownfield']
  },
  next: {
    summary: 'Diagnose the current repo state and recommend the next command to run.',
    usage: 'hydrate next   (aliases: hydrate ?, hydrate lost)',
    options: [],
    examples: ['hydrate next', 'hydrate ?', 'hydrate lost']
  }
};

// '?' and 'lost' are aliases of 'next' — registered so `hydrate ? --help` /
// `hydrate lost --help` resolve, but hidden from the COMMANDS listing so the
// global help screen doesn't show the same row three times.
COMMANDS['?'] = { ...COMMANDS.next, hidden: true };
COMMANDS.lost = { ...COMMANDS.next, hidden: true };

const GUIDE_ALIASES = ['?', 'lost', 'next'];

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

  console.log(bold(yellow('🌱 GREENFIELD PATH (1-2-3)')) + dim('  — starting a brand-new project'));
  console.log(`  1. ${green('hydrate init')}       Scaffold ROADMAP.md + .hydrate/`);
  console.log(`  2. ${green('hydrate prompt')}     Load the active UOW into context`);
  console.log(`  3. ${green('hydrate complete')}   Close out the UOW when done`);
  console.log(dim('  Full walkthrough: ') + green('hydrate greenfield'));
  console.log('');

  console.log(bold(cyan('🏗  BROWNFIELD PATH (4-5-6)')) + dim('  — retrofitting an existing repo'));
  console.log(`  4. ${green('hydrate inject')}     Auto-detect stack, sync CLAUDE.md`);
  console.log(`  5. ${green('hydrate init')}       (optional) add UOW tracking`);
  console.log(`  6. ${green('hydrate prompt')}     Load the active UOW into context`);
  console.log(dim('  Full walkthrough: ') + green('hydrate brownfield'));
  console.log('');

  console.log(dim('  Not sure which one you need? Run ') + yellow('hydrate ?') + dim(' (aliases: lost, next) for a live diagnosis.'));
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
  console.log('  $ hydrate <command> --help');
  console.log('  $ hydrate --version');
  console.log('  $ hydrate ?');
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
  GUIDE_ALIASES,
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
