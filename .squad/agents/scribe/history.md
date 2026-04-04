# Project Context

- **Project:** oxori
- **Created:** 2026-04-03

## Core Context

Agent Scribe initialized and ready for work.

## Recent Updates

📌 Team initialized on 2026-04-03

## Learnings

Initial setup complete.

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

## Phase 1 Commit Complete — $(date)

✅ All Phase 1 work committed in 7 conventional commits:
1. feat(types): Foundational type contracts and Result<T,E> helpers
2. feat(parser): Markdown parser with tag/wikilink extraction
3. feat(indexer): In-memory vault indexer with incremental updates
4. feat(cli): oxori init and oxori index CLI commands
5. fix(build): Fixed tsup config for per-entry shebang + CJS support
6. test(fixtures): Test fixtures and test suite for parser/indexer
7. docs: Architecture, README, CONTRIBUTING, RELEASES docs

All commits include Co-authored-by trailer.

## Phase 2 Commit Complete — 2026-04-03 23:14:00

✅ All Phase 2 work committed in 3 conventional commits:
1. feat(types): Add Phase 2 query engine and graph traversal type contracts
2. feat(query, graph, index, cli): Query tokenizer/parser/evaluator, BFS graph walk, CLI commands, public API exports
3. test(query, graph, cli): Query language tests, graph walk tests with edge case coverage, CLI integration tests
4. docs: Query language spec, Phase 2 README updates
5. fix(ci): Release workflow pnpm fix, Node 24 support, README version sync
6. chore(ci): GitVersion 5.12.0 integration for semantic versioning
7. chore(squad): Update agent histories and decisions from Phase 2 work

All commits include Co-authored-by trailer.
Ready for Phase 3: Write API + Governance.

## Phase 3 Wave 0 Commit — 2026-04-04T04:25:16Z

✅ **Committed Phase 3 Wave 0 output from all agents**

**Agents Onboarded:**
- Castor: Refined backlog ACs with TypeScript signatures, 4-wave plan
- Flynn: 22-criterion Phase 3 gate checklist (retro A1-A8 applied)
- Tron: GovernanceViolation, GovernanceResult, VaultWatcher types + exports
- Yori: 3 query stubs filled, watcher.test.ts + governance.test.ts created, CLI stubs added

**Commit:** `02748e1` (feat(phase3): Wave 0 — type contracts, test skeletons, backlog refinement)

**Logs Created:**
- `.squad/orchestration-log/2026-04-04T04:25:16Z-wave0.md` — Wave 0 deliverables summary
- `.squad/log/2026-04-04T04:25:16Z-phase3-wave0.md` — Session log
- `.squad/decisions.md` — Appended "## Phase 3 Wave 0 Decisions" section (merged inbox)

**Status:** Wave 0 complete. Phase 3 Gate open (awaiting Wave 1 types approval). All agents on schedule.

---

## Phase 3 Wave 1 Commit — 2026-04-04T04:28:25Z

**Commit:** 437f5e8 (feat(phase3): Wave 1 — watcher and governance engine)

**Staged & Committed:**
- src/watcher.ts (VaultWatcherImpl + watch factory)
- src/governance.ts (checkGovernance rule evaluator)
- .squad/decisions/inbox/ram-governance-impl.md
- .squad/agents/ram/history.md

**Actions Completed:**
1. ✅ Git status verified uncommitted files
2. ✅ Staged Wave 1 implementation files
3. ✅ Created commit with full message (bypassed /tmp constraint with inline -m)
4. ✅ Created orchestration log: .squad/orchestration-log/2026-04-04T04-28-25Z-wave1.md
5. ✅ Merged inbox decisions into .squad/decisions.md (tron-watcher-impl, ram-governance-impl)
6. ✅ Deleted merged inbox files
7. ✅ Appended this history entry

**Test Status:** 130 passed, 43 todo (all watcher & governance stubs remain as .todo())


## Phase 3 Wave 1 Commit (Yori test fill) — 2026-04-04T04:36:37Z

✅ **Committed Yori's Wave 1 test fill work**

**Commit:** ac3644c (test(phase3): fill watcher and governance test stubs)

**Staged & Committed:**
- tests/watcher.test.ts (10 stubs filled)
- tests/governance.test.ts (13 assertions, 6 filled + 7 extra)
- .squad/agents/yori/history.md
- .squad/decisions/inbox/yori-wave1-tests.md

**Actions Completed:**
1. ✅ Git status verified 3 modified + 1 untracked squad file
2. ✅ Staged test files and squad agent history
3. ✅ Created commit with full conventional message (inline -m)
4. ✅ Created orchestration log: .squad/orchestration-log/2026-04-04T04:36:37Z-yori-wave1-tests.md
5. ✅ Merged inbox decisions into .squad/decisions.md
6. ✅ Deleted merged inbox file
7. ✅ Appended this history entry

**Test Status:** 153 passed (up from 130), 27 todo (down from 43)

**Coverage Results:**
- governance.ts: 100% (all metrics)
- watcher.ts: 97.4% (macOS-unreachable change branch documented)

**Remaining Todos (4 documented stubs):**
- required-tag, no-orphan, max-links, severity:warning (feature-deferred)

