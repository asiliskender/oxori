# Castor — Project History

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

### 2026-04-03 — Full sprint backlog created
- Wrote complete sprint backlog to `.squad/backlog.md` — 38 issues across 5 phases
- Each phase is one npm release: v0.1.0 (parser+index) through v0.5.0 (MCP+Obsidian)
- Phase gates assigned to Flynn (review+approve before merge), release notes to Dumont
- Scope documented in `.squad/decisions/inbox/castor-backlog-scope.md`
- Key decisions: Phases 1-3 are core (locked in), Phases 4-5 are extensions (can be adapted)
- Team routing clear: Tron (parser/query), Ram (graph/writer/governance/search/MCP), Yori (tests), Dumont (docs), Clu (CI/CD), Quorra (MCP expertise)
- Backlog enables parallelization and prevents mid-phase scope creep
- Coverage target 80% minimum, parser/governance/indexer >= 95%

### 2026-04-03 — Phase 2 backlog refined with TypeScript signatures
- Updated all Phase 2 implementation issues with explicit TypeScript function signatures
- Added type definitions and exports for query/graph modules to prevent Phase 1 API mismatch
- Query module: `Token`, `TokenKind`, `QueryAST`, `QueryNode`, `FilterNode`, `OperatorNode`, `GroupNode`; `tokenize()` and `parse()` signatures
- Query evaluator: `QueryResult` type; `evaluate(ast: QueryAST, state: IndexState): QueryResult` signature — critical that parameter is `IndexState` not `IndexCache`
- Graph module: `WalkDirection`, `WalkVia`, `WalkOptions`, `Edge`, `WalkResult`; `walk(start: string, state: IndexState, options?: WalkOptions): WalkResult` signature
- CLI layer: Added note that commands are thin wrappers, no new exports from `cli.ts` — core logic in query.ts/graph.ts
- Phase 2 gate updated: added ACs for public API exports and test skeleton timing (after types are approved)
- Decision documented in `.squad/decisions/inbox/castor-phase2-backlog-refined.md`
- Prevention: Test skeletons now written after types locked, eliminating Yori↔Tron contract drift from Phase 1

### 2026-04-03 — Phase 3 backlog refinement and Wave 0 kickoff plan

