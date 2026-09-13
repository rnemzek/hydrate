const { COMMANDS } = require('../help');

// The command surface a shell completion script should offer — every
// non-hidden verb (hidden entries are aliases/easter-eggs like `status`,
// `export`, `paste`, `lfg` that already complete via their canonical verb).
function getVisibleCommandNames() {
  return Object.entries(COMMANDS)
    .filter(([, meta]) => !meta.hidden)
    .map(([name]) => name);
}

function buildBashCompletion(commands) {
  return `# hydrate bash completion — install with:
#   hydrate completion bash >> ~/.bashrc
_hydrate_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  COMPREPLY=( $(compgen -W "${commands.join(' ')}" -- "$cur") )
}
complete -F _hydrate_completions hydrate
complete -F _hydrate_completions hz
`;
}

function buildZshCompletion(commands) {
  return `#compdef hydrate hz
# hydrate zsh completion — install with:
#   hydrate completion zsh >> ~/.zshrc
_hydrate() {
  local -a commands
  commands=(${commands.map((name) => `'${name}'`).join(' ')})
  _describe 'command' commands
}
_hydrate
`;
}

// `shell` is 'bash' or 'zsh' (anything else falls back to bash — the more
// broadly-installed default completion mechanism).
function buildCompletionScript(shell, commands = getVisibleCommandNames()) {
  return shell === 'zsh' ? buildZshCompletion(commands) : buildBashCompletion(commands);
}

// Picks a default shell for `hydrate completion` (no argument) by sniffing
// $SHELL — mirrors the same convention `src/commands/hook.js` uses for its
// rc-file default.
function detectShell(env = process.env) {
  return String(env.SHELL || '').includes('zsh') ? 'zsh' : 'bash';
}

module.exports = { getVisibleCommandNames, buildBashCompletion, buildZshCompletion, buildCompletionScript, detectShell };
