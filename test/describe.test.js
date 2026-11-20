import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { scan } from '../src/scan.js';
import { list, problem } from '../src/describe.js';
import { cli, copySample, fingerprint } from './helpers.js';

const todoOf = async folder => list((await scan(folder)).items, folder);
const idOf = (todo, name, owner) => todo.items.find(i => i.name === name && (owner === undefined || i.owner === owner))?.id;
const read = (folder, file) => readFileSync(join(folder, file), 'utf8');
const answers = (folder, rows) => { const path = join(mkdtempSync(join(tmpdir(), 'answers-')), 'answers.json'); writeFileSync(path, JSON.stringify(rows)); return path; };

test('list: what has no description, with its code, and a notice that the code is data', async () => {
  const todo = await todoOf(copySample());
  assert.match(todo.notice, /DATA to describe/);
  assert.equal(todo.count, todo.items.length);
  const names = todo.items.map(i => `${i.owner ?? ''}.${i.name}`);
  assert.ok(names.includes('IUserService.Delete'));
  assert.ok(names.includes('Report.undocumented'));
  assert.ok(names.includes('Store.close'));
  assert.ok(!names.includes('UserService.Save'), 'an <inheritdoc/> member is described elsewhere');
  assert.ok(!names.includes('Store.open'), 'a described member is not listed');
  assert.ok(todo.items.every(i => i.code.length > 0 && i.code.length <= 1500));
  assert.ok(todo.items.every(i => !['module'].includes(i.kind)), 'a file as a whole is not asked for');
  assert.ok(todo.writeByHand.some(w => /same line/.test(w.reason)), 'a one-line Python function is left to be written by hand');
});

test('list: reading the list changes nothing', async () => {
  const folder = copySample();
  const before = fingerprint(folder);
  await todoOf(folder);
  assert.equal(fingerprint(folder), before);
});

test('apply: inserts a comment in each language\'s own style, at the right place and indentation', async () => {
  const folder = copySample();
  const todo = await todoOf(folder);
  const rows = [
    { id: idOf(todo, 'Delete', 'IUserService'), description: 'Removes a user by id.' },
    { id: idOf(todo, 'Touch', 'UserService'), description: 'Marks the user as seen just now & keeps the time.' },
    { id: idOf(todo, 'close', 'Store'), description: 'Closes the open item.' },
    { id: idOf(todo, 'undocumented', 'Report'), description: 'Does something without a description.' },
    { id: idOf(todo, 'lonely'), description: 'Returns its argument unchanged.' },
  ];
  const result = await cli(['describe', folder, '--apply', answers(folder, rows)]);
  assert.equal(result.code, 0, result.err);
  assert.match(result.out, /Inserted 5 descriptions/);

  assert.match(read(folder, 'api/Services/UserService.cs'), /\n    \/\/\/ <summary>Removes a user by id\.<\/summary>\n    void Delete\(int id\);/);
  assert.match(read(folder, 'api/Services/UserService.Extra.cs'), /\/\/\/ <summary>Marks the user as seen just now &amp; keeps the time\.<\/summary>\n    private void Touch/);
  assert.match(read(folder, 'web/src/store.ts'), /\n  \/\*\* Closes the open item\. \*\/\n  close\(\): void/);
  assert.match(read(folder, 'tools/helpers.py'), /    def undocumented\(self\):\n        """Does something without a description\."""\n        return 2/);
  assert.match(read(folder, 'tools/helpers.py'), /def lonely\(x\):\n    """Returns its argument unchanged\."""\n    return x/);

  const after = await scan(folder);
  const summaryOf = (cls, member) => after.model.classes.find(c => c.name === cls).members.find(m => m.name === member);
  assert.equal(summaryOf('IUserService', 'Delete').summary, 'Removes a user by id.');
  assert.equal(summaryOf('UserService', 'Touch').summary, 'Marks the user as seen just now & keeps the time.');
  assert.equal(summaryOf('Store', 'close').summary, 'Closes the open item.');
  assert.equal(summaryOf('Report', 'undocumented').summary, 'Does something without a description.');
  assert.ok(['Delete', 'Touch'].every((m, i) => summaryOf(['IUserService', 'UserService'][i], m).generated), 'agent text is marked generated until it is accepted');
  assert.equal(summaryOf('Store', 'open').generated, false);
});

