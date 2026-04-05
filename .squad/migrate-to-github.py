#!/usr/bin/env python3
"""Migrate .squad/backlog.md issues to GitHub Issues + Projects v2"""

import json
import subprocess
import time

TOKEN = subprocess.check_output(
    "grep GITHUB_TOKEN /Users/onurasiliskender/Git/github-personal/oxori/.local/secrets.env | cut -d= -f2",
    shell=True
).decode().strip()

REPO = "asiliskender/oxori"
PROJECT_ID = "PVT_kwHOAZ1hac4BTybA"
STATUS_FIELD_ID = "PVTSSF_lAHOAZ1hac4BTybAzhA-6sE"
STATUS_TODO = "f75ad846"
STATUS_DONE = "98236657"

def api_call(method, url, data=None):
    cmd = ["curl", "-s", "-X", method, url,
           "-H", f"Authorization: Bearer {TOKEN}",
           "-H", "Accept: application/vnd.github+json",
           "-H", "Content-Type: application/json"]
    if data:
        cmd += ["-d", json.dumps(data)]
    result = subprocess.check_output(cmd)
    return json.loads(result)

def graphql(query):
    cmd = ["curl", "-s", "-X", "POST", "https://api.github.com/graphql",
           "-H", f"Authorization: Bearer {TOKEN}",
           "-H", "Content-Type: application/json",
           "-d", json.dumps({"query": query})]
    result = subprocess.check_output(cmd)
    return json.loads(result)

def create_issue(title, body, labels):
    return api_call("POST", f"https://api.github.com/repos/{REPO}/issues",
                    {"title": title, "body": body, "labels": labels})

def add_to_project(node_id):
    q = f'mutation {{ addProjectV2ItemById(input: {{ projectId: "{PROJECT_ID}", contentId: "{node_id}" }}) {{ item {{ id }} }} }}'
    return graphql(q)

def set_status(item_id, status_option_id):
    q = f'mutation {{ updateProjectV2ItemFieldValue(input: {{ projectId: "{PROJECT_ID}", itemId: "{item_id}", fieldId: "{STATUS_FIELD_ID}", value: {{ singleSelectOptionId: "{status_option_id}" }} }}) {{ projectV2Item {{ id }} }} }}'
    return graphql(q)

