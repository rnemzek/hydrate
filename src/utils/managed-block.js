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
//   - no existing content             -> file becomes just the block
//   - existing content, markers found -> only the delimited text is replaced
//     (everything outside the markers is preserved byte-for-byte)
//   - existing content, no markers    -> a "greenfield reset" is required:
//       - force: false (default) -> returns null (guard: caller must not
//         write, and should tell the operator to re-run with --force)
//       - force: true            -> wholesale-replaces the file with just
//         the block, discarding the unmarked legacy content
// (UOW-HYDRATE-15: the unmarked case used to auto-append instead of
// guarding — silently merging Hydrate's rules into a file the operator
// never opted into managing was surprising. Appending is no longer an
// available outcome; it's guard-by-default or full reset via --force.)
function applyManagedBlock(content, body, version, { force = false } = {}) {
  const block = renderManagedBlock(body, version);

  if (!content || !content.trim()) {
    return `${block}\n`;
  }

  if (BLOCK_RE.test(content)) {
    return content.replace(BLOCK_RE, block);
  }

  return force ? `${block}\n` : null;
}

// True when `content` is non-empty, unmarked legacy content that
// `applyManagedBlock()` will refuse to touch without `{ force: true }`.
function needsGreenfieldReset(content) {
  return Boolean(content && content.trim()) && !hasManagedBlock(content);
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

module.exports = { renderManagedBlock, hasManagedBlock, applyManagedBlock, stripManagedBlock, needsGreenfieldReset, BLOCK_RE };
