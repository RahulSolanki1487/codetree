import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { isIgnored, parseGitignore } from '../src/gitignore.js';
import { looksBundled, scan } from '../src/scan.js';
import { copySample } from './helpers.js';

const ignores = (text, path, isDirectory = false, base = '') => isIgnored(parseGitignore(text, base), path, isDirectory);

test('gitignore: a name matches at any depth, a leading slash only at the root, a trailing slash only folders', () => {
  assert.equal(ignores('dist', 'a/b/dist', true), true);
  assert.equal(ignores('/dist', 'dist', true), true);
  assert.equal(ignores('/dist', 'a/dist', true), false);
  assert.equal(ignores('build/', 'build', true), true);
  assert.equal(ignores('build/', 'build', false), false);
});

test('gitignore: stars, double stars, question marks, comments and re-including with !', () => {
  assert.equal(ignores('*.log', 'x/y/app.log'), true);
  assert.equal(ignores('*.log', 'x/y/app.txt'), false);
  assert.equal(ignores('a/**/c.js', 'a/b/b/c.js'), true);
  assert.equal(ignores('a/**/c.js', 'a/c.js'), true);
  assert.equal(ignores('file?.js', 'file1.js'), true);
  assert.equal(ignores('# a comment\n\n', 'x'), false);
  assert.equal(ignores('*.local.ts\n!keep.local.ts', 'keep.local.ts'), false);
  assert.equal(ignores('*.local.ts\n!keep.local.ts', 'other.local.ts'), true);
});

test('gitignore: a nested file applies only below its own folder', () => {
  assert.equal(ignores('nested.ts', 'web/src/nested.ts', false, 'web'), true);
  assert.equal(ignores('nested.ts', 'api/nested.ts', false, 'web'), false);
});

test('gitignore: a pattern it cannot read is skipped, not guessed at', () => {
  assert.deepEqual(parseGitignore('[abc].js\nfoo\\ bar'), []);
});

test('bundled and minified files are recognised by their long lines, hand-written ones are not', () => {
  assert.equal(looksBundled(`${'x'.repeat(30000)}\n`), true);
  assert.equal(looksBundled('line\n'.repeat(10000)), false);
  assert.equal(looksBundled('short'), false);
});

function withIgnoreFiles() {
  const folder = copySample();
  writeFileSync(join(folder, '.gitignore'), 'ignored/\n*.local.ts\n!keep.local.ts\n');
  writeFileSync(join(folder, 'web', '.gitignore'), 'nested.ts\n');
  return folder;
}

test('scan: leaves out what the project\'s .gitignore ignores, keeps what it re-includes, and counts them', async () => {
  const { model } = await scan(withIgnoreFiles());
  const names = model.classes.map(c => c.name);
  for (const left of ['Hidden', 'SecretLocal', 'Nested']) assert.ok(!names.includes(left), `${left} is ignored by git`);
  assert.ok(names.includes('KeepLocal'));
  assert.equal(model.skipped.ignored, 3);
});

test('scan: --no-gitignore reads them too', async () => {
  const { model } = await scan(withIgnoreFiles(), { gitignore: false });
  const names = model.classes.map(c => c.name);
  for (const read of ['Hidden', 'SecretLocal', 'Nested', 'KeepLocal']) assert.ok(names.includes(read), read);
  assert.equal(model.skipped.ignored, 0);
});

test('scan: a minified or bundled file is skipped and counted as generated, even when git does not ignore it', async () => {
  const { model } = await scan(copySample());
  assert.ok(!model.classes.some(c => c.name === 'Bundled'));
  assert.equal(model.skipped.generated, 2, 'the generated .g.cs file and the bundle');
});
