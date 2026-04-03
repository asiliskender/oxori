# Oxori Architecture

> Where humans and AI agents think together, in markdown.

## Overview

Oxori is a TypeScript library and CLI that makes markdown files queryable, traversable, and semantically searchable — without an external database. The vault itself remains a collection of plain markdown files, and **the index is also markdown**, stored under `.oxori/index/` and human-readable. This design enables both humans and AI agents to work on the same knowledge base while maintaining Git-friendly workflows and filesystem-level concurrency semantics.

Oxori is built in five distinct phases, each delivering a shippable npm release. Phase 1 focuses on parsing and indexing. By Phase 5, the system provides a complete MCP server for AI agents, governance rules to constrain agent writes, semantic vector search, and graph traversal with typed relationships.

The architecture prioritizes **predictability over cleverness**: all file paths are normalized and absolute, errors are structured and recoverable, types are strict with no `any`, and operations are idempotent — re-indexing is always safe.

## Core Principles

1. **Markdown files are the source of truth. Always.** The vault is a collection of plain `.md` files, readable in any editor (Obsidian, VS Code, vim). Oxori never modifies source files during indexing — it only reads. Humans have full write access to their vault.

2. **The index is also markdown, stored under `.oxori/index/`. Derived, regenerable, human-readable.** The index files (`files.md`, `tags.md`, `links.md`) are markdown documents that list file entries, tag mappings, and link relationships. They can be inspected, version-controlled, and regenerated at any time. This is not a database — it's a derived summary.

3. **No external database. No SQLite. The filesystem is the database, the index files are the catalog.** All indexing data is computed from source files and stored either in memory (cache) or as markdown files. This simplifies deployment, keeps the vault portable, and ensures that the vault can be used without Oxori — users always own their data.

4. **Governance constrains agents, not humans. Humans have full access.** Governance rules live in `.oxori/governance.md` and are enforced **only** on agent writes (via CLI, SDK, or MCP). Humans can edit files directly in Obsidian, and those edits bypass governance entirely. This principle ensures humans remain in control while agents operate within defined boundaries.

5. **Git handles concurrency. No application-level locks.** Multiple agents and humans working on the same vault use Git branches, pull requests, and merges to coordinate. Oxori does not manage locks, transactions, or conflict resolution — Git does. This scales horizontally and delegates concurrency to a tool humans already understand.

6. **Obsidian-compatible conventions for wikilinks, frontmatter, and tags.** Oxori uses standard markdown practices: YAML frontmatter for structured metadata, `[[wikilink]]` syntax for internal references, and `#tag` / `#tag/subtag` for hierarchical categorization. Users can open the same vault in Obsidian and Oxori without conflicts or special setup.

7. **Both humans and agents read and write to the same vault.** The vault is a shared knowledge base. Humans use Obsidian as the visual interface. Agents use the CLI, SDK, or MCP server. Both sides read and write the same `.md` files. Governance and the write API ensure consistent behavior across both interfaces.

## System Layers

### Layer 1: Parser

**What it does:** Reads a single markdown file from disk and extracts all structured metadata: YAML frontmatter, tags (`#tag`), wikilinks (`[[link]]`), typed relations, and raw body content.

**What it depends on:** The filesystem. Takes an absolute filepath as input.

**Key design decisions:**
- Uses `gray-matter` to parse frontmatter — any valid YAML is accepted. No schema validation at parse time; consuming code narrows the types it cares about.
- Tags are expanded to all ancestor levels. `#project/auth/oauth` produces three entries: `"project"`, `"project/auth"`, `"project/auth/oauth"`. This enables prefix-based queries without recursive logic at query time.
- Wikilinks are normalized to lowercase filename stems (no `.md` extension), so `[[My Note]]` and `[[my note]]` both resolve to `"my note"`. Case-insensitive lookup simplifies graph traversal.
- Typed relations are extracted from frontmatter keys that contain wikilinks, e.g. `depends_on: [[other-file]]` becomes a `TypedRelation` edge. The key becomes the relation type (e.g., `"depends_on"`).
- The body is preserved as-is for future semantic search. Parser does not extract inline links, hashtags, or other content — that is a job for later layers.

**Returns:** A `ParsedFile` object with filepath, filename, frontmatter, tags, wikilinks, typed relations, and body.

### Layer 2: Markdown Index

