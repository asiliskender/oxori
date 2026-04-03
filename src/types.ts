/**
 * @file types.ts
 * @description Shared type contract for all Oxori modules.
 *
 * Every other module imports from here. Changes to these types ripple across
 * the entire system — treat this file as the source of truth for data shapes.
 *
 * Design principles applied here:
 * - No `any`. Use `unknown` and narrow at call sites.
 * - `ReadonlySet` / `ReadonlyMap` on index entries to prevent accidental cache mutation.
 * - `Result<T, E>` tagged union for structured, recoverable error handling.
 * - All file paths are absolute, normalized via `path.resolve()` before storage.
 * - Types defined for all 5 phases upfront to avoid breaking changes mid-project.
 */

// === Frontmatter ===

/**
 * @description Schemaless frontmatter type. Any YAML key-value pair is valid.
 * Used as the `frontmatter` field in both `ParsedFile` and `FileEntry`.
 *
 * @remarks
 * Typed as `Record<string, unknown>` rather than `Record<string, any>` so that
 * consumers are forced to narrow values before use. This prevents silent runtime
 * errors when reading frontmatter fields like `status`, `tags`, or custom keys.
 *
 * @example
 * const fm: FrontmatterEntry = { status: "wip", priority: 2, tags: ["project/auth"] };
 */
export type FrontmatterEntry = Record<string, unknown>;

// === Parsed File ===

/**
 * @description Represents a single markdown file after it has been fully parsed.
 * This is the intermediate form produced by the parser and consumed by the indexer.
 * It is mutable by design — the parser builds it up incrementally before handing
 * it off to the indexer, which converts it into the immutable `FileEntry`.
 *
 * @remarks
 * `tags` stores ALL ancestor levels of a hierarchical tag. For example,
 * `#project/auth/oauth` produces three entries: `"project"`, `"project/auth"`,
 * and `"project/auth/oauth"`. This allows queries at any level of the hierarchy
 * to match without needing recursive logic at query time.
 *
 * `wikilinks` stores filename stems only (no `.md` extension), normalized to
 * lowercase. `[[My Note]]` and `[[my note]]` both resolve to `"my note"`.
 *
 * `typedRelations` captures frontmatter keys whose values are wikilinks, e.g.:
 * `depends_on: [[other-file]]` → `Map { "depends_on" => ["other-file"] }`.
 * These become typed edges in the graph traversal layer.
 *
 * @example
 * // A file at /vault/auth.md with frontmatter depends_on: [[login]]
 * const parsed: ParsedFile = {
 *   filepath: "/vault/auth.md",
 *   filename: "auth",
 *   frontmatter: { depends_on: "[[login]]", status: "wip" },
 *   tags: new Set(["project", "project/auth"]),
 *   wikilinks: new Set(["login"]),
 *   typedRelations: new Map([["depends_on", ["login"]]]),
 *   body: "## Auth module\n..."
 * };
 */
export type ParsedFile = {
  /** Absolute path to the file, normalized via `path.resolve()`. */
  filepath: string;
  /** Basename without extension, e.g. `"auth"` for `auth.md`. */
  filename: string;
  /** Raw frontmatter key-value pairs. Schemaless — any YAML is valid. */
  frontmatter: FrontmatterEntry;
  /**
   * All tag strings including ancestors. `#project/auth/oauth` expands to
   * `"project"`, `"project/auth"`, `"project/auth/oauth"`.
   */
  tags: Set<string>;
  /** Wikilink targets (filename stems), lowercased, no extension. */
  wikilinks: Set<string>;
  /** Frontmatter key → array of wikilink targets for typed graph edges. */
  typedRelations: Map<string, string[]>;
  /** Raw markdown body with frontmatter stripped. */
  body: string;
};

// === Index Entries ===

