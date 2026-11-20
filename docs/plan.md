# Plan: a code tree for any codebase, as a Claude Code skill

Status: v0.1 built on branch `feature/v0.1` (2026-11-20), named `codetree`. The sections below are the plan it was built from; steps 1 to 8 are done.

## What it is

One command turns a folder of code **in the supported languages (C#, TypeScript/JavaScript and Python)** into **one HTML file** you open in the browser: **tiles** (the top-level areas of the project), then the **classes or files** in each, then their **functions and methods**, each with a plain-words description and one **search box** across all of it. A second step finds what has no description and has an agent write it, as a diff you review before keeping.

It started as a feature inside a private project (a Code tree page for its web app and server). This plan makes it a small, public, beginner-friendly tool anyone can add to Claude Code.

## Goals for v0.1 (beginner level)

- Install in two commands, run with one slash command, get one file.
- Works on a C#, TypeScript/JavaScript or Python project it has never seen, with no configuration. Files in any other language are listed as skipped, never guessed at, and the README does not claim more than this stack.
- Shows the descriptions the code already has, and says plainly where there is none ("no description yet"). It never invents one on its own.
- Safe to point at any repository: it never runs, builds or loads anything from it, and makes no network calls.

## Not in v0.1

Call graphs ("called by"), links to tests, type-aware analysis, deep per-language adapters (C#, Angular), a server mode, signed releases, a Windows and Linux test matrix. They can come later, driven by what people ask for.

## What the user does

```
/plugin marketplace add <owner>/<repo>
/plugin install <plugin>@<marketplace>

/<plugin>:scan        writes code-tree.html next to the code
/<plugin>:describe    lists what has no description, has the agent write them, shows a diff
```

(`claude plugin marketplace add` and `claude plugin install` do the same from a shell.)

## What the file shows

1. **Tiles:** the top-level folders (`api`, `web`, `billing`…), each with counts. An optional `codetree.json` renames or merges tiles; without it nothing is needed.
2. **Classes or files:** every class (or, for languages without classes, file) in the tile, with its description and how many members it has.
3. **Members:** each function or method: name, signature, file and line, description. Existing doc comments are the description.
4. **Search:** one box, across every tile, class and member, by name or description.
5. **Marks:** members with no description are marked; members whose description an agent wrote are marked "generated" until a person keeps them.

## Languages for v0.1 (the supported stack, and nothing more)

| Language | Read with | What counts as a description | Where the agent's description goes |
| --- | --- | --- | --- |
| C# (`.cs`) | tree-sitter C# grammar | the `/// <summary>` XML comment | a `/// <summary>` line above the declaration (text escaped) |
| TypeScript / JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`) | tree-sitter TypeScript grammar | the `/** … */` comment above the declaration | a `/** … */` line above it |
| Python (`.py`) | tree-sitter Python grammar | the docstring | a docstring as the first statement of the function or class |

All three are read with tree-sitter (WebAssembly, so nothing to compile and no .NET, Node project or Python environment is needed to scan). Tree-sitter finds namespaces, classes, interfaces, records, functions, methods, signatures and doc comments but not resolved types, so there are no call links yet.

- **C# specifics:** namespaces and the folder of each `.csproj` group classes; interfaces, records, structs and enums are shown; `partial` classes are merged; generated files (`*.g.cs`, `*.Designer.cs`, `obj/`, `bin/`) are skipped.
- **TypeScript specifics:** a file with several exports is a class-like entry named after the file; Angular `@Component` and `@Injectable` classes are shown as ordinary classes in v0.1.
- **Deeper C# and Angular analysis** (call links, "called by", tests, which controller answers a web call) exists in the private project the idea came from. It could return later as an optional plugin; it is not part of v0.1, and it needs the .NET SDK (C#) or the project's own TypeScript (which this tool must never load from the scanned project).
- **Anything else** (Go, Java, Ruby…) is out of scope: the tool says "skipped N files in unsupported languages" and lists them.

## The data format (one JSON file, versioned)

```json
{
  "version": 1,
  "root": "my-project",
  "tiles": [{ "id": "api", "name": "api", "classes": ["api/users.ts#UserService"] }],
  "classes": [{ "id": "api/users.ts#UserService", "name": "UserService", "kind": "class",
                "file": "api/users.ts", "line": 12, "summary": "", "members": [] }]
}
```

A member has `name`, `signature`, `line`, `summary` and `generated` (true while it is an agent's unreviewed text). A JSON Schema ships with the repository, and a test checks every output against it. The HTML viewer embeds this JSON and reads nothing else.

## Security rules (not optional, even at v0.1)

1. **Never run anything from the scanned project.** No build, no install, no scripts, nothing loaded from its `node_modules`. The tool bundles its own pinned parsers.
2. **No network, no telemetry, no keys.** The tool never calls a model itself. The agent runs in the user's own Claude Code session, so the cost is theirs.
3. **The agent only returns text.** `describe` writes a list of `{id, description}`; the tool validates it (length, no links or markup, one id per member) and inserts it as a comment in the language's own style. The agent never edits files, and the skill gives it read-only tools.
4. **The scanned code is untrusted data.** A comment saying "ignore your instructions" is text to describe, not an instruction. The skill says so, and fences the code it shows the agent.
5. **The user reviews a diff.** Description comments are the only change `describe` makes, and nothing is kept until the user accepts it.
6. **Pinned and checksummed parsers.** Each tree-sitter grammar is pinned to a version with its checksum, listed in the repository.

## The description step

1. `describe --list` finds members with no description and says how many (and an estimate of the work).
2. The agent reads the members in batches, from the code only, and returns the list.
3. `describe --apply` validates and inserts the comments.
4. The user reads `git diff`, keeps or discards, and runs `scan` again.

It can stop and resume. It asks before starting, since it uses the user's agent time.

## Repository layout

```
.claude-plugin/plugin.json          name, version, description, author, license
.claude-plugin/marketplace.json     lists the plugin (this repository is its own marketplace)
skills/scan/SKILL.md                /<plugin>:scan      read-only, writes the HTML
skills/describe/SKILL.md            /<plugin>:describe  disable-model-invocation: true
scripts/codetree.mjs                the tool: one bundled file, no install step
grammars/                           pinned tree-sitter WebAssembly files + CHECKSUMS
schema/code-tree.schema.json        the data format
test/fixtures/                      small sample projects written for the tests
docs/plan.md, README.md, LICENSE, SECURITY.md, CONTRIBUTING.md
```

`scan` runs only the bundled script (`${CLAUDE_SKILL_DIR}`/`${CLAUDE_PLUGIN_ROOT}`), so it needs no install and no permission prompt beyond the script. `allowed-tools` does not restrict other tools, so safety comes from the design above, not from that setting.

## Publishing

1. **Self-hosted first.** The repository is public and is its own marketplace; nobody needs approval to add it.
2. **Release hygiene.** Set `version` in `plugin.json` and raise it on every release (users do not get new commits otherwise). Run `claude plugin validate .`, tag with `claude plugin tag --push`, and write the changes in the release notes.
3. **Directory later.** Once it has real users, consider Anthropic's directory submission (a portal for paid claude.ai plans; confirm its current requirements then).

## Tests

- Fixture projects (a small C# one, a small TypeScript one and a small Python one) with known classes, members and comments, including a `partial` C# class and a generated C# file that must be skipped; the tool's output is compared to a committed expected file.
- A schema check on every output.
- A test that scanning a fixture with a malicious comment ("ignore previous instructions…") changes nothing and that `apply` refuses output with links or markup.
- A test that the tool makes no network call and spawns no process (a guard that fails if it tries).
- One CI run on pull requests.

## Order of work

| Step | Work | Done when |
| --- | --- | --- |
| 1 | Format, schema, tree-sitter reader for C# | Fixture output matches (summaries, `partial`, generated files skipped) |
| 2 | TypeScript/JavaScript reader | Fixture output matches |
| 3 | Python reader, "skipped files in unsupported languages" report | Fixture output matches; a Go file is listed as skipped |
| 4 | Tiles by folder (and by `.csproj` for C#), `codetree.json` override | A fixture with tiles renames correctly |
| 5 | Standalone HTML viewer with search | Opens offline; search finds a member by name and by description |
| 6 | `scan` skill | `/…:scan` on a fixture writes the file |
| 7 | `describe --list`, `--apply`, the skill (C# `///`, TypeScript `/** */`, Python docstring inserters) | Fixture gets comments in each language's style; unsafe output refused |
| 8 | README with a screenshot, SECURITY.md, release v0.1.0 | Installs from a clean machine in two commands |

## Open decisions

- **Name** of the plugin, skill and repository (short, plain, not already taken).
- **Licence:** MIT unless the owner says otherwise.
- **Languages for v0.1:** C#, TypeScript/JavaScript and Python. Python can be dropped if the stack is only C# and TypeScript.
- **Public from the start,** or private until v0.1 works. This repository starts private.

## Risks

- **Wrong descriptions** in other people's code are a worse failure than in one's own. The diff review, the "generated" mark and "describe from the code only" matter most.
- **A public tool is a commitment:** issues and pull requests need answers. Keep v0.1 small so there is little to maintain.
- **Many tools exist** (Archify and others). What this one offers is grounding in the code, a plain three-level view, and a way to fill in missing descriptions safely.
