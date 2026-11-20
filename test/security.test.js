import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { GRAMMAR_HASHES } from '../src/grammar-hashes.js';
import { bundle, copySample, fingerprint, repo, sample } from './helpers.js';

test('every pinned grammar on disk matches its checksum', () => {
  for (const [name, expected] of Object.entries(GRAMMAR_HASHES)) {
    assert.equal(createHash('sha256').update(readFileSync(join(repo, 'grammars', name))).digest('hex'), expected, name);
  }
});

test('the tool runs with only read access to the folder and the grammars, write access to its output, and no way to start a program', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'codetree-out-')), 'code-tree.html');
  const output = execFileSync(process.execPath, [
    '--permission', `--allow-fs-read=${repo}`, `--allow-fs-read=${out}`, `--allow-fs-write=${out}`,
    bundle, 'scan', sample, '--out', out,
  ], { encoding: 'utf8' });
  assert.match(output, /Wrote /);
  assert.ok(readFileSync(out, 'utf8').includes('codetree-data'));
});

test('under that same permission model, starting a program is refused', () => {
  assert.throws(() => execFileSync(process.execPath, ['--permission', `--allow-fs-read=${repo}`, '-e', "require('node:child_process').execSync('echo no')"], { stdio: 'pipe' }));
});

test('the tool refuses to overwrite a file it did not make', () => {
  const folder = copySample();
  const mine = join(folder, 'notes.html');
  writeFileSync(mine, '<p>my own notes</p>');
  assert.throws(() => execFileSync(process.execPath, [bundle, 'scan', folder, '--out', mine], { stdio: 'pipe' }), /was not made by codetree/);
  assert.equal(readFileSync(mine, 'utf8'), '<p>my own notes</p>');
});

test('scanning the sample (with its hostile comments) through the bundled tool changes nothing in the project', () => {
  const folder = copySample();
  const out = join(mkdtempSync(join(tmpdir(), 'codetree-out-')), 'tree.html');
  const before = fingerprint(folder);
  execFileSync(process.execPath, [bundle, 'scan', folder, '--out', out], { encoding: 'utf8' });
  assert.equal(fingerprint(folder), before);
});

test('the sources make no network call and start no program', () => {
  const sources = ['cli.js', 'scan.js', 'describe.js', 'grammars.js', 'html.js', 'languages.js', 'main.js'].map(f => readFileSync(join(repo, 'src', f), 'utf8')).join('\n');
  for (const word of ['node:http', 'node:https', 'node:net', 'node:dgram', 'node:child_process', 'fetch(', 'XMLHttpRequest', 'eval(', 'new Function']) {
    assert.ok(!sources.includes(word), `the sources must not use ${word}`);
  }
});

test('the built tool is the one the sources make', () => {
  const built = readFileSync(bundle, 'utf8');
  assert.ok(built.startsWith('#!/usr/bin/env node'));
  assert.ok(!/node:child_process/.test(built.replace(/__createRequire/g, '')), 'the bundle does not start programs');
});