**Applied Phase 2 Retro Action Items (A1-A8) to Phase 3:**
- **A1**: Runtime export check added to gate criterion #7 (binary pass/fail on `dist/index.js` exports)
- **A2**: Types-first discipline enforced: Tron locks types.ts in Wave 1 before any implementation
- **A3**: Yori writes test skeletons only after Flynn approves types (after Wave 1)
- **A4**: New modules require ≥ 90% coverage; governance module ≥ 95% (criterion #16)
- **A5**: All backlog ACs now include explicit TypeScript signatures with parameter names and types
- **A6**: Phase 3 gate checklist written at Wave 0 kickoff (→ `.squad/decisions/inbox/castor-phase3-gate.md`)
- **A7**: CLI tests for oxori write/append/config required in gate (criterion #15)
- **A8**: README updated as part of Wave 0 planning; implemented in Wave 4 (not deferred)

**Phase 3 Refined ACs:**
- **writer.ts** (Ram — Wave 2): `create()` and `append()` with exact signatures, handles special chars, ISO 8601 dates, idempotency
- **governance.ts** (Ram — Wave 2): `parseGovernance()` parses `.oxori/governance.md`; `enforceRule()` enforces with human bypass; ≥ 95% coverage (safety-critical)
- **Vault SDK** (Ram — Wave 3): `open(path): Promise<Vault>` opens vault; Vault class with `query()`, `walk()`, `create()`, `append()`, `getGovernanceRules()`; all methods async; Result<T,E> error handling
- **CLI commands** (Tron — Wave 3): `oxori write`, `oxori append`, `oxori config` (thin wrappers around Vault SDK); all respect --vault flag and --agent flag (for testing governance)
- **Tests** (Yori — Wave 2-3): writer.test.ts (12+), governance.test.ts (16+), index.test.ts (14+), cli.test.ts updates; governance tests critical (all guard clauses); full per-file coverage table required
- **Docs** (Dumont — Wave 4): docs/write-api.md, docs/governance.md, docs/sdk-api.md, docs/safety-principles.md, README.md updates, docs/architecture.md updates

**Phase 3 Wave Plan (4 waves, 7 days total):**
- **Wave 0** (1 day): Gate checklist, type planning, docs structure, fixtures design — NO implementation code
- **Wave 1** (1 day): Tron locks types.ts; Ram records signatures; after Flynn approves → Yori starts test skeletons
- **Wave 2** (2 days): Ram implements writer.ts + governance.ts (parallel); Yori writes tests (parallel); coverage ≥ 90%/95%
- **Wave 3** (2 days): Ram implements Vault class; Tron implements CLI commands (after Vault); Yori writes integration tests (parallel)
- **Wave 4** (1 day): Dumont writes docs; Yori verifies coverage; Flynn final gate → v0.3.0 release

**Critical Path:**
1. Wave 0: Gate checklist + type planning
2. Wave 1: types.ts locked (gates Wave 2)
3. Wave 2: writer + governance (gates Wave 3)
4. Wave 3: Vault + CLI (gates Wave 4)
5. Wave 4: Release

**22-Criterion Phase 3 Gate Checklist:**
- 6 inherited criteria (TypeScript, linting, tests, build, shebang, no-any)
- 16 Phase 3 specific:
  - **#7**: Runtime export check (new — catches type-vs-value mismatch)
  - **#8-10**: JSDoc, type exports, public API re-exports
  - **#11**: Writer module (create, append)
  - **#12**: Governance module (parseGovernance, enforceRule, ≥ 95% coverage)
  - **#13**: SDK Vault class and open()
  - **#14**: CLI commands (write, append, config)
  - **#15**: CLI integration tests (required in gate, not optional)
  - **#16**: Coverage 80%+ overall, 90%+ new modules, 95%+ governance
  - **#17**: Docs (write-api.md, governance.md, sdk-api.md, README, architecture)
  - **#18**: Governance safety (no bypass for agents)
  - **#19**: Performance (< 100ms writes, < 10ms governance check)
  - **#20**: Frontmatter conventions (title, tags, created_at, updated_at)
  - **#21**: Indexer incremental update on write
  - **#22**: Indexer coverage improved to ≥ 90% (Phase 2 debt)

**New TypeScript Types (Phase 3 additions to types.ts):**
- `CreateOptions`: title?, tags[], frontmatter?, body
- `GovernanceRules`: allowedPaths[], blockedPaths[], requiredFrontmatter[]
- `Actor = Agent | Human`; `Agent: { kind: "agent", name: string }`; `Human: { kind: "human" }`
- `WriteAction = "create" | "append"`
- `SearchResult` (future Phase 4, documented but not implemented yet)

**Key Design Decisions:**
- Writer module is dumb (pure I/O); governance is smart (rule enforcement)
- Humans bypass governance by design (governance protects agents, humans are responsible)
- All writes go through `safeWrite()` / `safeAppend()` for governance check
- Result<T,E> pattern for error handling (not throws)
- CLI commands are thin wrappers around Vault SDK (logic in SDK, not CLI)
- .oxori/governance.md protected from agent writes (strict rule)

**Prevention Measures (from Phase 2 Retro):**
- Runtime export check in gate (criterion #7) prevents type-vs-value export mismatch
- Per-file coverage table required in fix submissions (prevents omitting modules)
- Test skeletons written after types locked (prevents parameter order drift)
- Full per-file table for coverage (not summary)

**Dependencies and Wave Gates:**
- Wave 1 unlock: Flynn approves types.ts
- Wave 2 unlock: All writer + governance tests pass
- Wave 3 unlock: All SDK + CLI integration tests pass
- Wave 4 unlock: All docs written, coverage verified, Flynn approves all 22 criteria

Documentation written to:
- `.squad/backlog.md`: Phase 3 Refinement section (line ~499), Wave 0-4 plans (line ~548-690), refined ACs for all 8 Phase 3 issues (line ~702-1046)
- `.squad/decisions/inbox/castor-phase3-gate.md`: Complete 22-criterion gate checklist (4 waves, 7 days, critical path defined)
- `.squad/agents/castor/history.md`: This entry (appended)
