#!/usr/bin/env node
// Copies the pinned tree-sitter grammars from node_modules into grammars/ and writes their SHA-256 into src/grammar-hashes.js.
// The tool checks each file against that table before it loads it. Run after changing a version in package.json.
import { chmodSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasms = join(root, 'node_modules', 'tree-sitter-wasms', 'out');
const files = {
  'tree-sitter.wasm': join(root, 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm'),
  'tree-sitter-c_sharp.wasm': join(wasms, 'tree-sitter-c_sharp.wasm'),
  'tree-sitter-typescript.wasm': join(wasms, 'tree-sitter-typescript.wasm'),
  'tree-sitter-tsx.wasm': join(wasms, 'tree-sitter-tsx.wasm'),
  'tree-sitter-javascript.wasm': join(wasms, 'tree-sitter-javascript.wasm'),
  'tree-sitter-python.wasm': join(wasms, 'tree-sitter-python.wasm'),
};
mkdirSync(join(root, 'grammars'), { recursive: true });
const hashes = {};
for (const [name, from] of Object.entries(files).sort()) {
  copyFileSync(from, join(root, 'grammars', name));
  chmodSync(join(root, 'grammars', name), 0o644);
  hashes[name] = createHash('sha256').update(readFileSync(join(root, 'grammars', name))).digest('hex');
}
const body = Object.entries(hashes).map(([n, h]) => `  '${n}': '${h}',`).join('\n');
writeFileSync(join(root, 'src', 'grammar-hashes.js'), `// Written by scripts/grammars.mjs: the SHA-256 of each pinned grammar. The tool refuses a file that does not match.\nexport const GRAMMAR_HASHES = {\n${body}\n};\n`);
console.log(`Pinned ${Object.keys(hashes).length} files.`);
