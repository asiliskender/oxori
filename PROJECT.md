# PROJECT.md

## Project Overview

Oxori is a TypeScript library and CLI that makes markdown files queryable, traversable, and semantically searchable — without an external database. The index itself is markdown. It is a shared knowledge layer for humans and AI agents.

Tagline: Where humans and AI agents think together, in markdown.

## Core Principles

1. Markdown files are the source of truth. Always.
2. The index is also markdown, stored under `.oxori/index/`. Derived, regenerable, human-readable.
3. No external database. No SQLite. The filesystem is the database, the index files are the catalog.
4. Governance constrains agents, not humans. Humans have full access.
5. Git handles concurrency. No application-level locks.
6. Obsidian-compatible conventions for wikilinks, frontmatter, and tags.
7. Both humans and agents read and write to the same vault.

## Architecture

See `docs/architecture.md` for full design. Summary of layers:

1. **Parser** — reads `.md` files, extracts frontmatter (YAML), tags (`#tag`), wikilinks (`[[link]]`), typed relations, and body content
2. **Markdown Index** — `.oxori/index/files.md`, `tags.md`, `links.md` — derived summaries parsed into an in-memory cache on startup
3. **Query Engine** — parses query strings into AST, evaluates against in-memory cache
4. **Graph Traversal** — walks link relationships with configurable depth, direction, and relation type
5. **Semantic Search** — vector embeddings cached in `.oxori/vectors/` (binary, derived, regenerable)
6. **Governance** — `.oxori/governance.md` parsed at startup, enforced on agent writes only
7. **Write API** — create and append markdown files with convention-compliant frontmatter
8. **Watcher** — filesystem monitoring for incremental index updates
9. **MCP Server** — Model Context Protocol server for agent integrations

## Tech Stack

- **Language:** TypeScript 5.x, targeting Node.js 20+
- **Runtime:** Node.js
- **Markdown parsing:** `gray-matter` for frontmatter, `unified`/`remark` for body parsing, regex for wikilinks/tags
- **Embeddings (optional):** API-based — OpenAI, Anthropic, or any provider via HTTP. Optional local via ONNX runtime.
- **File watching:** `chokidar`
- **CLI:** `commander`
- **MCP:** `@modelcontextprotocol/sdk`
- **Testing:** `vitest`
- **Bundling:** `tsup`
- **Package manager:** `pnpm`
- **CI/CD:** GitHub Actions
- **Versioning:** `semantic-release` from conventional commits

## File Structure

```
oxori/
├── src/
│   ├── index.ts                # public API entry point
│   ├── cli.ts                  # commander CLI entry point
│   ├── parser.ts               # markdown file parser
│   ├── indexer.ts              # markdown index builder and in-memory cache
│   ├── graph.ts                # link graph traversal
│   ├── search.ts               # semantic vector search
│   ├── query.ts                # query language tokenizer, parser, evaluator
│   ├── writer.ts               # file creation and append
│   ├── governance.ts           # governance rule parser and enforcer
│   ├── watcher.ts              # filesystem change monitor
│   ├── mcp.ts                  # MCP server
│   └── types.ts                # shared type definitions
├── tests/
│   ├── parser.test.ts
│   ├── indexer.test.ts
│   ├── query.test.ts
│   ├── graph.test.ts
│   ├── writer.test.ts
│   ├── governance.test.ts
│   ├── search.test.ts
│   └── fixtures/               # sample .md vaults for testing
│       ├── basic-vault/
│       ├── governance-vault/
│       └── linked-vault/
├── docs/
│   └── architecture.md
├── .github/
│   └── workflows/
│       ├── ci.yml              # lint + typecheck + test on every push/PR
│       └── release.yml         # auto-version + publish on merge to main
├── README.md
├── CLAUDE.md
├── CONTRIBUTING.md
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── LICENSE
└── .gitignore
```

## Coding Conventions

- Strict TypeScript — `strict: true` in tsconfig, no `any` unless absolutely necessary
- Prefer functions over classes. Use classes only for stateful objects like `Vault` and `MCP server`.
- Named exports only, no default exports
- Use `type` keyword for type-only imports
- Error handling: use `Result<T, E>` pattern or throw descriptive errors with action suggestions
- File paths via Node.js `path` module, always normalize with `path.resolve`
- Prefer `async/await` over callbacks
- No abbreviations in variable names — `frontmatter` not `fm`, `governance` not `gov`

## Key Design Decisions

- **No SQLite.** Index is markdown files parsed into in-memory Maps and Sets on startup. Regenerable from source.
- **Wikilinks are `[[filename]]` without extension.** Resolution is case-insensitive, matches by filename stem.
- **Tags support hierarchy.** `#project/auth/oauth` matches queries at all ancestor levels.
- **Frontmatter is schemaless.** Any YAML key-value is indexed. No predefined schema.
- **Typed relations via frontmatter.** `depends_on: [[file]]` creates a typed edge in the graph. The frontmatter key becomes the relation type.
- **Vector search is optional.** Core functionality works without embeddings. Embeddings are a computed cache.
- **Governance is a markdown file.** No config language — just a `.md` with rules.
- **Governance constrains agents only.** Humans (Obsidian, direct editing) bypass governance by design.
- **Writes update the index.** Every write operation updates both the in-memory cache and `.oxori/index/` files.
- **Git handles concurrency.** No locks, no conflict resolution in Oxori.
- **TypeScript for everything.** Same language for CLI, SDK, MCP server, and eventual UI.

## CI/CD

### GitHub Actions: ci.yml

Runs on every push and pull request:

