const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderManagedBlock, hasManagedBlock, applyManagedBlock, stripManagedBlock } = require('../src/utils/managed-block');

test('renderManagedBlock() wraps the body in versioned begin/end markers', () => {
  const block = renderManagedBlock('Some rules', '1.4.0');
  assert.match(block, /^<!-- BEGIN HYDRATE MANAGED BLOCK v1\.4\.0 -->/);
  assert.match(block, /<!-- END HYDRATE MANAGED BLOCK -->$/);
  assert.match(block, /Some rules/);
});

test('hasManagedBlock() detects markers and rejects plain content', () => {
  assert.equal(hasManagedBlock(renderManagedBlock('x', '1.0.0')), true);
  assert.equal(hasManagedBlock('just some text'), false);
  assert.equal(hasManagedBlock(''), false);
  assert.equal(hasManagedBlock(null), false);
});

test('applyManagedBlock() creates a fresh file when there is no existing content', () => {
  const result = applyManagedBlock(null, 'Hydrate rules', '1.0.0');
  assert.match(result, /BEGIN HYDRATE MANAGED BLOCK v1\.0\.0/);
  assert.match(result, /Hydrate rules/);
});

test('applyManagedBlock() appends the block when existing content has no markers', () => {
  const result = applyManagedBlock('# My Project\n- custom rule', 'Hydrate rules', '1.0.0');
  assert.match(result, /# My Project\n- custom rule/);
  assert.match(result, /BEGIN HYDRATE MANAGED BLOCK v1\.0\.0/);
  // Custom content must come first, block appended after.
  assert.ok(result.indexOf('custom rule') < result.indexOf('BEGIN HYDRATE MANAGED BLOCK'));
});

test('applyManagedBlock() replaces only the delimited text when markers already exist', () => {
  const original = `# My Project\n- custom rule\n\n${renderManagedBlock('old rules', '1.0.0')}\n`;
  const result = applyManagedBlock(original, 'new rules', '1.1.0');

  assert.match(result, /# My Project\n- custom rule/);
  assert.match(result, /BEGIN HYDRATE MANAGED BLOCK v1\.1\.0/);
  assert.match(result, /new rules/);
  assert.doesNotMatch(result, /old rules/);
  assert.doesNotMatch(result, /v1\.0\.0/);
});

test('applyManagedBlock() is a no-op (identical output) when re-applied with the same body/version', () => {
  const first = applyManagedBlock(null, 'rules', '1.0.0');
  const second = applyManagedBlock(first, 'rules', '1.0.0');
  assert.equal(first, second);
});

test('stripManagedBlock() removes the block and reports removal', () => {
  const original = `# My Project\n- custom rule\n\n${renderManagedBlock('rules', '1.0.0')}\n`;
  const { content, removed } = stripManagedBlock(original);

  assert.equal(removed, true);
  assert.match(content, /# My Project\n- custom rule/);
  assert.doesNotMatch(content, /HYDRATE MANAGED BLOCK/);
});

test('stripManagedBlock() returns empty content when the block was the only content', () => {
  const { content, removed } = stripManagedBlock(renderManagedBlock('rules', '1.0.0'));
  assert.equal(removed, true);
  assert.equal(content, '');
});

test('stripManagedBlock() is a no-op when no block is present', () => {
  const { content, removed } = stripManagedBlock('plain content');
  assert.equal(removed, false);
  assert.equal(content, 'plain content');
});

test('stripManagedBlock() treats missing content as empty, unremoved', () => {
  const { content, removed } = stripManagedBlock(null);
  assert.equal(removed, false);
  assert.equal(content, '');
});
