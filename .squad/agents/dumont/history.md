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

### Phase 2 Query Language Documentation (2026-04-04)

**Task:** Write `docs/query-language.md` — comprehensive reference for the Oxori query language based on actual implementation in `src/query.ts`.

**Deliverable:** `docs/query-language.md` (9200+ words)

**Sections completed:**

1. **Overview** — What the query language is and what it matches.

2. **Filter Syntax** — All six fields (`tag`, `type`, `path`, `frontmatter`, `title`, `link`) with three operators (`=`, `:`, `~`). Comprehensive table showing behavior by field and operator. Quoted value support for multi-word values.

3. **Boolean Operators** — `AND`, `OR`, `NOT` with strict precedence (NOT > AND > OR). Real examples showing precedence in action and how grouping overrides it.

4. **Grouping** — Parentheses for explicit precedence override, with practical examples.

5. **Bare Values** — Words without `field:` prefix expand to `title:word OR link:word`. Shorthand syntax for simple, intuitive queries.

6. **BNF Grammar** — Formal grammar showing the recursive-descent parser structure.

7. **Error Messages** — Two error codes from implementation:
   - `QUERY_PARSE_ERROR` — syntax errors (unbalanced parens, stray tokens) with actionable guidance
   - `QUERY_UNKNOWN_FIELD` — unknown field with did-you-mean suggestion

8. **Examples** — Eight real-world examples covering:
   - Simple tag filter
   - Compound AND queries
   - OR with grouping
   - NOT exclusion
   - Frontmatter search
   - Graph-aware queries (link + type)
   - Path-based filtering
   - Bare values with boolean ops

9. **Evaluation Semantics** — Case sensitivity, empty queries, tag hierarchy expansion, wikilink normalization, operator consistency.

10. **Performance** — Guarantees < 100ms on typical vaults.

11. **Implementation Notes** — Three-stage pipeline (tokenize → parse → evaluate), error handling pattern with try/catch.

**Design principles applied:**

- **Accuracy-first:** All syntax, operator behavior, and error messages derived directly from `src/query.ts` implementation.
- **Developer-friendly:** Clear tables, practical examples, grammar for reference.
- **No fluff:** Every section tied to actual behavior; no invented features.
- **Consistent tone:** Matches `docs/architecture.md` — technical but approachable.

**Status:** ✅ Complete and written to `/Users/onurasiliskender/Git/github-personal/oxori/docs/query-language.md`

### Phase 2 README Update (2026-04-04)

**Task:** Update `README.md` to reflect Phase 2 completion — replace future-tense "🔜 Phase 2" placeholders with actual completed features.

**Changes made:**

1. **Features section** — Updated version to v0.2.0, replaced placeholders:
   - ✅ Query engine — filter files by tag, type, path, frontmatter, title, link
   - ✅ Graph traversal — BFS walk with cycle detection, direction, and typed relations
   - ✅ CLI commands — oxori query, oxori walk, oxori graph

2. **Quick Start section** — Removed "(Phase 1)" header, added three new subsections after "Index your vault":
   - **Query your vault** — Three CLI examples (`oxori query` with various filters and flags)
   - **Walk the graph** — Three CLI examples (`oxori walk` with direction, via, depth options)
   - **View full graph** — Two CLI examples (`oxori graph` with and without --json)

3. **SDK Usage section** — Extended with Phase 2 API examples:
   - Query API: `tokenize`, `parse`, `evaluate` with full example
   - Walk API: `walk()` with direction, via, depth options
   - Shows accessing `queryResult.totalMatched` and `walkResult.visitOrder`

4. **Architecture section** — Removed future-tense Phase 2 language, updated to acknowledge Phase 2 as complete and ready for use.

**Standards applied:**
- Exact flag names from `src/cli.ts` (e.g., `--direction forward/backward`, `--via links`)
- Real examples derived from docs/query-language.md and CLI implementation
- Kept concise, developer-friendly tone matching existing README
- Maintained markdown formatting and hierarchy

**Status:** ✅ Complete. README.md updated with Phase 2 content.

### Phase 3 Documentation Updates (2026-04-04)

**Task:** Update README.md, docs/architecture.md, and RELEASES.md to document Phase 3 additions (Watcher and Governance).

**Changes made:**

1. **README.md**
   - Updated features list from v0.2.0 to v0.3.0
   - Updated capabilities: added "File watching (real-time vault change events)" and "Governance (policy rules via glob patterns)"
   - Restructured SDK Usage into four subsections:
     - Parse and Index (existing, kept as-is)
     - Query and Walk (reorganized from existing content)
     - **File Watcher** (new) — Complete code example showing `watch()` API with `on('change')` listener, event handling (type, filepath, timestamp), error handling, and `stop()` cleanup
     - **Governance** (new) — Complete code example showing `checkGovernance()` API with rule definition (id/description/pattern/effect/appliesTo), result checking, and violation iteration
   - Updated Architecture section description to reflect Phase 3 completeness ("Phase 1-3 gives you a solid foundation... enforce governance rules")

2. **docs/architecture.md**
   - Added new "## Phase 3 Additions" section (after System Layers, before Data Flow)
   - Summarizes Watcher layer:
     - EventEmitter-based, wraps Node.js fs.watch
     - Emits WatchEvent with type (add/change/unlink), filepath (absolute), timestamp (ms)
     - Optional, used in long-running processes (MCP server, agent interactions)
     - API: `watch(vaultPath, config?); watcher.on('change', handler); watcher.stop()`
   - Summarizes Governance layer:
     - Glob-pattern rule evaluation with id/pattern/effect/appliesTo
     - Rules evaluated in order, first match wins
     - Violations include ruleId, message, filePath, severity
     - **Crucial:** Humans never subject to governance — only agent writes checked
     - API: `checkGovernance(rules, state); if (!result.passed) { result.violations... }`
   - Emphasizes both are pure functions with no I/O or mutation, ready for Phase 5 MCP integration

3. **RELEASES.md**
   - Added **[Unreleased] — v0.3.0** section at top
   - Sections:
     - **Added** — New APIs (`watch()`, `checkGovernance()`), new types (VaultWatcher, WatchEvent, GovernanceRule, GovernanceViolation, GovernanceResult), SDK exports
     - **Changed** — README.md updates (features list, SDK Usage sections) and docs/architecture.md updates (Phase 3 Additions section)
     - **Documentation** — Key points on WatchEvent fields, governance enforcement scope, pure function design
   - Preserved all existing v0.1.0 content below

**API Accuracy Verified:**
- WatchEvent uses `filepath` (not `path`), types are `"add" | "change" | "unlink"` (not "create"/"modify"/"delete")
- GovernanceRule uses `pattern` (glob string), `effect: "allow" | "deny"`, `appliesTo: "agents" | "all"`
- All examples validated against src/watcher.ts and src/governance.ts source code
- VaultWatcher interface shows `on()` overloads for "change" (WatchEvent) and "error" (Error)

**Standards Applied:**
- README examples are complete, runnable code with proper error handling
- Architecture section clearly explains layer design decisions and integration points
- Release notes follow existing format with Added/Changed/Documentation sections
- All examples are derived from actual API signatures, not pseudo-code
- Maintained consistency with Phase 1 and 2 documentation tone and structure

**Files created/updated:**
- `.squad/decisions/inbox/dumont-phase3-docs.md` — Decision note explaining context and choices
- README.md — Updated version, features, capabilities, SDK Usage
- docs/architecture.md — Added Phase 3 Additions section
- RELEASES.md — Added v0.3.0 [Unreleased] entry at top

**Status:** ✅ Complete. Phase 3 documentation is ready for release and user consumption.
