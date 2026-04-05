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
 * @brief Schemaless frontmatter type. Any YAML key-value pair is valid.
 * Used as the `frontmatter` field in both `ParsedFile` and `FileEntry`.
 *
 * @remarks
 * Typed as `Record<string, unknown>` rather than `Record<string, any>` so that
 * consumers are forced to narrow values before use. This prevents silent runtime
 * errors when reading frontmatter fields like `status`, `tags`, or custom keys.
 *
 * @example
 * const fm: FrontmatterEntry = { status: "wip", priority: 2, tags: ["project/auth"] };
 *
 * @since 0.1.0
 */
export type FrontmatterEntry = Record<string, unknown>;

// === Parsed File ===

/**
 * @brief Intermediate mutable form of a markdown file produced by the parser.
 *
 * Represents a single markdown file after it has been fully parsed.
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
 *
 * @since 0.1.0
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
 * @brief Immutable index entry for a file stored in the in-memory cache.
 *
 * The immutable representation of a file stored in the in-memory cache.
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
 *
 * @since 0.1.0
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
 * @brief Tag-to-files reverse index entry.
 *
 * Tracks a single tag and the set of files that carry it.
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
 *
 * @since 0.1.0
 */
export type TagEntry = {
  /** The tag string, e.g. `"project/auth"`. */
  tag: string;
  /** Absolute filepaths of all files that carry this tag. */
  files: Set<string>;
};

/**
 * @brief Wikilink-to-sources reverse index entry.
 *
 * Tracks a wikilink target and all files that reference it.
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
 *
 * @since 0.1.0
 */
export type LinkEntry = {
  /** Lowercased filename stem being linked to. */
  target: string;
  /** Absolute filepaths of all files that contain `[[target]]`. */
  sources: Set<string>;
};

/**
 * @brief A single typed relation edge between two vault files.
 *
 * A single typed edge in the file relationship graph.
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
 *
 * @since 0.1.0
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
 * @brief Complete in-memory vault cache holding all indexed file data.
 *
 * The complete in-memory cache built by the indexer on startup.
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
 *
 * @since 0.1.0
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
 * @brief Configuration for opening an Oxori vault.
 *
 * Configuration for opening an Oxori vault.
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
 *
 * @since 0.1.0
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
 * @brief Structured error type for all Oxori operations.
 *
 * Structured error type for all Oxori operations.
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
 *
 * @since 0.1.0
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
 * @brief Tagged union type for recoverable operation results.
 *
 * Tagged union for recoverable operation results.
 * All functions that can fail should return `Result<T, E>` instead of throwing,
 * unless the failure is truly unrecoverable (programmer error).
 *
 * @typeParam T - The success value type.
 * @typeParam E - The error type; defaults to `OxoriError`.
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
 *
 * @since 0.1.0
 */
export type Result<T, E = OxoriError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * @brief Constructs a successful `Result` wrapping the given value.
 *
 * @typeParam T - The type of the success value.
 * @param value - The success value to wrap.
 * @returns A `Result` discriminated as `ok: true` with the provided value.
 *
 * @example
 * ```typescript
 * const result = ok(42); // { ok: true, value: 42 }
 * ```
 *
 * @since 0.1.0
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * @brief Constructs a failed `Result` wrapping the given error.
 *
 * @typeParam E - The type of the error value.
 * @param error - The error to wrap.
 * @returns A `Result` discriminated as `ok: false` with the provided error.
 *
 * @example
 * ```typescript
 * const result = err({ message: "Not found", code: "FILE_NOT_FOUND" });
 * // { ok: false, error: { message: "Not found", code: "FILE_NOT_FOUND" } }
 * ```
 *
 * @since 0.1.0
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// === Watcher (Phase 5) ===

/**
 * @brief Describes a filesystem event emitted by the watcher module.
 *
 * Describes a filesystem event emitted by the watcher module.
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
 *
 * @since 0.3.0
 */
export type WatchEvent = {
  /** The kind of filesystem change. */
  type: "add" | "change" | "unlink";
  /** Absolute path of the affected file, normalized via `path.resolve()`. */
  filepath: string;
  /** Unix timestamp (ms) when the event was emitted. */
  timestamp: number;
};