/**
 * @description The immutable representation of a file stored in the in-memory cache.
 * Produced by the indexer from a `ParsedFile` and stored in `IndexState.files`.
 *
 * @remarks
 * Uses `ReadonlySet` and `ReadonlyMap` (with `readonly` value arrays) to prevent
 * accidental mutation of cached data. The indexer owns these structures; all other
 * modules are consumers and must treat them as read-only.
 *
 * `lastModified` is the `mtime` from `fs.stat()`, stored as a Unix timestamp (ms).
 * The indexer uses this to skip re-parsing files that haven't changed on disk.
 *
 * @example
 * const entry: FileEntry = {
 *   filepath: "/vault/auth.md",
 *   filename: "auth",
 *   frontmatter: { status: "wip" },
 *   tags: new Set(["project/auth"]),
 *   wikilinks: new Set(["login"]),
 *   typedRelations: new Map([["depends_on", ["login"]]]),
 *   lastModified: 1712134400000
 * };
 */
export type FileEntry = {
  /** Absolute path, normalized via `path.resolve()`. */
  filepath: string;
  /** Basename without extension. */
  filename: string;
  /** Raw frontmatter — consumers must narrow before use. */
  frontmatter: FrontmatterEntry;
  /** Immutable tag set. All ancestor levels included. */
  tags: ReadonlySet<string>;
  /** Immutable wikilink target set. Lowercase, no extension. */
  wikilinks: ReadonlySet<string>;
  /** Immutable typed-relation map. Values are readonly arrays. */
  typedRelations: ReadonlyMap<string, readonly string[]>;
  /** `mtime` in milliseconds from `fs.stat()`. Used for change detection. */
  lastModified: number;
};

/**
 * @description Tracks a single tag and the set of files that carry it.
 * Stored in `IndexState.tags`, keyed by the tag string.
 *
 * @remarks
 * Because tags are expanded to all ancestor levels during parsing, a file with
 * `#project/auth/oauth` will appear in the `files` set for `"project"`,
 * `"project/auth"`, and `"project/auth/oauth"` — enabling prefix queries
 * without any recursive logic at query time.
 *
 * @example
 * const entry: TagEntry = {
 *   tag: "project/auth",
 *   files: new Set(["/vault/auth.md", "/vault/oauth.md"])
 * };
 */
export type TagEntry = {
  /** The tag string, e.g. `"project/auth"`. */
  tag: string;
  /** Absolute filepaths of all files that carry this tag. */
  files: Set<string>;
};

/**
 * @description Tracks a wikilink target and all files that reference it.
 * Stored in `IndexState.links`, keyed by the lowercased filename stem.
 *
 * @remarks
 * The `target` is always the lowercased filename stem — no extension, no `[[]]`.
 * A file does not need to exist for a `LinkEntry` to be created; dangling links
 * are valid and intentional (the graph layer handles resolution and missing-file
 * detection separately).
 *
 * @example
 * const entry: LinkEntry = {
 *   target: "login",
 *   sources: new Set(["/vault/auth.md", "/vault/session.md"])
 * };
 */
export type LinkEntry = {
  /** Lowercased filename stem being linked to. */
  target: string;
  /** Absolute filepaths of all files that contain `[[target]]`. */
  sources: Set<string>;
};

/**
 * @description A single typed edge in the file relationship graph.
 * Derived from `FileEntry.typedRelations` during graph traversal.
 *
 * @remarks
 * `source` is a filepath (not just a filename) to enable graph traversal by
 * absolute path — the graph layer needs to look up `FileEntry` objects by path,
 * so storing the stem alone would force an extra resolution step on every hop.
 *
 * `relationType` is the raw frontmatter key, e.g. `"depends_on"`, `"blocks"`,
 * `"related_to"`. No normalisation is applied — callers query by exact key.
 *
 * @example
 * const edge: TypedRelation = {
 *   source: "/vault/auth.md",
 *   relationType: "depends_on",
 *   target: "login"
 * };
 */
