# codetree

A Claude Code plugin that turns a codebase into **one HTML file** you can open in the browser: the main areas, the classes or files in each, and their functions and methods, with their descriptions and **one search box** across all of it. A second command finds what has no description, has Claude write one plain sentence for each, and shows you the result as a `git diff` to review.

It is small on purpose, and it is safe to point at any project: it only reads files as text. It never runs, builds or installs anything from the project, and it makes no network calls.

## Supported stack

Only these, on purpose:

| Language | Files | A description is |
| --- | --- | --- |
| C# | `.cs` | the `/// <summary>` comment |
| TypeScript / JavaScript | `.ts` `.tsx` `.js` `.jsx` | the `/** … */` comment above the declaration |
| Python | `.py` | the docstring |

Files in any other language are listed as skipped and are never guessed at. If your project is not mostly in these languages, this tool is not for it (yet).

## Install

In Claude Code:

```
/plugin install codetree --marketplace RahulSolanki1487/codetree
```

(or `/plugin marketplace add RahulSolanki1487/codetree`, then `/plugin install codetree@codetree`). Nothing else to install: the tool is one bundled file inside the plugin.

## Use

```
/codetree:scan        writes code-tree.html in the project; open it in a browser
/codetree:describe    writes the missing descriptions as comments, for you to review
```

`scan` shows the areas (the top-level folders), then the classes in one, then a class's members. It leaves out what the project's own `.gitignore` ignores (build output, copied bundles, vendored code) and minified or bundled files; `--no-gitignore` reads those too. Anything without a description says "no description yet", and a switch shows only those. It never invents a description.

`describe` asks before it starts, lists what is missing, has Claude describe each item **from its code only**, checks every sentence, and inserts it as a comment in the language's own style. You read the change with `git diff`; descriptions stay marked "generated" in the page until you run `codetree describe --accept`.

### Without Claude Code

The tool is a plain Node.js (20 or newer) script:

```
node scripts/codetree.mjs scan path/to/project --out code-tree.html
node scripts/codetree.mjs describe path/to/project --list --out todo.json
node scripts/codetree.mjs describe path/to/project --apply answers.json --dry-run
node scripts/codetree.mjs describe path/to/project --accept
```

An optional `codetree.json` at the project's root renames areas: `{ "name": "My app", "tiles": { "Backend": ["src/Api", "src/Core"] } }`.

**Features.** For a C# web project, the page also lists one feature per controller (its `[Route]` and `[HttpGet]`/`[HttpPost]`… attributes): the endpoints with their verb and full route, the classes the controller takes in, and the front-end functions (TypeScript/JavaScript) that call each endpoint, found by the `/api/...` text and the `get`/`post`/`put`/`patch`/`delete` call around it. Calls in test files, and addresses built from a variable base, are not matched. Nothing is guessed: an endpoint with no match says "no front-end call found".

## How it stays safe

- **Nothing from the project runs.** Files are read as text and parsed with pinned tree-sitter grammars (WebAssembly) that ship in this repository; each is checked against a SHA-256 before it is loaded. Links are never followed.
- **No network, no telemetry, no keys.** The tool never calls a model. Claude runs in your own session.
- **The agent only returns text.** `describe` takes a list of `{id, description}`, refuses anything with markup, links, quotes or a comment ending, and inserts the rest itself. Claude never edits your files.
- **Your code is treated as data.** A comment saying "ignore your instructions" is something to describe, not something to obey.
- **The page is one offline file** that draws everything as text, under a policy that allows no network.
- It will not overwrite a file it did not make.

The tests check these rules, including running the tool under Node's permission model with no way to start a program. See [SECURITY.md](SECURITY.md).

## Develop

```
npm install
npm run build     # bundles src/ into scripts/codetree.mjs (committed: the plugin ships it)
npm test
```

After changing a grammar version, run `node scripts/grammars.mjs` to pin the new files. Contributions are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md). The plan and its reasons are in [docs/plan.md](docs/plan.md).

MIT licence.
