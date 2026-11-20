import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import Ajv from 'ajv/dist/2020.js';
import { renderHtml } from '../src/html.js';
import { scan } from '../src/scan.js';
import { fingerprint, repo, sample } from './helpers.js';

const expectedPath = join(repo, 'test', 'expected', 'sample.json');
const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(JSON.parse(readFileSync(join(repo, 'schema', 'code-tree.schema.json'), 'utf8')));

const { model } = await scan(sample);
const find = (name, file) => model.classes.find(c => c.name === name && (!file || c.file.endsWith(file)));

test('the sample project reads as the committed expected tree', () => {
  if (process.env.UPDATE_EXPECTED) {
    mkdirSync(dirname(expectedPath), { recursive: true });
    writeFileSync(expectedPath, `${JSON.stringify(model, null, 2)}\n`);
  }
  assert.ok(existsSync(expectedPath), 'run once with UPDATE_EXPECTED=1 to write test/expected/sample.json');
  assert.deepEqual(model, JSON.parse(readFileSync(expectedPath, 'utf8')));
});

test('the output follows the schema', () => {
  assert.ok(validate(model), JSON.stringify(validate.errors));
});

test('C#: descriptions come from /// <summary>, <see> turns into its name, and <inheritdoc/> is not asked for', () => {
  const service = find('UserService', 'UserService.cs');
  assert.equal(service.summary, 'Looks users up and changes them. See IUserStore for where they live.');
  const save = service.members.find(m => m.name === 'Save');
  assert.equal(save.summary, '');
  assert.equal(service.members.find(m => m.name === 'FindAsync').summary, 'Finds one user by id, or nothing when there is none.');
});

test('C#: a partial class is one class across its files, with the described part speaking for it', () => {
  const parts = model.classes.filter(c => c.name === 'UserService');
  assert.equal(parts.length, 1);
  assert.equal(parts[0].file, 'api/Services/UserService.cs');
  assert.deepEqual(parts[0].members.map(m => m.name).sort(), ['ActiveToday', 'Count', 'FindAsync', 'Name', 'Save', 'Touch', 'UserService']);
  assert.equal(parts[0].members.find(m => m.name === 'ActiveToday').file, 'api/Services/UserService.Extra.cs');
});

test('C#: interfaces, records, enums and nested classes are shown; generated files and obj/ are skipped', () => {
  assert.equal(find('IUserService').kind, 'interface');
  assert.equal(find('User').kind, 'record');
  assert.equal(find('Role').kind, 'enum');
  assert.ok(find('UserService.Cache'));
  assert.equal(find('Thing'), undefined);
  assert.equal(find('SkippedBuildOutput'), undefined);
  assert.equal(model.skipped.generated, 1);
});

test('TypeScript: JSDoc is the description, decorators are not part of the signature, and a file\'s functions are one entry', () => {
  const store = find('Store');
  assert.equal(store.summary, 'Keeps what the page shows, and the actions that change it.');
  assert.equal(store.members.find(m => m.name === 'open').signature, 'async open(id: string, extra?: number): Promise<void>');
  assert.equal(store.members.find(m => m.name === 'mode').summary, 'The mode: plain or developer.');
  const module = find('store', 'store.ts');
  assert.equal(module.kind, 'module');
  assert.deepEqual(module.members.map(m => m.name), ['increment', 'double', 'undocumented']);
});

test('JavaScript: the description stops at the first @tag', () => {
  assert.equal(find('util').members.find(m => m.name === 'join').summary, 'Joins two names with a dash.');
});

test('Python: the first paragraph of the docstring is the description; async, decorated and module functions are read', () => {
  const report = find('Report');
  assert.equal(report.summary, 'A report of one run.');
  assert.equal(report.signature, 'class Report(Base)');
  assert.equal(report.members.find(m => m.name === 'send').signature, 'async def send(self)');
  assert.equal(report.members.find(m => m.name === 'title').summary, 'The title of the report.');
  assert.deepEqual(find('helpers').members.map(m => m.name), ['top', 'lonely', 'one_line']);
});

test('files in other languages are counted as skipped, never read', () => {
  assert.deepEqual(model.skipped.languages, { Go: 1 });
});

test('areas are the top-level folders', () => {
  assert.deepEqual(model.tiles.map(t => t.name), ['api', 'evil', 'tools', 'web']);
});

test('scanning changes nothing in the project', async () => {
  const before = fingerprint(sample);
  await scan(sample);
  assert.equal(fingerprint(sample), before);
});

test('text in the scanned code can never break out of the page, and is read back as the same data', () => {
  const html = renderHtml(model);
  assert.equal((html.match(/<script/g) ?? []).length, 2, 'only the two script elements of the viewer');
  assert.equal((html.match(/<\/script>/g) ?? []).length, 2);
  const embedded = /<script type="application\/json" id="codetree-data">([\s\S]*?)<\/script>/.exec(html)[1];
  assert.deepEqual(JSON.parse(embedded), model);
  assert.ok(html.includes('<meta name="generator" content="codetree">'));
  // The code holds the texts /*SCRIPT*/ and /*DATA*/: they stay data (once each), and the viewer's script is in the page exactly once.
  assert.equal(html.split('/*SCRIPT*/').length - 1, 1);
  assert.equal(html.split('/*DATA*/').length - 1, 1);
  assert.equal(html.split("document.getElementById('codetree-data')").length - 1, 1);
});

test('the code tree.json override renames areas and the project', async () => {
  const { copySample } = await import('./helpers.js');
  const folder = copySample();
  writeFileSync(join(folder, 'codetree.json'), JSON.stringify({ name: 'Demo', tiles: { Backend: ['api'], Scripts: ['tools', 'other'] } }));
  const { model: renamed } = await scan(folder);
  assert.equal(renamed.root, 'Demo');
  assert.deepEqual(renamed.tiles.map(t => t.name), ['Backend', 'Scripts', 'evil', 'web']);
});
