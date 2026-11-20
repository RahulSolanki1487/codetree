# codetree-skill (working name)

A Claude Code skill that turns a codebase into one HTML file you can open in the browser: tiles for the main areas, the classes or files in each, and their functions and methods, with descriptions and one search box. A second step fills in missing descriptions, as a diff you review.

## Supported stack

Only these, on purpose:

| Language | Files | Descriptions come from |
| --- | --- | --- |
| C# | `.cs` | `/// <summary>` comments |
| TypeScript / JavaScript | `.ts` `.tsx` `.js` `.jsx` | `/** … */` comments |
| Python | `.py` | docstrings |

Files in any other language are listed as skipped and are never guessed at. If your project is not mostly in these languages, this tool is not for it (yet).

**Status: planning.** Nothing is built yet. Read [docs/plan.md](docs/plan.md).
