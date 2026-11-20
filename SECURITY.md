# Security

codetree reads source code written by other people, so it is built to treat that code as hostile.

## The rules the tool keeps

1. It never runs, builds, installs or loads anything from the project it scans (no scripts, no `node_modules`, no project parsers).
2. It makes no network calls and sends nothing anywhere. It never calls a model and never handles a key.
3. Its parsers are the pinned WebAssembly files in `grammars/`, each checked against the SHA-256 in `src/grammar-hashes.js` before use.
4. The description step only inserts comment lines that it has checked itself; the agent never edits files.
5. The HTML it writes draws only with `textContent`, embeds the tree so that nothing can close its `<script>` element, and carries a policy that allows no network.
6. It does not follow symbolic links, skips very large files, and will not overwrite a file it did not make.

## Reporting a problem

Please report a vulnerability privately, through GitHub's "Report a vulnerability" (Security tab) on this repository, and not in a public issue. Include the smallest project or file that shows it. A reply should come within a week.

Things we want to hear about: a way to make the tool run or load something from a scanned project, a way to make it write outside the project or overwrite a file, a way to get text from scanned code to run in the HTML page, a way to get a description past the checks, or a network call.
