#!/usr/bin/env node
// Builds scripts/codetree.mjs: the whole tool in one file (the plugin ships this, so there is nothing to install). The grammars stay beside it in grammars/.
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync(process.execPath, [join(root, 'scripts', 'assets.mjs')], { stdio: 'inherit' });
await build({
  entryPoints: [join(root, 'src', 'main.js')],
  outfile: join(root, 'scripts', 'codetree.mjs'),
  bundle: true, platform: 'node', format: 'esm', target: 'node20', legalComments: 'none', minify: false,
  banner: { js: '#!/usr/bin/env node\n// codetree: built from src/ by scripts/build.mjs. Do not edit by hand.\nimport { createRequire as __createRequire } from "node:module";\nconst require = __createRequire(import.meta.url);' },
  // The grammars are read at run time from grammars/ next to scripts/, after their checksums are checked.
  define: { 'import.meta.url': 'import.meta.url' },
});
console.log('Built scripts/codetree.mjs');
