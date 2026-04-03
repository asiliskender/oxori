# Yori — Project History

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

### Phase 1 — Fixture design and test skeleton (2026-04-03)

**What was built:**
- `tests/fixtures/basic-vault/` — 6 root-level files covering all core parser edge cases
  (rich frontmatter, typed relations, hierarchical tags, empty file, no-frontmatter, lowercase/dedup wikilinks)
- `tests/fixtures/linked-vault/` — 7 files forming a realistic directed graph with cycle (A→B→C→A),
  leaf (node-d), hub (node-e), and multiple typed-relation targets (node-f)
- `tests/fixtures/governance-vault/` — updated governance.md to spec format, added `secrets/` with 2 protected files
- `tests/parser.test.ts` — 20 test cases (16 fully implemented, 4 `it.todo()`)
- `tests/indexer.test.ts` — 18 test cases (13 fully implemented, 5 `it.todo()`)
- `tests/cli.test.ts` — 11 test cases (all `it.todo()` — CLI tests require end-to-end implementation)
- `tests/fixtures/README.md` — full documentation of all fixtures and their test scenarios

**Lessons learned:**

1. **Typed relations isolation:** `note-two.md` intentionally has no wikilinks in the body — only
   `depends_on`/`blocks` typed relations in frontmatter. This is the only clean way to test
   "typed relations do not bleed into the wikilinks Set" without ambiguity from body links.

2. **Hierarchical tag deduplication test:** Testing dedup via ancestor expansion is more robust than
   adding explicit duplicate tags to a frontmatter list — `project/alpha` and `project/alpha/planning`
   both expand to include `project`, so checking `count === 1` catches any dedup failure.

3. **Wikilink normalisation test:** `overview.md` body contains both `[[note-one]]` and `[[NOTE-ONE]]`
   in the same body. One entry in the Set confirms both normalisation AND deduplication in a single test.

4. **CLI tests are all `it.todo()`:** CLI end-to-end tests need the actual CLI implementation to know
   exact output strings, exit codes, and flag names. Stubs are in place so they're visible in the test
   report and can be filled in by Tron when cli.ts is written.

5. **Temp dirs within project:** CLI tests use `tests/.tmp-cli-<n>/` rather than `os.tmpdir()` to
   respect the "no /tmp writes" constraint. `beforeEach`/`afterEach` create and clean these up.

6. **Cycle safety in linked-vault:** The A→B→C→A cycle tests that `buildIndex()` does not loop
   infinitely — it should detect cycles at the wikilink collection level, not at graph traversal
   (traversal is Phase 2's concern). The cycle fixture verifies the indexer is cycle-safe at scan time.
