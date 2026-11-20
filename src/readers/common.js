// Small helpers the readers share.

export const collapse = text => text.replace(/\s+/g, ' ').trim();

/** The text of the node's children from the first one that is not skipped up to (not including) the first stop node: a declaration's head without its body. */
export function head(node, stopTypes, skipTypes = [], { colon = false } = {}) {
  const parts = [];
  for (const child of node.children) {
    if (stopTypes.includes(child.type)) break;
    if (skipTypes.includes(child.type)) continue;
    parts.push(child.text);
  }
  const text = collapse(parts.join(' ')).replace(/\s+([,;)\]])/g, '$1').replace(/([(\[])\s+/g, '$1').replace(/([\w>?\]])\s+\(/g, '$1(');
  return colon ? text.replace(/\)\s+:/g, '):') : text;
}

/**
 * The comment nodes directly above a declaration (no blank line between them), nearest last. `isLeading` says which sibling types may sit between the
 * comments and the declaration (attributes, decorators): the first of them is where a new comment would go.
 */
export function leading(node, isLeading = () => false) {
  let first = node;
  while (first.previousSibling && isLeading(first.previousSibling) && first.previousSibling.endPosition.row >= first.startPosition.row - 1) first = first.previousSibling;
  const comments = [];
  let next = first;
  while (next.previousSibling && next.previousSibling.type === 'comment' && next.previousSibling.endPosition.row >= next.startPosition.row - 1) {
    next = next.previousSibling;
    comments.unshift(next);
  }
  return { first, comments };
}

/** The indentation (spaces and tabs) of a source line. */
export function indentOf(lines, row) {
  return (lines[row] ?? '').match(/^[ \t]*/)[0];
}

/** A short description's first paragraph, in one line. */
export function firstParagraph(text) {
  return collapse(text.trim().split(/\r?\n\s*\r?\n/)[0] ?? '');
}