ISSUES = [
    # ── PHASE 1 ── Done (v0.1.0 shipped)
    {
        "title": "Phase 1 Kickoff — Parser + Markdown Index",
        "labels": ["phase-1", "gate"],
        "phase": 1,
        "body": """## Context
Phase 1 is the foundation. We're building the parser and markdown index subsystem. This is the gate issue: Flynn reviews all Phase 1 PRs and approves for merge to main only when all acceptance criteria pass.

## Acceptance Criteria
- [ ] All Phase 1 issues completed and PR-linked
- [ ] All tests passing (pnpm test -- --coverage)
- [ ] Coverage >= 80% (parser and indexer >= 95%)
- [ ] types.ts reviewed and no `any` types
- [ ] parser.ts handles edge cases: missing frontmatter, malformed YAML, empty files
- [ ] indexer.ts builds index files correctly under .oxori/index/
- [ ] cli.ts `oxori init` and `oxori index` commands working end-to-end
- [ ] CI pipeline green (lint, typecheck, test, coverage on Node 20+22)
- [ ] README.md updated with Phase 1 API docs
- [ ] Architecture docs complete in docs/architecture.md

## Notes
Phase 1 gates Phase 2. Don't merge to main until this is production-ready. Each PR should link to the Phase 1 gate issue. After approval, tag as v0.1.0 and publish to npm.

---
*Migrated from .squad/backlog.md — Phase 1 (✅ COMPLETE v0.1.0)*"""
    },
    {
        "title": "Define core types for parser and index",
        "labels": ["phase-1"],
        "phase": 1,
        "body": """## Context
Types are the first thing we build. Parser, indexer, and query engine all depend on these type definitions. Define the shape of parsed files, tag entries, link entries, and all frontmatter-related types.

## Acceptance Criteria
- [ ] types.ts exports: ParsedFile, FileEntry, TagEntry, LinkEntry, FrontmatterEntry, TypedRelation
- [ ] ParsedFile includes: filepath, filename, frontmatter (schemaless object), tags (Set<string>), wikilinks (Set<string>), typedRelations (Map<string, string[]>), body (string)
- [ ] No `any` types — use strict TypeScript
- [ ] Named exports only, no defaults
- [ ] All types use `type` keyword (not `interface` for structural types)
- [ ] Types are documented with JSDoc comments explaining usage
- [ ] types.ts has zero dependencies on other src/ modules

## Notes
Reference PROJECT.md conventions. Keep types focused on what the parser outputs, not what the CLI needs yet. The index cache and query AST types come in Phase 2.

---
*Migrated from .squad/backlog.md — Phase 1 (✅ COMPLETE v0.1.0)*"""
    },
    {
        "title": "Parse markdown files into ParsedFile objects",
        "labels": ["phase-1"],
        "phase": 1,
        "body": """## Context
Parser reads a single .md file and extracts structure: frontmatter (YAML), tags (#tag, #project/auth hierarchy), wikilinks ([[link]] without extension), typed relations (keys in frontmatter that reference files), and body text.

## Acceptance Criteria
- [ ] parser.ts exports: parseFile(filePath: string): Promise<ParsedFile>
- [ ] Extracts frontmatter using gray-matter, leaves body intact
- [ ] Finds all #hashtags including hierarchical ones (#project/auth/oauth creates entries at #project, #project/auth, #project/auth/oauth)
- [ ] Finds all [[wikilinks]], stores only filename stem (no extension)
- [ ] Identifies typed relations: any frontmatter key with value [[file]] becomes a TypedRelation
- [ ] Handles edge cases: missing frontmatter (returns empty object), malformed YAML (throws descriptive error), missing files (returns error), empty files (returns valid ParsedFile with empty tags/links)
- [ ] Wikilink matching is case-insensitive per PROJECT.md
- [ ] Uses path.resolve() to normalize all file paths
- [ ] parseFile throws Error with action suggestion if file doesn't exist

## Notes
Test with fixtures/ vaults. Don't assume file encoding. Use fs.readFile with utf8. Parser should be pure-ish — given a filepath, return ParsedFile. No side effects.

---
*Migrated from .squad/backlog.md — Phase 1 (✅ COMPLETE v0.1.0)*"""
    },
    {
        "title": "Build in-memory index and write .oxori/index markdown files",
        "labels": ["phase-1"],
        "phase": 1,
        "body": """## Context
Indexer scans a vault directory, parses all .md files, builds in-memory Maps/Sets for fast lookup, and writes three derived markdown files: files.md (catalog of all files), tags.md (tag->files index), links.md (link->files index).

## Acceptance Criteria
- [ ] indexer.ts exports: buildIndex(vaultPath: string): Promise<IndexCache>
- [ ] Recursively scans vaultPath for all .md files
- [ ] Returns IndexCache: { files: Map<string, ParsedFile>, tags: Map<string, Set<string>>, links: Map<string, Set<string>> }
- [ ] Creates .oxori/index/ directory if not present
- [ ] Writes files.md: markdown table with columns [filename, frontmatter keys, tags, wikilinks count]
- [ ] Writes tags.md: for each tag, list of files that have it
- [ ] Writes links.md: for each wikilink target, list of files that link to it
- [ ] Index files are deterministic (sorted) for git-friendly diffs
- [ ] Errors gracefully if vault path doesn't exist (throws with action suggestion)
- [ ] Excludes files starting with . and inside .oxori/ itself
- [ ] Index cache is held in memory for query/graph operations

## Notes
Index files are derived and regenerable — they go in .gitignore. The in-memory cache is what powers queries. Make sure the three index markdown files are human-readable and useful for debugging.

---
*Migrated from .squad/backlog.md — Phase 1 (✅ COMPLETE v0.1.0)*"""
    },
    {
        "title": "Implement oxori init and oxori index CLI commands",
        "labels": ["phase-1"],
        "phase": 1,
        "body": """## Context
CLI entry point (using commander). Two commands: `oxori init` creates a new vault with template structure, `oxori index` re-scans and rebuilds the index.

## Acceptance Criteria
- [ ] cli.ts uses commander.js with named exports
- [ ] `oxori init [path]` creates path if not present, adds .oxori/ directory, creates template files (README.md, .gitignore)
- [ ] `oxori index` (with implicit current vault path) re-indexes vault in current directory or via --vault flag
- [ ] Commands print user-friendly status: "Vault initialized at ./my-vault", "Indexed 42 files, 15 tags, 128 links"
- [ ] Errors include action suggestions: "No vault found. Run 'oxori init ./path' first."
- [ ] Both commands work end-to-end with test fixtures
- [ ] No default exports — named exports only

## Notes
CLI is stateless — it reads from disk each invocation. Main entry point is in bin/oxori.ts or similar (check package.json scripts). Keep commands simple; complexity goes in indexer.ts.

---
*Migrated from .squad/backlog.md — Phase 1 (✅ COMPLETE v0.1.0)*"""
    },
    {
        "title": "Write comprehensive tests for Phase 1",
        "labels": ["phase-1"],
        "phase": 1,
        "body": """## Context
Full test suite for types, parser, indexer, and CLI. All tests use fixtures under tests/fixtures/ (basic-vault, governance-vault, linked-vault). Aim for 80%+ coverage, parser/indexer >= 95%.

## Acceptance Criteria
- [ ] tests/parser.test.ts: 15+ test cases covering frontmatter, tags (hierarchical), wikilinks, typed relations, edge cases
- [ ] tests/indexer.test.ts: 12+ test cases covering vault scan, cache building, index file output, deterministic ordering, error handling
- [ ] tests/cli.test.ts: 8+ test cases covering `oxori init` and `oxori index` end-to-end with temp directories
- [ ] All fixtures under tests/fixtures/ are committed and reusable
- [ ] Fixtures include: basic-vault/ (simple files), governance-vault/ (with .oxori/governance.md), linked-vault/ (densely linked)
- [ ] Tests use vitest snapshots for index file content validation
- [ ] Coverage report shows >= 80% overall, >= 95% for parser.ts and indexer.ts
- [ ] All tests pass with `pnpm test -- --coverage`

## Notes
Yori owns all test files. Work with Tron to ensure fixtures align with parser expectations. Use temp directories for CLI tests (not /tmp — use project directory).

---
*Migrated from .squad/backlog.md — Phase 1 (✅ COMPLETE v0.1.0)*"""
    },
    {
        "title": "Set up CI/CD pipeline",
        "labels": ["phase-1"],
        "phase": 1,
        "body": """## Context
GitHub Actions workflows for lint, typecheck, test, coverage check on every push and PR. Also configure semantic-release for auto-versioning and npm publish on merge to main.

## Acceptance Criteria
- [ ] .github/workflows/ci.yml: runs pnpm lint, pnpm typecheck, pnpm test -- --coverage on Node 20 and 22
- [ ] CI fails if coverage drops below 80%
- [ ] CI upload coverage to Codecov or similar service
- [ ] .github/workflows/release.yml: semantic-release on merge to main only
- [ ] Release workflow auto-tags, auto-generates changelog from conventional commits
- [ ] Release workflow publishes to npm if semantic-release bumps version
- [ ] package.json has scripts: lint, typecheck, test, build, dev
- [ ] Lint script uses eslint (or similar) on src/, tests/
- [ ] Typecheck script runs tsc --noEmit
- [ ] Build script outputs to dist/ via tsup
- [ ] All workflows are documented in .github/WORKFLOWS.md or similar

## Notes
Phase 1 doesn't auto-publish — manual `npm publish` until release.yml is tested. By end of Phase 1, the full CI/CD pipeline should be green and ready.

---
*Migrated from .squad/backlog.md — Phase 1 (✅ COMPLETE v0.1.0)*"""
    },
    {
        "title": "Write Phase 1 release notes and API docs",
        "labels": ["phase-1"],
        "phase": 1,
        "body": """## Context
Final issue of Phase 1. Document what v0.1.0 delivers, how to use it, and what's coming in Phase 2. Update README.md with examples, add docs/phase1-api.md with complete API reference.

## Acceptance Criteria
- [ ] README.md includes Phase 1 features: vault init, file parsing, index building, index markdown files
- [ ] README.md includes quick-start example: oxori init, oxori index, examining .oxori/index/ files
- [ ] docs/phase1-api.md documents: parseFile(), buildIndex(), CLI commands, type definitions
- [ ] Detailed release notes in RELEASES.md for v0.1.0: features, breaking changes (if any), migration steps
- [ ] RELEASES.md includes: what's new, known limitations, roadmap to Phase 2
- [ ] README links to docs/architecture.md for deeper dive
- [ ] All code examples are tested (or clearly marked as pseudo-code)

## Notes
This is the last issue in Phase 1. After Dumont's docs, Flynn approves and we tag v0.1.0. Phase 1 complete.

---
*Migrated from .squad/backlog.md — Phase 1 (✅ COMPLETE v0.1.0)*"""
    },

    # ── PHASE 2 ── Done (v0.2.0 shipped)
    {
        "title": "Phase 2 Kickoff — Query Engine + Graph Walk",
        "labels": ["phase-2", "gate"],
        "phase": 2,
        "body": """## Context
Phase 2 gates on Phase 1 completion and approval. Flynn reviews all Phase 2 PRs — query edge cases, graph cycles, performance, and query language design decisions.

## Acceptance Criteria
- [ ] All Phase 2 issues completed and PR-linked
- [ ] Phase 1 merged to main and tagged v0.1.0
- [ ] All Phase 2 public API types exported from src/index.ts before implementation begins
- [ ] Yori writes test skeletons only after types.ts Phase 2 types are Flynn-approved
- [ ] All Phase 2 tests passing (pnpm test -- --coverage)
- [ ] Coverage >= 80%, query and graph modules >= 90%
- [ ] Query language documented in docs/query-language.md
- [ ] Graph traversal handles cycles, self-links, and complex topologies
- [ ] CLI commands `oxori query`, `oxori walk`, `oxori graph` working end-to-end
- [ ] No performance regressions on linked-vault fixture (should complete in < 500ms)
- [ ] Architecture docs updated with query and graph sections

## Notes
Phase 2 is where Oxori becomes interactive. Design the query language carefully — it's user-facing and should be easy to remember.

---
*Migrated from .squad/backlog.md — Phase 2 (✅ COMPLETE v0.2.0)*"""
    },
    {
        "title": "Design and implement query language tokenizer and AST",
        "labels": ["phase-2"],
        "phase": 2,
        "body": """## Context
Query language is the main interface to the vault. Examples: `type:decision`, `tag:#project`, `path:~/docs`, `frontmatter.author=Onur`, chaining with `and`/`or`. Build a tokenizer that converts query strings into an AST that the evaluator can execute against the index cache.

## Acceptance Criteria
- [ ] query.ts exports: tokenize(query: string): Token[], parse(tokens: Token[]): QueryAST
- [ ] QueryAST type represents: filters (type, tag, path, frontmatter), operators (and, or, not), nested groups
- [ ] Tokenizer handles: word tokens, operators, quotes, special syntax like type:, tag:#, path:~
- [ ] Parser builds tree: e.g., `tag:#auth and (type:decision or path:~/docs)` → nested AST
- [ ] Edge cases: empty query (returns all), unbalanced parens (throws error), unknown filters (throws with suggestion)
- [ ] Tokenizer and parser are deterministic (same input → same AST every time)
- [ ] Query language documented in docs/query-language.md with BNF grammar
- [ ] At least 10 unit tests covering tokenization and parsing

## TypeScript Contract
```typescript
export type Token = { kind: TokenKind; value: string; };
export type TokenKind = "word" | "operator" | "lparen" | "rparen" | "filter" | "quote";
export type QueryAST = QueryNode;
export type QueryNode = FilterNode | OperatorNode | GroupNode;
export type FilterNode = { type: "filter"; filterType: "type" | "tag" | "path" | "frontmatter"; value: string; };
export type OperatorNode = { type: "operator"; operator: "and" | "or" | "not"; operands: QueryNode[]; };
export type GroupNode = { type: "group"; node: QueryNode; };
export function tokenize(query: string): Token[];
export function parse(tokens: Token[]): QueryAST;
```

## Notes
Design the query language to be simple for users but powerful for complex searches. Reference Obsidian's search or GitHub Issues search for inspiration. Avoid SQL-like syntax.

---
*Migrated from .squad/backlog.md — Phase 2 (✅ COMPLETE v0.2.0)*"""
    },
    {
        "title": "Implement query evaluator against index cache",
        "labels": ["phase-2"],
        "phase": 2,
        "body": """## Context
Evaluator takes a QueryAST and the in-memory index cache, executes the query, returns a Set<string> of matching file paths.

## Acceptance Criteria
- [ ] query.ts exports: evaluate(ast: QueryAST, state: IndexState): QueryResult
- [ ] Supports filters: type: (file extension), tag: (hierarchical tag match), path: (glob or prefix), frontmatter.key=value
- [ ] Operators: and (intersection), or (union), not (complement)
- [ ] Handles nested groups: `(a and b) or (c and not d)`
- [ ] Tag matching respects hierarchy: tag:#project matches #project, #project/auth, #project/auth/oauth
- [ ] Path matching supports ~ for vault root, globs (*, **, ?)
- [ ] Performance: evaluate() completes in < 100ms on linked-vault
- [ ] Deterministic results: same query on same cache returns same set every time
- [ ] At least 12 unit tests covering all filter types and operators

## TypeScript Contract
```typescript
export type QueryResult = { matches: Set<string>; count: number; };
export function evaluate(ast: QueryAST, state: IndexState): QueryResult;
```

## Notes
Keep evaluation simple — the cache is in memory, so full scans are fast. No need for sophisticated indexing yet. Note: parameter is `IndexState` (the actual type from types.ts), not `IndexCache`.

---
*Migrated from .squad/backlog.md — Phase 2 (✅ COMPLETE v0.2.0)*"""
    },
    {
        "title": "Implement graph traversal with depth, direction, and relation filters",
        "labels": ["phase-2"],
        "phase": 2,
        "body": """## Context
Graph walk starts at a file, follows wikilinks (or other relation types) for N hops, optionally filtering by direction (incoming, outgoing, both) and relation type (typed relations like depends_on).

## Acceptance Criteria
- [ ] graph.ts exports: walk(start: string, state: IndexState, options?: WalkOptions): WalkResult
- [ ] WalkOptions includes: depth (default 1), direction (incoming|outgoing|both), via (links|tags|both|relation:key)
- [ ] WalkResult includes: nodes (Set<string>), edges (Set<Edge>), visitOrder (array for topological inspection)
- [ ] Handles cycles gracefully: doesn't infinite loop, tracks visited nodes
- [ ] Handles self-links: file linking to itself doesn't cause issues
- [ ] Can walk typed relations: walk(start, state, { via: 'relation:depends_on' })
- [ ] Performance: walk(start, depth=3, via=links) on linked-vault completes in < 200ms
- [ ] At least 10 unit tests: simple walks, cycles, direction filters, typed relations, empty results

## TypeScript Contract
```typescript
export type WalkDirection = "incoming" | "outgoing" | "both";
export type WalkVia = "links" | "tags" | "both" | `relation:${string}`;
export type WalkOptions = { depth?: number; direction?: WalkDirection; via?: WalkVia; };
export type Edge = { source: string; target: string; relation?: string; };
export type WalkResult = { nodes: Set<string>; edges: Set<Edge>; visitOrder: string[]; };
export function walk(start: string, state: IndexState, options?: WalkOptions): WalkResult;
```

## Notes
Graph is a directed graph with typed edges. Wikilinks are one edge type, tags are another, typed relations are custom. Design walk() to be composable.

---
*Migrated from .squad/backlog.md — Phase 2 (✅ COMPLETE v0.2.0)*"""
    },
    {
        "title": "Implement oxori query, oxori walk, and oxori graph CLI commands",
        "labels": ["phase-2"],
        "phase": 2,
        "body": """## Context
CLI commands for querying and walking the graph. `oxori query "type:decision"` returns matching files, `oxori walk start.md --depth 2` shows connected nodes, `oxori graph start.md` visualizes as ASCII or JSON.

## Acceptance Criteria
- [ ] `oxori query "query string" [--format json|table|list]` returns matches
- [ ] Query command defaults to table format: filename | frontmatter.title | tag count
- [ ] `oxori walk [--start file] [--depth N] [--direction in|out|both] [--via links|tags|relation:key] [--format json|tree]`
- [ ] Walk command defaults to tree format showing hierarchy
- [ ] `oxori graph [--start file] [--depth N] [--format json|dot]` outputs graph structure
- [ ] All commands use current vault (or --vault flag)
- [ ] Error messages include action suggestions if no vault found
- [ ] Output is deterministic and testable
- [ ] Commands integrate with Phase 1 index (no rebuilding unless --reindex flag)

## Notes
CLI commands are wrappers around query and walk functions. Keep logic in query.ts and graph.ts, keep CLI thin. JSON output should be structured so users can pipe to jq.

---
*Migrated from .squad/backlog.md — Phase 2 (✅ COMPLETE v0.2.0)*"""
    },
    {
        "title": "Write comprehensive tests for Phase 2",
        "labels": ["phase-2"],
        "phase": 2,
        "body": """## Context
Full test suite for query language, evaluator, graph walk, and CLI. Focus on edge cases: complex queries, cycles, empty results, malformed input.

## Acceptance Criteria
- [ ] tests/query.test.ts: 20+ cases covering tokenization, parsing, evaluation, edge cases, performance benchmarks
- [ ] tests/graph.test.ts: 18+ cases covering walks, cycles, direction filters, typed relations, empty results
- [ ] tests/cli.test.ts updates: query, walk, graph commands with various inputs
- [ ] Fixtures include linked-vault for graph testing
- [ ] Snapshot tests for query AST validation
- [ ] Performance tests: queries and walks complete within acceptable thresholds
- [ ] Coverage >= 80%, query and graph modules >= 90%
- [ ] All tests pass with `pnpm test -- --coverage`

## Notes
Focus on determinism and reproducibility. Use fixtures consistently. Performance tests should be documented so future devs know why thresholds are set.

---
*Migrated from .squad/backlog.md — Phase 2 (✅ COMPLETE v0.2.0)*"""
    },
    {
        "title": "Write Phase 2 release notes and query language docs",
        "labels": ["phase-2"],
        "phase": 2,
        "body": """## Context
Final issue of Phase 2. Document query language, graph traversal, new CLI commands, and what's coming in Phase 3.

## Acceptance Criteria
- [ ] docs/query-language.md: BNF grammar, examples, supported filters, operators, edge case behavior
- [ ] docs/graph-traversal.md: walk() API, direction/depth/via options, examples, cycle handling
- [ ] README.md updated with query and walk examples
- [ ] RELEASES.md v0.2.0: new features, breaking changes from v0.1.0, migration notes
- [ ] Roadmap updated: Phase 3 focus on write API and governance
- [ ] All examples tested or marked as pseudo-code
- [ ] API reference in docs/phase2-api.md: query.ts and graph.ts exports

## Notes
Query language is the heart of Phase 2. Make docs crystal clear with lots of examples. Users should be able to learn by reading these docs.

---
*Migrated from .squad/backlog.md — Phase 2 (✅ COMPLETE v0.2.0)*"""
    },

    # ── PHASE 3 ── Done (v0.3.0 shipped)
    {
        "title": "Phase 3 Kickoff — Read/Write API and Governance",
        "labels": ["phase-3", "gate"],
        "phase": 3,
        "body": """## Context
Phase 3 is where humans and agents can write back to the vault. Governance enforces rules on agent writes, protecting critical paths. Flynn writes the gate checklist at kickoff and approves type contracts before implementation begins.

## Acceptance Criteria
- [ ] Phase 3 gate checklist written and documented (→ `.squad/decisions/inbox/castor-phase3-gate.md`)
- [ ] All 22 gate criteria agreed upon by team
- [ ] Wave 0 plan complete: roles, dependencies, critical path
- [ ] Dumont confirmed docs structure (writer, governance, SDK sections)
- [ ] Yori has governance-vault/ test fixture design reviewed
- [ ] Phase 2 merged to main and tagged v0.2.0 ✓
- [ ] Ready to lock types in Wave 1 (Tron)

## Notes
Gate checklist must be visible before any implementation — this is critical for preventing scope creep and gate failures. See `.squad/decisions/inbox/castor-phase3-gate.md` for the complete 22-criterion checklist.

---
*Migrated from .squad/backlog.md — Phase 3 (✅ COMPLETE v0.3.0)*"""
    },
    {
        "title": "Implement writer.ts for file creation and append",
        "labels": ["phase-3"],
        "phase": 3,
        "body": """## Context
Writer creates new markdown files and appends to existing ones, always respecting frontmatter conventions. It doesn't enforce governance — that's governance.ts. Writer just handles the mechanics of writing markdown with proper frontmatter.

## TypeScript Contract
```typescript
interface CreateOptions {
  title?: string;
  tags?: string[];
  frontmatter?: Record<string, unknown>;
  body: string;
}
export async function create(path: string, options: CreateOptions): Promise<void>;
export async function append(path: string, content: string): Promise<void>;
```

## Acceptance Criteria
- [ ] `create(path, options)`: Creates new markdown file with frontmatter (title, tags, dates, custom fields, body)
- [ ] Throws error if file already exists (no overwrite)
- [ ] Normalizes paths with `path.resolve()`
- [ ] Generates frontmatter in consistent YAML format
- [ ] Dates: `created_at` and `updated_at` in ISO 8601 UTC format
- [ ] Custom frontmatter fields merged into YAML
- [ ] `append(path, content)`: Appends content without modifying frontmatter
- [ ] Creates file if not present (uses create with default options)
- [ ] Updates `updated_at` field in frontmatter to current time
- [ ] Edge cases: very long titles, special chars in frontmatter, large appends (>1MB), non-existent parent dirs
- [ ] All operations complete in < 100ms
- [ ] tests/writer.test.ts: 12+ cases, coverage >= 90%

## Notes
Writer is dumb — it writes what you tell it to write. Governance sits on top and says "no, don't write there". Keep them separate for testability.

---
*Migrated from .squad/backlog.md — Phase 3 (✅ COMPLETE v0.3.0)*"""
    },
    {
        "title": "Design and implement governance rule parser",
        "labels": ["phase-3"],
        "phase": 3,
        "body": """## Context
Governance is a markdown file at `.oxori/governance.md` that specifies rules for what agents can and cannot do. Rules protect critical paths like governance.md itself, allow writes to specific directories, enforce frontmatter fields, etc. Humans always bypass governance (by design).

## TypeScript Contract
```typescript
type Actor = Agent | Human;
interface Agent { kind: "agent"; name: string; }
interface Human { kind: "human"; }
type WriteAction = "create" | "append";
interface GovernanceRules {
  allowedPaths: string[];
  blockedPaths: string[];
  requiredFrontmatter: string[];
  relationRules?: Record<string, unknown>;
}
export async function parseGovernance(filePath: string): Promise<GovernanceRules>;
export function enforceRule(path: string, action: WriteAction, rules: GovernanceRules, actor: Agent | Human): boolean;
```

## Acceptance Criteria
- [ ] `parseGovernance(filePath)`: Parses `.oxori/governance.md` into structured GovernanceRules
- [ ] Returns default rules if file missing (no restrictions, fail-safe)
- [ ] `enforceRule(...)`: Returns `true` if action is allowed, `false` if denied
- [ ] Humans always bypass — returns `true` for all actions (actor.kind === "human")
- [ ] Agents subject to rules — checks path against allowedPaths and blockedPaths
- [ ] Path matching uses glob patterns (*, **, ?)
- [ ] Deterministic rule evaluation (same inputs → same output)
- [ ] Conflicting rules: most restrictive wins
- [ ] Edge cases: missing governance.md (no restrictions), malformed governance.md (throws with recovery suggestion)
- [ ] tests/governance.test.ts: 16+ cases, coverage >= 95%

## Notes
Governance is intentionally simple — markdown, not complex DSL. Human bypass is **by design** — not a security hole; the point is that humans are responsible, agents are constrained.

---
*Migrated from .squad/backlog.md — Phase 3 (✅ COMPLETE v0.3.0)*"""
    },
    {
        "title": "Integrate governance with writer for safe agent writes",
        "labels": ["phase-3"],
        "phase": 3,
        "body": """## Context
SafeWrite wraps writer and governance together: before writing, check governance rules. If actor is human, allow and write. If actor is agent, check rules, enforce, and write only if allowed.

## TypeScript Contract
```typescript
export async function safeWrite(path: string, options: CreateOptions, actor: Agent | Human, vaultPath: string): Promise<Result<void, OxoriError>>;
export async function safeAppend(path: string, content: string, actor: Agent | Human, vaultPath: string): Promise<Result<void, OxoriError>>;
```

## Acceptance Criteria
- [ ] `safeWrite(...)`: Checks governance rules before writing
- [ ] If human (`actor.kind === "human"`), allow write (bypass governance)
- [ ] If agent, call `enforceRule()` — allow only if returns true
- [ ] If denied, return `Err(OxoriError)` with action suggestion
- [ ] Logging (debug level): log all write attempts with actor, path, action, allowed
- [ ] Governance rules loaded from `.oxori/governance.md` in vaultPath
- [ ] Edge case: governance.md itself cannot be written by agents (strict rule)
- [ ] Errors include action suggestions (not cryptic error codes)
- [ ] Performance: governance check + write complete in < 100ms
- [ ] Used by Vault SDK (vault.create() and vault.append() call safeWrite)

## Notes
SafeWrite is the integration point between writer (dumb I/O) and governance (smart enforcement). Vault class calls safeWrite for agent operations.

---
*Migrated from .squad/backlog.md — Phase 3 (✅ COMPLETE v0.3.0)*"""
    },
    {
        "title": "Design and implement public SDK API (index.ts)",
        "labels": ["phase-3"],
        "phase": 3,
        "body": """## Context
Public SDK that users and agents import. Provides high-level interface to Oxori: open a vault, query it, walk the graph, write files, check governance. This is the main entry point for the library.

## TypeScript Contract
```typescript
export class Vault {
  query(q: string): Promise<Set<string>>;
  walk(start: string, opts?: WalkOptions): Promise<WalkResult>;
  create(path: string, opts: CreateOptions, actor: Agent | Human): Promise<Result<void, OxoriError>>;
  append(path: string, content: string, actor: Agent | Human): Promise<Result<void, OxoriError>>;
  getGovernanceRules(): GovernanceRules;
}
export async function open(path: string): Promise<Vault>;
```

## Acceptance Criteria
- [ ] `open(path)`: Creates Vault, loads index, parses governance, throws if invalid
- [ ] `Vault.query(q)`: Delegates to Phase 2 query engine
- [ ] `Vault.walk(start, opts)`: Delegates to Phase 2 graph traversal
- [ ] `Vault.create(path, opts, actor)`: Calls safeWrite, returns Result<void>
- [ ] `Vault.append(path, content, actor)`: Calls safeAppend, returns Result<void>
- [ ] `Vault.getGovernanceRules()`: Returns parsed governance rules
- [ ] All public methods documented with TypeDoc (JSDoc) comments
- [ ] Error handling uses Result<T, E> pattern (not throw)
- [ ] index.ts is the ONLY public entry point (no internal imports leaked)
- [ ] Named exports only: `export { open, Vault }`
- [ ] `open()` completes in < 500ms (includes index load)
- [ ] tests/index.test.ts: 14+ cases, coverage >= 90%

## Notes
SDK is the face of Oxori for users. Keep it simple, intuitive, and well-documented. All complexity hidden behind clean method signatures.

---
*Migrated from .squad/backlog.md — Phase 3 (✅ COMPLETE v0.3.0)*"""
    },
    {
        "title": "Implement oxori write, oxori append, and oxori config CLI commands",
        "labels": ["phase-3"],
        "phase": 3,
        "body": """## Context
CLI commands for writing and appending files, plus configuration viewing. Commands are thin wrappers around the Vault SDK — logic lives in Vault class, CLI layer only handles I/O and argument parsing.

## Acceptance Criteria
- [ ] `oxori write [OPTIONS]`: --title, --tags, --path, --body, --frontmatter json, --vault, --agent flags
- [ ] Creates file via Vault.create() with specified options
- [ ] `oxori append FILE [OPTIONS]`: --body, --vault, --agent flags
- [ ] Appends via Vault.append()
- [ ] `oxori config [--vault v]`: Displays vault path, governance rules, index stats, last reindex
- [ ] `--json` flag for JSON output
- [ ] All commands respect `--vault` flag
- [ ] Error messages are clear and actionable
- [ ] Governance denials include suggestions
- [ ] `--agent` flag for testing governance (not for production use — documented clearly)
- [ ] tests/cli.test.ts: 12+ cases for write/append/config, coverage included in >= 80%

## Notes
CLI commands are convenience wrappers. Keep argument parsing clean, keep error handling graceful.

---
*Migrated from .squad/backlog.md — Phase 3 (✅ COMPLETE v0.3.0)*"""
    },
    {
        "title": "Write comprehensive tests for Phase 3",
        "labels": ["phase-3"],
        "phase": 3,
        "body": """## Context
Full test suite for writer, governance, SDK, and CLI write commands. Focus on edge cases, error scenarios, and governance enforcement.

## Acceptance Criteria
- [ ] tests/writer.test.ts: 12+ cases (create/append all options, edge cases, coverage >= 90%)
- [ ] tests/governance.test.ts: 16+ cases (parse, enforce, human bypass, globs, edge cases, coverage >= 95%)
- [ ] tests/index.test.ts: 14+ cases for SDK integration (coverage >= 90%)
- [ ] tests/cli.test.ts updates: write, append, config commands
- [ ] Fixtures: governance-vault/ with sample governance.md rules
- [ ] Integration test: create → query → verify in index → append → verify update
- [ ] Integration test: governance blocking (agent) → verify error with suggestion
- [ ] Integration test: human bypass (human writes to .oxori/) → success
- [ ] All tests pass with `pnpm test -- --coverage`
- [ ] Per-file coverage table in submissions

## Notes
Governance tests are critical. Enumerate every guard clause and edge case.

---
*Migrated from .squad/backlog.md — Phase 3 (✅ COMPLETE v0.3.0)*"""
    },
    {
        "title": "Write Phase 3 release notes and governance docs",
        "labels": ["phase-3"],
        "phase": 3,
        "body": """## Context
Final issue of Phase 3. Document write API, governance design, SDK usage, and what's coming in Phase 4. Release notes must cover new features, breaking changes, and migration steps from v0.2.0.

## Acceptance Criteria
- [ ] docs/write-api.md: complete API reference for create/append, CreateOptions, frontmatter format, examples
- [ ] docs/governance.md: governance file format, rule syntax, human vs agent semantics, examples, troubleshooting
- [ ] docs/sdk-api.md: Vault class reference, open(), all methods, error handling, 8+ code examples
- [ ] docs/safety-principles.md: design principle, human bypass semantics, agent constraints, best practices
- [ ] README.md: Phase 3 section, SDK quick example, governance explanation, CLI examples for write/append/config
- [ ] docs/architecture.md: Phase 3 architecture section (module overview, data flow, governance enforcement)
- [ ] RELEASES.md v0.3.0: new features, breaking changes, migration from v0.2.0, known limitations

## Notes
Phase 3 is pivotal — users can now read AND write to Oxori. Make docs crystal clear about how to use the write API and how governance protects agent writes.

---
*Migrated from .squad/backlog.md — Phase 3 (✅ COMPLETE v0.3.0)*"""
    },

    # ── PHASE 4 ── Todo (not yet started)
    {
        "title": "Phase 4 Kickoff — Semantic Search",
        "labels": ["phase-4", "gate"],
        "phase": 4,
        "body": """## Context
Phase 4 adds semantic search via vector embeddings. This is optional functionality — core Oxori (Phases 1-3) works without it. Flynn gates Phase 4 to ensure embedding integration doesn't break core features.

## Acceptance Criteria
- [ ] All Phase 4 issues completed and PR-linked
- [ ] Phase 3 merged to main and tagged v0.3.0
- [ ] All Phase 4 tests passing (pnpm test -- --coverage)
- [ ] Coverage >= 80%, search module >= 85%
- [ ] Embedding provider interface is clean and mockable
- [ ] Default OpenAI provider works with --api-key flag
- [ ] Vector storage in .oxori/vectors/ is deterministic and regenerable
- [ ] Performance: search 100 files in < 500ms
- [ ] No core feature breakage: existing phases still work without embeddings
- [ ] Docs clear on optional nature and setup

## Notes
Embeddings are a computed cache — regenerable and optional. Design for extensibility: users should be able to plug in their own embedding providers.

---
*Migrated from .squad/backlog.md — Phase 4 (Todo — not yet started)*"""
    },
    {
        "title": "Design embedding provider interface and default OpenAI provider",
        "labels": ["phase-4"],
        "phase": 4,
        "body": """## Context
Provider interface abstracts embedding generation. Users can use OpenAI, Anthropic, local ONNX, or custom. Implement default OpenAI provider that makes HTTP calls (no heavy deps).

## Acceptance Criteria
- [ ] search.ts exports: EmbeddingProvider interface with embed(text: string): Promise<number[]>
- [ ] OpenAI provider: configure via API key, model, batch size
- [ ] Supports batching multiple texts in one HTTP request
- [ ] Error handling: missing API key (throw with action suggestion), rate limits (retry logic), network errors
- [ ] Provider caches API responses in memory for same-session requests (not persistent yet)
- [ ] Cost estimation: calculates tokens and estimated cost before embedding
- [ ] User can skip embeddings entirely (graceful no-op)
- [ ] Example provider implementations: mock for testing, stub for documentation
- [ ] At least 6 unit tests: provider interface, error handling, batch logic

## Notes
Keep HTTP calls explicit and testable. No heavy dependencies like langchain or llm libs — just fetch/node-fetch.

---
*Migrated from .squad/backlog.md — Phase 4 (Todo — not yet started)*"""
    },
    {
        "title": "Implement binary vector storage and cosine similarity",
        "labels": ["phase-4"],
        "phase": 4,
        "body": """## Context
Store embedding vectors in binary format under `.oxori/vectors/` for fast lookup. Implement cosine similarity scoring for ranking search results.

## Acceptance Criteria
- [ ] search.ts exports: storeVectors(vault: Vault, provider: EmbeddingProvider): Promise<VectorCache>, cosineSimilarity(v1: number[], v2: number[]): number
- [ ] VectorCache: Map<string, number[]> where key is file path, value is embedding vector
- [ ] Binary storage: each vector stored as Float32Array or Float64Array in a binary file
- [ ] Reading is fast: parse .oxori/vectors/ into in-memory Maps on startup
- [ ] Regenerable: deleting .oxori/vectors/ and re-running embed rebuilds it
- [ ] Cosine similarity returns 0-1 score (1 = identical, 0 = orthogonal)
- [ ] Performance: computing similarity for 100 vectors in < 50ms
- [ ] Index file: .oxori/vectors/index.json lists files and metadata (model, timestamp)
- [ ] Handles edge cases: zero vectors, NaN values, empty files

## Notes
Binary storage is important for performance. Float32 should be sufficient for most embeddings. Document file format so users can inspect.

---
*Migrated from .squad/backlog.md — Phase 4 (Todo — not yet started)*"""
    },
    {
        "title": "Implement oxori search and oxori embed CLI commands",
        "labels": ["phase-4"],
        "phase": 4,
        "body": """## Context
CLI commands for semantic search and embedding generation. `oxori embed` pre-computes vectors for all files, `oxori search "query text"` finds semantically similar files.

## Acceptance Criteria
- [ ] `oxori embed [--provider openai|custom] [--api-key KEY] [--model gpt-3.5-turbo] [--force]` embeds all files
- [ ] Embed command shows progress: "Processing 42 files, 15% complete"
- [ ] Embed command estimates cost and asks confirmation before hitting API
- [ ] `oxori search "query text" [--provider openai] [--top N] [--threshold T]` searches and ranks results
- [ ] Search returns results sorted by cosine similarity, shows score
- [ ] Search format: filename | similarity score | snippet of best matching section
- [ ] Both commands respect --vault flag
- [ ] Error messages clear: missing API key, rate limits, network errors
- [ ] --force flag rebuilds vectors even if .oxori/vectors/ exists
- [ ] Performance: embed 100 files in < 2s with batching, search returns in < 100ms

## Notes
Embed is an optional step — Phase 1-3 work without it. Search should gracefully degrade if vectors unavailable.

---
*Migrated from .squad/backlog.md — Phase 4 (Todo — not yet started)*"""
    },
    {
        "title": "Integrate semantic search with Vault SDK",
        "labels": ["phase-4"],
        "phase": 4,
        "body": """## Context
Vault class gains search() method. Users call vault.search("semantic query") to find similar files. Integration is transparent — if vectors aren't available, throw informative error.

## Acceptance Criteria
- [ ] Vault.search(query: string, options: SearchOptions): Promise<SearchResult[]>
- [ ] SearchOptions: limit (default 5), threshold (default 0.5), provider (for flexibility)
- [ ] SearchResult: filePath, score, snippet, metadata
- [ ] search() embeds query text, compares to all vectors, ranks by cosine similarity
- [ ] Throws if vectors not available: "Run 'oxori embed' first to enable semantic search."
- [ ] Performance: search completes in < 100ms
- [ ] Optional: filter results by query (e.g., vault.search(...).filter(r => r.score > 0.7))
- [ ] Works alongside keyword query (can combine: keyword match + semantic reranking)

## Notes
SDK search() is a thin wrapper over vector operations. Logic stays in search.ts, SDK just calls it.

---
*Migrated from .squad/backlog.md — Phase 4 (Todo — not yet started)*"""
    },
    {
        "title": "Write comprehensive tests for Phase 4",
        "labels": ["phase-4"],
        "phase": 4,
        "body": """## Context
Full test suite for embeddings, vector storage, search, and CLI. Use mock embeddings for deterministic tests (don't call real APIs in tests).

## Acceptance Criteria
- [ ] tests/search.test.ts: 16+ cases covering provider interface, mock embeddings, vector storage, cosine similarity, edge cases
- [ ] Mock provider returns deterministic vectors for testing
- [ ] tests/cli.test.ts updates: embed and search commands with mock provider
- [ ] Integration tests: embed vault, search, verify results match expected similarities
- [ ] Fixtures: simple files with known semantic relationships for testing
- [ ] Performance tests: embed 100 files, search with 1000 vectors
- [ ] Coverage >= 80%, search >= 85%
- [ ] All tests pass without calling real APIs
- [ ] All tests pass with `pnpm test -- --coverage`

## Notes
Mock embeddings are key for testability. Create a test provider that returns predictable vectors. Don't mock HTTP in real tests — mock the provider level instead.

---
*Migrated from .squad/backlog.md — Phase 4 (Todo — not yet started)*"""
    },
    {
        "title": "Write Phase 4 release notes and semantic search docs",
        "labels": ["phase-4"],
        "phase": 4,
        "body": """## Context
Final issue of Phase 4. Document semantic search, how to enable embeddings, performance considerations, and what's coming in Phase 5.

## Acceptance Criteria
- [ ] docs/semantic-search.md: how search works, vector embeddings explained simply, provider setup, costs, performance tips
- [ ] docs/embedding-providers.md: how to write custom providers, interface reference, example implementations
- [ ] docs/search-api.md: vault.search() method reference, options, examples, ranking algorithm
- [ ] README.md updated: semantic search is optional, how to enable, example search query
- [ ] RELEASES.md v0.4.0: new features, how to migrate from v0.3.0, breaking changes (if any)
- [ ] docs/cost-estimation.md: OpenAI pricing, token costs, how to estimate vault embedding cost
- [ ] Roadmap: Phase 5 focus on MCP server and Obsidian

## Notes
Phase 4 is optional but powerful. Make it clear that core Oxori works fine without embeddings.

---
*Migrated from .squad/backlog.md — Phase 4 (Todo — not yet started)*"""
    },

    # ── PHASE 5 ── Todo (not yet started)
    {
        "title": "Phase 5 Kickoff — MCP Server and Obsidian Compatibility",
        "labels": ["phase-5", "gate"],
        "phase": 5,
        "body": """## Context
Phase 5 is the capstone. Oxori becomes an MCP server (agents can use it directly), and fully Obsidian-compatible (humans can use Obsidian plugins). Flynn gates Phase 5 to ensure agent/human interop is solid.

## Acceptance Criteria
- [ ] All Phase 5 issues completed and PR-linked
- [ ] Phase 4 merged to main and tagged v0.4.0
- [ ] All Phase 5 tests passing (pnpm test -- --coverage)
- [ ] Coverage >= 80%, MCP and watcher >= 85%
- [ ] MCP server implements all resources and tools per spec
- [ ] Watcher monitors vault for changes, updates index incrementally
- [ ] Obsidian wikilinks and frontmatter are fully compatible
- [ ] Integration tests: agent workflow via MCP end-to-end
- [ ] No performance regressions from watcher monitoring
- [ ] Architecture docs updated with MCP and watcher sections

## Notes
Phase 5 completes the vision: humans use Obsidian, agents use MCP, both read/write the same vault. This is the final phase — ship it solid.

---
*Migrated from .squad/backlog.md — Phase 5 (Todo — not yet started)*"""
    },
    {
        "title": "Implement MCP server exposing Oxori as tools and resources",
        "labels": ["phase-5"],
        "phase": 5,
        "body": """## Context
MCP (Model Context Protocol) server that agents can connect to. Exposes vault operations as tools (query, walk, write, search, embed) and resources (vault files, index, governance).

## Acceptance Criteria
- [ ] mcp.ts exports: startServer(vault: Vault, port: number): Promise<void>
- [ ] Server implements MCP spec: tools, resources, sampling endpoints
- [ ] Tools: query, walk, search, embed, write, append, config
- [ ] Each tool has clear description and input schema
- [ ] Resources: vault (file listing), index (files.md, tags.md, links.md), governance (governance.md)
- [ ] Errors use MCP error format with descriptive messages
- [ ] Server runs on configurable port (default 3000)
- [ ] Handles multiple concurrent agent connections
- [ ] Logs all operations (debug level)
- [ ] Performance: agent request completes in < 500ms
- [ ] Graceful shutdown on signal (SIGTERM, SIGINT)

## Notes
MCP is the standardized protocol for agent-tool interaction. Reference @modelcontextprotocol/sdk docs. Design tools to be stateless — each request should be independent.

---
*Migrated from .squad/backlog.md — Phase 5 (Todo — not yet started)*"""
    },
    {
        "title": "Implement filesystem watcher for incremental index updates",
        "labels": ["phase-5"],
        "phase": 5,
        "body": """## Context
Watcher monitors the vault for file changes (create, modify, delete) and updates the in-memory index incrementally. No need to rebuild entire index on every change.

## Acceptance Criteria
- [ ] watcher.ts exports: startWatcher(vault: Vault): Promise<Watcher>, Watcher has: stop(), isActive()
- [ ] Uses chokidar to monitor vault directory
- [ ] On file add: parse, update index, write .oxori/index/ files
- [ ] On file modify: re-parse, update index, write .oxori/index/ files
- [ ] On file delete: remove from index, update .oxori/index/ files
- [ ] Debounces rapid changes (e.g., save bursts) — updates index every 500ms max
- [ ] Ignores .oxori/ directory (don't watch own output)
- [ ] Ignores dot files and node_modules
- [ ] Handles file rename as delete + add
- [ ] Performance: index update completes in < 100ms for single file
- [ ] Graceful error handling: malformed file, permission denied, etc.

## Notes
Watcher enables live updates — users see index changes as they edit. Keep updates atomic: don't corrupt index if update fails halfway.

---
*Migrated from .squad/backlog.md — Phase 5 (Todo — not yet started)*"""
    },
    {
        "title": "Ensure full Obsidian compatibility and ecosystem",
        "labels": ["phase-5"],
        "phase": 5,
        "body": """## Context
Obsidian users should be able to use Oxori seamlessly. Their vaults are already Obsidian-compatible (wikilinks, frontmatter, tags). Ensure Oxori respects Obsidian conventions and can coexist with Obsidian plugins.

## Acceptance Criteria
- [ ] Wikilinks: [[file]] without extension works in Oxori parser and matches Obsidian resolution
- [ ] Tags: #tag and #tag/subtag work identically in Oxori and Obsidian
- [ ] Frontmatter: YAML frontmatter parseable by both gray-matter and Obsidian
- [ ] .gitignore: includes .obsidian/ (Obsidian config), .oxori/ (Oxori index), both regenerable
- [ ] Compatibility test: open Obsidian vault in Oxori, query/walk/write, re-open in Obsidian, everything intact
- [ ] docs/obsidian-compatibility.md: conventions, known limitations, best practices
- [ ] Obsidian example vault included in fixtures for testing
- [ ] Future roadmap: consider Obsidian plugin that calls Oxori MCP server

## Notes
Obsidian is the primary UI for humans. Oxori augments it with CLI and agent access. Design Oxori to be invisible to Obsidian users.

---
*Migrated from .squad/backlog.md — Phase 5 (Todo — not yet started)*"""
    },
    {
        "title": "Write comprehensive tests for Phase 5",
        "labels": ["phase-5"],
        "phase": 5,
        "body": """## Context
Full test suite for MCP server, watcher, and Obsidian compatibility. Integration tests are key here — test agent workflows end-to-end.

## Acceptance Criteria
- [ ] tests/mcp.test.ts: 14+ cases covering tools, resources, error handling, concurrent requests
- [ ] tests/watcher.test.ts: 12+ cases covering file add/modify/delete, debouncing, error recovery
- [ ] tests/integration.test.ts: end-to-end agent workflow via MCP — query, walk, write, search
- [ ] Obsidian compatibility tests: create vault in Obsidian format, verify Oxori parses correctly
- [ ] Performance tests: watcher updates < 100ms, MCP requests < 500ms, 100 concurrent requests
- [ ] Coverage >= 80%, MCP and watcher >= 85%
- [ ] All tests pass with `pnpm test -- --coverage`
- [ ] Fixtures: Obsidian example vault with real wikilinks and tags

## Notes
Integration tests verify the full vision: humans edit in Obsidian, agents query/write via MCP, index stays in sync.

---
*Migrated from .squad/backlog.md — Phase 5 (Todo — not yet started)*"""
    },
    {
        "title": "Write Phase 5 release notes and final documentation",
        "labels": ["phase-5"],
        "phase": 5,
        "body": """## Context
Final issue of all phases. Document MCP server, watcher, Obsidian integration, and reflect on the full Oxori journey.

## Acceptance Criteria
- [ ] docs/mcp-server.md: how to start server, connect agents, available tools and resources, examples
- [ ] docs/watcher.md: how watcher works, performance characteristics, limitations, debugging
- [ ] docs/obsidian-compatibility.md: detailed compatibility guide, conventions, best practices
- [ ] docs/end-to-end-workflow.md: full example of human in Obsidian, agent via MCP, reading/writing same vault
- [ ] RELEASES.md v0.5.0: final feature set, breaking changes, migration from v0.4.0
- [ ] docs/ARCHITECTURE-COMPLETE.md: architectural review of all 5 phases, design decisions, trade-offs
- [ ] README.md refreshed: complete feature overview, quick start for all user types
- [ ] ROADMAP.md: post-v0.5.0 ideas (Obsidian plugin, more providers, performance optimizations, etc.)

## Notes
Phase 5 is complete. v0.5.0 is release ready. This should be beautiful documentation that future maintainers love.

---
*Migrated from .squad/backlog.md — Phase 5 (Todo — not yet started)*"""
    },
]

