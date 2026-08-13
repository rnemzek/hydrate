#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

try {
  const claudeCmdDir = path.join(os.homedir(), '.claude', 'commands');
  fs.mkdirSync(claudeCmdDir, { recursive: true });

  // 1. Create main /hydrate command
  const hydrateCmdPath = path.join(claudeCmdDir, 'hydrate.md');
  const hydrateContent = `Read the current unit of work and project context from \`.hydrate/CURRENT_UOW.md\` and \`CONTEXT.md\`.