1. **Lint** — `pnpm lint`
2. **Type check** — `pnpm typecheck`
3. **Test** — `pnpm test -- --coverage`
4. **Coverage** — upload to Codecov, fail if below 80%

Matrix: Node.js 20, 22 on ubuntu-latest.

### GitHub Actions: release.yml

Runs on merge to `main`:

1. **Semantic versioning** — `semantic-release` reads conventional commit messages
   - `feat:` → minor version bump
   - `fix:` → patch version bump
   - `feat!:` or `BREAKING CHANGE:` → major version bump
2. **Changelog** — auto-generated from commits
3. **Tag and release** — creates Git tag and GitHub release
4. **Publish** — builds and publishes to npm

### Commit Convention

All commits follow Conventional Commits:
```
feat: add graph walk with typed relations
fix: handle missing frontmatter gracefully
docs: update architecture with governance section
test: add fixtures for linked vault
refactor: extract query AST into separate module
feat!: change index format to hierarchical
```

## Testing Strategy

### Unit Tests
- `parser.test.ts` — parse frontmatter, tags, wikilinks, typed relations from sample files
- `indexer.test.ts` — build index from fixture vault, verify files.md/tags.md/links.md content
- `query.test.ts` — parse query strings to AST, evaluate against mock index
- `graph.test.ts` — walk links at various depths, directions, relations
- `writer.test.ts` — create files, append content, verify frontmatter conventions
- `governance.test.ts` — parse governance rules, test allow/deny scenarios
- `search.test.ts` — embed, store, search with mock embeddings

### Integration Tests
- Full vault scenarios: init → index → query → walk → write → re-index
- Governance enforcement end-to-end
- Watcher: modify file, verify index updates

### Fixtures
Test vaults under `tests/fixtures/`:
- `basic-vault/` — simple files with frontmatter, tags, links
- `governance-vault/` — vault with `.oxori/governance.md` and protected paths
- `linked-vault/` — densely linked files for graph traversal testing

### Coverage Target
80% minimum. Parser and governance modules should aim for near 100%.

## Build Order (Phased)

### Phased 1 — Parse and Markdown Index
1. `types.ts` — type definitions: ParsedFile, FileEntry, TagEntry, LinkEntry
2. `parser.ts` — extract frontmatter, tags, wikilinks, typed relations from one file
3. `indexer.ts` — scan vault, build in-memory cache (Maps/Sets), write `.oxori/index/*.md`
4. `cli.ts` — `oxori init`, `oxori index`
5. Tests + CI pipeline setup

### Phased 2 — Query and Graph Walk
1. `query.ts` — tokenizer, AST parser, evaluator against in-memory cache
2. `graph.ts` — walk with depth, direction, relation, via (links/tags/both)
3. `cli.ts` — `oxori query`, `oxori walk`, `oxori graph`
4. Tests for query language edge cases and graph cycles

### Phased 3 — Read/Write API and Governance
1. `writer.ts` — create and append with frontmatter conventions
2. `governance.ts` — parse governance.md, enforce rules on writes
3. `cli.ts` — `oxori write`, `oxori append`
4. `index.ts` — public SDK API: `Oxori.open()`, `vault.query()`, `vault.walk()`, `vault.write()`
5. Tests for governance allow/deny and write validation

### Phased 4 — Semantic Search
1. `search.ts` — embedding provider interface, binary vector storage, cosine similarity
2. Default provider: OpenAI API (HTTP call, no heavy deps)
3. CLI: `oxori search`, `oxori embed`
4. Tests with mock embeddings for deterministic results

### Phased 5 — MCP Server and Obsidian Compatibility
1. `mcp.ts` — MCP server exposing all Oxori tools and resources
2. `watcher.ts` — chokidar-based filesystem monitoring for live index updates
3. Obsidian compatibility documentation and testing
4. Integration tests: full agent workflow via MCP

## What NOT to Do

- Never use an external database. The filesystem and markdown index are the database.
- Never modify user's markdown files during indexing. Index is read-only on source files.
- Never require a specific folder structure.
- Never add heavy native dependencies to core. Embeddings use HTTP APIs.
- Never bypass governance for agent writes, even if the caller claims to be human.
- Never commit to Git on behalf of the user. Oxori writes files, the user manages Git.
- Never build a UI in this package. Obsidian is the UI for now. This is a library, CLI, and MCP server.
- Never use `any` type. Use `unknown` and narrow.

## Development Commands

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests with coverage
pnpm test -- --coverage

# Type check
pnpm typecheck

# Lint
pnpm lint

# Lint and fix
pnpm lint:fix

# Build
pnpm build

# Run CLI locally
pnpm dev -- init ./test-vault
pnpm dev -- index
pnpm dev -- query "type:decision"
```

# IMPORTANT 

Make super detailed documentation and comments in the code. This is a complex system with many interacting parts. Future maintainers (including future you) will thank you for clear explanations of the why behind each design choice, especially in edge cases and non-obvious logic. Write really datailed Release Notes for each version, summarizing new features, breaking changes, and migration steps if needed.

Every phase should be different iterations and should be merged into `main` only when fully complete with tests and documentation. Don't merge half-baked features. It's better to have a smaller, well-documented, fully-tested codebase than a larger, incomplete one. Every phase is new release.

Make your commit messages clear and descriptive, following the Conventional Commits format. This will help with generating changelogs and understanding the history of changes.

Make your commits atomic — one logical change per commit. This makes it easier to review and revert if needed.

Update README.md if necessary to reflect new features or changes, but keep it high-level. The detailed documentation should go in the `docs/` folder.