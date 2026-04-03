# Dumont — Project History

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

## Work Completed

### Phase 1 Documentation (2026-04-03)

**Delivered:**
1. **docs/architecture.md** — Comprehensive 1000+ line architecture document covering all 9 layers, 7 core principles, data flow, type system, error handling, build phases, 7 ADRs, performance considerations, and "what NOT to do" section.

2. **README.md** — Updated with Phase 1 features, quick-start guide, SDK usage, vault structure, index file explanations, and roadmap. Kept high-level; detailed docs in `docs/` folder.

3. **CONTRIBUTING.md** — Complete contributor guide with dev setup, running commands, code conventions (TypeScript, functions, comments, JSDoc), commit conventions (Conventional Commits with examples), testing guidelines (80%+ coverage), PR process, phase gates, CI/CD pipeline, and getting help.

4. **RELEASES.md** — Detailed v0.1.0 release notes covering Parser module, Markdown Index, CLI commands, Type System, installation, quick start, SDK usage, architecture reference, breaking changes (none), known limitations, migration guide (N/A), Phase 2 preview, and testing/CI details.

**Key Content:**
- Parser: YAML frontmatter, tags (with hierarchy), wikilinks (case-insensitive), typed relations, body content
- Markdown Index: Three index files (files.md, tags.md, links.md) — human-readable, git-friendly, regenerable
- CLI: `oxori init`, `oxori index` commands
- Type system: ParsedFile, FileEntry, TagEntry, LinkEntry, TypedRelation, IndexState, Result<T,E>, OxoriError
- Error handling: Result<T,E> for recoverable errors, throw for programmer errors, structured OxoriError with codes and actions
- Build phases: Table showing all 5 phases with focus, key modules, release versions
- Architecture decisions: 7 ADRs (No Database, Wikilinks Without Extension, Schemaless Frontmatter, Governance for Agents Only, Git Handles Concurrency, Typed Relations, Optional Semantic Search)

**Standards Applied:**
- Markdown-first: all examples are real or clearly marked pseudo-code
- Clear for future maintainers: detailed "why" behind each design choice
- Phase gates: documented what "done" means for Phase 1
- Release notes: comprehensive, including breaking changes (none), migration steps, and Phase 2 preview

## Learnings

### Retro A9: FrontmatterEntry Documentation (2026-04-04)

**Task:** Add usage examples and consumer patterns for `FrontmatterEntry` type to `docs/architecture.md`.

**Action taken:**
- Added new subsection in "## Type System / ### Key Types" (right after intro, before `ParsedFile`)
- Explains what `FrontmatterEntry` is: `type FrontmatterEntry = Record<string, unknown>` (schemaless)
- Explains why `unknown` not `any`: forces consumers to narrow values before use, prevents silent runtime errors
- Provided three code examples showing ❌ (unsafe access), ✅ (type guard with `typeof`), ✅ (helper function)
- Explained why it's a named type: enables future refinement without breaking existing consumers
- Kept to ~20 lines + code block (concise, focused)
- Insert location: Line 234, between type system intro and ParsedFile

**Result:** Phase 1 audit closed. `FrontmatterEntry` now clearly documented with consumer patterns for future developers.
