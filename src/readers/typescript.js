// Reads TypeScript and JavaScript (tree-sitter): classes, interfaces, and the file's own functions. A description is the /** … */ comment above a declaration.
import { collapse, head, indentOf, leading } from './common.js';

const isDecorator = node => node.type === 'decorator';

function summaryOf(comments) {
  const docs = comments.filter(c => c.text.startsWith('/**'));
  if (docs.length === 0) return { summary: '', inherits: false, hasComment: false };
  const text = docs[docs.length - 1].text.replace(/^\/\*\*/, '').replace(/\*\/$/, '').split(/\r?\n/).map(l => l.replace(/^\s*\*? ?/, '')).join('\n');
  const body = text.split(/^\s*@/m)[0].replace(/\{@(?:link|linkcode|linkplain)\s+([^}|\s]+)[^}]*\}/g, '$1');
  if (/^\s*@inheritDoc|\{@inheritDoc\}/m.test(text)) return { summary: '', inherits: true, hasComment: true };
  return { summary: collapse(body), inherits: false, hasComment: true };
}

/** Where a new comment goes: above the declaration and its decorators; a declaration that already has a comment without a description is left to be edited by hand. */
function placeFor(outer, lines, node) {
  const { first, comments } = leading(outer, isDecorator);
  const docs = comments.filter(c => c.text.startsWith('/**'));
  if (docs.length) return { mode: 'none', reason: 'has a comment without a description: write it by hand' };
  return { mode: 'above', row: first.startPosition.row, indent: indentOf(lines, node.startPosition.row) };
}

function describe(outer, lines, node) {
  return { ...summaryOf(leading(outer, isDecorator).comments), place: placeFor(outer, lines, node) };
}

function functionMember(node, outer, lines, name, kind, stop) {
  return { name, kind, signature: head(node, stop, ['decorator'], { colon: true }), line: node.startPosition.row + 1, ...describe(outer, lines, node) };
}

function classMembers(body, lines) {
  const members = [];
  for (const child of body.children) {
    if (child.type === 'method_definition') {
      const name = child.childForFieldName('name')?.text ?? '';
      members.push(functionMember(child, child, lines, name, name === 'constructor' ? 'constructor' : 'method', ['statement_block']));
    } else if (child.type === 'public_field_definition') {
      const name = child.childForFieldName('name')?.text ?? '';
      const value = child.childForFieldName('value');
      const callable = value && (value.type === 'arrow_function' || value.type === 'function_expression' || value.type === 'function');
      const doc = summaryOf(leading(child, isDecorator).comments);
      if (!callable && !doc.hasComment) continue;
      const signature = callable ? `${name}${head(value, ['statement_block', '=>'], [], { colon: true })}` : head(child, ['=', ';']);
      members.push({ name, kind: callable ? 'method' : 'property', signature: collapse(signature), line: child.startPosition.row + 1, ...describe(child, lines, child) });
    }
  }
  return members;
}

function declared(outer, node, lines, out, moduleMembers) {
  const doc = () => describe(outer, lines, node);
  switch (node.type) {
    case 'class_declaration':
    case 'abstract_class_declaration': {
      const name = node.childForFieldName('name')?.text ?? '';
      const body = node.childForFieldName('body');
      out.push({ name, kind: 'class', signature: head(node, ['class_body'], ['decorator'], { colon: true }), line: node.startPosition.row + 1, ...doc(), members: body ? classMembers(body, lines) : [] });
      break;
    }
    case 'interface_declaration': {
      const name = node.childForFieldName('name')?.text ?? '';
      const members = [];
      for (const m of node.childForFieldName('body')?.children ?? []) {
        if (m.type !== 'method_signature') continue;
        members.push({ name: m.childForFieldName('name')?.text ?? '', kind: 'method', signature: collapse(m.text.replace(/;$/, '')), line: m.startPosition.row + 1, ...describe(m, lines, m) });
      }
      out.push({ name, kind: 'interface', signature: head(node, ['interface_body', 'object_type']), line: node.startPosition.row + 1, ...doc(), members });
      break;
    }
    case 'function_declaration':
    case 'generator_function_declaration': {
      const name = node.childForFieldName('name')?.text ?? '';
      moduleMembers.push(functionMember(node, outer, lines, name, 'function', ['statement_block']));
      break;
    }
    case 'lexical_declaration':
    case 'variable_declaration': {
      for (const d of node.children.filter(c => c.type === 'variable_declarator')) {
        const value = d.childForFieldName('value');
        if (!value || !['arrow_function', 'function_expression', 'function'].includes(value.type)) continue;
        const name = d.childForFieldName('name')?.text ?? '';
        moduleMembers.push({
          name, kind: 'function', signature: collapse(`${name}${head(value, ['statement_block', '=>'], [], { colon: true })}`), line: node.startPosition.row + 1, ...doc(),
        });
      }
      break;
    }
    default:
  }
}

/** Reads one parsed TypeScript or JavaScript file into class entries; the file's own functions become one entry named after the file. */
export function readTypeScript(root, source, fileName) {
  const lines = source.split(/\r?\n/);
  const out = [];
  const moduleMembers = [];
  for (const child of root.children) {
    if (child.type === 'export_statement') {
      const inner = child.children.find(c => !['export', 'default', 'decorator', 'comment', ';'].includes(c.type) && c.isNamed);
      if (inner) declared(child, inner, lines, out, moduleMembers);
    } else {
      declared(child, child, lines, out, moduleMembers);
    }
  }
  if (moduleMembers.length) {
    const base = fileName.split('/').pop().replace(/\.[^.]+$/, '');
    out.push({ name: base, kind: 'module', signature: '', line: 1, summary: '', inherits: false, hasComment: true, place: { mode: 'none', reason: 'a file has no declaration to comment' }, members: moduleMembers });
  }
  return out;
}