// === Query Engine (Phase 2) ===

/**
 * @brief Enumerates every token kind the query tokenizer can emit.
 *
 * Enumerates every token kind the query tokenizer can emit.
 *
 * @remarks
 * - `FILTER`   — a `field:value` or `field=value` atom before operator parsing
 * - `OPERATOR` — the literal strings `AND`, `OR`, `NOT`
 * - `VALUE`    — a bare or quoted string used as a shorthand tag/title search
 * - `LPAREN`   — opening parenthesis `(`
 * - `RPAREN`   — closing parenthesis `)`
 * - `EOF`      — sentinel emitted once the input is exhausted
 *
 * @since 0.2.0
 */
export type TokenKind = "FILTER" | "OPERATOR" | "VALUE" | "LPAREN" | "RPAREN" | "EOF";

/**
 * @brief A single token produced by the query tokenizer.
 *
 * A single token produced by the query tokenizer.
 *
 * @remarks
 * `position` is a zero-based character offset into the original query string.
 * It is preserved in every token so the parser can attach accurate source
 * locations to error messages without re-scanning.
 *
 * @example
 * // Tokenizing `tag:zettel AND type:note` yields (among others):
 * const t: Token = { kind: "FILTER", value: "tag:zettel", position: 0 };
 *
 * @since 0.2.0
 */
export type Token = {
  /** The grammatical category of this token. */
  kind: TokenKind;
  /** The raw substring from the query string that produced this token. */
  value: string;
  /** Zero-based character offset of the token's first character in the query. */
  position: number;
};

/**
 * @brief AST leaf node representing a single field-operator-value filter.
 *
 * AST leaf node representing a single field-operator-value filter.
 *
 * @remarks
 * Three operator forms are supported:
 * - `=`  exact equality (case-insensitive)
 * - `:`  token / starts-with match (mirrors Obsidian dataview convention)
 * - `~`  substring / regex match
 *
 * `field` must be one of the {@link FilterField} values; the evaluator rejects
 * unknown fields at runtime so the type is kept as `string` here to avoid
 * a circular dependency between the AST and the field enumeration.
 *
 * @example
 * const node: FilterNode = { type: "filter", field: "tag", operator: ":", value: "zettel" };
 *
 * @since 0.2.0
 */
export type FilterNode = {
  type: "filter";
  /** The index field being tested (e.g. `"tag"`, `"type"`, `"path"`). */
  field: string;
  /** How the field value is compared against the filter value. */
  operator: "=" | ":" | "~";
  /** The value the field is compared against. */
  value: string;
};

/**
 * @brief AST interior node representing a boolean combination of child nodes.
 *
 * AST interior node representing a boolean combination of child nodes.
 *
 * @remarks
 * A discriminated union on `type` ensures exhaustive handling in the evaluator:
 * - `"and"` — all children must match
 * - `"or"`  — at least one child must match
 * - `"not"` — `children` holds exactly one node whose result is inverted
 *
 * Using a single `OperatorNode` with a `type` field (rather than separate
 * `AndNode`/`OrNode`/`NotNode` types) keeps the visitor pattern lean: a single
 * `case "and"` / `case "or"` / `case "not"` covers all boolean logic.
 *
 * @example
 * const node: OperatorNode = {
 *   type: "and",
 *   children: [
 *     { type: "filter", field: "tag", operator: ":", value: "zettel" },
 *     { type: "filter", field: "type", operator: "=", value: "note" },
 *   ],
 * };
 *
 * @since 0.2.0
 */
export type OperatorNode = {
  type: "and" | "or" | "not";
  /** Child query nodes. For `"not"`, this array has exactly one element. */
  children: QueryNode[];
};

/**
 * @brief AST node representing a parenthesized sub-expression.
 *
 * AST node representing a parenthesized sub-expression.
 *
 * @remarks
 * `GroupNode` exists as a distinct node type (rather than being erased during
 * parsing) so that round-trip serialization and IDE highlighting can faithfully
 * reconstruct the original grouping. The evaluator simply descends into `child`.
 *
 * @example
 * // Query: `(tag:zettel OR tag:fleeting) AND type:note`
 * const group: GroupNode = {
 *   type: "group",
 *   child: { type: "or", children: [ ... ] },
 * };
 *
 * @since 0.2.0
 */
