// Reads Python (tree-sitter): classes and their methods, and the file's own functions. A description is the docstring.
import { collapse, firstParagraph, indentOf } from './common.js';

/** The docstring of a function or class body, and where a new one goes (as the first statement of the body). */
function docstringOf(node, lines) {
  const body = node.childForFieldName('body');
  const first = body?.children.find(c => c.isNamed && c.type !== 'comment');
  if (!body || !first) return { summary: '', inherits: false, hasComment: false, place: { mode: 'none', reason: 'an empty body' } };
  const string = first.type === 'expression_statement' ? first.children.find(c => c.type === 'string') : null;
  if (string) {
    const text = string.children.filter(c => c.type === 'string_content').map(c => c.text).join('');
    return { summary: firstParagraph(text), inherits: false, hasComment: true, place: { mode: 'none', reason: 'has a docstring without a description: write it by hand' } };
  }
  if (first.startPosition.row === node.startPosition.row) return { summary: '', inherits: false, hasComment: false, place: { mode: 'none', reason: 'the body is on the same line' } };
  return { summary: '', inherits: false, hasComment: false, place: { mode: 'docstring', row: first.startPosition.row, indent: indentOf(lines, first.startPosition.row) } };
}

function functionOf(node, lines, decorated) {
  const name = node.childForFieldName('name')?.text ?? '';
  const returns = node.childForFieldName('return_type');
  const isAsync = node.children.some(c => c.type === 'async') || node.text.startsWith('async');
  const signature = collapse(`${isAsync ? 'async ' : ''}def ${name}${node.childForFieldName('parameters')?.text ?? '()'}${returns ? ` -> ${returns.text}` : ''}`);
  return { name, kind: 'function', signature, line: (decorated ?? node).startPosition.row + 1, ...docstringOf(node, lines) };
}

function classOf(node, lines, decorated) {
  const name = node.childForFieldName('name')?.text ?? '';
  const bases = node.childForFieldName('superclasses')?.text ?? '';
  const members = [];
  for (const child of node.childForFieldName('body')?.children ?? []) {
    if (child.type === 'function_definition') members.push({ ...functionOf(child, lines), kind: 'method' });
    else if (child.type === 'decorated_definition') {
      const def = child.childForFieldName('definition');
      if (def?.type === 'function_definition') members.push({ ...functionOf(def, lines, child), kind: 'method' });
    }
  }
  return { name, kind: 'class', signature: `class ${name}${bases}`, line: (decorated ?? node).startPosition.row + 1, ...docstringOf(node, lines), members };
}

/** Reads one parsed Python file into class entries; the file's own functions become one entry named after the file. */
export function readPython(root, source, fileName) {
  const lines = source.split(/\r?\n/);
  const out = [];
  const functions = [];
  for (const child of root.children) {
    const def = child.type === 'decorated_definition' ? child.childForFieldName('definition') : child;
    const outer = child.type === 'decorated_definition' ? child : undefined;
    if (def?.type === 'class_definition') out.push(classOf(def, lines, outer));
    else if (def?.type === 'function_definition') functions.push(functionOf(def, lines, outer));
  }
  if (functions.length) {
    const base = fileName.split('/').pop().replace(/\.py$/, '');
    out.push({ name: base, kind: 'module', signature: '', line: 1, summary: '', inherits: false, hasComment: true, place: { mode: 'none', reason: 'a file has no declaration to comment' }, members: functions });
  }
  return out;
}
