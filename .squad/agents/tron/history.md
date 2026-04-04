# Tron — Project History

## Project Context

**Project:** Oxori
**Owner:** Onur Asiliskender
**Repo:** /Users/onurasiliskender/Git/github-personal/oxori
**Stack:** TypeScript 5.x, Node.js 20+, pnpm, vitest, tsup
**Tagline:** Where humans and AI agents think together, in markdown.

**Architecture layers:**
1. Parser — reads .md files, extracts frontmatter (gray-matter), tags, wikilinks, typed relations
2. Markdown Index — .oxori/index/files.md, tags.md, links.md — in-memory Maps/Sets on startup
3. Query Engine — tokenizer, AST parser, evaluator
4. Graph Traversal — walks link relationships (depth, direction, relation type)
5. Semantic Search — vector embeddings in .oxori/vectors/ (optional, HTTP-based)
6. Governance — .oxori/governance.md, enforced on agent writes only
7. Write API — create/append files with convention-compliant frontmatter
8. Watcher — chokidar-based incremental index updates
9. MCP Server — Model Context Protocol for agent integrations

**Key decisions:**
- No external database — filesystem + markdown index is the database
- Wikilinks: [[filename]] without extension, case-insensitive
- Tags support hierarchy: #project/auth/oauth matches ancestors
- Frontmatter is schemaless — any YAML key-value indexed
- Typed relations via frontmatter keys (e.g., depends_on: [[file]])
- Vector search is optional — core works without embeddings
- Git handles concurrency — no application locks
- Strict TypeScript — no any, use unknown and narrow
- Functions over classes (except Vault and MCP server)

**Build phases:**
- Phase 1: Parser + Markdown Index (types, parser, indexer, CLI init/index)
- Phase 2: Query Engine + Graph Walk (query AST, graph, CLI query/walk/graph)
- Phase 3: Write API + Governance (writer, governance, SDK public API)
- Phase 4: Semantic Search (embeddings, vector storage, cosine similarity)
- Phase 5: MCP Server + Watcher (MCP server, chokidar, Obsidian compat)

**Conventions:**
- Conventional commits (feat/fix/docs/test/refactor)
- Atomic commits — one logical change per commit
- No phase merge without: passing tests, 80%+ coverage, docs updated, Flynn approved
- Each phase = a separate npm release with detailed release notes

## Learnings

### 2026-04-03: parser.ts written

**Task:** Implement `src/parser.ts` — reads `.md` files from disk, extracts frontmatter, tags, wikilinks, typed relations, and body.

**Key design decisions:**
- Named helper exports (`extractTags`, `expandTagHierarchy`, `extractWikilinks`, `extractTypedRelations`) keep `parseFile` thin and each helper independently testable.
- `gray-matter` wrapped in a try/catch — YAML parse errors return `err({ code: "PARSE_ERROR" })` rather than throwing.
- ENOENT detection via checking `(e as { code }).code === "ENOENT"` after narrowing `unknown` — no `any`, no `instanceof` (Node errors are not class instances in all runtimes).
- Tag regex `/#+([a-zA-Z0-9/_-]+)/g` created fresh per call via `new RegExp(source, "g")` to avoid shared lastIndex state across calls — a classic JS regex gotcha with the `g` flag on module-level constants.
- Wikilink extraction from frontmatter values handles both `string` and `string[]` values — typed relations like `depends_on: ["[[a]]", "[[b]]"]` are correctly collected.
- `frontmatter.tags` can be `string | string[]` — both cases handled, non-strings silently skipped per spec.
- `body` comes from `parsed.content` (gray-matter strips frontmatter block); `frontmatter` from `parsed.data`.
- All imports use `"./types.js"` with `.js` extension for ESM resolution compatibility.

**Gotchas / edge cases:**
- Module-level regex with `g` flag must not be used directly with `exec()` across multiple calls — always clone with `new RegExp(re.source, "g")` or reset `lastIndex`. This is a subtle source of non-deterministic bugs.
- `gray-matter` returns `parsed.data = {}` for files with no frontmatter — safe to use as-is.
- Empty file produces valid result: empty sets, empty map, empty body, empty frontmatter.
- `path.basename(filePath, ".md")` correctly strips the extension for `filename`; `path.resolve(filePath)` always produces absolute path for `filepath`.

