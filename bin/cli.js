#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { runInit } = require('../src/init');

// Capture the user command (e.g. 'init', 'prompt')
const command = process.argv[2];

switch (command) {
  case 'init':
    runInit();
    break;

  case 'prompt':
    generatePrompt();
    break;

  default:
    console.log(`
💧 Hydrate AI Harness — NemZilla Studio

Usage:
  npx @nemzilla/hydrate init     Scaffold Hydrate files in current repo
  npx @nemzilla/hydrate prompt   Generate next UOW prompt for AI Agent
    `);
    break;
}

function generatePrompt() {
  const cwd = process.cwd();
  const planPath = path.join(cwd, 'PROJECT_PLAN.md');
  const rulesPath = path.join(cwd, 'AI_PROJECT_RULES.md');

  if (!fs.existsSync(planPath) || !fs.existsSync(rulesPath)) {
    console.error("❌ Error: Missing PROJECT_PLAN.md or AI_PROJECT_RULES.md. Run `npx @nemzilla/hydrate init` first!");
    process.exit(1);
  }

  const planText = fs.readFileSync(planPath, 'utf8');
  const rulesText = fs.readFileSync(rulesPath, 'utf8');

  // Regex to extract the first unchecked UOW block
  const pendingUowMatch = planText.match(/## (UOW-\d+:[\s\S]*?)(?=## UOW-|$)/);
  const nextUOW = pendingUowMatch ? pendingUowMatch[1] : "All UOWs are complete!";

  const generatedPrompt = `
You are acting as Lead Developer (Claude Code / "CC").

### System Rules
${rulesText}

### Active Target Task
${nextUOW}
`;

  console.log("\n=================== GENERATED HYDRATE PROMPT ===================");
  console.log(generatedPrompt);
  console.log("================================================================");
  console.log("⚡ Copy the payload above and hand it to Claude Code!");
}
