// Idempotent "delimited managed block" primitive for CLAUDE.md (UOW-HYDRATE-14
// Item 1.1). Lets `hydrate init`/`hydrate sync` inject and refresh Hydrate's
// operating rules inside a brownfield CLAUDE.md without touching any
// surrounding text the Product Owner or another tool already wrote there.
const BLOCK_RE = /<!-- BEGIN HYDRATE MANAGED BLOCK.*?-->[\s\S]*?<!-- END HYDRATE MANAGED BLOCK -->/;
const END_MARKER = '<!-- END HYDRATE MANAGED BLOCK -->';

function beginMarker(version) {
  return `<!-- BEGIN HYDRATE MANAGED BLOCK v${version} -->`;
}

function renderManagedBlock(body, version) {
  return `${beginMarker(version)}\n${body.trim()}\n${END_MARKER}`;
}

function hasManagedBlock(content) {
  return Boolean(content) && BLOCK_RE.test(content);
}

// Returns the next full file content with `body` (tagged with `version`)
// applied as the managed block:
//   - no existing content            -> file becomes just the block
//   - existing content, no markers   -> block is appended to the bottom
//   - existing content, markers found -> only the delimited text is replaced
// Everything outside the markers is preserved byte-for-byte.
function applyManagedBlock(content, body, version) {
  const block = renderManagedBlock(body, version);

  if (!content || !content.trim()) {
    return `${block}\n`;
  }

  if (BLOCK_RE.test(content)) {
    return content.replace(BLOCK_RE, block);
  }

  return `${content.trimEnd()}\n\n${block}\n`;
}

// Removes the managed block entirely (used by `hydrate eject`). Returns the
// remaining content (trimmed, collapsing any leftover blank-line runs) and
// whether a block was actually found and removed.
function stripManagedBlock(content) {
  if (!content || !BLOCK_RE.test(content)) {
    return { content: content || '', removed: false };
  }

  const stripped = content.replace(BLOCK_RE, '').replace(/\n{3,}/g, '\n\n').trim();
  return { content: stripped ? `${stripped}\n` : '', removed: true };
}

module.exports = { renderManagedBlock, hasManagedBlock, applyManagedBlock, stripManagedBlock, BLOCK_RE };
