# Flynn — Project History

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

### 2026-04-03: types.ts review — CHANGES REQUESTED

Reviewed `src/types.ts` submitted by Tron.

**Two blockers found:**
1. `FrontmatterEntry` missing as a named export — backlog criterion explicitly requires it. Inline `Record<string, unknown>` is not sufficient.
2. Individual types lack per-type JSDoc — file header is good but each exported type needs its own block documenting semantics and non-obvious design choices (especially the `ParsedFile` vs `FileEntry` mutability split).

**Passes:** no `any`, named exports only, `type` keyword throughout, zero src/ dependencies, API surface shapes are solid, `Result<T,E>` pattern is well-designed.

**Revision assigned to Ram** (per protocol: different agent than original author Tron).

### 2026-04-03: Phase 1 Gate Review — APPROVED

Ran the full Phase 1 verification suite. All 14 acceptance criteria passed:
- `tsc --noEmit`: zero errors
- `eslint src/ tests/`: zero errors
- `npx vitest run`: 31 passed, 22 todo, 11 CLI tests skipped (expected — CLI tests are integration-level)
- `npx tsup`: clean build — dist/index.js, dist/index.cjs, dist/cli.js all present
- dist/cli.js shebang: `#!/usr/bin/env node` ✅ — dist/index.js has no shebang ✅
- No `any` types in src/ — confirmed clean
- JSDoc: every exported function in parser.ts, indexer.ts, types.ts has a doc block
- README.md, docs/architecture.md, CONTRIBUTING.md, RELEASES.md — all in place

**Lesson:** Vitest's "todo" and "skipped" counts are not failures — they're intentional placeholders for future work. The gate criterion is "all non-todo tests pass", which is satisfied. Distinguish between `todo` (intentional, future), `skip` (intentional, integration/e2e), and actual failures when assessing test results.

**Gate decision:** `.squad/decisions/inbox/flynn-phase1-gate.md` — APPROVED. Phase 1 status updated to ✅ Complete in team.md. Ready for Phase 2.

### 2026-04-03: Phase 2 Gate Checklist Written

**Delivered:** `.squad/decisions/inbox/flynn-phase2-gate-checklist.md`

Wrote the complete Phase 2 gate checklist at kickoff (addressing Action Item A6 from Phase 1 retro: "write gate checklist at kickoff, not at review time"). 

Checklist is based on Phase 1's 14 criteria (TypeScript, ESLint, tests, build, shebang, no-any, JSDoc, README) plus 17 Phase 2-specific criteria covering: Query types and module exports, Graph types and walk API, public API re-exports, tokenizer/parser/evaluator implementation details, CLI command functionality, documentation (query-language.md, architecture.md updates), Phase 1 CLI tests now filled in, and performance thresholds (query < 100ms, walk < 200ms on linked-vault).

Checklist is binary-verifiable (run commands, check output, review code). Ready for Phase 2 team to execute against.

---

### 2026-04-03: Phase 1 Retrospective facilitated

**Facilitated** the Phase 1 retrospective for all contributors (Tron, Yori, Clu, Dumont, Castor).

**Key findings documented in `.squad/decisions/inbox/flynn-phase1-retro.md`:**

**Wins:** Types-first discipline, Result<T,E> pattern, Yori's thorough fixture design (including cycle-safe linked-vault), Clu's dual-package tsup fix, Dumont's production-grade docs from day one, conventional commit discipline throughout.

**Friction points (named honestly):**
1. API mismatch between Yori's test skeletons and Tron's implementation — `buildIndex(path)` vs `indexVault(config)`, direct vs `Result<T,E>` access. Required full test rewrite.
2. tsup banner bug — shebang leaked to all dist outputs in initial config. Clu caught and fixed it.
3. Missing `FrontmatterEntry` named export in Tron's first types.ts submission — caught in code review, revised by Ram.
4. `@types/micromatch` discovered mid-implementation, not during planning.
5. All 11 CLI tests remain `it.todo()` — CLI is shipped but untested by automated tests.
6. `src/index.ts` was a late addition, not planned in early backlog issues.

**9 action items assigned** for Phase 2 — highest priority: lock index.ts as first deliverable (A1), Yori writes skeletons only after contracts are merged (A2), fill in CLI todos (A3).

**Phase 2 readiness:** ✅ Cleared. Primary concern for Phase 2: query AST/tokenizer types must be reviewed and locked before Yori writes test skeletons — do not repeat the Phase 1 API mismatch pattern.

### 2025-07-13: Phase 2 Type Contracts Review — APPROVED

Reviewed `src/types.ts` Phase 2 sections (lines 381–682) submitted by Tron, covering the Query Engine and Graph Traversal type contracts.

**All 5 verification criteria passed:**
- Zero `any` types — confirmed by scan
- All exported types use `type` keyword; `FILTER_FIELDS` correctly uses `const` for runtime availability
- Named exports only, no defaults
- Every Phase 2 type has `@description`, `@remarks`, and `@example` JSDoc — field-level inline docs present on non-obvious fields
- Types are complete for `query.ts` and `graph.ts` needs

**Answered Tron's 4 open questions:**
1. **`OperatorNode.children` for NOT:** Keep `QueryNode[]` — runtime assert covers the one-child constraint; tuple adds construction friction with no extra safety in a correct parser.
2. **`FilterNode.field` as `FilterField` vs `string`:** Keep `string` — field validation belongs in the evaluator; `FilterField` adds test fixture friction for no meaningful compile-time gain.
3. **Preserve `GroupNode`:** Yes — round-trip serialization and MCP tooling need it; cost is one evaluator `case`.
4. **`WalkResult.edges` as `ReadonlySet<Edge>`:** Confirmed correct — deduplication semantics are right for edges; `visitOrder` already covers ordered node traversal.

**Actions taken:**
- Updated `src/index.ts` to re-export all 15 Phase 2 types plus `FILTER_FIELDS`
- Ran `npx tsc --noEmit` — zero errors
- Wrote verdict to `.squad/decisions/inbox/flynn-phase2-types-review.md`

**Cleared:** Yori may begin writing test skeletons against these locked contracts immediately.
