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
