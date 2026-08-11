const fs = require('fs');
const path = require('path');

const COMMAND_CONTENT = `---
description: Sync the active Hydrate UOW into context and copy it to the clipboard.
---

Run \`hydrate prompt --copy\` in the project root using the Bash tool, then treat the
freshly written \`.hydrate/CURRENT_UOW.md\` payload as your active Lead Developer
execution scope for this session.
`;

// Regenerated in full every run — this file is solely owned by hydrate, so
// there's no user content to preserve across re-runs (unlike CLAUDE.md).
function runSetupCc() {
  const cwd = process.cwd();
  const commandsDir = path.join(cwd, '.claude', 'commands');
  const commandPath = path.join(commandsDir, 'hydrate.md');

  if (!fs.existsSync(commandsDir)) {
    fs.mkdirSync(commandsDir, { recursive: true });
  }

  const existed = fs.existsSync(commandPath);
  fs.writeFileSync(commandPath, COMMAND_CONTENT, 'utf8');

  console.log(`
💧 Claude Code Integration Ready!
  ✔ ${existed ? 'Updated' : 'Created'} .claude/commands/hydrate.md

⚡ NEXT STEPS:
   1. Open Claude Code in this repo.
   2. Type '/hydrate' to sync + copy the active UOW payload.
  `);

  return { path: commandPath, action: existed ? 'updated' : 'created' };
}

module.exports = { runSetupCc, COMMAND_CONTENT };