export type GroupNode = {
  type: "group";
  /** The single query node enclosed by the parentheses. */
  child: QueryNode;
};

/**
 * @brief The discriminated union of every node that can appear in a query AST.
 *
 * The discriminated union of every node that can appear in a query AST.
 *
 * @remarks
 * Pattern-matching on `node.type` exhaustively covers all cases:
 * `"filter"` → {@link FilterNode}, `"and" | "or" | "not"` → {@link OperatorNode},
 * `"group"` → {@link GroupNode}.
 *
 * @since 0.2.0
 */
export type QueryNode = FilterNode | OperatorNode | GroupNode;

/**
 * @brief The top-level result of parsing a query string into an AST.
 *
 * The top-level result of parsing a query string.
 *
 * @remarks
 * `root: null` is the canonical representation of the empty query (match all
 * files).  Having an explicit `null` avoids a sentinel node and lets callers
 * short-circuit evaluation with a simple `if (ast.root === null) return allFiles`.
 *
 * @example
 * const ast: QueryAST = { root: null }; // matches every file
 *
 * @since 0.2.0
 */
export type QueryAST = {
  /** The root node of the parsed query tree, or `null` for "match all". */
  root: QueryNode | null;
};

/**
 * @brief Result returned by a query execution against the vault index.
 *
 * The result returned by a query execution.
 *
 * @remarks
 * `matches` is a `ReadonlySet` to signal that callers must not mutate it.
 * `executionMs` is a wall-clock duration measured inside the query executor
 * and is intended for developer tooling / MCP diagnostics, not for caching decisions.
 *
 * @example
 * const result: QueryResult = {
 *   matches: new Set(["notes/foo.md", "notes/bar.md"]),
 *   totalMatched: 2,
 *   executionMs: 1.4,
 * };
 *
 * @since 0.2.0
 */
export type QueryResult = {
  /** File paths (vault-relative) of every file that satisfied the query. */
  matches: ReadonlySet<string>;
  /** Convenience count — equivalent to `matches.size`. */
  totalMatched: number;
  /** Wall-clock milliseconds the executor spent evaluating the query. */
  executionMs: number;
};

/**
 * @brief Exhaustive list of index fields that a filter expression may target.
 *
 * The exhaustive list of index fields that a filter expression may target.
 *
 * @remarks
 * Defined as a `const` tuple so it can be used at runtime (e.g. to validate
 * user-supplied field names in the evaluator) while simultaneously producing
 * the `FilterField` union type via `typeof FILTER_FIELDS[number]`.
 *
 * Fields:
 * - `"tag"`         — one of the file's `#tags`
 * - `"type"`        — the `type` frontmatter key (e.g. `note`, `task`)
 * - `"path"`        — the vault-relative filepath
 * - `"frontmatter"` — arbitrary frontmatter key (combined with value as `key=value`)
 * - `"title"`       — the `title` frontmatter key or inferred H1
 * - `"link"`        — a wikilink target present in the file's body
 *
 * @since 0.2.0
 */
export const FILTER_FIELDS = ["tag", "type", "path", "frontmatter", "title", "link"] as const;

/**
 * @brief Union of valid field names accepted by a filter expression.
 *
 * The union of valid field names accepted by a {@link FilterNode}.
 *
 * @example
 * const field: FilterField = "tag"; // valid
 * const bad: FilterField = "author"; // TS error — not a recognised field
 *
 * @since 0.2.0
 */
export type FilterField = (typeof FILTER_FIELDS)[number];

// === Graph Traversal (Phase 2) ===

/**
 * @brief A single directed edge in the file-relationship graph.
 *
 * A single directed edge in the file-relationship graph.
 *
 * @remarks
 * All paths are vault-relative strings (the same format used throughout the
 * indexer).  `kind` distinguishes how the relationship was discovered:
 * - `"wikilink"` — a `[[target]]` reference in the source file's body
 * - `"tag"`      — source and target share a common tag (co-occurrence edge)
 * - `"relation"` — a typed relation declared in frontmatter (`key:: [[target]]`);
 *   the relation type is preserved in `relationType` for downstream use.
 *
 * `relationType` is only present when `kind === "relation"`.
 *
 * @example
 * const e: Edge = { source: "notes/a.md", target: "notes/b.md", kind: "wikilink" };
 * const r: Edge = { source: "notes/a.md", target: "notes/b.md", kind: "relation", relationType: "references" };
 *
 * @since 0.2.0
 */
