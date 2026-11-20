// Builds the one HTML file: the viewer with the tree embedded in it.
import { VIEWER_CSS, VIEWER_HTML, VIEWER_JS } from './viewer-assets.js';

/** The tree as text that is safe inside a <script> element (`<` is written as <, so nothing can close the element or open a comment). */
function embed(model) {
  return JSON.stringify(model).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/** The viewer page for a tree. One pass over the template, so text inside the embedded tree is never mistaken for a placeholder. */
export function renderHtml(model) {
  const parts = { CSS: VIEWER_CSS, DATA: embed(model), SCRIPT: VIEWER_JS };
  return VIEWER_HTML.replace(/\/\*(CSS|DATA|SCRIPT)\*\//g, (_, key) => parts[key]);
}
