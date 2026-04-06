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

## Work Completed

### Sprint 1 Documentation (2026-04-03)

**Delivered:**
1. **docs/architecture.md** — Comprehensive 1000+ line architecture document covering all 9 layers, 7 core principles, data flow, type system, error handling, build sprints, 7 ADRs, performance considerations, and "what NOT to do" section.

2. **README.md** — Updated with Sprint 1 features, quick-start guide, SDK usage, vault structure, index file explanations, and roadmap. Kept high-level; detailed docs in `docs/` folder.

3. **CONTRIBUTING.md** — Complete contributor guide with dev setup, running commands, code conventions (TypeScript, functions, comments, JSDoc), commit conventions (Conventional Commits with examples), testing guidelines (80%+ coverage), PR process, sprint gates, CI/CD pipeline, and getting help.

4. **RELEASES.md** — Detailed v0.1.0 release notes covering Parser module, Markdown Index, CLI commands, Type System, installation, quick start, SDK usage, architecture reference, breaking changes (none), known limitations, migration guide (N/A), Sprint 2 preview, and testing/CI details.

**Key Content:**
- Parser: YAML frontmatter, tags (with hierarchy), wikilinks (case-insensitive), typed relations, body content
- Markdown Index: Three index files (files.md, tags.md, links.md) — human-readable, git-friendly, regenerable
- CLI: `oxori init`, `oxori index` commands
- Type system: ParsedFile, FileEntry, TagEntry, LinkEntry, TypedRelation, IndexState, Result<T,E>, OxoriError
- Error handling: Result<T,E> for recoverable errors, throw for programmer errors, structured OxoriError with codes and actions
- Build sprints: Table showing all 5 sprints with focus, key modules, release versions
- Architecture decisions: 7 ADRs (No Database, Wikilinks Without Extension, Schemaless Frontmatter, Governance for Agents Only, Git Handles Concurrency, Typed Relations, Optional Semantic Search)

**Standards Applied:**
- Markdown-first: all examples are real or clearly marked pseudo-code
- Clear for future maintainers: detailed "why" behind each design choice
- Sprint gates: documented what "done" means for Sprint 1
- Release notes: comprehensive, including breaking changes (none), migration steps, and Sprint 2 preview

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

**Result:** Sprint 1 audit closed. `FrontmatterEntry` now clearly documented with consumer patterns for future developers.

### Sprint 2 Query Language Documentation (2026-04-04)

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

### Sprint 2 README Update (2026-04-04)

**Task:** Update `README.md` to reflect Sprint 2 completion — replace future-tense "🔜 Sprint 2" placeholders with actual completed features.

**Changes made:**

1. **Features section** — Updated version to v0.2.0, replaced placeholders:
   - ✅ Query engine — filter files by tag, type, path, frontmatter, title, link
   - ✅ Graph traversal — BFS walk with cycle detection, direction, and typed relations
   - ✅ CLI commands — oxori query, oxori walk, oxori graph

2. **Quick Start section** — Removed "(Sprint 1)" header, added three new subsections after "Index your vault":
   - **Query your vault** — Three CLI examples (`oxori query` with various filters and flags)
   - **Walk the graph** — Three CLI examples (`oxori walk` with direction, via, depth options)
   - **View full graph** — Two CLI examples (`oxori graph` with and without --json)

3. **SDK Usage section** — Extended with Sprint 2 API examples:
   - Query API: `tokenize`, `parse`, `evaluate` with full example
   - Walk API: `walk()` with direction, via, depth options
   - Shows accessing `queryResult.totalMatched` and `walkResult.visitOrder`

4. **Architecture section** — Removed future-tense Sprint 2 language, updated to acknowledge Sprint 2 as complete and ready for use.

**Standards applied:**
- Exact flag names from `src/cli.ts` (e.g., `--direction forward/backward`, `--via links`)
- Real examples derived from docs/query-language.md and CLI implementation
- Kept concise, developer-friendly tone matching existing README
- Maintained markdown formatting and hierarchy

**Status:** ✅ Complete. README.md updated with Sprint 2 content.

### Sprint 3 Documentation Updates (2026-04-04)

