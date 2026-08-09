const fs = require('fs');
const path = require('path');

function runInit() {
  const cwd = process.cwd();
  console.log("💧 Initializing Hydrate AI Harness in:", cwd);

  // 1. Create PROJECT_PLAN.md template
  const planContent = `# PROJECT_PLAN.md

## UOW-01: System Initialization
- [ ] Initialize repository structure
- [ ] Configure environment variables
- [ ] Verify test suite baseline

## UOW-02: Core Feature Implementation
- [ ] Build core functional components
- [ ] Add integration unit tests
`;

  // 2. Create AI_PROJECT_RULES.md template
  const rulesContent = `# AI_PROJECT_RULES.md

### Execution Protocol
1. Never edit files outside target UOW scope without explicit architectural direction.
2. Verify test suite passes 100% clean before declaring task complete.
3. Update dev journals upon completing every UOW.
`;

  // Write files if they don't already exist
  writeFileSafely(path.join(cwd, 'PROJECT_PLAN.md'), planContent);
  writeFileSafely(path.join(cwd, 'AI_PROJECT_RULES.md'), rulesContent);

  // 3. Create journal directories
  const journalDir = path.join(cwd, 'docs', 'journals');
  if (!fs.existsSync(journalDir)) {
    fs.mkdirSync(journalDir, { recursive: true });
    console.log("  ✔ Created directory: docs/journals/");
  }

  writeFileSafely(path.join(journalDir, 'dev-journal.md'), "# Dev Journal\n\n");
  writeFileSafely(path.join(journalDir, 'architect-journal.md'), "# Architect Journal\n\n");

  console.log("\n🚀 Hydrate Harness scaffolding complete! Edit PROJECT_PLAN.md to start.");
}

function writeFileSafely(filePath, content) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✔ Created file: ${path.basename(filePath)}`);
  } else {
    console.log(`  ⚠️  Skipped (already exists): ${path.basename(filePath)}`);
  }
}

module.exports = { runInit };
