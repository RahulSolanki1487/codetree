// A small reader for .gitignore files, so the tool leaves out what the project itself leaves out of git (build output, copies of bundles, vendored code).
// Supported: comments, blank lines, `*`, `**`, `?`, a leading `/` (anchored), a trailing `/` (folders only), `!` (re-include), and one .gitignore per folder.
// Not supported: character classes and escapes (such a line is ignored). The file is only ever read as text.

const MOST_LINES = 2000;
const MOST_LENGTH = 200;

function toRegex(pattern) {
  let body = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        if (pattern[i + 2] === '/') { body += '(?:.*/)?'; i += 2; } else { body += '.*'; i += 1; }
      } else body += '[^/]*';
    } else if (c === '?') body += '[^/]';
    else if (c === '[' || c === '\\') return null;
    else body += c.replace(/[.+^${}()|]/g, '\\$&');
  }
  return body;
}

/** The rules of one .gitignore (its text), for the folder `base` (a path relative to the project, '' for the root). */
export function parseGitignore(text, base = '') {
  const rules = [];
  for (const raw of text.split(/\r?\n/).slice(0, MOST_LINES)) {
    let line = raw.replace(/\s+$/, '');
    if (!line || line.startsWith('#') || line.length > MOST_LENGTH) continue;
    const negate = line.startsWith('!');
    if (negate) line = line.slice(1);
    const dirOnly = line.endsWith('/');
    if (dirOnly) line = line.slice(0, -1);
    const anchored = line.includes('/');
    line = line.replace(/^\//, '');
    const body = toRegex(line);
    if (body === null || body === '') continue;
    rules.push({ negate, dirOnly, base, regex: new RegExp(anchored ? `^${body}$` : `(?:^|/)${body}$`) });
  }
  return rules;
}

/** Whether a path (relative to the project) is ignored by the rules (outermost first; the last rule that matches decides, as in git). */
export function isIgnored(rules, path, isDirectory) {
  let ignored = false;
  for (const rule of rules) {
    if (rule.dirOnly && !isDirectory) continue;
    if (rule.base && !path.startsWith(`${rule.base}/`)) continue;
    const local = rule.base ? path.slice(rule.base.length + 1) : path;
    if (rule.regex.test(local)) ignored = !rule.negate;
  }
  return ignored;
}
