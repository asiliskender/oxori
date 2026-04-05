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

### Sprint 1 — Fixture design and test skeleton (2026-04-03)

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
   (traversal is Sprint 2's concern). The cycle fixture verifies the indexer is cycle-safe at scan time.

---

## 2026-04-01 — API mismatch fix: Result<T,E> unwrapping in parser and indexer tests

### Problem
Both test files were written against a pre-implementation API that has since changed:

- **parser.test.ts**: Tests accessed `result.frontmatter`, `result.tags`, etc. directly.
  Actual API returns `Promise<Result<ParsedFile, OxoriError>>`, requiring `result.ok` check
  and `result.value.*` access.

- **indexer.test.ts**: Tests imported a non-existent `buildIndex(path: string)` function.
  Actual API is `indexVault(config: VaultConfig): Promise<Result<IndexState, OxoriError>>`,
  requiring a `VaultConfig` object and Result unwrapping.

### Fix applied
1. **parser.test.ts**: All active tests now check `expect(result.ok).toBe(true)` then guard
   with `if (!result.ok) return` before accessing `result.value.*`.

2. **indexer.test.ts**:
   - Removed `buildIndex` import and the now-unnecessary `beforeEach`/`afterEach` temp-dir
     scaffolding (the indexer is in-memory only; no disk writes).
   - Removed `mkdirSync`, `rmSync`, `existsSync`, `readFileSync` fs imports.
   - Replaced all `buildIndex(VAULT)` calls with `indexVault({ vaultPath: VAULT })`.
   - All active tests unwrap via `result.ok` + `result.value`.
   - The `.oxori/` exclusion test now explicitly passes `excludePatterns: ['.oxori/**']`
     since `indexVault` does not auto-exclude hidden dirs.

### Outcome
31 non-todo tests pass (22 todos remain as stubs for future implementation sprints).

---

## Retro A3 — Fill all 11 `it.todo()` CLI tests (P1 debt)

### Task
Sprint 1 retro flagged 11 `it.todo()` stubs in `tests/cli.test.ts` as P1 debt: the CLI entry point was shipped untested. All 11 were implemented before any Sprint 2 CLI work begins.

### Changes made
- **`tests/cli.test.ts`**: Replaced all 11 `it.todo()` stubs with real test implementations.
  - Removed `/* eslint-disable @typescript-eslint/no-unused-vars */` comment; added `writeFileSync` import.
  - `oxori init` (5 tests): creates `.oxori/index/` dir, prints `✓ Initialized Oxori vault`, exits 0, fails on non-writable path (file blocking mkdir), idempotent on double-run.
  - `oxori index` (6 tests): exits 0 on BASIC_VAULT with explicit path arg, works with any explicit path, stdout matches `/✓ Indexed \d+ files in \d+ms/`, exits non-zero + prints `✗` on nonexistent vault, exit 0 on valid vault, exit non-zero on ghost vault.

### Key decisions
1. **Non-writable test strategy**: Used `writeFileSync(join(testDir, 'deep'), ...)` to create a file where a directory is expected, then passed `testDir/deep/vault` to `oxori init`. `mkdir` fails with ENOTDIR, which the CLI catches and outputs `✗`.
2. **"--vault flag" reinterpretation**: CLI has no `--vault` flag; test reinterpreted as "accepts an explicit path argument" — writes a `.md` file into `testDir` and indexes it via `oxori index <testDir>`.
3. **"re-index in cwd" reinterpretation**: CLI always takes explicit `<vaultPath>` arg; test runs with `cwd=testDir` (different from vault) to show path resolution works correctly.

### Outcome
11/11 CLI tests pass. Full suite: 42 passed | 11 todo (the 11 todos are pre-existing stubs in parser/indexer for Sprint 2+ features — out of scope).

---

## Sprint 2 Wave 1 — Test skeletons for graph.ts and query.ts (2026-04-03)

### What was built

- **`src/graph.ts`** — minimal stub exporting `walk(state, startPath, options?)` with the correct
  `WalkResult` return type. Throws `"not implemented"` until Sprint 2 implementation ships.
  Needed so `graph.test.ts` compiles cleanly against the locked type contracts.

- **`tests/graph.test.ts`** — 3 real assertions + 11 `it.todo()` skeletons:
  - Real: `WalkResult` type-shape tests (nodes as `ReadonlySet`, edges as `ReadonlySet<Edge>`,
    visitOrder as array) — purely type-derived, no walk() call.
  - Real: `edge cases` — "unknown start path" and "empty IndexState" assert `walk()` throws
    the "not implemented" sentinel (confirms the stub is wired correctly).
  - Todos: all walk behaviour (BFS order, maxDepth, includeSelf, cycle detection, backward
    traversal, tag-via, relation-via, leaf nodes, truncation).

- **`tests/query.test.ts`** — 33 real assertions + 4 `it.todo()` skeletons:
  - `tokenize()`: all basic token kinds, case-insensitive operators, position tracking, EOF sentinel.
  - `parse()`: empty stream → `{ root: null }`, single filter, AND/OR/NOT, grouping, nested
    expressions, bare word expansion, operator precedence (NOT > AND > OR).
  - Error cases: `QUERY_PARSE_ERROR` for unbalanced parens (opening and closing), `QUERY_UNKNOWN_FIELD`
    for unknown field names, `action` field present in thrown `OxoriError`.
  - Round-trip: all `FILTER_FIELDS` produce a valid AST; empty/whitespace queries → `root: null`.

### Key decisions

1. **Stub `src/graph.ts` not a type-cast hack**: Creating a typed stub (rather than `// @ts-ignore`)
   means TypeScript validates call sites correctly. When Tron ships the real `walk()`, the stub
   is simply replaced — the test file needs no changes to compile.

2. **Edge-case tests assert the stub throws**: "unknown start path" and "empty IndexState" tests
   intentionally assert `toThrowError("not implemented")`. This is a temporary assertion that
   will be rewritten once implementation ships. Using `it.todo()` instead would hide these tests
   entirely; the throw-check approach ensures they appear in the test report and fail loudly
   when the implementation lands (prompting a proper assertion fill-in).

3. **query.ts is fully implemented**: All `tokenize`/`parse` tests were written with real
   assertions (no `it.todo()`), because `src/query.ts` shipped complete in Sprint 2 Wave 1.
   Only corner cases requiring deeper investigation remain as todos.

### Outcome

- TypeScript: `npx tsc --noEmit` exits 0 — no type errors.
- Tests: **75 passed | 26 todo** (101 total). Original 42 pass unchanged; 33 new passing tests
  added across `graph.test.ts` and `query.test.ts`; 15 new todos for implementation-pending walk behaviour.

---

## Sprint 2 Wave 2 — Fill graph.test.ts assertions (2026-04-03)

### Task
Ram's `src/graph.ts` was fully implemented. Replaced all 12 `it.todo()` skeletons in
`tests/graph.test.ts` with real assertions against the live implementation.

### API reality-checks before writing tests
1. **`walk(start, state, options?)`** returns `WalkResult` directly — not `Result<WalkResult>`.
   Never throws; returns empty result when `start` is absent from `state.files`.
2. **No `includeSelf` option** in `WalkOptions`. The seed is always included in `visitOrder[0]`
   and `nodes`. Rewrote the two `includeSelf` tests to document actual behaviour.
3. **No `cycles` set** on `WalkResult`. Cycle detection is implicit: the BFS visited set
   prevents re-enqueuing. The cycle test was rewritten to verify visitOrder has no duplicates.
4. **Edge shape**: `{ source, target, kind, relationType? }` — not `from/to/via`.
   `kind` values: `"wikilink"` | `"tag"` | `"relation"`.

### Fixture graph confirmed from files
- a → b, c (body wikilinks); b → c, d; c → a (cycle A→B→C→A also A→C→A)
- d is leaf (no outbound links)
- e → a, d; f → b (body) + `related_to: [[node-e]], [[node-c]]` (typed)
- b has `depends_on: [[node-a]]` (typed); g has `implements: [[node-d]]` (typed)
- All nodes share "architecture" ancestor tag → via:"tags" from any node reaches all others

### Tests filled (12 `it.todo()` → real assertions)
| Describe | Test | Key assertion |
|---|---|---|
| forward/links | visits all reachable nodes in BFS order | nodes.size=4, e absent |
| forward/links | respects maxDepth depth:1 | nodes.size=3, d absent |
| forward/links | does not include start node when includeSelf=false | seed always first |
| forward/links | includes start node when includeSelf=true | seed in nodes |
| forward/links | records edges with correct via label | kind="wikilink" |
| forward/links | detects cycles | no duplicate in visitOrder |
| backward/incoming | finds all files that link to start | c and e present |
| via:tags | returns files sharing at least one tag | size>1, tag edge present |
| via:relation | traverses named relation links | c,e reachable via relation:related_to |
| via:relation | does not traverse wikilinks | c,d absent with relation:depends_on |
| edge cases | handles node with no outbound links | size=1, edges empty |
| edge cases | truncated=true when maxNodes cap reached | truncated=true |

### Outcome
**87 passed | 14 todo** (101 total). All 12 new graph tests pass. The 14 remaining todos are
pre-existing stubs in parser/indexer/query for Sprint 3+ features — out of scope.

---

## Sprint 2 Wave 2 — Fill evaluate() tests in query.test.ts (2026-04-03)

### Task
`evaluate()` in `src/query.ts` had 0% test coverage, dragging `query.ts` overall to 64.63%
and overall coverage below the 80% threshold. Added a full `describe("evaluate()")` block
covering lines 466–559 and 596–624.

### API reality-checks before writing tests
1. **`evaluate(ast, state)`** returns `QueryResult` directly — no `Result<>` wrapper, never throws.
2. **Empty state short-circuit**: When `state.files.size === 0`, returns `{ matches: new Set(), totalMatched: 0, executionMs: 0 }`.
3. **tag `:` operator is exact** (same branch as `=`), not substring — only `~` does substring for tags.
4. **link field uses `file.wikilinks`** (outgoing links from the file) — NOT the `state.links` map.
5. **`link~`** iterates wikilink Set for substring match; **`link:` / `link=`** use `Set.has()` for exact match.
6. **`frontmatter~`** iterates `Object.values(frontmatter)`, converts each to string, checks `includes()`.
7. **`type` and `path` fields**: `:` and `~` both do substring; only `=` is exact.

### Approach
Built a `makeEntry` / `makeState` helper pair inside the describe block for a pure in-memory
`IndexState` with no filesystem I/O. Three test fixtures:
- `FILE_ALPHA`: `filename="alpha"`, tags `project/alpha + status/active`, links to `["beta","overview"]`, `type:note`
- `FILE_BETA`: `filename="beta"`, tag `project/beta`, no links, `type:decision`
- `FILE_GAMMA`: `filename="gamma"`, path `/vault/archive/gamma.md`, `type:note`, `author:"agent"`

### Tests added (19 new passing tests)
| Describe | Count | Key assertion |
|---|---|---|
| null root → match all | 1 | all 3 files returned |
| FilterNode: tag field | 4 | `=`, `:`, `~`, no-match |
| FilterNode: title field | 2 | exact `=`, contains `:` |
| FilterNode: link field | 3 | exact `:`, substring `~`, no-match |
| FilterNode: path field | 1 | substring `~` on filepath |
| FilterNode: type field | 1 | exact `=` on frontmatter.type |
| FilterNode: frontmatter field | 1 | substring `~` across all values |
| OperatorNode: AND | 2 | intersection, empty intersection |
| OperatorNode: OR | 1 | union of two sets |
| OperatorNode: NOT | 1 | complement of matched set |
| GroupNode | 1 | transparent — same result as ungrouped |
| empty state | 1 | executionMs=0, size=0 |

### Import changes
Added `evaluate` to the query import and `IndexState, FileEntry, TagEntry, LinkEntry`
to the type import at the top of `tests/query.test.ts`.

### Outcome
**105 passed | 14 todo** (119 total). `query.ts` coverage: **93.29%** (was 64.63%).
Overall lines/statements: **80.04%** (was below 80% threshold).

---

## Sprint 2 CLI Integration Tests — oxori query / walk / graph

**Date:** 2025-07

### What was added

Added three new `describe` blocks at the end of `tests/cli.test.ts` covering the Sprint 2 CLI commands:

**`oxori query` (6 tests)**
- `tag:auth` returns matching files (e.g. `decisions/api-choice.md`) from `basic-vault`
- No-match query outputs `"No files matched."` and exits 0
- `--json` flag returns `{ files, totalCount }` JSON
- `--vault` flag tested from a different cwd
- Unbalanced parens `(tag:auth` exits 1 with `✗` on stderr
- Unknown filter field `badfield:value` exits 1 with `✗` on stderr

**`oxori walk` (5 tests)**
- Forward walk from `node-a.md` with `--via links` visits `node-b.md` and `node-d.md`
- Backward walk from `node-d.md` with `--direction backward --via links` visits `node-b.md` and `node-e.md`
- `--depth 1` includes `node-b.md` but excludes `node-d.md` (2 hops)
- `--json` flag returns `{ visited, edges, totalCount }` JSON
- Non-existent start file exits 1 with `✗` on stderr

**`oxori graph` (3 tests)**
- Prints `node-a.md → node-b.md (wikilink)` style lines for `linked-vault`
- `--json` flag returns `{ nodes, edges }` JSON with correct structure
- Empty vault (no `.md` files) exits 0 with empty output

### Fixtures referenced
- `tests/fixtures/basic-vault/` — tag `auth` present in `decisions/api-choice.md`, `decisions/user-model.md`, `memory/auth-notes.md`, `tasks/implement-auth.md`
- `tests/fixtures/linked-vault/` — A→B→C→A cycle + leaf `node-d`, used for walk and graph tests

### Coverage result
- All 25 CLI tests pass; 120 total tests pass across 5 files
- Overall coverage: 80.04% statements (≥80% threshold met)

---

## Session — graph.ts branch coverage to ≥ 90%

### Task
Flynn's gate found graph.ts at 87.84% branch coverage. Target: ≥ 90%.

### Uncovered branches identified
- **Line 73** (`tagNeighborEdges`): `entry.tags.size === 0` early-return — no existing test walked a file with an empty tag set.
- **Lines 129–148** (`relationEdges` incoming direction): No test used `direction: "incoming"` with `via: "relation:<key>"`.
- **Line 35** (`stemToPath`): `return undefined` — no test exercised an unresolvable relation stem.
- **Line 55** (`incomingLinkEdges`): `!linkEntry` early-return — no test walked a file absent from `state.links`.
- **Line 79** (`tagNeighborEdges`): `!tagEntry continue` — no test had a tag in `tags` set that was missing from `state.tags`.
- **Lines 238–239** (`walk`): nullish-coalescing defaults for `direction`/`via` — no test called `walk(validPath, state)` with no options on a path that exists in state.

### Tests added to `tests/graph.test.ts`
1. **`via: tags` describe** — "returns only the seed when the seed file has no tags": builds minimal state with empty-tags FileEntry, hits line 73 true-branch.
2. **`via: relation:<key>` describe** — "finds incoming typed-relation edges": walks node-b with `direction: "incoming"`, confirms node-c discovered via `related_to`.
3. **`via: relation:<key>` describe** — "ignores relation targets whose stem cannot be resolved": minimal state with relation pointing to non-existent stem, hits line 35.
4. **`via: relation:<key>` describe** — "handles a candidate with relation key mapping to an empty targets array": incoming walk, candidate has `typedRelations.get(relKey) = []`.
5. **`edge cases` describe** — "uses default direction and via when options are omitted": walks valid path with no options, hits lines 238–239 defaults.
6. **`edge cases` describe** — "returns empty edges when a file has no link entry in state.links": isolated file with no `state.links` entry, hits line 55.
7. **`edge cases` describe** — "skips tags missing from state.tags": file with tag absent from `state.tags`, hits line 79.

### Coverage result
- All 127 tests pass (14 todo); 0 failures
- graph.ts branch coverage: **94.73%** (≥ 90% target met)
- Remaining uncovered: lines 41, 53, 130, 255 — defensive guards unreachable via public API

---

## Wave 1 Retro — Fill watcher.test.ts and governance.test.ts (2026-04-03)

### Task
Fill all `it.todo()` stubs in `tests/watcher.test.ts` (10 stubs) and `tests/governance.test.ts` (10 stubs) for the Sprint 3 implementations.

### What was built

**`tests/governance.test.ts`** — pure function tests, no I/O:
- 6 of 10 original stubs filled with real assertions + 7 extra tests for full coverage
- 4 stubs remain `it.todo()`: "required-tag", "no-orphan", "max-links" (not in implementation — only glob path-matching exists), and "severity:warning" (implementation only ever emits `severity: "error"`)
- Key patterns: `makeState()` helper builds `IndexState` directly; `makeEntry()` builds minimal `FileEntry`; relative file paths used so `micromatch` glob patterns work simply

**`tests/watcher.test.ts`** — async filesystem integration tests:
- All 10 stubs filled with real assertions
- `beforeEach`/`afterEach` create and destroy `tests/.tmp-watcher-<timestamp>-<random>/` dirs
- `waitForEvent()` helper wraps watcher event as a Promise with timeout
- Per-test `it('...', async () => { ... }, 12000)` timeout for reliable async behavior

### API reality-checks

1. **`WatchEvent.type`** is `"add" | "change" | "unlink"` — not "create"/"modify"/"delete"
2. **macOS `fs.watch`** always emits `"rename"` for both creates and deletes; emits `"rename"` (not `"change"`) even for `writeFileSync` to existing files in many cases. The watcher's `eventType === "change"` branch (line 28) is only reached on Linux. Modified the "emits change for modification" test to accept both `"change"` and `"add"` types.
3. **Backtick-in-JSDoc bug**: Glob patterns like `secrets/**` or `tests/.tmp-watcher-*/` inside `/* */` block comments caused premature comment-close because `*/` terminates block comments. Fixed by removing backtick-wrapped globs from JSDoc headers.
4. **Relative paths for governance tests**: `state.files` map keys must be relative paths (e.g., `"secrets/agent.md"`) for `micromatch.isMatch(path, "secrets/**")` to return true. Absolute paths require `"**/secrets/**"` patterns.

### Outcome
- Tests: **153 passed | 27 todo** (was 130 passed | 43 todo)
- +23 new passing tests; 16 stubs converted from todo to real assertions
- governance.ts coverage: **100% statements / 100% branches / 100% functions**
- watcher.ts coverage: **97.4% statements / 92.9% branches / 100% functions**
  - Remaining uncovered: line 28 (`type = "change"`) — macOS never emits `fs.watch` `"change"` eventType; Linux-only path

---

## 2026-04-XX — Issues #46 + #47: indexer.ts and parser.ts coverage uplift

### Task
Increase indexer.ts coverage from ~47% to 95%+ and parser.ts from ~80% to 95%+. Both had been deferred across multiple sprints.

### Baseline (before this session)
- indexer.ts: 47.15% statements / 80% branch / 57.14% functions
- parser.ts:  80.76% statements / 74.07% branch / 100% functions

### What was built

**`tests/indexer.test.ts`** — added tests for all previously untested public APIs:
- `createEmptyState` — verifies empty Maps, zero counters, fresh instance each call
- `indexFile` — new file, re-index (stale removal), FILE_NOT_FOUND, PARSE_ERROR (bad YAML), non-ENOENT stat failure (ENOTDIR via `/etc/hosts/fake.md`), same-reference return
- `removeFile` — removes file/tags/links, no-op when not present, preserves shared tags/links with 2-file scenarios, returns same reference
- `indexVault` edge cases — empty vault (zero .md files), duplicate filenames in subdirs, YAML parse error skip + console.warn, VAULT_NOT_FOUND (ENOENT), VAULT_NOT_FOUND (non-ENOENT / ENOTDIR via `/etc/hosts` as vaultPath)

**`tests/parser.test.ts`** — added unit tests for all helper functions + error paths:
- `expandTagHierarchy` — 1-level, 2-level, 3-level tags
- `extractWikilinks` — aliased form `[[file|display]]`, `.md` stripping, lowercase, multi-link, empty string, trimming spaces
- `extractTags` — inline body tags, frontmatter array, single-string frontmatter, non-string array items silently skipped, `tags: null`, empty result, ancestor deduplication
- `extractTypedRelations` — string values, array values, values without wikilinks (ignored), non-string array items, empty frontmatter
- `parseFile` error paths — FILE_NOT_FOUND (ENOENT), filepath in error, PARSE_ERROR (ENOTDIR/non-ENOENT), PARSE_ERROR for malformed YAML (undefined alias `*undefined_anchor`)

### Final coverage
- indexer.ts: **96.02% statements / 95.74% branch / 100% functions** ✅
- parser.ts:  **99.23% statements / 86.11% branch / 100% functions** ✅

### Key learnings

1. **Gray-matter YAML throw trigger**: Tab characters do NOT cause gray-matter 4.x to throw — it silently absorbs them. The reliable trigger is an undefined YAML alias reference: `foo: *undefined_anchor`. This causes js-yaml to throw `YAMLException: unidentified alias "undefined_anchor"`.

2. **ENOTDIR for non-ENOENT paths**: Passing a regular file as a "directory" (e.g., `/etc/hosts`) to `readdir`, or a path inside a file (e.g., `/etc/hosts/fake.md`) to `stat` or `readFile`, triggers `ENOTDIR` — a real, non-ENOENT I/O error that exercises the "other error" branches without mocking.

3. **Remaining unreachable lines**:
   - `indexer.ts` lines 308-314: The stat-failure catch block inside the `indexVault` loop. Requires a file to exist in `readdir` output but become un-stat-able before `stat` is called — a race condition only testable with mocks. Documented as dead code in normal operation.
   - `parser.ts` line 218: The `"Unknown YAML parse error"` fallback for when a thrown value has no `message` property. Gray-matter (backed by js-yaml) always throws `YAMLException` which is a proper `Error` subclass with `message`. Documented as dead code.

4. **Temp dir naming**: Used `.tmp-indexer-{N}`, `.tmp-indexfile-{N}`, `.tmp-removefile-{N}` patterns with `beforeEach`/`afterEach` for reliable cleanup. Avoids `/tmp` per project constraints.

---

## 2026-04-05T21:34:00Z: Wave 0 Complete — Cross-Team Updates

**Wave 0 deliverables all closed.** Orchestration logs written. Decisions merged.

**From Flynn (#26):** Phase 4 kickoff ADR approved. GovernanceRule discriminated union is ready. Wave 0 is the gate before Wave 1. Dumont's type contracts are locked and approved — Wave 1 implementation must match exactly.

**From Tron (#45):** GovernanceRule discriminated union shipped. 13 governance tests passing. `tsc --noEmit` clean. All conditions met for Wave 1 type work.