PHASE_STATUS = {1: STATUS_DONE, 2: STATUS_DONE, 3: STATUS_DONE, 4: STATUS_TODO, 5: STATUS_TODO}

def ensure_labels():
    """Ensure required labels exist in the repo."""
    existing = api_call("GET", f"https://api.github.com/repos/{REPO}/labels?per_page=100")
    existing_names = {l["name"] for l in existing}
    needed = [
        ("phase-1", "0075ca", "Phase 1 — Parser + Markdown Index"),
        ("phase-2", "e4e669", "Phase 2 — Query Engine + Graph Walk"),
        ("phase-3", "d93f0b", "Phase 3 — Read/Write API and Governance"),
        ("phase-4", "0052cc", "Phase 4 — Semantic Search"),
        ("phase-5", "5319e7", "Phase 5 — MCP Server and Obsidian Compatibility"),
        ("gate", "b60205", "Phase gate issue"),
    ]
    for name, color, desc in needed:
        if name not in existing_names:
            api_call("POST", f"https://api.github.com/repos/{REPO}/labels",
                     {"name": name, "color": color, "description": desc})
            print(f"  Created label: {name}")

created = []
failed = []

print("Ensuring labels exist...")
ensure_labels()
print()

for i, issue in enumerate(ISSUES):
    title = issue["title"]
    print(f"Creating issue ({i+1}/{len(ISSUES)}): \"{title}\"...", end=" ", flush=True)
    try:
        resp = create_issue(title, issue["body"], issue["labels"])
        if "number" not in resp:
            raise Exception(f"No number in response: {resp}")
        num = resp["number"]
        node_id = resp["node_id"]
        
        # Add to project
        proj_resp = add_to_project(node_id)
        if "errors" in proj_resp:
            raise Exception(f"Project add failed: {proj_resp['errors']}")
        item_id = proj_resp["data"]["addProjectV2ItemById"]["item"]["id"]
        
        # Set status
        status_id = PHASE_STATUS[issue["phase"]]
        status_resp = set_status(item_id, status_id)
        if "errors" in status_resp:
            raise Exception(f"Status set failed: {status_resp['errors']}")
        
        created.append((num, title))
        print(f"#{num} ✅")
        time.sleep(0.5)
    except Exception as e:
        print(f"❌ FAILED: {e}")
        failed.append((title, str(e)))
        time.sleep(0.5)

print()
print(f"=== Migration Complete ===")
print(f"Total created: {len(created)}")
print(f"Total failed: {len(failed)}")
if failed:
    print("Failures:")
    for t, e in failed:
        print(f"  - {t}: {e}")
