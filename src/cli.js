// The command line: scan, and the description step (list, apply, accept).
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { accept, apply, list, parseDescriptions } from './describe.js';
import { renderHtml } from './html.js';
import { scan } from './scan.js';

export const VERSION = '1.0.0';

const HELP = `codetree ${VERSION}: a browsable code tree of a C#, TypeScript/JavaScript or Python project.

  codetree scan [folder] [--out code-tree.html] [--json code-tree.json] [--no-gitignore]
      Reads the folder (default: here) and writes one HTML file to open in a browser.
      What the project's .gitignore ignores, and minified or bundled files, are left out.
  codetree describe [folder] --list [--out todo.json]
      Lists what has no description, with its code, for an agent to describe.
  codetree describe [folder] --apply descriptions.json [--dry-run]
      Checks what the agent wrote and inserts it as comments. Review the result with git diff.
  codetree describe [folder] --accept
      You have read the descriptions and keep them: they stop being marked "generated".

Other languages are listed as skipped, never guessed at. Nothing in the folder is run, built or loaded, and nothing is sent anywhere.
`;

function options(args) {
  const out = { folder: '.', flags: {} };
  let positional = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const name = a.slice(2);
      out.flags[name] = ['out', 'json', 'apply'].includes(name) ? args[++i] : true;
    } else if (!positional) { out.folder = a; positional = true; }
  }
  return out;
}

/** HTML written by this tool says so in a <meta>; a file that does not is never overwritten (it could be something of the user's). */
function writable(path, force) {
  if (!existsSync(path) || force) return true;
  return readFileSync(path, 'utf8').includes('<meta name="generator" content="codetree">') || path.endsWith('.json');
}

function write(path, text, force) {
  if (!writable(path, force)) throw new Error(`${path} exists and was not made by codetree: choose another name with --out, or add --force.`);
  writeFileSync(path, text);
}

function summary(model) {
  const members = model.classes.reduce((n, c) => n + c.members.length, 0);
  const lines = [`Read ${model.files} files: ${model.classes.length} classes or files, ${members} members, in ${model.tiles.length} areas.`];
  const without = model.classes.reduce((n, c) => n + (c.summary || c.kind === 'module' ? 0 : 1) + c.members.filter(m => !m.summary).length, 0);
  lines.push(`${without} classes, files or members have no description yet.`);
  const langs = Object.entries(model.skipped.languages);
  if (langs.length) lines.push(`Skipped files in unsupported languages: ${langs.map(([l, n]) => `${l} ${n}`).join(', ')}.`);
  if (model.skipped.generated) lines.push(`Skipped ${model.skipped.generated} generated or minified files.`);
  if (model.skipped.ignored) lines.push(`Left out ${model.skipped.ignored} files and folders the project's .gitignore ignores (--no-gitignore reads them too).`);
  return lines;
}

/** Runs a command. Returns the exit code; prints to the given streams. */
export async function run(argv, io = { out: s => process.stdout.write(s + '\n'), err: s => process.stderr.write(s + '\n') }) {
  const [command, ...rest] = argv;
  if (!command || command === 'help' || command === '--help' || command === '-h') { io.out(HELP); return 0; }
  if (command === '--version' || command === '-v') { io.out(VERSION); return 0; }
  const { folder, flags } = options(rest);
  const root = resolve(folder);
  if (!existsSync(root) || !statSync(root).isDirectory()) { io.err(`${folder} is not a folder.`); return 1; }

  try {
    if (command === 'scan') {
      const { model } = await scan(root, { gitignore: !flags['no-gitignore'] });
      const htmlPath = resolve(flags.out ?? join(root, 'code-tree.html'));
      write(htmlPath, renderHtml(model), flags.force);
      if (flags.json) write(resolve(flags.json), `${JSON.stringify(model, null, 2)}\n`, flags.force);
      for (const line of summary(model)) io.out(line);
      io.out(`Wrote ${htmlPath}: open it in a browser.`);
      return 0;
    }
    if (command === 'describe') {
      const { items } = await scan(root, { gitignore: !flags['no-gitignore'] });
      if (flags.accept) { io.out(`Kept ${accept(root)} descriptions: they are no longer marked generated.`); return 0; }
      if (flags.list) {
        const todo = list(items, root);
        const text = `${JSON.stringify(todo, null, 2)}\n`;
        if (flags.out) { write(resolve(flags.out), text, flags.force); io.out(`${todo.count} items need a description: written to ${resolve(flags.out)}.`); } else io.out(text);
        return 0;
      }
      if (flags.apply) {
        const result = apply(items, root, parseDescriptions(readFileSync(resolve(flags.apply), 'utf8')), { dryRun: Boolean(flags['dry-run']) });
        for (const r of result.refused) io.err(`Refused ${r.id}: ${r.why}.`);
        io.out(`${flags['dry-run'] ? 'Would insert' : 'Inserted'} ${result.applied.length} descriptions${result.refused.length ? `, refused ${result.refused.length}` : ''}.`);
        if (result.applied.length && !flags['dry-run']) io.out('Read the changes with git diff, then run: codetree describe --accept');
        return result.refused.length ? 2 : 0;
      }
      io.err('describe needs --list, --apply <file> or --accept.');
      return 1;
    }
  } catch (error) {
    io.err(error.message);
    return 1;
  }
  io.err(`Unknown command "${command}". Run: codetree --help`);
  return 1;
}