**What it does:** Scans the entire vault, parses all markdown files via Layer 1, and builds three human-readable markdown index files: `files.md` (a registry of all files and their frontmatter), `tags.md` (tag-to-file mappings), and `links.md` (wikilink graph). Also builds an in-memory cache (`IndexState`) with fast O(1) lookups via Maps and Sets.

**What it depends on:** Layer 1 (Parser).

**Key design decisions:**
- The in-memory cache uses Maps and Sets with absolute filepaths as keys (for files), raw tag strings as keys (for tags), and lowercase filename stems as keys (for links). This ensures O(1) lookups and avoids case-sensitivity bugs.
- Index files are markdown, not JSON. Each line in `files.md` is a summary of one file (filepath, frontmatter summary). `tags.md` lists each tag and its associated files. `links.md` lists each link relationship. This makes the index inspectable, diff-friendly, and human-readable.
- Index files are written after parsing completes, so a partial crash never leaves a corrupt index. The vault is always consistent.
- The indexer tracks `lastModified` (mtime) for each file to enable incremental updates in Phase 5. Watcher can skip re-parsing files that haven't changed.
- Exclude patterns (glob-based) allow users to skip folders like `.obsidian/` or `node_modules/`.

**Produces:**
- Three markdown files under `.oxori/index/`: `files.md`, `tags.md`, `links.md`.
- An in-memory `IndexState` object with three Maps: `files` (filepath → FileEntry), `tags` (tag string → TagEntry), `links` (filename stem → LinkEntry).

### Layer 3: Query Engine

**What it does:** Parses query strings into an abstract syntax tree (AST), then evaluates the AST against the in-memory index to find matching files. Queries support filtering by frontmatter keys, tag presence/absence, and file count constraints.

**What it depends on:** Layer 2 (Markdown Index). Reads from `IndexState`.

**Key design decisions:**
- Query syntax is simple and human-friendly: `type:decision AND status:open` filters to files where frontmatter `type` is `"decision"` and `status` is `"open"`. Parentheses, AND/OR/NOT, and wildcards are supported.
- Queries are evaluated left-to-right against the in-memory cache, with early termination on empty intermediate results to keep latency low even on large vaults (thousands of files).
- Tag queries can prefix-match because tags are expanded to all ancestor levels during parsing. `tag:project` matches all files with `#project`, `#project/auth`, `#project/auth/oauth`, etc.
- Frontmatter values are type-narrowed during query evaluation — queries compare strings, numbers, and booleans based on the detected type, not string comparison of YAML values.

**Returns:** A list of matching filepaths.

### Layer 4: Graph Traversal

**What it does:** Walks the wikilink graph and typed-relation graph with configurable depth, direction (incoming, outgoing, bidirectional), and relation type filters. Returns all reachable files from a starting point.

**What it depends on:** Layer 2 (Markdown Index). Reads from `IndexState`.

**Key design decisions:**
- Wikilinks and typed relations are both treated as graph edges. Wikilinks are undirected (if A links to B, you can traverse from B back to A). Typed relations like `depends_on` are directed — you traverse in the direction the relation points.
- The graph may contain cycles and dangling links (files that reference non-existent files). Graph traversal handles both gracefully: cycles are detected and not re-traversed, dangling links are skipped with an optional warning.
- Depth is configurable to enable "deep dives" (find all dependencies of dependencies) or focused searches (only direct references). Depth 0 returns the starting file. Depth 1 returns direct neighbors.
- Relation filters allow traversing only specific types (e.g., follow only `depends_on` edges, not `blocks` or `related_to`). This enables semantic filtering of the graph.

**Returns:** A set of filepaths reachable from the starting point within the depth limit, optionally filtered by relation type.

### Layer 5: Semantic Search

**What it does:** Embeds file content using an external embedding provider (OpenAI, Anthropic, or a local ONNX model), stores embeddings as binary vectors in `.oxori/vectors/`, and searches by computing cosine similarity between query embeddings and cached file embeddings.

**What it depends on:** Layer 1 (Parser — extracts body content). Embedding provider (HTTP or local). File storage for `.oxori/vectors/`.

**Key design decisions:**
- Semantic search is optional. Core Oxori functionality (parsing, indexing, querying, graph traversal) works without any embeddings.
- Embeddings are a computed cache stored as binary data under `.oxori/vectors/`. They are regenerable and not checked into Git. Users can delete the `vectors/` folder and rebuild embeddings at any time.
- The embedding provider is pluggable via an interface. Default is OpenAI (via HTTP), but users can supply their own provider or use a local ONNX model.
- Searches return results ranked by cosine similarity. Top-K results are returned by default.
- Embeddings are recomputed on re-indexing only for files that have changed (via `lastModified` tracking).

