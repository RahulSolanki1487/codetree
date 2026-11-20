// Reads C# (tree-sitter): namespaces, classes, interfaces, structs, records and enums, with their methods, constructors and properties.
// A description is the /// <summary> XML comment; a /// <inheritdoc/> means "described elsewhere" and is not asked for.
import { collapse, head, indentOf, leading } from './common.js';

const VERBS = { HttpGet: 'GET', HttpPost: 'POST', HttpPut: 'PUT', HttpDelete: 'DELETE', HttpPatch: 'PATCH' };

/** The routing attributes of a declaration: [Route("x")] gives a route, [HttpGet("y")] a verb and a path. Read from the attribute text only. */
function routingOf(node) {
  const found = {};
  for (const list of node.children.filter(isAttributeList)) {
    for (const m of list.text.matchAll(/\b(Route|Http(?:Get|Post|Put|Delete|Patch))\b(?:\s*\(\s*"([^"]*)")?/g)) {
      if (m[1] === 'Route') found.route = m[2] ?? '';
      else found.http = { verb: VERBS[m[1]], path: m[2] ?? '' };
    }
  }
  return found;
}

/** The calls of the form target.Method(...) in a method's body, where target is a plain name or this.name: what the method hands its work to. */
function invokesOf(node) {
  const found = new Map();
  for (const call of node.descendantsOfType('invocation_expression')) {
    const fn = call.childForFieldName('function');
    if (fn?.type !== 'member_access_expression') continue;
    let target = fn.childForFieldName('expression');
    if (target?.type === 'member_access_expression' && target.childForFieldName('expression')?.type === 'this_expression') target = target.childForFieldName('name');
    const method = fn.childForFieldName('name')?.text.replace(/<.*$/s, '');
    if (target?.type !== 'identifier' || !method) continue;
    found.set(target.text + '.' + method, { target: target.text, method });
  }
  return [...found.values()];
}

const TYPES = {
  class_declaration: 'class', interface_declaration: 'interface', struct_declaration: 'struct', record_declaration: 'record',
  record_struct_declaration: 'record', enum_declaration: 'enum',
};
const MEMBERS = { method_declaration: 'method', constructor_declaration: 'constructor', property_declaration: 'property', operator_declaration: 'operator' };

function summaryOf(comments) {
  const doc = comments.filter(c => c.text.startsWith('///')).map(c => c.text.replace(/^\/\/\/ ?/, '')).join('\n');
  if (!doc) return { summary: '', inherits: false, hasComment: false };
  if (/<inheritdoc\b/.test(doc)) return { summary: '', inherits: true, hasComment: true };
  const match = /<summary>([\s\S]*?)<\/summary>/.exec(doc);
  if (!match) return { summary: '', inherits: false, hasComment: true };
  const text = match[1]
    .replace(/<(?:see|seealso|paramref|typeparamref)\b[^>]*?(?:cref|name)="([^"]*)"[^>]*\/?>/g, (_, name) => ` ${name.replace(/^[A-Z]:/, '').replace(/\(.*$/, '').split('.').pop()} `)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  return { summary: collapse(text), inherits: false, hasComment: true };
}

const isAttributeList = node => node.type === 'attribute_list';

/** Where a new comment goes: above the existing /// block, else above the declaration (and its attributes). */
function placeFor(node, lines) {
  const { first, comments } = leading(node);
  const docs = comments.filter(c => c.text.startsWith('///'));
  const row = docs.length ? docs[0].startPosition.row : first.startPosition.row;
  return { mode: 'above', row, indent: indentOf(lines, node.startPosition.row) };
}

function memberOf(node, lines) {
  const name = node.childForFieldName('name')?.text ?? node.children.find(c => c.type === 'identifier')?.text ?? '';
  const kind = MEMBERS[node.type];
  const signature = kind === 'property'
    ? head(node, ['accessor_list', 'arrow_expression_clause', '=', ';'], ['attribute_list'])
    : head(node, ['block', 'arrow_expression_clause', ';', 'constructor_initializer'], ['attribute_list']);
  return { name, kind, signature, line: node.startPosition.row + 1, ...summaryOf(leading(node).comments), place: placeFor(node, lines), http: routingOf(node).http, invokes: invokesOf(node) };
}

/** The grammar cannot read a primary constructor with a qualified generic parameter (A.B.IOptions<C>) and puts "Name(" in an error node: the name is there. */
function nameOf(node) {
  const lost = node.children.find(c => c.type === 'ERROR' && /^[A-Za-z_]\w*\s*\(/.test(c.text));
  return lost ? /^[A-Za-z_]\w*/.exec(lost.text)[0] : node.childForFieldName('name')?.text ?? '';
}

function typeOf(node, lines, namespace, outer) {
  const name = nameOf(node);
  const kind = TYPES[node.type];
  const members = [];
  const nested = [];
  const body = node.children.find(c => c.type === 'declaration_list');
  for (const child of body?.children ?? []) {
    if (MEMBERS[child.type]) members.push(memberOf(child, lines));
    else if (TYPES[child.type]) nested.push(...typeOf(child, lines, namespace, outer ? `${outer}.${name}` : name));
  }
  const signature = head(node, ['declaration_list', 'enum_member_declaration_list', ';'], ['attribute_list']);
  const entry = {
    name: outer ? `${outer}.${name}` : name, kind, namespace, signature, line: node.startPosition.row + 1,
    partial: node.children.some(c => c.type === 'modifier' && c.text === 'partial'),
    ...summaryOf(leading(node).comments), place: placeFor(node, lines), members, route: routingOf(node).route,
  };
  return [entry, ...nested];
}

function walk(node, lines, namespace, out) {
  for (const child of node.children) {
    if (TYPES[child.type]) out.push(...typeOf(child, lines, namespace, ''));
    else if (child.type === 'namespace_declaration' || child.type === 'file_scoped_namespace_declaration') {
      const name = child.childForFieldName('name')?.text ?? '';
      walk(child.children.find(c => c.type === 'declaration_list') ?? child, lines, namespace ? `${namespace}.${name}` : name, out);
    }
  }
}

/** Reads one parsed C# file into class entries (partial classes of one file or several are merged later, by scan). */
export function readCSharp(root, source) {
  const lines = source.split(/\r?\n/);
  const out = [];
  walk(root, lines, '', out);
  return out;
}
