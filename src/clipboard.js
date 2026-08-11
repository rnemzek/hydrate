const { spawnSync } = require('child_process');

// Ordered by platform: cli.js always tries these in order and stops at the
// first one that actually exists, so Linux boxes with only `xsel` (no
// `xclip`) still work without any extra config.
function candidatesForPlatform(platform = process.platform) {
  switch (platform) {
    case 'darwin':
      return [{ cmd: 'pbcopy', args: [] }];
    case 'win32':
      return [{ cmd: 'clip', args: [] }];
    case 'linux':
      return [
        { cmd: 'xclip', args: ['-selection', 'clipboard'] },
        { cmd: 'xsel', args: ['--clipboard', '--input'] }
      ];
    default:
      return [];
  }
}

// Returns true on success, false if no clipboard tool was found/usable —
// callers are expected to fall back to printing `text` themselves rather
// than treating false as an error.
function copyToClipboard(text, { platform = process.platform, spawn = spawnSync } = {}) {
  const candidates = candidatesForPlatform(platform);

  for (const { cmd, args } of candidates) {
    const result = spawn(cmd, args, { input: text, encoding: 'utf8' });
    if (result && !result.error && result.status === 0) {
      return true;
    }
  }

  return false;
}

module.exports = { copyToClipboard, candidatesForPlatform };
