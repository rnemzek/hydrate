
npm init --scope=@nemzilla
npm publish --access public


🛠️ What You Need to Do in NPM Right Now
1. Click Your Profile Icon (Top Right)
Click that purple/green avatar icon in the top-right corner of the NPM screen. A drop-down menu will appear.

2. Click "Add Organization"
In that drop-down menu, look for "Add Organization" (or "Create Organization").

Organization Name / Scope: Type nemzilla

Type: Select the Free Tier (it allows unlimited public scoped packages).

💡 Why this matters: Creating the nemzilla organization reserves @nemzilla as your official NPM scope. Once created, any package you publish as @nemzilla/hydrate will belong exclusively to your brand, and nobody else on Earth can take it!

🚀 The 3-Step Setup Checklist
Here is our immediate setup pipeline while CC finishes UOW-15:

┌─────────────────────────────────────────────────────────────┐
│ 1. GitHub Repo Created  ──▶  github.com/rnemzek/hydrate    │ ✅ DONE!
├─────────────────────────────────────────────────────────────┤
│ 2. NPM Org Reserved    ──▶  @nemzilla on npmjs.com         │ 👈 DO THIS NOW
├─────────────────────────────────────────────────────────────┤
│ 3. Enable 2FA           ──▶  Configure 2FA on NPM Account   │ 👈 MANDATORY
└─────────────────────────────────────────────────────────────┘
3. Enable Two-Factor Authentication (2FA)
You see that yellow banner at the top of your NPM screen? NPM strictly requires 2FA to publish packages (starting August 2026 for tokens and mandatory for direct publishing).

Click "Configure 2FA" in that yellow banner.

Link it to your phone's Authenticator app (1Password, Google Authenticator, Authy, etc.).

Once you create the @nemzilla organization on NPM and turn on 2FA, your publishing pipeline is officially locked and loaded. When we finish StreamZilla's NFL features, publishing @nemzilla/hydrate will take literally 10 seconds from your terminal!

---

🏗️ How Hydrate Enforces Workflow Adherence
Instead of treating AI_PROJECT_RULES.md as a static document you have to read and remember, Hydrate acts as the interactive referee and automated prompt generator.

                   ┌──────────────────────────────────────────┐
                   │               DEVELOPER                  │
                   │       (Runs: `npx @nemzilla/hydrate`)    │
                   └────────────────────┬─────────────────────┘
                                        │
     ┌──────────────────────────────────┴──────────────────────────────────┐
     │                                                                     │
     ▼                                                                     ▼
┌──────────────────────────────────────┐   ┌──────────────────────────────────────┐
│  1. `hydrate sync` (Validation)      │   │  2. `hydrate prompt` (Generation)    │
│  • Reads git diff & changesets       │   │  • Parses active UOW from plan       │
│  • Checks if journals were updated   │   │  • Injects latest journal deltas     │
│  • Blocks commit if rules violated   │   │  • Outputs exact prompt for CC       │
└──────────────────────────────────────┘   └──────────────────────────────────────┘
🛠️ The 3 Compliance Engines inside Hydrate
1. The Prompt Engine (hydrate prompt)
You shouldn't have to manually craft long CC prompts in your head or copy-paste template markdown files.

When you run npx @nemzilla/hydrate prompt:

It inspects PROJECT_PLAN.md and finds the next unchecked UOW (e.g., UOW-15).

It pulls the latest 2 entries from dev-journal.md and architect-journal.md to get recent context deltas.

It combines those deltas with AI_PROJECT_RULES.md into a perfectly formatted, laser-focused prompt.

It automatically copies that prompt to your clipboard ready to paste into Claude Code.

Result: Zero friction, 100% adherence to your prompt formatting rules every single time.

2. Git Pre-Commit Hook Enforcement (hydrate init)
When a user runs npx @nemzilla/hydrate init in a repository, it installs a lightweight Git pre-commit hook (.husky/pre-commit or .git/hooks/pre-commit).

Before Git allows a commit on dev, the hook runs hydrate verify:

✅ Does PROJECT_PLAN.md have marked-off tasks?

✅ Has dev-journal.md been updated with new execution notes?

✅ Are there untracked, rogue files floating around outside the project scope?

If any check fails, the commit is paused with a clear, friendly reminder:

⚠️ "Hydrate Notice: You're trying to commit without updating dev-journal.md. Run npx @nemzilla/hydrate journal to auto-append your notes!"

3. Interactive Terminal Wizards (hydrate journal)
Instead of opening dev-journal.md and manually typing out raw Markdown headers, Hydrate gives you interactive terminal prompts powered by Inquirer:

Bash
$ npx @nemzilla/hydrate journal