**Returns:** A ranked list of filepaths sorted by semantic relevance to the query.

### Layer 6: Governance

**What it does:** Reads `.oxori/governance.md` on startup, parses governance rules (allow/deny patterns), and enforces those rules on agent writes. Human writes are never subject to governance.

**What it depends on:** Layer 1 (Parser — parses `.oxori/governance.md` as a markdown file). Layer 7 (Write API — checks rules before allowing writes).

**Key design decisions:**
- Governance rules are written as markdown in `.oxori/governance.md` — no special configuration language. Each rule has an ID, pattern (glob or regex), effect (`"allow"` or `"deny"`), and scope (`"agents"` or `"all"`).
- Only agent writes (via MCP, CLI, or SDK) are subject to governance. Human writes (Obsidian, direct file edits) bypass governance entirely. This is intentional: humans are the owners.
- Rules are evaluated in declaration order. The first matching rule wins. This enables hierarchical rule structures (allow all except a few exceptions).
- Rules can target specific paths (e.g., `archive/**` is read-only) or file content (e.g., files tagged `#sensitive` can only be read, not written).
- Governance denials are logged and reported back to the agent with a clear message and optional remediation steps.

**Returns:** A decision (allow/deny) for a proposed write operation.

### Layer 7: Write API

**What it does:** Creates new markdown files or appends content to existing files, with automatic frontmatter generation, governance enforcement, and index updates.

**What it depends on:** Layer 1 (Parser — parses frontmatter). Layer 2 (Markdown Index — updates cache after write). Layer 6 (Governance — checks rules before allowing writes).

**Key design decisions:**
- Write operations are idempotent. Writing the same file twice produces the same result (no duplication).
- Frontmatter is automatically normalized: timestamps are ISO-8601, file paths are absolute, tags are consistent.
- After a write, the in-memory index is updated immediately so subsequent queries and walks reflect the new file.
- Index markdown files are updated after each write, so the `.oxori/index/*.md` files stay consistent with the vault. This ensures Git diffs are predictable.
- The write API does not commit to Git. Oxori writes files; the user (or their automation) manages Git commits. This keeps Oxori out of the business of version control.

**Returns:** A `Result` indicating success or failure with optional action guidance.

### Layer 8: Watcher

**What it does:** Monitors the vault directory for filesystem changes (new files, edits, deletions) and updates the index incrementally rather than re-scanning the entire vault. Enables live index updates for long-running operations.

**What it depends on:** Layer 2 (Markdown Index — incremental updates). `chokidar` for filesystem monitoring.

**Key design decisions:**
- The watcher uses `chokidar` to detect `add`, `change`, and `unlink` events. It debounces rapid changes to avoid thrashing on rapid edits.
- On `change` or `add`, the watcher re-parses only that file and updates the index. On `unlink`, the watcher removes all cache entries for that file.
- The watcher is optional and only engaged during long-running operations (like the MCP server). For CLI one-shot commands, a full re-index is simpler and faster.
- The watcher uses `lastModified` (mtime) to skip re-parsing files that haven't changed, reducing CPU overhead.

**Emits:** `WatchEvent` objects (type, filepath, timestamp) that the indexer consumes to update `IndexState`.

### Layer 9: MCP Server

**What it does:** Exposes all Oxori functionality as a Model Context Protocol server, enabling Claude, Cursor, or any MCP-compatible AI agent to interact with the vault. Hosts tools for querying, walking the graph, reading files, and writing files (subject to governance).

**What it depends on:** All other layers. The MCP server is the top-level orchestrator that calls into parser, indexer, query engine, graph traversal, semantic search, governance, and write API.

**Key design decisions:**
- The MCP server runs as a separate process or in-process, depending on deployment. It listens for incoming MCP protocol messages.
- All MCP calls are routed through the governance layer before being executed, ensuring agents cannot bypass governance constraints.
- The MCP server keeps the vault open and the index in memory across multiple requests, reducing startup latency for rapid agent interactions.
- The MCP server can optionally enable the watcher to live-update the index as files change, providing real-time consistency to the agent.

**Provides:** MCP tools for querying, graph traversal, semantic search, file reading, and file writing. Resources for exposing the entire vault as queryable data structures.

