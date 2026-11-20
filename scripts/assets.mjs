#!/usr/bin/env node
// Turns the viewer's three files into src/viewer-assets.js (strings), so the bundled tool carries them. Run by `npm run build`.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = name => readFileSync(join(root, 'src', 'viewer', name), 'utf8').replace(/\r\n/g, '\n');
writeFileSync(join(root, 'src', 'viewer-assets.js'),
  `// Written by scripts/assets.mjs from src/viewer/: do not edit by hand.\nexport const VIEWER_HTML = ${JSON.stringify(read('viewer.html'))};\nexport const VIEWER_CSS = ${JSON.stringify(read('viewer.css'))};\nexport const VIEWER_JS = ${JSON.stringify(read('client.js'))};\n`);
console.log('Wrote src/viewer-assets.js');