**Task:** Update README.md, docs/architecture.md, and RELEASES.md to document Sprint 3 additions (Watcher and Governance).

**Changes made:**

1. **README.md**
   - Updated features list from v0.2.0 to v0.3.0
   - Updated capabilities: added "File watching (real-time vault change events)" and "Governance (policy rules via glob patterns)"
   - Restructured SDK Usage into four subsections:
     - Parse and Index (existing, kept as-is)
     - Query and Walk (reorganized from existing content)
     - **File Watcher** (new) — Complete code example showing `watch()` API with `on('change')` listener, event handling (type, filepath, timestamp), error handling, and `stop()` cleanup
     - **Governance** (new) — Complete code example showing `checkGovernance()` API with rule definition (id/description/pattern/effect/appliesTo), result checking, and violation iteration
   - Updated Architecture section description to reflect Sprint 3 completeness ("Sprint 1-3 gives you a solid foundation... enforce governance rules")

2. **docs/architecture.md**
   - Added new "## Sprint 3 Additions" section (after System Layers, before Data Flow)
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
   - Emphasizes both are pure functions with no I/O or mutation, ready for Sprint 5 MCP integration

3. **RELEASES.md**
   - Added **[Unreleased] — v0.3.0** section at top
   - Sections:
     - **Added** — New APIs (`watch()`, `checkGovernance()`), new types (VaultWatcher, WatchEvent, GovernanceRule, GovernanceViolation, GovernanceResult), SDK exports
     - **Changed** — README.md updates (features list, SDK Usage sections) and docs/architecture.md updates (Sprint 3 Additions section)
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
- Maintained consistency with Sprint 1 and 2 documentation tone and structure

**Files created/updated:**
- `.squad/decisions/inbox/dumont-phase3-docs.md` — Decision note explaining context and choices
- README.md — Updated version, features, capabilities, SDK Usage
- docs/architecture.md — Added Sprint 3 Additions section
- RELEASES.md — Added v0.3.0 [Unreleased] entry at top

**Status:** ✅ Complete. Sprint 3 documentation is ready for release and user consumption.

### README and Docs Cleanup — Removal of Sprints, Roadmap, and Team References (2026-04-05)

**Task:** Clean up README.md, docs/architecture.md, and CONTRIBUTING.md to remove all future-tense language, sprint references, roadmap mentions, and internal team/squad references. Documentation should reflect current state only.

**User directive:**
- README should ONLY explain what the project is, how to install it, how to use it
- No future plans, sprints, roadmap, squad/team references
- All code and docs in English
- This is a TypeScript library + CLI named "oxori"

**Changes made:**

1. **README.md**
   - Removed "Features (v0.3.0 — Sprint 1, 2, & 3)" header, changed to just "## Features"
   - Removed 🔜 "Semantic search" (Sprint 4) and "MCP server" (Sprint 5) lines — keep only completed features
   - Removed "vectors/" reference and "(Sprint 4)" comment from vault structure diagram
   - Removed "(Sprint 3)" comment from governance.md reference
   - Rewrote Architecture section overview paragraph:
     - Removed all sprint references ("Sprint 2 adds...", "Sprint 3 adds...", "Sprints 4-5 will...")
     - Condensed to current-state description of query engine, graph traversal, watcher, governance
     - Added clear reference to docs/architecture.md for complete design
   - Maintained version badge (v0.3.0), installation instructions, CLI usage examples, SDK examples
   - Kept all functional features, governance rules, and contributing section

2. **docs/architecture.md**
   - Updated Overview section:
     - Removed "Oxori is built in five distinct sprints..." and "By Sprint 5, the system provides..."
     - Replaced with current-state description: "Oxori provides a layered architecture: parsing and indexing form the foundation, followed by query filtering, graph traversal, semantic search, governance rules, write operations, and real-time file watching."
   - Renamed and rewrote "## Sprint 3 Additions" section to "## Key Capabilities"
     - Removed "Sprint 3 introduces two critical capabilities that complete the core Oxori platform"
     - Changed intro to "Oxori provides the following key capabilities"
     - Removed "and are ready for Sprint 5's MCP server and agent orchestration" from watcher/governance summary
   - Updated data flow section headers:
     - Changed "### Indexing (Sprint 1)" → "### Indexing"
     - Changed "### Querying (Sprint 2)" → "### Querying"
     - Changed "### Graph Traversal (Sprint 2)" → "### Graph Traversal"
     - Changed "### Writing (Sprint 3)" → "### Writing"
     - Changed "### Semantic Search (Sprint 4)" → "### Semantic Search"
     - Changed "### MCP Server (Sprint 5)" → "### MCP Server"
   - Kept all technical content, design decisions, and implementation details