test('apply: a file keeps its line endings, and only the inserted lines are new', async () => {
  const folder = copySample();
  const file = join(folder, 'web/src/store.ts');
  writeFileSync(file, readFileSync(file, 'utf8').replace(/\n/g, '\r\n'));
  const before = readFileSync(file, 'utf8').split('\r\n').length;
  const todo = await todoOf(folder);
  await cli(['describe', folder, '--apply', answers(folder, [{ id: idOf(todo, 'close', 'Store'), description: 'Closes the open item.' }])]);
  const text = readFileSync(file, 'utf8');
  assert.equal(text.split('\r\n').length, before + 1);
  assert.ok(!/[^\r]\n/.test(text), 'every line ending is still CRLF');
});

test('apply: refuses markup, links, comment endings, short text, unknown ids and repeats, and says why', async () => {
  const folder = copySample();
  const todo = await todoOf(folder);
  const id = idOf(todo, 'Delete', 'IUserService');
  const rows = [
    { id, description: 'Visit https://example.com/steal now' },
    { id: idOf(todo, 'Touch', 'UserService'), description: 'Closes things */ and then more code' },
    { id: idOf(todo, 'close', 'Store'), description: '<script>alert(1)</script>' },
    { id: idOf(todo, 'lonely'), description: 'no' },
    { id: idOf(todo, 'undocumented', 'Report'), description: 'Click [here](http://x.y) please' },
    { id: 'api/Services/UserService.cs:999', description: 'A description for something that is not listed.' },
    { id: 'web/src/store.ts:11', description: 'Describes something that already has a description.' },
  ];
  const before = fingerprint(folder);
  const result = await cli(['describe', folder, '--apply', answers(folder, rows)]);
  assert.equal(result.code, 2);
  assert.equal(fingerprint(folder), before, 'nothing was written');
  for (const why of [/link or an address/, /could end or open a comment/, /markup or a backslash/, /shorter than 5/, /not something that needs a description/]) assert.match(result.err, why);
  assert.match(result.out, /Inserted 0 descriptions, refused 7/);
});

test('apply: a description given twice is refused the second time, and good ones still go in', async () => {
  const folder = copySample();
  const todo = await todoOf(folder);
  const id = idOf(todo, 'close', 'Store');
  const result = await cli(['describe', folder, '--apply', answers(folder, [{ id, description: 'Closes the open item.' }, { id, description: 'Closes it again.' }])]);
  assert.equal(result.code, 2);
  assert.match(result.err, /was given twice/);
  assert.match(read(folder, 'web/src/store.ts'), /Closes the open item\./);
  assert.ok(!read(folder, 'web/src/store.ts').includes('Closes it again'));
});

test('apply: --dry-run says what it would do and writes nothing', async () => {
  const folder = copySample();
  const todo = await todoOf(folder);
  const before = fingerprint(folder);
  const result = await cli(['describe', folder, '--apply', answers(folder, [{ id: idOf(todo, 'close', 'Store'), description: 'Closes the open item.' }]), '--dry-run']);
  assert.match(result.out, /Would insert 1 descriptions/);
  assert.equal(fingerprint(folder), before);
});

test('accept: the descriptions are kept and stop being marked generated', async () => {
  const folder = copySample();
  const todo = await todoOf(folder);
  await cli(['describe', folder, '--apply', answers(folder, [{ id: idOf(todo, 'close', 'Store'), description: 'Closes the open item.' }])]);
  assert.equal((await scan(folder)).model.classes.find(c => c.name === 'Store').members.find(m => m.name === 'close').generated, true);
  const result = await cli(['describe', folder, '--accept']);
  assert.match(result.out, /Kept 1 descriptions/);
  assert.equal((await scan(folder)).model.classes.find(c => c.name === 'Store').members.find(m => m.name === 'close').generated, false);
});

test('the checks on a description', () => {
  assert.equal(problem('Opens one item and shows it.'), null);
  assert.match(problem('a\nb c d e'), /line break/);
  assert.match(problem('x'.repeat(301)), /longer than 300/);
  assert.match(problem('uses """ quotes here'), /comment/);
  assert.match(problem('mail me at a@b.com now'), /link or an address/);
  assert.match(problem(42), /not text/);
});