## Data Flow

### Indexing (Phase 1)

1. User runs `oxori index` in a vault directory.
2. CLI initializes the indexer with the vault path.
3. Indexer scans all `.md` files matching include patterns and respecting exclude patterns.
4. For each file, indexer calls the parser to extract frontmatter, tags, wikilinks, and typed relations.
5. Parser returns a `ParsedFile` object.
6. Indexer accumulates parsed files into three separate data structures: `files` (by filepath), `tags` (by tag string), and `links` (by wikilink target).
7. Indexer writes three markdown files under `.oxori/index/`: `files.md`, `tags.md`, `links.md`.
8. Indexer stores the `IndexState` in memory (in-process cache).
9. CLI prints summary: "Indexed 42 files, 15 tags, 128 links" and exits.

### Querying (Phase 2)

1. User runs `oxori query "type:decision AND status:open"`.
2. CLI loads the vault and index from disk (if not already loaded).
3. Query engine parses the query string into an AST.
4. Query engine evaluates the AST against the in-memory `IndexState`.
5. Query returns a list of matching filepaths.
6. CLI prints the results and exits.

### Graph Traversal (Phase 2)

1. User runs `oxori walk decisions/api-choice.md --depth 2`.
2. CLI loads the vault and index from disk.
3. Graph traversal finds the starting file in the index.
4. Graph traversal iteratively explores neighbors at depths 0, 1, 2, adding them to the result set.
5. For each neighbor, graph traversal checks `wikilinks` (undirected) and `typedRelations` (directed) to find the next hop.
6. Graph returns all reachable filepaths.
7. CLI prints the results and exits.

### Writing (Phase 3)

1. User (or agent via MCP) calls `vault.write("memory/plan.md", { frontmatter: { type: "memory" }, body: "..." })`.
2. Write API generates frontmatter (adds `created_at`, normalizes timestamps, etc.).
3. Write API calls governance layer to check if this write is allowed.
4. If governance denies, write operation fails with error.
5. If governance allows, write API creates the file on disk.
6. Write API calls the indexer to update the in-memory `IndexState`.
7. Write API updates the index markdown files (`.oxori/index/*.md`).
8. Write API returns success.
9. Next query or walk operation sees the new file without needing to re-index.

### Semantic Search (Phase 4)

1. User runs `oxori search "authentication approach"`.
2. CLI loads the vault and index from disk.
3. Search layer embeds the query string using the configured provider (OpenAI by default).
4. Search layer retrieves cached embeddings for all files from `.oxori/vectors/`.
5. Search layer computes cosine similarity between query embedding and each cached file embedding.
6. Search returns the top-K results sorted by similarity score.
7. CLI prints the results with scores and exits.

### MCP Server (Phase 5)

1. Agent (Claude, Cursor, etc.) connects to the MCP server.
2. Agent calls an MCP tool, e.g. "query vault for open decisions".
3. MCP server parses the call and routes to the appropriate Oxori layer (query engine in this case).
4. Oxori layer processes the request and returns results.
5. MCP server formats results as MCP protocol messages and sends back to agent.
6. Agent receives results and can call other tools (walk, search, write) as needed.
7. If write is attempted, MCP server checks governance before allowing the write.
8. Index is kept in memory across multiple agent calls via the watcher, enabling low-latency repeated queries.

## Type System

The type system is strict and stable. Core types are defined once in `types.ts` and reused throughout the codebase. No `any` type is used — all values are either known types or `unknown` and narrowed at the call site.

### Key Types

**`FrontmatterEntry`** — Type alias for `Record<string, unknown>`. Represents schemaless YAML frontmatter where any key-value pair is valid. The `unknown` type forces consumers to narrow values before use, preventing silent type errors. Example usage:

```typescript
// ❌ Don't do this — type is unknown, operations are unsafe
const status = entry.frontmatter['status'];
console.log(status.toUpperCase()); // Error: toUpperCase not defined on unknown

// ✅ Do this — narrow before use
if (typeof status === 'string') {
  console.log(status.toUpperCase()); // Safe
}

// ✅ Or use a helper
function getString(fm: FrontmatterEntry, key: string): string | undefined {
  const val = fm[key];
  return typeof val === 'string' ? val : undefined;
}
```

Named as a type (rather than inline `Record<string, unknown>`) to enable future schema refinement (e.g., stricter validation in Phase 3+) without breaking existing code.

