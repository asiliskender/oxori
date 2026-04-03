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

## Phase 2 — Graph Traversal Implementation

**Date:** $(date -u +%Y-%m-%dT%H:%M:%SZ)

### Completed: O-2-02 — `src/graph.ts`

Replaced the Phase 2 Wave 1 stub with a full BFS implementation.

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