### 2026-04-03: indexer.ts written

**Task:** Implement `src/indexer.ts` — walks a vault directory, parses all `.md` files via `parseFile`, and builds an in-memory `IndexState` with three lookup maps (files, tags, links).

**Key design decisions:**
- Three-tier helper structure: `parsedFileToEntry` (converts ParsedFile → FileEntry), `addFileToState` / `removeFileFromState` (targeted mutations), and the three exported functions that compose them. Keeps each piece independently testable.
- `removeFileFromState` does targeted cleanup rather than a full rebuild — iterates only the removed file's own tags/wikilinks and prunes empty entries. O(tags + wikilinks) instead of O(all files).
- `indexFile` calls `removeFileFromState` before re-adding to handle the re-index case cleanly without leaking stale tag/link entries.
- `indexVault` uses `readdir` with `recursive: true` (Node 18.17+). The result is `string[]` of relative paths, resolved to absolute with `resolve(vaultPath, entry)` before stat/parse.
- `micromatch` receives the relative path (from `relative(vaultPath, absPath)`) — patterns like `archive/**` are written relative to vault root, so computing the relative path before matching is essential.
- Parse errors are collected into `OxoriError[]` and logged via `console.warn`, not thrown — the vault scan always completes with whatever files parsed successfully.
- `typedRelations` values are frozen arrays (`Object.freeze([...values])`) to satisfy `readonly string[]` in `FileEntry` without a cast.
- `@types/micromatch` was missing from devDependencies — installed it to resolve TS7016 implicit-any error. Lesson: always verify `@types` packages exist for all non-TS deps before writing the import.

**Gotchas / edge cases:**
- `readdir` with `{ recursive: true }` returns relative paths on Node 20 — must prepend `vaultPath` before calling `stat` or `parseFile`.
- The `recursive` option type is `BufferEncodingOption | ObjectEncodingOptions & { recursive?: boolean }` — the return type widens to `string[] | Buffer[]` depending on encoding; casting the result to `string[]` after filtering is safe when no `encoding: "buffer"` is passed.
- `removeFile` is synchronous (no I/O) — it mutates state and returns the same reference for chaining, consistent with the spec.
- `state.totalFiles` must be kept in sync manually (`state.files.size`) — it's a denormalized counter, not auto-derived.

### 2026-04-03: cli.ts written

**Task:** Implement `src/cli.ts` — the Oxori CLI entry point (backlog O-1-04). Provides `oxori init <vaultPath>` and `oxori index <vaultPath>` commands using `commander`.

**Key design decisions:**
- Used `createRequire(import.meta.url)` + cast to `{ version: string }` for JSON version import — avoids `assert`/`with` syntax ambiguity between TS 5.3+ and bundler module resolution. No runtime overhead, works cleanly with `--noEmit`.
- `init` uses `fs.mkdir(..., { recursive: true })` which is idempotent by design. `EEXIST` on the path is treated the same as success, printing the same confirmation message.
- `index` times the operation with `Date.now()` before/after `indexVault()` and prints `✓ Indexed N files in Xms`.
- All error paths print with `✗` prefix via `console.log` (not `console.error`) per spec, then `process.exit(1)`.
- `program.parseAsync(process.argv)` is awaited at module level — the file is pure side-effects, no exported functions needed.
- No shebang in source — tsup banner config injects `#!/usr/bin/env node` on build.

**Gotchas / edge cases:**
- `mkdir({ recursive: true })` on Node 20 does NOT throw `EEXIST` — it resolves silently when the directory already exists. The `EEXIST` guard is a safety net for edge cases (e.g., a file named `.oxori` blocking directory creation), not the normal idempotency path.
- `unknown` error narrowing: always check `typeof e === "object" && e !== null && "code" in e` before reading `.code` — Node errors are plain objects, not class instances in all runtimes.
- `noUnusedLocals` / `noUnusedParameters` in tsconfig means every import must be used — `createEmptyState` is intentionally not imported in cli.ts since `indexVault` manages its own state internally.

### 2026-04-03: types.ts written

**Task:** Write the foundational shared type contract for all Oxori modules.