**`ParsedFile`** — The intermediate form produced by the parser. Mutable by design (parser builds it incrementally). Contains filepath, filename, frontmatter (Record<string, unknown>), tags (Set<string>), wikilinks (Set<string>), typedRelations (Map<string, string[]>), and body. Example: parsing `/vault/auth.md` with `depends_on: [[login]]` produces a `ParsedFile` with `typedRelations.get("depends_on")` returning `["login"]`.

**`FileEntry`** — The immutable representation stored in the in-memory cache. Same fields as `ParsedFile`, but uses `ReadonlySet` and `ReadonlyMap` to prevent accidental cache mutation. Also includes `lastModified` (mtime) for change detection.

**`TagEntry`** — A single tag and the set of files that carry it. Used in `IndexState.tags`. Example: `{ tag: "project/auth", files: Set(["/vault/auth.md", "/vault/oauth.md"]) }`.

**`LinkEntry`** — A single wikilink target and the set of files that reference it. Used in `IndexState.links`. Example: `{ target: "login", sources: Set(["/vault/auth.md", "/vault/session.md"]) }`.

**`TypedRelation`** — A directed edge in the file relationship graph. Contains source (filepath), relationType (frontmatter key), and target (filename stem). Example: `{ source: "/vault/auth.md", relationType: "depends_on", target: "login" }`.

**`IndexState`** — The complete in-memory cache. Contains three Maps: `files` (filepath → FileEntry), `tags` (tag string → TagEntry), `links` (filename stem → LinkEntry). Also tracks `totalFiles` and `lastIndexed` timestamp.

**`VaultConfig`** — Configuration for opening a vault. Contains `vaultPath` (required) and optional `indexPath`, `vectorPath`, `governancePath`, and `excludePatterns`.

**`Result<T, E>`** — Tagged union for structured error handling. Either `{ ok: true, value: T }` or `{ ok: false, error: E }`. All fallible operations return `Result` instead of throwing (unless the failure is truly unrecoverable, like a programmer error).

**`OxoriError`** — Structured error type. Contains `message` (human-readable), `code` (machine-readable, SCREAMING_SNAKE_CASE), optional `action` (how to fix it), and optional `filepath` (if traceable to a specific file).

## Error Handling Strategy

Oxori uses a combination of `Result<T, E>` and throws for error handling, depending on severity:

**Recoverable Errors (Return `Result`):** File not found, parse error (malformed frontmatter), query validation error, governance denial. These are expected to happen occasionally and should be reported to the user with a suggestion for remediation. Example: "File `/vault/decisions/api-choice.md` not found. Run `oxori index` to rebuild the index."

**Unrecoverable Errors (Throw):** Programmer errors like invalid type narrowing, out-of-bounds access, invariant violation. These indicate a bug in Oxori and should crash the process with a stack trace for debugging.

**CLI Error Handling:** The CLI catches all errors (both `Result` errors and thrown exceptions), formats them with context (filepath if available, action if available), and exits with status 1. User sees a clear message like:

```
Error: GOVERNANCE_DENIED
File: /vault/archive/old-decision.md
Message: Agents cannot modify archived files.
Action: Ask a human to update this file or move it out of archive/.
```

**MCP Error Handling:** MCP calls always return structured responses. Errors are included in the response with code, message, and optional action. The client (Claude, Cursor) receives the error and can display it to the user or retry with a different approach.

## Build Phases

| Phase | Focus | Key Modules | Release | Status |
|-------|-------|-------------|---------|--------|
| 1 | Parser + Markdown Index | `types.ts`, `parser.ts`, `indexer.ts`, `cli.ts` (init/index) | v0.1.0 | Planned |
| 2 | Query + Graph Traversal | `query.ts`, `graph.ts`, `cli.ts` (query/walk/graph) | v0.2.0 | Planned |
| 3 | Write API + Governance | `writer.ts`, `governance.ts`, `index.ts` (public SDK), `cli.ts` (write) | v0.3.0 | Planned |
| 4 | Semantic Search | `search.ts`, embeddings providers | v0.4.0 | Planned |
| 5 | MCP + Watcher | `mcp.ts`, `watcher.ts`, Obsidian docs | v0.5.0 | Planned |

Each phase is a complete npm release with a new version number, release notes, and changelog. Phases are merged to `main` only when fully complete with tests (80%+ coverage), documentation, and Flynn's architectural approval.

## File Structure

