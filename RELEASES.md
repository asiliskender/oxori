# Release Notes

## [Unreleased] — v0.3.0

**Status:** Draft (Phase 3 in progress)

### Added

- **`watch(vaultPath, config?)`** — Real-time file watcher emitting `WatchEvent` (add/change/unlink) for markdown files. EventEmitter-based for easy integration with indexers and MCP servers.
- **`checkGovernance(rules, state)`** — Glob-pattern-based governance rule evaluation. Rules have `id`, `pattern`, `effect` (allow/deny), and `appliesTo` (agents only by design). Returns `GovernanceResult` with violations list.
- **New types** — `VaultWatcher`, `WatchEvent`, `GovernanceRule`, `GovernanceViolation`, `GovernanceResult` now fully implemented and exported.
- **SDK exports** — `watch()` and `checkGovernance()` are now part of the public API.

### Changed

- **README.md** — Updated features list to v0.3.0; added "File Watcher" and "Governance" sections in SDK Usage with complete code examples.
- **docs/architecture.md** — Added "Phase 3 Additions" section summarizing the watcher and governance layers with API examples.

### Documentation

- Watcher emits `WatchEvent` with fields: `type` (add/change/unlink), `filepath` (absolute), `timestamp` (ms)
- Governance rules enforce policy on agent writes only; humans bypass governance by design
- Both implementations are pure functions (no I/O or side effects in core logic)

---

## v0.1.0 — Phase 1: Parser + Markdown Index

**Status:** 🔜 Planned  
**Target:** Phase 1 completion

### What's New

Oxori's first release focuses on the foundation: parsing markdown files and building a human-readable index. No external database, no complexity — just markdown reading markdown.

#### Parser (`src/parser.ts`)

The parser is the engine that reads a single markdown file and extracts all its structure. It handles:

- **Frontmatter** — YAML between `---` delimiters. Any keys are accepted (schemaless). Accessed via `ParsedFile.frontmatter: Record<string, unknown>`.
- **Tags** — Both hashtags in the body (`#auth`) and the `tags` field in frontmatter. Tags are expanded to all ancestor levels: `#project/auth/oauth` becomes three entries: `"project"`, `"project/auth"`, `"project/auth/oauth"`. Enables prefix queries without recursion.
- **Wikilinks** — `[[link]]` patterns in the body. Resolved by filename stem (lowercased, no `.md` extension). `[[My Note]]` and `[[my note]]` both resolve to `"my note"`.
- **Typed Relations** — Frontmatter keys containing wikilinks, e.g. `depends_on: [[login]]` becomes a `TypedRelation` edge with type `"depends_on"` and target `"login"`.
- **Body** — Raw markdown body preserved as-is for future semantic search.

Returns a `ParsedFile` object. Failures are returned as `Result<ParsedFile, OxoriError>` with machine-readable error codes and action suggestions.

#### Markdown Index (`src/indexer.ts`)

The indexer scans the entire vault and builds three human-readable markdown index files:

**`.oxori/index/files.md`** — Registry of all indexed files:
```markdown
---
type: oxori-index
generated_at: 2026-04-03T15:00:00Z
file_count: 42
---

## decisions/api-choice.md
- type: decision
- status: open
- author: agent:researcher
- tags: auth, security, sprint-3
- depends_on: [[user-model]]
- links_out: user-model, deploy-v2
- links_in: implement-auth
- modified: 2026-04-03T14:30:00Z
```

**`.oxori/index/tags.md`** — Tag-to-file mappings:
```markdown
---
type: oxori-tags
generated_at: 2026-04-03T15:00:00Z
tag_count: 15
---

## auth
- decisions/api-choice.md
- tasks/implement-auth.md

## sprint-3
- decisions/api-choice.md
```

**`.oxori/index/links.md`** — Wikilink graph:
```markdown
---
type: oxori-links
generated_at: 2026-04-03T15:00:00Z
link_count: 128
---

| source | target | relation |
|--------|--------|----------|
| decisions/api-choice.md | user-model | depends_on |
| tasks/implement-auth.md | api-choice | link |
```

The indexer also builds an in-memory `IndexState` cache with Maps and Sets for O(1) lookups. This cache is used by all subsequent layers (Phase 2+) for querying and graph traversal.

**Features:**
- Scans all `.md` files in the vault
- Respects `excludePatterns` (glob-based, e.g. `.obsidian/**`, `node_modules/**`)
- Tracks file metadata (modified time, content hash) for incremental updates
- Writes index files atomically (no partial/corrupt index)
- Returns summary: files count, tags count, links count

#### CLI Commands