3. **CONTRIBUTING.md**
   - Updated opening paragraph:
     - Removed "Oxori is built by a team of specialists working in sprints. Each sprint is a complete, shippable npm release..."
     - Replaced with "Oxori is an open-source project developed in short-lived feature branches integrated back to main frequently. Each contribution is tested, documented, and reviewed before merge."
   - Updated "## Creating a Pull Request" section:
     - Removed "create a branch... use kebab-case:" → added "use kebab-case from `main`:"
     - Added new item: "**Keep it short-lived** — branch should exist for days, not weeks. Integrate to main frequently."
     - Changed review line from "Wait for review — Flynn (architecture) reviews all Sprint PRs before merge" to "Wait for review — maintainers review all PRs before merge"
   - Replaced entire "## Sprints and Releases" section with "## Releases and Versioning"
     - Removed Sprint table (1-5 with scope/release/status)
     - Removed "Sprint Process" (7 step workflow tied to sprints)
     - Removed "Sprint Gates" (tests/coverage/architecture review tied to sprints)
     - Replaced with cleaner structure:
       - **Version Bumping** — How commit types trigger version bumps (feat/fix/breaking changes)
       - **Release Process** — What happens when PRs merge to main (automated via semantic-release)
   - Updated "## CI/CD Pipeline" section name from "### Release Pipeline" to "### Automatic Releases"
   - Kept all development setup, code conventions, commit types, testing guidelines, and technical standards

**Inconsistencies found and fixed:**
- architecture.md still referenced Sprint 3 capabilities in section header (fixed)
- README referenced Sprint numbers for future features (removed)
- CONTRIBUTING.md listed 5 sprints as "planned" when only Sprint 1-3 are complete (removed entire sprint table)
- Internal team name "Flynn" appeared in review process (generalized to "maintainers")

**Files modified:**
- README.md — 11 lines changed (removed future features, sprint references, simplified architecture overview)
- docs/architecture.md — 22 lines changed (removed sprint language, updated section headers, current-state descriptions)
- CONTRIBUTING.md — 60 lines changed (removed sprint workflow, added trunk-based branch guidance, generalized review process)

**Standards applied:**
- All removed content was future-tense or internal process (no functional code affected)
- Maintained technical accuracy and depth
- Kept all completed features, real examples, and API references
- Followed user directive strictly: current state only, no roadmap, no team references
- Tone remains professional and developer-focused

**Status:** ✅ Complete. All documentation reflects current-state Oxori only. Ready for feature branch pre-phase4-cleanup.

---

## 2025-04-04: Remove CONTRIBUTING.md Entirely

**Task:** Per user directive D10, remove CONTRIBUTING.md file and all references from project documentation.

**Actions taken:**
1. Deleted CONTRIBUTING.md from root
2. Removed "## Contributing" section from README.md
3. Removed reference to CONTRIBUTING.md in README section (line 308)
4. Removed CONTRIBUTING.md from PROJECT.md file tree listing
5. Removed CONTRIBUTING.md from docs/architecture.md file tree listing
6. Confirmed no package.json "contributing" field

**Files modified:**
- CONTRIBUTING.md — deleted
- README.md — removed Contributing section + reference link
- PROJECT.md — removed CONTRIBUTING.md from file tree
- docs/architecture.md — removed CONTRIBUTING.md from file tree

**Commit:** `76853b8` — "chore: remove CONTRIBUTING.md and all references"

**Status:** ✅ Complete. All references cleaned. Pushed to feature/pre-phase4-cleanup.