export type Edge = {
  /** Vault-relative path of the originating file. */
  source: string;
  /** Vault-relative path of the referenced file. */
  target: string;
  /** How the relationship between source and target was established. */
  kind: "wikilink" | "tag" | "relation";
  /**
   * The semantic label of the relation (e.g. `"references"`, `"inspired-by"`).
   * Only present when `kind === "relation"`.
   */
  relationType?: string;
};

/**
 * @brief Controls which direction edges are followed during a graph walk.
 *
 * Controls which direction edges are followed during a graph walk.
 *
 * @remarks
 * - `"outgoing"` — follow edges where the start node is the source (default)
 * - `"incoming"` — follow edges where the start node is the target (backlinks)
 * - `"both"`     — follow edges in either direction
 *
 * @since 0.2.0
 */
export type WalkDirection = "incoming" | "outgoing" | "both";

/**
 * @brief Constrains which edge kinds are traversed during a graph walk.
 *
 * Constrains which edge kinds are traversed during a graph walk.
 *
 * @remarks
 * The template literal form `relation:${string}` lets callers target a specific
 * named relation type (e.g. `"relation:references"`) without enumerating every
 * possible relation name in the type system.  This keeps the type extensible —
 * new relation types added to frontmatter are automatically valid walk targets.
 *
 * @example
 * const via: WalkVia = "links";               // only wikilinks
 * const via2: WalkVia = "relation:inspired-by"; // only "inspired-by" relations
 *
 * @since 0.2.0
 */
export type WalkVia = "links" | "tags" | "both" | `relation:${string}`;

/**
 * @brief Options bag passed to `graph.walk()`.
 *
 * Options bag passed to `graph.walk()`.
 *
 * @remarks
 * All fields are optional; omitting them yields a sensible default walk:
 * - `depth`     defaults to `Infinity` (walk until no new nodes are found)
 * - `direction` defaults to `"outgoing"`
 * - `via`       defaults to `"both"` (all edge kinds)
 * - `maxNodes`  defaults to no cap (unbounded walk)
 *
 * `maxNodes` is a safety valve for large vaults — once the visited-node count
 * hits the limit the walk stops and `WalkResult.truncated` is set to `true`.
 *
 * @example
 * const opts: WalkOptions = { depth: 2, direction: "outgoing", via: "links", maxNodes: 500 };
 *
 * @since 0.2.0
 */
export type WalkOptions = {
  /** Maximum edge-hop depth from the seed node. Defaults to `Infinity`. */
  depth?: number;
  /** Which direction to follow edges. Defaults to `"outgoing"`. */
  direction?: WalkDirection;
  /** Which edge kinds to traverse. Defaults to `"both"`. */
  via?: WalkVia;
  /** Hard cap on visited nodes; walk stops early if reached. */
  maxNodes?: number;
};

/**
 * @brief The result returned by a `graph.walk()` call.
 *
 * The result returned by a `graph.walk()` call.
 *
 * @remarks
 * `nodes` and `edges` are `ReadonlySet` to prevent accidental mutation by
 * callers.  `visitOrder` is a `readonly` array preserving BFS/DFS discovery
 * order — useful for rendering breadcrumbs or computing ancestry chains.
 *
 * `truncated` is `true` whenever the walk was halted by `maxNodes`; callers
 * should surface this to users so they know results may be incomplete.
 *
 * @example
 * const result: WalkResult = {
 *   nodes: new Set(["notes/a.md", "notes/b.md"]),
 *   edges: new Set([{ source: "notes/a.md", target: "notes/b.md", kind: "wikilink" }]),
 *   visitOrder: ["notes/a.md", "notes/b.md"],
 *   truncated: false,
 * };
 *
 * @since 0.2.0
 */