export type TypedRelation = {
  /** Absolute filepath of the file that declares this relation. */
  source: string;
  /** The frontmatter key that names this relation type. */
  relationType: string;
  /** The wikilink target filename stem (lowercase, no extension). */
  target: string;
};

// === Index State ===

/**
 * @description The complete in-memory cache built by the indexer on startup.
 * All query, graph, and search operations read from this structure.
 *
 * @remarks
 * All maps use strings as keys: absolute filepaths for `files`, raw tag strings
 * for `tags`, and lowercase filename stems for `links`. This makes lookups O(1)
 * and avoids the ambiguity of case-sensitive key comparisons.
 *
 * `lastIndexed` is set after a full vault scan completes. The watcher layer uses
 * this to determine whether incremental updates are needed on startup.
 *
 * @example
 * const state: IndexState = {
 *   files: new Map([["/vault/auth.md", fileEntry]]),
 *   tags: new Map([["project/auth", tagEntry]]),
 *   links: new Map([["login", linkEntry]]),
 *   totalFiles: 1,
 *   lastIndexed: Date.now()
 * };
 */
export type IndexState = {
  /** filepath → FileEntry */
  files: Map<string, FileEntry>;
  /** tag string → TagEntry */
  tags: Map<string, TagEntry>;
  /** lowercase filename stem → LinkEntry */
  links: Map<string, LinkEntry>;
  /** Total number of indexed files. Kept in sync with `files.size`. */
  totalFiles: number;
  /** Unix timestamp (ms) of the last completed full index run. */
  lastIndexed: number;
};

// === Vault Configuration ===

/**
 * @description Configuration for opening an Oxori vault.
 * Passed to the top-level `Vault` constructor or `Oxori.open()` SDK call.
 *
 * @remarks
 * All paths are resolved to absolute paths internally via `path.resolve()`.
 * Optional paths default to subdirectories under `vaultPath/.oxori/` so that
 * the index, vectors, and governance file are co-located with the vault by default,
 * keeping everything self-contained and portable.
 *
 * `excludePatterns` uses glob syntax (same as `.gitignore`). Patterns are matched
 * against paths relative to `vaultPath`. Useful for excluding `node_modules`,
 * `.obsidian/`, or large binary-adjacent folders from indexing.
 *
 * @example
 * const config: VaultConfig = {
 *   vaultPath: "/Users/alice/notes",
 *   excludePatterns: [".obsidian/**", "archive/**"]
 * };
 */
export type VaultConfig = {
  /** Absolute path to the vault root directory. */
  vaultPath: string;
  /** Defaults to `{vaultPath}/.oxori/index`. */
  indexPath?: string;
  /** Defaults to `{vaultPath}/.oxori/vectors`. */
  vectorPath?: string;
  /** Defaults to `{vaultPath}/.oxori/governance.md`. */
  governancePath?: string;
  /** Glob patterns (relative to `vaultPath`) to exclude from indexing. */
  excludePatterns?: string[];
};

// === Error Handling ===

/**
 * @description Structured error type for all Oxori operations.
 * Includes a machine-readable `code`, a human-readable `message`, and an
 * optional `action` string that tells the user how to fix the problem.
 *
 * @remarks
 * `code` values are SCREAMING_SNAKE_CASE constants, e.g. `"VAULT_NOT_FOUND"`,
 * `"PARSE_ERROR"`, `"GOVERNANCE_DENIED"`. They are stable across versions and
 * safe to `switch` on in calling code.
 *
 * `filepath` is included when the error is traceable to a specific file — this
 * surfaces the offending path in CLI output and MCP error responses without
 * requiring callers to attach it themselves.
 *
 * @example
 * const error: OxoriError = {
 *   message: "Vault directory not found at /vault",
 *   code: "VAULT_NOT_FOUND",
 *   action: "Run `oxori init <path>` to create a new vault.",
 *   filepath: "/vault"
 * };
 */