```
oxori/
├── src/
│   ├── index.ts                # Public SDK entry point (Phase 3)
│   ├── cli.ts                  # CLI entry point and commands
│   ├── parser.ts               # Markdown file parser
│   ├── indexer.ts              # Vault scanner and in-memory cache builder
│   ├── graph.ts                # Graph traversal (Phase 2)
│   ├── search.ts               # Semantic vector search (Phase 4)
│   ├── query.ts                # Query AST and evaluator (Phase 2)
│   ├── writer.ts               # File creation/append (Phase 3)
│   ├── governance.ts           # Governance rule parsing and enforcement (Phase 3)
│   ├── watcher.ts              # Filesystem change monitor (Phase 5)
│   ├── mcp.ts                  # MCP server (Phase 5)
│   └── types.ts                # Shared type definitions (all phases)
├── tests/
│   ├── parser.test.ts
│   ├── indexer.test.ts
│   ├── query.test.ts           # Phase 2
│   ├── graph.test.ts           # Phase 2
│   ├── writer.test.ts          # Phase 3
│   ├── governance.test.ts      # Phase 3
│   ├── search.test.ts          # Phase 4
│   └── fixtures/               # Test vaults
│       ├── basic-vault/
│       ├── governance-vault/
│       └── linked-vault/
├── docs/
│   ├── architecture.md         # This file
│   ├── phase1-api.md           # Phase 1 API docs
│   └── releases/               # Release notes per phase
│       └── v0.1.0.md
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
├── README.md
├── CONTRIBUTING.md
├── PROJECT.md
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── eslint.config.js
├── LICENSE
└── .gitignore
```

## Key Design Decisions

### ADR-001: No External Database

**Decision:** All indexing data is computed from source files and stored either in memory (cache) or as markdown files. No SQLite, Postgres, or other external database.

**Why:** 
- Keeps the vault portable and self-contained. Users can copy the vault to another machine, and it "just works" without database migrations or exports.
- Avoids deployment complexity. No database server to manage, scale, or back up.
- Maintains Git-friendly workflows. Index files are markdown and diff-able; database files would be binary and opaque to Git.
- Simplifies offline usage. The vault can be indexed and queried on a laptop with no network.

**Tradeoffs:** 
- Startup time is slower (full scan and parse on first load). Mitigated by incremental updates (watcher) and in-memory caching.
- Query performance is limited by RAM size. Mitigated by keeping the cache small (maps and sets) and avoiding cartesian products in queries.

### ADR-002: Wikilinks Without Extension

**Decision:** Wikilinks are `[[filename]]` without `.md` extension, resolved case-insensitively by filename stem.

**Why:**
- Matches Obsidian convention. Users switching between Obsidian and Oxori see the same syntax.
- Simplifies resolution. No ambiguity over which file `[[note]]` refers to (only one `note.md` per folder).
- Encourages stable naming. Renaming from `foo.md` to `bar.md` breaks the link visibly; users have a chance to update references.

**Tradeoffs:** 
- Cannot have multiple `.md` files in the same folder with the same stem (would be invalid anyway).
- Case-insensitive lookups require normalization at parse time.

### ADR-003: Schemaless Frontmatter

**Decision:** Any YAML key-value is indexed. No predefined schema. Consuming code narrows types at the call site.

**Why:**
- Maximizes flexibility. Users can add custom frontmatter fields without modifying Oxori.
- Maintains human-writability. Users can edit frontmatter in Obsidian or any editor without worrying about schema validation.
- Keeps parser simple. No validation burden; parser just extracts YAML and hands it to the indexer.

**Tradeoffs:** 
- Query code must be defensive and handle missing or malformed frontmatter values.
- No static guarantees about frontmatter structure. Tests must cover edge cases.

### ADR-004: Governance for Agents Only

**Decision:** Governance rules apply only to agent writes (via MCP, CLI, SDK). Human writes (Obsidian, direct file edits) bypass governance entirely.

**Why:**
- Preserves human agency. Users are the owners and can always edit their vault directly if needed.
- Prevents Oxori from becoming a barrier to legitimate work. A human should never be blocked from editing their own notes.
- Simplifies enforcement. Governance is only checked at the API boundary (CLI, SDK, MCP), not on every file write.

**Tradeoffs:**
- Agents can coordinate with humans to work around governance (e.g., agent asks human to make a write). This is acceptable — agents should have human oversight anyway.

### ADR-005: Git Handles Concurrency

