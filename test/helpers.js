import { cpSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const sample = join(repo, 'test', 'fixtures', 'sample');
export const bundle = join(repo, 'scripts', 'codetree.mjs');

/** A scratch copy of the sample project, so a test may change it. */
export function copySample() {
  const folder = mkdtempSync(join(tmpdir(), 'codetree-'));
  const target = join(folder, 'sample');
  cpSync(sample, target, { recursive: true });
  return target;
}

/** A hash of every file in a folder, to prove a command changed nothing. */
export function fingerprint(folder) {
  const hash = createHash('sha256');
  const visit = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else hash.update(path.slice(folder.length)).update(readFileSync(path));
    }
  };
  visit(folder);
  return hash.digest('hex');
}

/** Runs the command line in-process and returns the exit code and what it printed. */
export async function cli(args) {
  const { run } = await import('../src/cli.js');
  const out = [];
  const err = [];
  const code = await run(args, { out: s => out.push(s), err: s => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