export type OxoriError = {
  /** Human-readable description of what went wrong. */
  message: string;
  /** Stable machine-readable error code. Use in `switch` statements. */
  code: string;
  /** Optional guidance on how to resolve the error. */
  action?: string;
  /** The file that triggered the error, if applicable. */
  filepath?: string;
};

/**
 * @description Tagged union for recoverable operation results.
 * All functions that can fail should return `Result<T, E>` instead of throwing,
 * unless the failure is truly unrecoverable (programmer error).
 *
 * @remarks
 * Discriminate on the `ok` field:
 * ```ts
 * const result = parseFile(path);
 * if (!result.ok) {
 *   console.error(result.error.message);
 *   return;
 * }
 * doSomething(result.value);
 * ```
 * Default error type is `OxoriError`. Use the `ok()` and `err()` helpers
 * to construct results without verbose object literals.
 *
 * @example
 * function divide(a: number, b: number): Result<number, OxoriError> {
 *   if (b === 0) return err({ message: "Division by zero", code: "MATH_ERROR" });
 *   return ok(a / b);
 * }
 */
export type Result<T, E = OxoriError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Constructs a successful `Result` wrapping the given value.
 * @param value - The success value to wrap.
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Constructs a failed `Result` wrapping the given error.
 * @param error - The error to wrap.
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// === Watcher (Phase 5) ===

/**
 * @description Describes a filesystem event emitted by the watcher module.
 * Defined in Phase 1 to avoid type churn when the watcher lands in Phase 5.
 *
 * @remarks
 * `"add"` fires on new files detected (including during initial scan if configured).
 * `"change"` fires when an existing file's content changes.
 * `"unlink"` fires when a file is deleted or moved out of the vault.
 *
 * The indexer's incremental update handler receives these events and updates
 * `IndexState` accordingly — re-parsing on `add`/`change`, removing entries on `unlink`.
 *
 * @example
 * const event: WatchEvent = {
 *   type: "change",
 *   filepath: "/vault/auth.md",
 *   timestamp: Date.now()
 * };
 */
export type WatchEvent = {
  /** The kind of filesystem change. */
  type: "add" | "change" | "unlink";
  /** Absolute path of the affected file, normalized via `path.resolve()`. */
  filepath: string;
  /** Unix timestamp (ms) when the event was emitted. */
  timestamp: number;
};

// === Governance (Phase 3) ===

/**
 * @description A single governance rule parsed from `.oxori/governance.md`.
 * Defined in Phase 1 to avoid type churn when governance lands in Phase 3.
 *
 * @remarks
 * `pattern` is a glob or regex string matched against the filepath or content
 * of a proposed agent write. The `effect` determines whether the matched write
 * is permitted (`"allow"`) or blocked (`"deny"`).
 *
 * `appliesTo` scopes the rule: `"agents"` means it only applies to writes
 * originating from the MCP server / agent API — human writes (Obsidian, direct
 * file edits) are never subject to governance by design. `"all"` is reserved for
 * future use but defined now for forward compatibility.
 *
 * Rules are evaluated in declaration order. The first matching rule wins.
 *
 * @example
 * const rule: GovernanceRule = {
 *   id: "no-agent-writes-to-archive",
 *   description: "Agents must not modify archived files",
 *   pattern: "archive/**",
 *   effect: "deny",
 *   appliesTo: "agents"
 * };
 */
export type GovernanceRule = {
  /** Unique identifier for this rule. Used in error messages and audit logs. */
  id: string;
  /** Human-readable explanation of what this rule enforces. */
  description: string;
  /** Glob or regex string matched against the target filepath or content. */
  pattern: string;
  /** Whether a matching write is permitted or blocked. */
  effect: "allow" | "deny";
  /** Scope: `"agents"` for MCP/agent writes only; `"all"` for future use. */
  appliesTo: "agents" | "all";
};
