# Contributing

Small, plain changes are easiest to review. Open an issue first for anything bigger than a fix.

- `npm install`, `npm run build`, `npm test`. The bundle `scripts/codetree.mjs` and `src/viewer-assets.js` are generated and committed: run the build and commit them with your change (CI fails if they are out of date).
- A new language is a grammar (pinned with `node scripts/grammars.mjs`), a reader in `src/readers/`, a fixture in `test/fixtures/sample/`, and a line in the README's table. Keep the supported list honest: do not claim a language the tests do not cover.
- Keep the safety rules in [SECURITY.md](SECURITY.md). A change that runs, loads or fetches something from a scanned project, or that adds a network call, will not be merged.
- Every behaviour needs a test. For the sample project's expected tree, run `UPDATE_EXPECTED=1 npm test` once and read the diff of `test/expected/sample.json` before committing it.