**Decision:** Multiple agents and humans working on the same vault use Git for coordination. No application-level locks or conflict resolution.

**Why:**
- Delegates complexity to a proven tool. Git has ~20 years of battle-tested merging and conflict detection.
- Scales horizontally. Any number of agents/humans can work in parallel across branches.
- Maintains auditability. Git history shows who changed what and when.
- Keeps Oxori out of version control. Oxori's job is indexing and querying, not merging conflicts.

**Tradeoffs:** 
- Requires users to understand Git. Acceptable because users working with agents likely already use Git.
- Merge conflicts require manual resolution. This is rare in practice (different files or different sections).

### ADR-006: Typed Relations via Frontmatter

**Decision:** Frontmatter keys that contain wikilinks become typed edges in the graph. Example: `depends_on: [[login]]` creates a `depends_on` edge from this file to `login.md`.

**Why:**
- Semantic richness. "Depends on" is different from "Blocks" or "Related to". Typed edges preserve meaning.
- Schemaless. Users define their own relation types. A user might use `depends_on`, `blocks`, `related_to`, or custom types.
- Simple to implement. Parser extracts the key, indexer tracks the relation, graph traversal filters by key.

**Tradeoffs:** 
- Users must structure their frontmatter correctly. A typo like `dependsOn: [[login]]` (camelCase instead of snake_case) creates a different relation type.
- Graph traversal can be complex if many relation types exist. Mitigated by allowing filters (e.g., "follow only `depends_on` edges").

### ADR-007: Optional Semantic Search

**Decision:** Vector embeddings are optional. Core Oxori works without them. Embeddings are computed, cached, and regenerable.

**Why:**
- Reduces core complexity. Parsing, indexing, querying, and graphs are the MVP. Embeddings are a power feature.
- Avoids heavy dependencies. No need for embedding libraries (like `openai` or `anthropic`) in the core package.
- Keeps costs optional. Users can choose whether to use vector search (and incur API costs) or stick with keyword queries.
- Enables local adoption first. Users can start with the free core and opt into semantic search later.

**Tradeoffs:** 
- Semantic search is not available until Phase 4.
- Users who want embeddings must configure a provider (OpenAI, Anthropic, etc.).

## Build System and Tooling

### Array Configuration Pattern

Oxori uses `defineConfig([...])` with an **array of entry points** instead of a single object. This enables **per-entry customization**:

```ts
// tsup.config.ts
export default defineConfig([
  {
    entry: { index: "src/index.ts" },  // Library entry
    format: ["esm", "cjs"],
    dts: true,
    banner: {},                         // No banner for library
  },
  {
    entry: { cli: "src/cli.ts" },       // CLI entry
    format: ["esm"],
    banner: { js: "#!/usr/bin/env node" },
  },
]);
```

**Why the array?** Dual-package distribution requires different settings for library vs CLI:
- Library exports (`index.ts` → `dist/index.js` + `dist/index.cjs`) must have **no shebang** so downstream consumers can import cleanly.
- CLI entry (`cli.ts` → `dist/cli.js`) **must have shebang** to be executable as a standalone binary.

### Shebang Placement (Critical Rule)

**Rule: ONLY apply the shebang banner to CLI entry points, never to the library export.**

✅ **Correct:**
```ts
// CLI entry only
{
  entry: { cli: "src/cli.ts" },
  banner: { js: "#!/usr/bin/env node" }
}
```

❌ **Wrong:**
```ts
// This breaks library imports
{
  entry: { index: "src/index.ts" },
  banner: { js: "#!/usr/bin/env node" }
}
```

**What happens if you get it wrong?** 
If `banner: { js: "..." }` is applied to the library entry, downstream code that imports from the package will receive a file starting with `#!/usr/bin/env node`, which is invalid JavaScript and will fail to parse.

### Adding a New Binary Entry

If a new binary command needs to be added (e.g., `src/daemon.ts`), follow this pattern:

1. Create a new entry config in the array
2. Apply banner **only to the new entry**, not to existing ones
3. Add the new output file to `package.json` `bin` field

```ts
export default defineConfig([
  { entry: { index: "src/index.ts" }, /* ... */ },
  { entry: { cli: "src/cli.ts" }, banner: { js: "#!/usr/bin/env node" }, /* ... */ },
  {
    entry: { daemon: "src/daemon.ts" },  // New binary
    banner: { js: "#!/usr/bin/env node" }  // Shebang only here
  },
]);
```

