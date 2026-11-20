// Which files are read, with which grammar and reader, and which are left alone.

/** Extension → how to read it. */
export const READABLE = {
  '.cs': { language: 'c_sharp', reader: 'csharp' },
  '.ts': { language: 'typescript', reader: 'typescript' },
  '.mts': { language: 'typescript', reader: 'typescript' },
  '.cts': { language: 'typescript', reader: 'typescript' },
  '.tsx': { language: 'tsx', reader: 'typescript' },
  '.js': { language: 'javascript', reader: 'typescript' },
  '.jsx': { language: 'javascript', reader: 'typescript' },
  '.mjs': { language: 'javascript', reader: 'typescript' },
  '.cjs': { language: 'javascript', reader: 'typescript' },
  '.py': { language: 'python', reader: 'python' },
};

/** Code in other languages: counted and reported as skipped, never guessed at. */
export const UNSUPPORTED = {
  '.go': 'Go', '.java': 'Java', '.kt': 'Kotlin', '.rb': 'Ruby', '.rs': 'Rust', '.php': 'PHP', '.swift': 'Swift', '.scala': 'Scala',
  '.c': 'C', '.h': 'C', '.cpp': 'C++', '.cc': 'C++', '.hpp': 'C++', '.m': 'Objective-C', '.dart': 'Dart', '.lua': 'Lua', '.ex': 'Elixir', '.exs': 'Elixir',
  '.vb': 'Visual Basic', '.fs': 'F#', '.sh': 'Shell', '.ps1': 'PowerShell', '.sql': 'SQL', '.r': 'R', '.pl': 'Perl', '.clj': 'Clojure', '.hs': 'Haskell',
};

/** Folders that are never read. */
export const SKIP_FOLDERS = new Set([
  '.git', '.hg', '.svn', 'node_modules', 'bin', 'obj', 'dist', 'build', 'out', 'target', '.venv', 'venv', 'env', '__pycache__', '.next', '.nuxt', '.angular',
  '.cache', 'coverage', '.idea', '.vs', '.vscode', 'wwwroot', '.codetree',
]);

/** File name endings that mean generated or minified code. */
export const GENERATED = ['.g.cs', '.g.i.cs', '.designer.cs', '.generated.cs', '.d.ts', '.min.js', '.bundle.js', '_pb2.py'];

/** The most a single file may weigh (bytes); a bigger one is skipped and counted. */
export const MOST_BYTES = 1_000_000;
