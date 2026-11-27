# Changelog

## 1.0.0

First public release.

- Scans C#, TypeScript/JavaScript and Python projects into one browsable HTML file: areas, classes, members, descriptions and search.
- One tile per controller, with its front-end callers and back-end flow.
- Finds missing descriptions and has your AI assistant write them as a git diff you review.
- Works with Claude Code (plugin) and GitHub Copilot (prompt files).
- Reads code without running it: pinned, checksummed WebAssembly parsers, no network calls. See [SECURITY.md](SECURITY.md).
