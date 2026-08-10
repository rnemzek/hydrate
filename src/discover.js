const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPT_CANDIDATES = {
  test: ['test'],
  build: ['build', 'compile'],
  lint: ['lint'],
  start: ['dev', 'start']
};

function pickScript(scripts, key) {
  if (!scripts) return null;
  for (const name of SCRIPT_CANDIDATES[key]) {
    if (scripts[name]) {
      return name === 'test' ? 'npm test' : `npm run ${name}`;
    }
  }
  return null;
}

function detectPackageManager(cwd) {
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(cwd, 'package-lock.json'))) return 'npm';
  return 'npm';
}

function inferNodeStack(deps) {
  const stack = new Set();
  const has = (name) => Boolean(deps && Object.prototype.hasOwnProperty.call(deps, name));

  if (has('typescript')) stack.add('TypeScript');
  if (has('react') || has('react-dom')) stack.add('React');
  if (has('solid-js')) stack.add('SolidJS');
  if (has('vue')) stack.add('Vue');
  if (has('svelte')) stack.add('Svelte');
  if (has('next')) stack.add('Next.js');
  if (has('express')) stack.add('Express');
  if (has('fastify')) stack.add('Fastify');
  if (has('@nestjs/core')) stack.add('NestJS');
  if (has('vite')) stack.add('Vite');
  if (has('jest')) stack.add('Jest');
  if (has('vitest')) stack.add('Vitest');
  if (has('mocha')) stack.add('Mocha');

  return Array.from(stack);
}

function detectNonNodeStack(cwd) {
  const stack = [];
  if (fs.existsSync(path.join(cwd, 'go.mod'))) stack.push('Go');
  if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) stack.push('Rust');
  if (fs.existsSync(path.join(cwd, 'requirements.txt')) || fs.existsSync(path.join(cwd, 'pyproject.toml'))) stack.push('Python');
  return stack;
}

function getRecentCommits(cwd, count = 10) {
  try {
    const out = execSync(`git log -n ${count} --pretty=format:"%h %s"`, {
      cwd,
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return out.toString().trim().split('\n').filter(Boolean);
  } catch (err) {
    return [];
  }
}

const KNOWN_DIRS = [
  'src', 'lib', 'app', 'apps', 'pages', 'components',
  'server', 'client', 'packages', 'bin', 'test', 'tests', '__tests__', 'docs'
];

function detectDirectories(cwd) {
  return KNOWN_DIRS.filter((d) => fs.existsSync(path.join(cwd, d)));
}

const RULE_FILE_CANDIDATES = ['CLAUDE.md', 'AI_PROJECT_RULES.md', '.cursorrules', '.github/copilot-instructions.md'];

function detectExistingRules(cwd) {
  return RULE_FILE_CANDIDATES.filter((f) => fs.existsSync(path.join(cwd, f)));
}

function discoverProject(cwd) {
  const result = {
    projectName: path.basename(cwd),
    stack: [],
    packageManager: null,
    testCommand: null,
    buildCommand: null,
    lintCommand: null,
    startCommand: null,
    directories: detectDirectories(cwd),
    recentCommits: getRecentCommits(cwd),
    existingRules: detectExistingRules(cwd)
  };

  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    let pkg = null;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch (err) {
      pkg = null;
    }

    if (pkg) {
      result.projectName = pkg.name || result.projectName;
      result.testCommand = pickScript(pkg.scripts, 'test');
      result.buildCommand = pickScript(pkg.scripts, 'build');
      result.lintCommand = pickScript(pkg.scripts, 'lint');
      result.startCommand = pickScript(pkg.scripts, 'start');
      result.packageManager = detectPackageManager(cwd);

      const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
      result.stack.push(...inferNodeStack(deps));
    }
  }

  if (fs.existsSync(path.join(cwd, 'tsconfig.json')) && !result.stack.includes('TypeScript')) {
    result.stack.push('TypeScript');
  }

  result.stack.push(...detectNonNodeStack(cwd));

  if (result.stack.length === 0) {
    result.stack.push('Node.js');
  }

  return result;
}

module.exports = { discoverProject };