**Key design decisions:**
- `FileEntry` uses `ReadonlySet`/`ReadonlyMap` (not mutable `Set`/`Map`) to prevent accidental mutation of the in-memory cache. Consumers are readers, the indexer is the sole writer.
- `Result<T, E>` tagged union (discriminated on `ok: boolean`) for structured, recoverable error handling. Avoids mixing throw semantics with return-value semantics across the codebase. Helper functions `ok()` and `err()` keep call sites concise.
- `ParsedFile.tags` stores ALL ancestor levels of hierarchical tags (not just the leaf). `#project/auth/oauth` → `["project", "project/auth", "project/auth/oauth"]`. This pre-expansion makes query-time prefix matching O(1) via Set lookup.
- `TypedRelation.source` tracks the full filepath (not just filename stem) to enable graph traversal by absolute path — the graph layer resolves `FileEntry` objects by path key, making a stem-only source require an extra lookup on every edge hop.
- `WatchEvent` and `GovernanceRule` defined in Phase 1 to avoid type churn when Phases 3 and 5 land. Better to define stable shapes early.
- `IndexState` map keys are consistent: absolute paths for `files`, raw tag strings for `tags`, lowercase stems for `links`. Avoids mixed-convention lookups.

**Gotchas / edge cases:**
- `noUncheckedIndexedAccess` is enabled in tsconfig — any array/map access returns `T | undefined`. All consumers of `IndexState` maps must handle the `undefined` case.
- `exactOptionalPropertyTypes: false` in tsconfig — optional properties accept `undefined` values without issues.
- `typedRelations` values are `readonly string[]` in `FileEntry` (vs mutable `string[]` in `ParsedFile`) — the indexer must freeze/copy the arrays from the parser output before storing them in the cache.
- Typecheck passes with zero errors on `src/types.ts` alone (other src files don't exist yet — expected).

---

## Phase 2 — CLI Commands: query / walk / graph (O-2-04, O-2-05, O-2-06)

**Date:** 2025-07-13  
**Task:** Add `oxori query`, `oxori walk`, and `oxori graph` subcommands to `src/cli.ts`  
**Status:** Complete — `npx tsc --noEmit` → 0 errors; 87 tests pass

### What was done

Edited `src/cli.ts` to add three new commander subcommands. Existing `init` and `index` commands left untouched.

**New imports added:**
- `relative` added to `node:path` import (alongside existing `resolve`)
- `tokenize`, `parse`, `evaluate` from `./query.js`
- `walk` from `./graph.js`
- Types `OxoriError`, `Edge`, `WalkOptions`, `WalkDirection`, `WalkVia` from `./types.js` (type-only import)

**`oxori query <queryString> [--vault <path>] [--json]`:**
- Calls `indexVault()` → `tokenize()` → `parse()` → `evaluate()`
- Wraps tokenize/parse/evaluate in try/catch; detects thrown `OxoriError` by structural narrowing (`"code" in e && "message" in e`), prints `✗ message` + `→ action` to stderr, exits 1
- Default output: file paths relative to vault root, sorted, one per line
- `--json`: `{ files: string[], totalCount: number }`
- Empty result: prints "No files matched." to stdout, exits 0

**`oxori walk <startPath> [--vault <path>] [--direction ...] [--via ...] [--depth <n>] [--json]`:**
- Resolves `startPath` to absolute via `path.resolve(vaultPath, startPath)`
- Validates start file exists in index; exits 1 with stderr message if not
- `--direction` accepts `forward` (→ `"outgoing"`), `backward` (→ `"incoming"`), and `"both"` directly
- `--via` accepts `links`, `tags`, `both`, `relation:<key>` — passed directly as `WalkVia`
- `--depth` parsed as int, applied only when valid
- Calls `walk(absStart, state, walkOpts)` — returns `WalkResult` directly (not `Result<WalkResult>`)
- Default output: visited paths (relative, sorted), one per line
- `--json`: `{ visited: string[], edges: {from, to, kind}[], totalCount: number }`

**`oxori graph [--vault <path>] [--json]`:**
- Iterates all files in `state.files`; resolves each wikilink stem to an absolute path via filename matching (same approach as `graph.ts`'s internal `stemToPath`)
- Builds `Edge[]` with `kind: "wikilink"`
- Default output: `"source → target (wikilink)"` lines, one per edge
- `--json`: `{ nodes: string[], edges: Edge[] }` with paths relative to vault root

### Key decisions

1. **`evaluate()` throws, not returns `Result`** — confirmed by query.ts implementation; wrapped in try/catch with structural OxoriError narrowing (no `instanceof` needed — Node errors are plain objects).
2. **`walk()` returns `WalkResult` directly** — graph.ts never wraps in `Result`; no result unwrapping needed.
3. **Direction aliases** — `forward`/`backward` mapped to `outgoing`/`incoming` in the CLI layer; the walk internals always use `WalkDirection` values.
4. **Graph command replicates `stemToPath` inline** — `graph.ts`'s `stemToPath` is module-private; rather than export it or duplicate the traversal, the graph command does a simple filename-equality scan over `state.files.values()`. Acceptable at this scale (in-memory).
5. **`--json` flag comparison** — `options.json === true` (strict equality) avoids truthy-coercion issues with commander's boolean flag handling.
6. **`noUnusedLocals`** — all type imports (`OxoriError`, `Edge`, `WalkOptions`, `WalkDirection`, `WalkVia`) are used in type annotations within the action handlers; no dead imports.

### Gotchas / edge cases

- Commander parses `--depth <n>` as a string; must `parseInt(..., 10)` and guard with `isNaN` before setting `walkOpts.depth`.
- `result.visitOrder` is `readonly string[]`; spreading with `[...result.visitOrder]` to sort without mutation.
- `result.edges` is `ReadonlySet<Edge>`; spreading with `[...result.edges]` for mapping.
- OxoriError `action` is optional — checked `!== undefined` before printing the `→` line.
- `options.vault` defaults to `process.cwd()` via commander's option default — always a string when action runs.

---

## Phase 2 — Type Contract Design (Wave 1, Critical Path)

**Date:** 2025-07-13  
**Task:** Add Query Engine and Graph Traversal types to `src/types.ts`  
**Status:** Complete — awaiting Flynn review

### What was done

Added two new sections to `src/types.ts`:

**`// === Query Engine (Phase 2) ===`**
- `TokenKind` — union of token categories emitted by the tokenizer
- `Token` — `{ kind, value, position }` with zero-based source offset
- `FilterNode` — leaf AST node for `field op value` atoms
- `OperatorNode` — interior node for `AND / OR / NOT` with `children: QueryNode[]`
- `GroupNode` — parenthesized sub-expression node (preserved post-parse)
- `QueryNode` — discriminated union of the three node types above
- `QueryAST` — `{ root: QueryNode | null }` — null root means "match all"
- `QueryResult` — `{ matches: ReadonlySet<string>; totalMatched; executionMs }`
- `FILTER_FIELDS` — `as const` tuple for runtime field validation
- `FilterField` — derived union type from `FILTER_FIELDS`

**`// === Graph Traversal (Phase 2) ===`**
- `Edge` — `{ source, target, kind, relationType? }` directed graph edge
- `WalkDirection` — `"incoming" | "outgoing" | "both"`
- `WalkVia` — `"links" | "tags" | "both" | \`relation:${string}\`` (template literal for open-ended named relations)
- `WalkOptions` — optional-bag for `graph.walk()` configuration
- `WalkResult` — `{ nodes: ReadonlySet, edges: ReadonlySet, visitOrder: readonly[], truncated }`

### Key decisions

1. `QueryNode` is a discriminated union (not class hierarchy) — enables exhaustive `switch` + keeps nodes JSON-serialisable.
2. Single `OperatorNode` for AND/OR/NOT — unary NOT is a degenerate case of the same shape.
3. `GroupNode` preserved post-parse — needed for round-trip serialisation and IDE range highlighting.
4. `QueryAST.root: null` for empty query — avoids sentinel node, enables short-circuit at call site.
5. `FILTER_FIELDS as const` + derived `FilterField` — single source of truth for runtime validation and static typing.
6. `WalkVia` template literal — keeps named relation types open without `string` escape.
7. `ReadonlySet` on all result types — prevents caller mutation of engine output.
8. `Edge.relationType` optional (not discriminated union) — traversal algorithms treat all edges uniformly.

### Decision doc

Filed at `.squad/decisions/inbox/tron-phase2-type-contracts.md` with open questions for Flynn.

### Typecheck

`npx tsc --noEmit` → 0 errors.

### Open questions for Flynn

- Should `OperatorNode.children` for NOT be `[QueryNode]` tuple?
- Should `FilterNode.field` be `FilterField` instead of `string`?
- Should `GroupNode` be erased during parsing?
- `ReadonlySet<Edge>` vs `readonly Edge[]` for `WalkResult.edges`?

---

## Phase 2 — Query Engine: Tokenizer + Parser (Wave 1)

**Date:** 2025-07-13  
**Task:** Implement `src/query.ts` — tokenizer and recursive-descent parser (backlog O-2-01)  
**Status:** Complete — `npx tsc --noEmit` → 0 errors

### What was done

Wrote `src/query.ts` with three exported symbols plus internal helpers:

**Exported:**
- `tokenize(query: string): Token[]` — scans the raw query string character by character, emitting a flat `Token[]` ending with an `EOF` sentinel.
- `parse(tokens: Token[]): QueryAST` — builds a typed AST via recursive descent; returns `{ root: null }` for empty input.

**Internal:**
- `splitFilterToken(raw: string)` — splits a raw `field:value` / `field=value` / `field~value` string into its parts. Throws `QUERY_PARSE_ERROR` if no operator found.
- `TokenCursor` class — thin stateful wrapper over `Token[]` with `peek()`, `consume()`, `expect()`, and `isOperator()`.
- `raise(error: OxoriError): never` — throws a structured error; `never` return type allows use in expression position without needing extra casts.
- `closestField(unknown: string): string` — character-overlap heuristic for did-you-mean suggestions on unknown fields.
- `bareValueToNode(token: Token): QueryNode` — converts a bare word into an implicit `OR` of `title:word` and `link:word`.
- Grammar functions: `parsePrimary`, `parseNot`, `parseAnd`, `parseOr`.

### Operator precedence (highest to lowest)
1. `NOT` (unary prefix, right-recursive)
2. `AND` (binary infix, left-associative)
3. `OR`  (binary infix, left-associative)

### Error handling
- Chosen **throw** semantics (not `Result<T>`) — callers wrap in `try/catch`. Consistent with the task spec's "this module may throw" note.
- `QUERY_PARSE_ERROR` — unbalanced parens, unexpected tokens, malformed filter syntax.
- `QUERY_UNKNOWN_FIELD` — filter field not in `FILTER_FIELDS`, includes closest-match suggestion.

### Key decisions

1. **Throw vs Result** — chose `throw OxoriError` rather than `Result<Token[], OxoriError>` because parse failures are truly exceptional (not expected in the happy path), and throw keeps call sites cleaner when the caller already wraps in try/catch.
2. **`TokenCursor` as a class** — the recursive descent functions are stateless pure functions that share cursor state; a class with private `index` is the cleanest encapsulation without closures or parameter threading.
3. **`raise()` helper** — TypeScript doesn't infer `never` from bare `throw` inside a conditional expression; a `raise()` function with explicit `: never` return eliminates the need for `as never` casts.
4. **`noUncheckedIndexedAccess`** — `query[pos]` returns `string | undefined`; all usages guarded with `?? ""` before regex test or string concatenation.
5. **`GroupNode` preserved** — not erased during parse, per the locked type contract; evaluator in Wave 2 will simply descend into `.child`.
6. **`bareValueToNode`** — bare words expand to `OR(title:word, link:word)` as specified; produces a full `OperatorNode` in the AST.

### Gotchas / edge cases

- `noUncheckedIndexedAccess` means `tokens[this.index]` can return `undefined`; `peek()` coalesces with a synthetic `EOF` token.
- `FILTER_FIELDS` is `readonly string[]` after widening, so field validation uses `(FILTER_FIELDS as readonly string[]).includes(field)` — avoids the TS2345 "not assignable to parameter of `FilterField`" error that `FILTER_FIELDS.includes(field as FilterField)` would require.
- The `closestField` function must always find a winner since `FILTER_FIELDS` is non-empty; initialized to `FILTER_FIELDS[0]` with a non-null assertion via `as string` to satisfy strict null checks.
- Stray `)` with no matching `(` is caught by the post-`parseOr` EOF check, not inside `parsePrimary` — this gives a more actionable error message.

---

## Phase 2 — Query Engine: Evaluator (Wave 2)

**Date:** 2025-07-13  
**Task:** Add `evaluate()` to `src/query.ts` (backlog O-2-03)  
**Status:** Complete — `npx tsc --noEmit` → 0 errors; 75 tests pass

### What was done

Added three symbols to `src/query.ts`:

**Exported:**
- `evaluate(ast: QueryAST, state: IndexState): QueryResult` — evaluates the full AST against all files in the index; returns `matches` (filepath set), `totalMatched`, and `executionMs`.

**Internal:**
- `matchFilter(file: FileEntry, node: FilterNode): boolean` — handles per-field, per-operator matching logic.
- `matchNode(file: FileEntry, node: QueryNode, state: IndexState): boolean` — recursive dispatcher over `QueryNode` variants.

### Operator semantics implemented

| Field         | `=`                   | `:`                    | `~`                         |
|---------------|-----------------------|------------------------|-----------------------------|
| `tag`         | exact (case-insensitive) | exact (same as `=`)  | substring in any tag        |
| `type`        | exact                 | contains               | contains                    |
| `path`        | exact                 | contains               | contains                    |
| `title`       | exact                 | contains               | contains                    |
| `link`        | exact stem            | exact stem (same as `=`) | substring in any wikilink |
| `frontmatter` | exact on any value    | exact on any value     | substring in any value      |

### Key decisions

1. **`matchNode` receives `state`** — passed through in case future NOT-complement semantics need all-files access; currently NOT uses the local negation of the child result (correct per spec).
2. **`NOT` with empty children** — `node.children[0]` can be `undefined` under `noUncheckedIndexedAccess`; guard returns `false` rather than throwing.
3. **`QueryResult.matches` returns file paths** — consistent with the actual `types.ts` definition (`matches: ReadonlySet<string>`), not the task description's `files: ReadonlySet<FileEntry>`. The types.ts definition is authoritative.
4. **`executionMs` via `Date.now()`** — wall-clock delta; starts before the loop, ends after. Zero for empty state (short-circuit before clock).
5. **`tag` and `link` with `:`** — spec says "for tag: exact; for link: exact stem" — both collapse to the same branch as `=` (no `contains` behavior for these two fields with `:`).
6. **`frontmatter` substring on non-string values** — uses `String(fmVal)` before `.toLowerCase()` so numbers, booleans, and arrays can still be matched with `~`.

### Gotchas / edge cases

- `noUncheckedIndexedAccess` requires guarding `node.children[0]` in the `"not"` case — TypeScript infers `QueryNode | undefined`.
- `IndexState.files` is `Map<string, FileEntry>` — iterating `state.files` yields `[filepath, FileEntry]` tuples; both are used (filepath added to matches, FileEntry passed to matchers).
- `FileEntry.wikilinks` stores lowercased stems — `link` filter always compares against `lowerValue` (no further `.toLowerCase()` needed on the stored values).
- Empty state → early return `{ matches: new Set(), totalMatched: 0, executionMs: 0 }` avoids an unnecessary loop.

---

## Phase 3 — Wave 1: Watcher Implementation

**Date:** 2026-04-03

### Summary

Implemented `src/watcher.ts` — the vault filesystem watcher module.

- Created `VaultWatcherImpl` (internal class, extends `EventEmitter`, implements `VaultWatcher`)
- Exported only `watch(vaultPath, config?)` as the public factory function
- Added `export { watch } from "./watcher.js"` to `src/index.ts`
- Wrote decision note: `.squad/decisions/inbox/tron-watcher-impl.md`

### Implementation notes

- `fs.watch` `"change"` events → `WatchEvent.type = "change"`
- `fs.watch` `"rename"` + file exists → `"add"` (create)
- `fs.watch` `"rename"` + file missing → `"unlink"` (delete)
- `.md` filter in callback — non-markdown events silently dropped
- `setImmediate` defers constructor-time errors so callers attach listeners first
- Type definition in `src/types.ts` was authoritative — used `filepath` and `"add"/"change"/"unlink"` (task description had different names)

### Build & test

- `pnpm build` ✅ zero errors
- `pnpm test` ✅ 130 passed, 43 todo (all watcher tests are `it.todo()` stubs)