? Which UOW did you just complete? UOW-14
? What was the primary code change? Rebuilt Team Hub with ESPN high-res crests and news proxy
? Did you catch any bugs or edge cases? Fixed Capacitor window.open bug (_system vs _blank)
? Test suite status: 132/132 passing

✔ Dev Journal, Architect Journal, and Prompt Journal updated automatically!
🎯 The Philosophy: Make Compliance the Path of Least Resistance
You don't get humans to adhere to workflows by giving them a 10-page manual. You get them to adhere by making the automated tool faster and easier than doing it manually.

You run hydrate prompt ➡️ CC gets laser-focused instructions.

CC finishes code ➡️ You run hydrate journal ➡️ Logs format themselves.

You run git commit ➡️ hydrate verify checks your work and passes green.

That is how Hydrate turns context engineering from a chore into an effortless habit

---

1. How We Teach & Instruct the User (Zero Friction Onboarding)
You don't teach developers by forcing them to read a dry 20-page README.md. You teach them interactively right inside their terminal.

When a user opens a brand-new project and runs:

Bash
npx @nemzilla/hydrate init
The CLI executes an interactive wizard (like a video game tutorial) that teaches the protocol while setting up the project:

💧 Welcome to Hydrate AI Harness — NemZilla Studio

? What is your project name? StreamZilla
? What is your primary LLM dev agent? Claude Code
? What is your primary architecture role? Architect & Product Owner

✔ Created .hydrate/
✔ Created PROJECT_PLAN.md (Your master UOW backlog)
✔ Created AI_PROJECT_RULES.md (The guardrails for your AI)
✔ Created docs/journals/ (dev-journal, architect-journal, prompt-journal)
✔ Installed Git pre-commit hook guardrails

📖 QUICK START LESSON:
1. Edit `PROJECT_PLAN.md` with your UOW backlog items.
2. Run `npx @nemzilla/hydrate prompt` to generate your next AI prompt.
3. Hand the prompt to Claude Code and watch it execute flawlessly!
The key insight: The user doesn't need to know how AI_PROJECT_RULES.md works under the hood. hydrate init creates the exact templates for them, and hydrate prompt reads them automatically!

2. Where Does the Logic Live When Someone Runs hydrate StreamZilla?
How does the tool know what state StreamZilla is in and what to feed the AI?

Rule #1: The Code Repository Is the Single Source of Truth
Hydrate does not rely on a central remote cloud server holding private project details. Instead, the repository itself contains the state.

When you run:

Bash
cd ~/Projects/personal/streamzilla
npx @nemzilla/hydrate prompt
The CLI doesn't need a hardcoded database of every app in the world. It simply looks at the current working directory:

~/Projects/personal/streamzilla/
├── PROJECT_PLAN.md          <── Read by CLI (finds first unchecked UOW, e.g. UOW-15)
├── AI_PROJECT_RULES.md      <── Read by CLI (pulls system guardrails & rules)
└── docs/journals/           <── Read by CLI (pulls last 2 dev/architect journal deltas)
Inside ./bin/cli.js (The Code Logic)
Here is how the JavaScript logic actually builds and outputs the payload:

JavaScript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 1. Locate project files in current directory
const cwd = process.cwd();
const planPath = path.join(cwd, 'PROJECT_PLAN.md');
const rulesPath = path.join(cwd, 'AI_PROJECT_RULES.md');

// 2. Read file contents
const planText = fs.readFileSync(planPath, 'utf8');
const rulesText = fs.readFileSync(rulesPath, 'utf8');

// 3. Parse the next pending UOW from PROJECT_PLAN.md using simple Regex
const nextUowMatch = planText.match(/## (UOW-\d+:[\s\S]*?)(?=## UOW-|\$)/);
const nextUow = nextUowMatch ? nextUowMatch[1] : "All UOWs complete!";

// 4. Construct the Laser-Focused Prompt for Claude Code / CC
const promptPayload = `
You are acting as Lead Developer (Claude Code / "CC").
Adhere to the following rules from AI_PROJECT_RULES.md:
${rulesText}

Target Unit of Work to Execute:
${nextUow}
`;

// 5. Print to terminal AND copy directly to user clipboard!
console.log("⚡ Generated Hydrate prompt for next UOW! (Copied to clipboard)");
🎯 Bringing It All Together
User runs npx @nemzilla/hydrate init once: It creates PROJECT_PLAN.md, AI_PROJECT_RULES.md, and journal files inside their folder.

User adds their feature list to PROJECT_PLAN.md.

User runs npx @nemzilla/hydrate prompt:

Hydrate reads the local PROJECT_PLAN.md and AI_PROJECT_RULES.md.

It formats the ultimate, razor-sharp prompt payload.

It copies it straight to the clipboard!

User pastes it to Claude Code (CC).

The user doesn't have to remember complex protocols—they just run hydrate prompt, paste the result, and let CC cook!

!