**`oxori init <path>`** — Initialize a new vault
```bash
oxori init ./my-vault
```

Creates the `.oxori/` directory structure and a sample `governance.md` (for Phase 3).

**`oxori index`** — Index the vault
```bash
oxori index
```

Scans the vault, parses all files, and writes `.oxori/index/` files.

#### Type System (`src/types.ts`)

Core types defined for all 5 phases. No breaking changes mid-project:

- `ParsedFile` — single file after parsing (mutable)
- `FileEntry` — cached file representation (immutable, readonly)
- `TagEntry` — tag and its files
- `LinkEntry` — wikilink and its sources
- `TypedRelation` — graph edge with type
- `IndexState` — complete in-memory cache
- `VaultConfig` — vault configuration
- `Result<T, E>` — structured error handling
- `OxoriError` — standardized errors with codes and actions
- `WatchEvent` — filesystem change events (for Phase 5)
- `GovernanceRule` — governance rules (for Phase 3)

### Installation

```bash
npm install oxori
# or
npm install -g oxori
```

Requires Node.js 20+.

### Quick Start

```bash
# Initialize vault
oxori init ./my-vault
cd my-vault

# Add some markdown files
echo '---
type: decision
status: open
---

# My Decision

Why we chose this approach.' > decisions/api-choice.md

# Index
oxori index
# → Indexed 1 file, 0 tags, 0 links
# → Index written to .oxori/index/

# Inspect index
cat .oxori/index/files.md
```

### SDK Usage

```typescript
import { parseFile } from 'oxori/parser';
import { buildIndex } from 'oxori/indexer';

// Parse one file
const result = await parseFile('/path/to/note.md');
if (result.ok) {
  console.log(result.value.frontmatter.type);
  console.log(result.value.tags); // Set<string>
  console.log(result.value.wikilinks); // Set<string>
}

// Build vault index
const indexResult = await buildIndex('/path/to/vault');
if (indexResult.ok) {
  const { state, filesCount, tagsCount, linksCount } = indexResult.value;
  console.log(`Indexed ${filesCount} files`);
}
```

### Architecture

The complete architecture is documented in [docs/architecture.md](docs/architecture.md). Phase 1 covers **Layers 1-2**:

- **Layer 1: Parser** — `src/parser.ts`
- **Layer 2: Markdown Index** — `src/indexer.ts`

Subsequent phases add:
- Phase 2 → Layers 3-4 (Query, Graph Traversal)
- Phase 3 → Layers 6-7 (Governance, Write API)
- Phase 4 → Layer 5 (Semantic Search)
- Phase 5 → Layers 8-9 (Watcher, MCP Server)

### Breaking Changes

None — initial release. Future releases may break the API if needed (documented in release notes with migration steps).

### Known Limitations

- **No query engine yet** — Phase 2 adds querying by frontmatter and tags
- **No graph traversal yet** — Phase 2 adds walking links with depth/direction control
- **No write API yet** — Phase 3 adds creating and updating files with governance
- **No semantic search yet** — Phase 4 adds vector embeddings and similarity search
- **No MCP server yet** — Phase 5 adds Model Context Protocol for AI agents
- **Index files are read-only** — they're derived and regenerated on each `oxori index`. Direct edits are lost on next index.

### Migration Guide

First release — no migrations needed.

### What's Next (Phase 2)

Phase 2 focuses on querying and graph traversal:

- **Query Engine** — filter files by frontmatter and tags with a simple query language (`type:decision AND status:open`)
- **Graph Traversal** — walk links and typed relations with configurable depth (`oxori walk note.md --depth 2`)
- **CLI commands** — `oxori query`, `oxori walk`, `oxori graph`
- **MCP preparation** — APIs designed for agent consumption

### Testing

Phase 1 includes comprehensive tests:
- Parser tests: frontmatter edge cases, tag hierarchy, wikilink resolution, typed relations
- Indexer tests: full vault scenarios, exclude patterns, incremental updates
- All modules: 80%+ coverage, parser/indexer targeting 95%+

### CI/CD

Every push triggers:
- Linting (ESLint)
- Type checking (TypeScript strict mode)
- Tests with coverage (vitest, Codecov)

Releases are automated from conventional commits via `semantic-release`.

### Contributors

Oxori is built by a specialized team:
- **Tron** — types, parser, indexer (Phase 1)
- **Yori** — all tests (Phases 1-5)
- **Dumont** — documentation and release notes (Phases 1-5)
- **Flynn** — architecture review and approval
- **Clu** — CI/CD setup
- **Ram, Quorra, Castor** — other phases

### Thank You

Thanks for using Oxori. Your feedback shapes the roadmap.