export type WalkResult = {
  /** All vault-relative file paths visited during the walk (including the seed). */
  nodes: ReadonlySet<string>;
  /** All edges traversed during the walk. */
  edges: ReadonlySet<Edge>;
  /** Node paths in the order they were first visited. */
  visitOrder: readonly string[];
  /** `true` if the walk was halted early due to `maxNodes`. */
  truncated: boolean;
};

// === Governance (Phase 3) ===

/**
 * @brief A single governance rule parsed from `.oxori/governance.md`.
 *
 * A single governance rule parsed from `.oxori/governance.md`.
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
 *
 * @since 0.3.0
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

/**
 * @brief A single governance rule violation detected during evaluation.
 *
 * Represents a single governance rule violation detected during
 * governance evaluation.
 *
 * @remarks
 * Each violation corresponds to a rule that was evaluated against the vault state.
 * The `ruleId` allows audit logs to trace which rule was violated. `severity`
 * differentiates between blocking errors and warnings; implementation may use
 * this to determine whether to reject a write operation or emit a diagnostic.
 *
 * @since 0.3.0
 */
export type GovernanceViolation = {
  /** The unique ID of the rule that was violated. */
  ruleId: string;
  /** Human-readable message describing why the rule was violated. */
  message: string;
  /** The filepath (relative or absolute) affected by this violation. */
  filePath: string;
  /** Severity level: `"error"` prevents the write, `"warning"` allows but logs. */
  severity: "error" | "warning";
};

/**
 * @brief Result of evaluating governance rules against vault state.
 *
 * Result of evaluating governance rules against vault state.
 *
 * @remarks
 * `GovernanceResult` reports whether all evaluated rules passed and lists any
 * violations found. The `checkedAt` timestamp aids in audit trails and determining
 * whether a re-check is needed. A result is considered `passed` only if the
 * `violations` array is empty.
 *
 * @example
 * const result: GovernanceResult = {
 *   passed: false,
 *   violations: [
 *     {
 *       ruleId: "no-agent-writes-to-archive",
 *       message: "agents cannot write to archive/**",
 *       filePath: "archive/old.md",
 *       severity: "error"
 *     }
 *   ],
 *   checkedAt: Date.now()
 * };
 *
 * @since 0.3.0
 */
export type GovernanceResult = {
  /** True if all rules passed; false if any violation exists. */
  passed: boolean;
  /** Immutable list of violations found during evaluation. */
  violations: readonly GovernanceViolation[];
  /** Unix timestamp (ms) when the evaluation was performed. */
  checkedAt: number;
};

/**
 * @brief Interface for a vault filesystem watcher that emits typed change events.
 *
 * Emits `WatchEvent` objects when the vault filesystem changes.
 *
 * @remarks
 * `VaultWatcher` wraps Node.js `fs.watch` to provide typed events and clean
 * resource cleanup. Listeners subscribe via the `on()` method; the watcher
 * must be explicitly `stop()`-ped to release the underlying filesystem handle.
 * Events are emitted in the order they occur on the filesystem.
 *
 * Typical usage:
 * ```typescript
 * const watcher = watch(vaultPath);
 * watcher.on('change', (event) => {
 *   console.log(`File ${event.filepath} was ${event.type}d`);
 * });
 * watcher.on('error', (err) => {
 *   console.error('Watch error:', err);
 * });
 * // ... later ...
 * watcher.stop();
 * ```
 *
 * @since 0.3.0
 */
export interface VaultWatcher {
  /**
   * @brief Subscribes to filesystem change events for `.md` files.
   * @param event - The event type: `"change"` for file modifications, `"error"` for watcher errors.
   * @param listener - Callback invoked with a {@link WatchEvent} when the event fires.
   * @returns The watcher itself (for method chaining).
   */
  on(event: "change", listener: (e: WatchEvent) => void): this;
  /**
   * @brief Subscribes to watcher errors.
   * @param event - Always `"error"` for this overload.
   * @param listener - Callback invoked when a filesystem watch error occurs.
   * @returns The watcher itself (for method chaining).
   */
  on(event: "error", listener: (err: Error) => void): this;
  /**
   * @brief Stops watching and releases the underlying `fs.watch` handle.
   *
   * After calling `stop()`, no further events will be emitted. Safe to call multiple times.
   */
  stop(): void;
};
