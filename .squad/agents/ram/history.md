# Ram — Project History

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

**Build sprints:**
- Sprint 1: Parser + Markdown Index (types, parser, indexer, CLI init/index)
- Sprint 2: Query Engine + Graph Walk (query AST, graph, CLI query/walk/graph)
- Sprint 3: Write API + Governance (writer, governance, SDK public API)
- Sprint 4: Semantic Search (embeddings, vector storage, cosine similarity)
- Sprint 5: MCP Server + Watcher (MCP server, chokidar, Obsidian compat)

**Conventions:**
- Conventional commits (feat/fix/docs/test/refactor)
- Atomic commits — one logical change per commit
- No sprint merge without: passing tests, 80%+ coverage, docs updated, Flynn approved
- Each sprint = a separate npm release with detailed release notes

## Learnings

## Sprint 2 — Graph Traversal Implementation
## Phase 4 — Semantic Search Implementation (Issue #28)

**Date:** 2025-01-30

### Completed: src/search.ts — Binary Vector Storage, Cosine Similarity, Providers

**What was done:**
- Added Phase 4 types to `src/types.ts`: `Embedding`, `EmbeddingProvider`, `OpenAIProviderConfig`, `SearchResult`, `SearchOptions`, `VectorEntry`, `VectorIndex`
- Created `src/search.ts` with full implementation per `docs/semantic-search.md`

**Key decisions/findings:**
- Embedding types were NOT in `types.ts` yet (Tron's Wave 0 commit hadn't included them). Added them at the bottom of types.ts under `// === Semantic Search (Phase 4) ===`
- TypeScript strict mode (`noUncheckedIndexedAccess` or similar) caused array index access to be `number | undefined`. Fixed with `?? 0` fallbacks and one `!` non-null assertion on `data.data[0]!.embedding` (safe: OpenAI always returns at least one embedding on success)
- The `createStubProvider` normalizes to unit vector — makes cosine similarity tests meaningful even for synthetic data
- `VectorStore.store()` uses SHA-256 of filepath for `.vec` filename (first 16 hex chars) — collision-resistant, stable across renames
- Binary format: `0x4F584F52` magic ("OXOR"), u32 LE version=1, u32 LE dims, N×f32 LE — matches spec section 3 exactly
- All 197 existing tests pass after changes

**Files changed:**
- `src/types.ts` — appended Phase 4 type exports
- `src/search.ts` — new file, full implementation

## Phase 2 — Graph Traversal Implementation

**Date:** $(date -u +%Y-%m-%dT%H:%M:%SZ)

### Completed: O-2-02 — `src/graph.ts`

Replaced the Sprint 2 Wave 1 stub with a full BFS implementation.

**What was done:**
- Implemented `walk(start, state, options?)` using a BFS queue `[path, depth][]`
- Internal helpers: `stemToPath`, `outgoingLinkEdges`, `incomingLinkEdges`, `tagNeighborEdges`, `relationEdges`, `resolveNeighbors`
- Supports all `WalkDirection` values: `"outgoing"`, `"incoming"`, `"both"`
- Supports all `WalkVia` values: `"links"`, `"tags"`, `"both"`, `"relation:<key>"`
- `depth` stops traversal at edge-hop limit (start = depth 0)
- `maxNodes` caps visited nodes; sets `truncated: true` when hit
- Global edge deduplication via `edgeKey` Set (prevents duplicate edges on direction=both)
- Cycle prevention: visited Set blocks re-enqueuing any node
- Returns empty `WalkResult` for unknown `start` — never throws
- All types aligned to actual `src/types.ts` (not task spec which had different names):
  - `FileEntry.wikilinks`, `FileEntry.filename`, `FileEntry.typedRelations`
  - `IndexState.tags: Map<string, TagEntry>` (TagEntry.files), `IndexState.links: Map<string, LinkEntry>` (LinkEntry.sources)
  - `WalkDirection`: `"outgoing" | "incoming" | "both"`
  - `WalkResult`: `nodes`, `edges`, `visitOrder`, `truncated`
  - `Edge`: `source`, `target`, `kind`, `relationType?`

**Tests updated (`tests/graph.test.ts`):**
- Fixed parameter order: `walk(state, path)` → `walk(path, state)` (task spec signature)
- Changed two `toThrowError("not implemented")` assertions to check for empty `WalkResult`

**TypeScript:** `npx tsc --noEmit` → 0 errors

## Sprint 3 — Governance Implementation

**Date:** 2025-01-29

### Completed: O-3-xx — `src/governance.ts`

Implemented `checkGovernance()` — the governance rule evaluation engine.

**What was done:**
- Created `src/governance.ts` with `checkGovernance(rules, state)` as the sole export
- Used `micromatch.isMatch()` for glob-based filepath pattern matching (transitive dep, already typed)
- Implemented first-match-wins semantics per Tron Sprint 3 spec (per-file rule evaluation stops at first matching pattern)
- `deny` matches → `GovernanceViolation` with `severity: "error"`; `allow` matches → silently accepted
- Violations sorted by `filePath` for deterministic output
- `passed` is `true` only if no `"error"`-severity violations exist
- Exported `checkGovernance` from `src/index.ts`

**Key finding — type mismatch in task spec:**
- Task prompt described rule types (`required-tag`, `no-orphan`, `max-links`, `required-frontmatter`) with a `type` discriminant and per-rule fields. The actual `GovernanceRule` type (set by Tron in Wave 1) uses `pattern + effect + appliesTo` — a glob-based allow/deny policy model. Implementation follows the actual types.

**TypeScript:** `pnpm build` → 0 errors  
**Tests:** `pnpm test` → 130 passed, 43 todo (governance tests all `.todo()`)