Then in `package.json`:
```json
{
  "bin": {
    "oxori": "./dist/cli.js",
    "oxori-daemon": "./dist/daemon.js"
  }
}
```

### Common Error: Invalid Banner Value Type

esbuild (used by tsup) requires banner values to be **strings only**, not objects. This error occurs if you try to pass an object:

```ts
// ❌ Error: banner option requires string value
banner: { js: { cli: "#!/usr/bin/env node" } }

// ✅ Correct: string value
banner: { js: "#!/usr/bin/env node" }
```

The error message: `"banner" option must be a string, got object`. Each entry in the array applies its banner independently — the banner config itself is always a string.

## What NOT to Do

### Never modify source markdown files during indexing.
The vault is the source of truth. Indexing is read-only. Any automatic modification (reformatting, normalizing, auto-linking) risks corrupting user data or making unintended changes.

### Never require a specific folder structure.
Users should be able to organize their vault however they want. `docs/`, `notes/`, `archive/`, nested folders — all should work without configuration.

### Never add heavy native dependencies to core.
Keep the core package lightweight and portable. Use HTTP APIs for external services (embeddings, LLMs). If a feature requires a heavy native dep (like ONNX for local embeddings), make it optional.

### Never bypass governance for agent writes.
Even if an agent claims to be "trusted" or "internal", governance rules must be enforced. Governance is the only mechanism to keep agents honest.

### Never commit to Git on behalf of the user.
Oxori writes files; Git commits are the user's responsibility (or their automation). This keeps Oxori out of version control and prevents accidental commits.

### Never build a UI in this package.
Oxori is a library, CLI, and MCP server. Obsidian is the visual UI for now. A separate UI package could layer on top later, but this package stays headless.

### Never use `any` type.
Strict TypeScript. Use `unknown` and narrow at the call site. This catches bugs at compile time and makes the code safer.

### Never assume files are UTF-8 encoded.
Use appropriate encoding detection (e.g., `chardet` library) or document the assumption clearly. Many legacy systems use other encodings.

### Never rely on file timestamps being accurate.
`mtime` can be manipulated or inaccurate on some filesystems. Use it as a heuristic for change detection, not as the source of truth. Re-parse if unsure.

### Never assume wikilinks are bidirectional.
A file can link to another file without the target linking back. The graph can have dangling links (links to non-existent files). Handle both gracefully.

## Error Handling Examples

### Parser Error
A file has malformed YAML frontmatter. Parser returns:
```ts
Result<ParsedFile, OxoriError> = {
  ok: false,
  error: {
    message: "Invalid YAML in frontmatter: unexpected token at line 2",
    code: "PARSE_ERROR",
    action: "Fix the YAML syntax and run oxori index again.",
    filepath: "/vault/auth.md"
  }
}
```

### Governance Denial
An agent tries to write to a protected path. Governance returns:
```ts
Result<void, OxoriError> = {
  ok: false,
  error: {
    message: "Governance rule 'no-agent-deletes' denies this operation",
    code: "GOVERNANCE_DENIED",
    action: "Ask a human to delete this file or move it out of the protected path.",
    filepath: "/vault/archive/decision.md"
  }
}
```

### Query Validation Error
User runs `oxori query "invalid(syntax"`. Query parser returns:
```ts
Result<string[], OxoriError> = {
  ok: false,
  error: {
    message: "Query parse error: unmatched parenthesis",
    code: "QUERY_PARSE_ERROR",
    action: "Check the query syntax. Example: oxori query \"type:decision AND status:open\"",
    filepath: undefined
  }
}
```

## Performance Considerations

- **Indexing:** O(n) where n is the number of files. Typical vault (1000 files) indexes in < 1 second.
- **Querying:** O(m) where m is the number of results. Evaluated against in-memory maps, so very fast.
- **Graph Traversal:** O(n + e) where n is the number of reachable nodes and e is the number of edges. Depth limit prevents exponential explosion.
- **Semantic Search:** O(n) for embedding all files on first run, O(1) for lookup in cache. Cosine similarity is computed on cached embeddings.
- **Index Writes:** O(1) amortized for in-memory updates, O(m) for writing index markdown files (m = number of files).

For large vaults (10,000+ files), consider:
- Increasing exclude patterns to skip large folders.
- Enabling the watcher to avoid full re-indexes.
- Partitioning the vault into separate vaults per domain (e.g., `projects/` and `personal/` as separate vaults).
