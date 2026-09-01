#!/usr/bin/env node

const path = require('path');
const { scaffoldClaudeCommands } = require('../src/init');

// npm sets INIT_CWD to the directory `npm install` was actually invoked
// from (the host project consuming this package as a dependency), which is
// distinct from `process.cwd()` (this package's own root during install).
// Falls back to process.cwd() for non-npm installers (yarn/pnpm) that may
// not set INIT_CWD.
try {
  const targetCwd = process.env.INIT_CWD || process.cwd();
  const pkgRoot = path.join(__dirname, '..');

  // Skip when this fires for hydrate's own local `npm install` (dev on the
  // hydrate repo itself) rather than consumption as a host project's
  // dependency — INIT_CWD equals this package's own root in that case.
  if (path.resolve(targetCwd) !== path.resolve(pkgRoot)) {
    const created = scaffoldClaudeCommands(targetCwd);
    if (created.length) {
      console.log('💧 @nemzilla/hydrate: provisioned Claude Code slash commands in .claude/commands/');
      created.forEach(({ label }) => console.log(`  ✔ ${label}`));
    }
  }
} catch (err) {
  // Fail quietly during npm install if filesystem permissions restrict writing.
}
