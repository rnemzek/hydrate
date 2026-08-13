#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

try {
  const claudeCmdDir = path.join(os.homedir(), '.claude', 'commands');
  fs.mkdirSync(claudeCmdDir, { recursive: true });

  // 1. Create global /hydrate command
  const hydrateCmdPath = path.join(claudeCmdDir, 'hydrate.md');
  const hydrateContent = `Read the active task in \`.hydrate/CURRENT_UOW.md\` and \`CONTEXT.md\`.

1. Review the active task guidelines and requirements.
2. Confirm readiness to execute the unit of work.`;

  fs.writeFileSync(hydrateCmdPath, hydrateContent, 'utf8');

  // 2. Create global /hydrate-architect command
  const architectCmdPath = path.join(claudeCmdDir, 'hydrate-architect.md');
  const architectContent = `Execute architectural planning using \`.hydrate/CURRENT_UOW.md\`. Check state and prepare the next architectural step.`;

  fs.writeFileSync(architectCmdPath, architectContent, 'utf8');

  console.log('✅ HydrateZ global Claude commands successfully installed to ~/.claude/commands/');
} catch (err) {
  // Fail quietly during npm install if filesystem permissions restrict writing
}
