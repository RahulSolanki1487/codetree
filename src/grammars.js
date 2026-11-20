// Loads the pinned tree-sitter parsers. Each .wasm file is checked against the SHA-256 in grammar-hashes.js first, and nothing is loaded from anywhere else
// (not from the scanned project, not from the network).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Language, Parser } from 'web-tree-sitter';
import { GRAMMAR_HASHES } from './grammar-hashes.js';

const folder = fileURLToPath(new URL('../grammars/', import.meta.url));
const loaded = new Map();
let parser = null;

function pinned(name) {
  const expected = GRAMMAR_HASHES[name];
  if (!expected) throw new Error(`${name} is not a pinned grammar.`);
  const bytes = readFileSync(folder + name);
  if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error(`${name} does not match its pinned checksum: refusing to load it.`);
  return bytes;
}

/** The parser, ready for a grammar chosen with {@link use}. */
export async function createParser() {
  if (parser) return parser;
  await Parser.init({ wasmBinary: pinned('tree-sitter.wasm') });
  parser = new Parser();
  return parser;
}

/** Points the parser at one language ('c_sharp', 'typescript', 'tsx', 'javascript' or 'python'). */
export async function use(language) {
  const p = await createParser();
  if (!loaded.has(language)) loaded.set(language, await Language.load(pinned(`tree-sitter-${language}.wasm`)));
  p.setLanguage(loaded.get(language));
  return p;
}
