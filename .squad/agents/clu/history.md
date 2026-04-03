# Clu — Project History

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

### 2026-04-03: CI/CD Infrastructure Established

**What:** Fixed and enhanced the build pipeline:
- **tsup.config.ts**: Split banner configuration per-entry (CLI only gets shebang). Added dual-package (ESM + CJS) for maximum compatibility. CLI gets `./dist/cli.js` with shebang; library exports from `./dist/index.js` (ESM) and `./dist/index.cjs` (CommonJS).
- **eslint.config.js**: Created new ESLint 9.x flat config with `typescript-eslint`. Enables `@typescript-eslint/no-explicit-any: "error"` to enforce type safety (no `any` allowed). Targets `src/**/*.ts` and `tests/**/*.ts`.
- **package.json**: Added `"module"` field for bundler compatibility. Updated `exports` to include CJS require path. Added `"packageManager": "pnpm@9.0.0"` to enforce pnpm 9 across team.
- **ci.yml**: Added `pnpm build` step to catch build failures early. Added CODECOV_TOKEN support for authenticated uploads. Matrix runs Node 20 + 22 for compatibility testing.
- **.npmignore**: Excludes development artifacts (.squad/, tests/, docs/, .github/, *.config.ts, src/) while preserving README.md and only shipping dist/.
- **vitest.config.ts**: Verified 80% threshold across lines, functions, branches, statements. Excludes cli.ts from coverage (entry point, tested by integration).

**Why:** Phase 1 acceptance criteria required full CI/CD infrastructure. The dual-package approach allows Oxori to be consumed by both ESM (modern) and CommonJS (legacy) consumers. Strict no-any rule enforces type safety from day one. Shebang per-entry prevents accidental executable output in library builds.

**Decisions Made:**
1. **Dual-package strategy** — ESM for Node.js, CJS for legacy consumers. Type declarations generated for both.
2. **Flat ESLint config** — Uses ESLint 9.x modern format. Avoids deprecated .eslintrc.json.
3. **No-any enforcement** — Type safety via TypeScript. Unknown is allowed (pattern matching required).
4. **Per-entry banners** — Only CLI gets shebang. Library exports clean.

**Files Modified:**
- ✅ tsup.config.ts (fixed dual-package + per-entry banners)
- ✅ eslint.config.js (created)
- ✅ .npmignore (created)
- ✅ package.json (added module, CJS exports, packageManager)
- ✅ ci.yml (added build step, codecov token)
- ✅ vitest.config.ts (verified thresholds)
