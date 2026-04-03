# Oxori Architecture

## Overview

Oxori is a read/write knowledge layer on top of a folder of markdown files. It extracts structure, makes it queryable and traversable, enforces governance for agents, and keeps everything in markdown — including the index itself.

```
┌─────────────────────────────────────────────┐
│              Markdown Files                  │
│            (source of truth)                 │
└──────────┬───────────────────┬──────────────┘
           │ read/parse        │ write (governed)
           ▼                   ▲
┌──────────────────────────────────────────────┐
│              Parser Layer                     │
│    frontmatter · tags · wikilinks · body      │
└──────────┬───────────────────────────────────┘
           │ build
           ▼
┌──────────────────────────────────────────────┐
│         Markdown Index (.oxori/index/)        │
│    files.md · tags.md · links.md              │
│    (derived, regenerable, Git-versioned)      │
└────┬─────────────┬───────────────┬───────────┘
     │             │               │
     ▼             ▼               ▼
┌─────────┐ ┌───────────┐ ┌───────────────┐
│  Query  │ │   Graph   │ │   Semantic    │
│  Engine │ │ Traversal │ │   Search      │
└────┬────┘ └─────┬─────┘ └──────┬────────┘
     │            │               │
     └────────────┼───────────────┘
                  ▼
┌──────────────────────────────────────────────┐
│         Governance Layer                      │
│    .oxori/governance.md                       │
│    (constrains agents, not humans)            │
└──────────────────┬───────────────────────────┘
                   ▼
┌──────────────────────────────────────────────┐
│           API Layer                           │
│       CLI · TypeScript SDK · MCP Server       │
└──────────────────┬───────────────────────────┘
                   ▼
┌──────────────────────────────────────────────┐
│           Consumers                           │
│    Agents (CLI/MCP) · Humans (Obsidian)       │
└──────────────────────────────────────────────┘
```

## Design Principles

1. **Markdown is the source of truth.** Files are never locked into a proprietary format.
2. **The index is also markdown.** Derived from source files, regenerable, human-readable.
3. **No external database.** No SQLite, no Postgres. The filesystem is the database.
4. **Governance constrains agents, not humans.** Humans have full access. Agent writes are validated.
5. **Git handles concurrency.** Multi-agent and multi-human collaboration is resolved through Git workflows, not application-level locks.
6. **Obsidian-compatible conventions.** Wikilinks, frontmatter, and tags follow Obsidian syntax.
7. **TypeScript everywhere.** Same language for CLI, SDK, MCP server, and eventual UI.

## Layer Details

### 1. Parser

Reads a single `.md` file and returns a structured representation.

Input: file path.
Output: `ParsedFile` object.

Extracts:
- **Frontmatter** — YAML between `---` delimiters via `gray-matter`, returned as `Record<string, unknown>`
- **Tags** — `#tag` patterns in body AND `tags` field in frontmatter, returned as `string[]`
- **Wikilinks** — `[[target]]` patterns in body via regex, returned as `string[]`
- **Typed relations** — frontmatter keys whose values contain wikilinks (e.g. `depends_on: [[file]]`), returned as `TypedLink[]`
- **Body** — full text content below frontmatter, returned as `string`
- **File metadata** — path, modified time, content hash for change detection

Tag hierarchy: `#project/auth/oauth` is stored as three tags: `project`, `project/auth`, and `project/auth/oauth`. Queries at any level match descendants.

Wikilink resolution: `[[implement-auth]]` resolves to a file named `implement-auth.md` anywhere in the vault. Case-insensitive. If ambiguous, the closest file by directory depth wins.

### 2. Markdown Index

Stored under `.oxori/index/`. Entirely derived from source files. Delete it and run `oxori index` to regenerate.

On vault open, these index files are parsed into in-memory data structures (`Map` and `Set`). File changes trigger incremental updates to both the in-memory cache and the index files.

**`.oxori/index/files.md`** — registry of all indexed files:
```markdown
---
type: oxori-index
generated_at: 2026-04-03T14:30:00Z
file_count: 47
---

## Files

### decisions/api-choice.md
- type: decision
- status: open
- author: agent:researcher
- tags: auth, security, sprint-3
- links_out: user-model, deploy-v2
- links_in: implement-auth
- modified: 2026-04-03T14:30:00Z
- hash: a1b2c3d4
```

**`.oxori/index/tags.md`** — tag to file mappings:
```markdown
---
type: oxori-tags
generated_at: 2026-04-03T14:30:00Z
tag_count: 12
---

## auth
- decisions/api-choice.md
- tasks/implement-auth.md
- memory/auth-notes.md

## auth/oauth
- decisions/api-choice.md
```

**`.oxori/index/links.md`** — link graph:
```markdown
---
type: oxori-links
generated_at: 2026-04-03T14:30:00Z
link_count: 23
---

## Link Graph

| source | target | relation |
|--------|--------|----------|
| decisions/api-choice.md | user-model | depends_on |
| decisions/api-choice.md | deploy-v2 | blocks |
| tasks/implement-auth.md | api-choice | link |
```

### 3. Query Engine

Parses a simple query language and evaluates it against the in-memory index.

Query syntax:
```
type:decision                          — frontmatter field match
tag:auth                               — tag match (hierarchical)
status:open AND tag:security           — boolean AND
tag:auth OR tag:api                    — boolean OR
author:human AND NOT status:closed     — negation
modified:>2026-01-01                   — date comparison
```

Implementation: query string is tokenized and parsed into an AST, then evaluated by walking the AST against in-memory `Map<string, FileEntry>`. No SQL — just TypeScript filtering over Maps.

### 4. Graph Traversal

Walks the link graph starting from a given file.

API:
```typescript
vault.walk("decisions/api-choice.md", {
  depth: 2,
  direction: "both",    // "outgoing" | "incoming" | "both"
  relation: undefined,  // filter by relation type, undefined = all
  via: "links",         // "links" | "tags" | "links+tags"
}): Promise<GraphNode[]>
```

`via="links"` follows wikilinks in body and typed relations in frontmatter.
`via="tags"` finds files sharing tags with the start file.
`via="links+tags"` combines both.

Each `GraphNode` contains the file, its distance from start, and the traversal path.

### 5. Semantic Search (Faz 4)

Embeds file body content into vectors for similarity search.

Storage: `.oxori/vectors/` contains binary embedding files. This is a computed cache, not source of truth. Delete the folder and embeddings regenerate from markdown source files.

Embedding providers are pluggable via a simple interface:
```typescript
interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  readonly model: string;
}
```

Default provider calls OpenAI API via HTTP — no heavy native dependencies. Alternative providers (Anthropic, local ONNX) can be plugged in.

Search API:
```typescript
vault.search("authentication approach", {
  limit: 10,
  filter: "type:decision",  // metadata pre-filter before vector search
}): Promise<SearchResult[]>
```

### 6. Governance

Lives in `.oxori/governance.md`. Parsed at startup, cached in memory. Enforced only at the API layer (CLI, SDK, MCP). Obsidian and direct file editing bypass governance by design — humans are owners.

Governance checks run on every write operation:
1. Parse the governance file for rules
2. Identify the caller (human or agent identity)
3. Check if the target path is writable by the caller
4. Check if required frontmatter fields are present
5. Allow or reject the write

If governance file is missing or unparseable, default behavior is permissive with a warning.

### 7. Write API

Oxori can create new files and append to existing files:

```typescript
// Create a new file
await vault.write("decisions/caching.md", {
  frontmatter: {
    type: "decision",
    status: "draft",
    author: "agent:planner",
    tags: ["performance", "infrastructure"],
  },
  body: "We should consider Redis for caching because...",
});

// Append to an existing file
await vault.append("logs/session-2026-04-03.md", {
  content: "\n## 15:30 — Completed auth review\n\nFound 3 issues...",
  author: "agent:researcher",
});
```

Every write operation:
1. Checks governance rules
2. Auto-adds `created_at` or `updated_at` timestamps
3. Validates frontmatter against conventions
4. Updates the in-memory index and `.oxori/index/` files
5. Does NOT commit to Git (user's responsibility)

### 8. Watcher

Monitors the vault directory for file changes using `chokidar`.

Events: file created, modified, deleted, or renamed triggers incremental index update. Debounces rapid changes (300ms). Runs when Oxori is active (e.g. during MCP server operation).

### 9. MCP Server (Faz 5)

Exposes Oxori capabilities as MCP tools:

Tools:
- `oxori_query` — run a metadata query
- `oxori_read` — read a file's content and metadata
- `oxori_write` — create or update a file (governance-checked)
- `oxori_walk` — traverse the graph from a file
- `oxori_search` — semantic search
- `oxori_tags` — list tags or files for a tag
- `oxori_graph` — return graph structure

Resources:
- `oxori://files` — all indexed files
- `oxori://file/{path}` — single file
- `oxori://graph` — full graph as JSON

## Data Flow

### Indexing
```
.md files → Parser → ParsedFile → In-memory Map/Set cache
                                 → .oxori/index/*.md (persisted)
                                 → .oxori/vectors/ (optional, binary cache)
```

### Querying
```
query string → Tokenizer → AST → evaluate against in-memory Map → results
```

### Graph Walk
```
start file → Graph.walk(depth=N) → recursive traversal of in-memory link Map → results
```

### Semantic Search
```
query string → EmbeddingProvider.embed() → cosine similarity vs cached vectors → ranked results
```

### Writing
```
write request → Governance check → create/update .md file → update in-memory cache → update .oxori/index/
```

## Concurrency Model

Oxori does not manage concurrent writes. Multi-agent and multi-human collaboration is handled through Git:
- Each agent works on its own branch or writes to non-overlapping paths (enforced by governance)
- Humans merge branches and resolve conflicts
- Oxori watches for file changes and updates its index regardless of how the change happened

## Obsidian Compatibility

Oxori conventions are fully compatible with Obsidian:
- `[[wikilink]]` syntax matches Obsidian internal links
- YAML frontmatter between `---` is standard
- `#tag` and `#tag/subtag` match Obsidian tag syntax
- `.oxori/` can be excluded in Obsidian settings (Settings → Files and Links → Excluded files)
- Obsidian's graph view will show the same link structure that Oxori traverses

Humans use Obsidian. Agents use CLI/MCP. Same vault, different doors.

## Phased Delivery

### Faz 1 — Parse and Markdown Index
- `types.ts` — type definitions
- `parser.ts` — extract frontmatter, tags, wikilinks from a single file
- `indexer.ts` — scan vault, generate `.oxori/index/files.md`, `tags.md`, `links.md`
- `cli.ts` — `oxori init`, `oxori index`
- Tests and CI pipeline setup

### Faz 2 — Query and Graph Walk
- `query.ts` — query language parser and evaluator
- `graph.ts` — link graph traversal with depth, direction, relation
- `cli.ts` — `oxori query`, `oxori walk`, `oxori graph`
- Tests for query edge cases and graph cycles

### Faz 3 — Read/Write API and Governance
- `writer.ts` — create and append with frontmatter conventions
- `governance.ts` — parse governance.md, enforce rules
- `index.ts` — public SDK: `Oxori.open()`, `vault.query()`, `vault.walk()`, `vault.write()`
- `cli.ts` — `oxori write`, `oxori append`
- Tests for governance and write validation

### Faz 4 — Semantic Search
- `search.ts` — embedding provider interface, binary storage, cosine similarity
- Default provider: OpenAI API via HTTP
- `cli.ts` — `oxori search`, `oxori embed`
- Tests with mock embeddings

### Faz 5 — MCP Server and Obsidian Compatibility
- `mcp.ts` — MCP server with all tools and resources
- `watcher.ts` — chokidar filesystem monitoring
- Obsidian compatibility documentation and testing
- Integration tests: full agent workflow via MCP

## What Oxori Does NOT Do

- Does not use an external database
- Does not enforce folder structure
- Does not replace Git for version control or concurrency
- Does not constrain human access (governance is agent-only)
- Does not provide a UI (Obsidian is the UI layer for now)
- Does not host or sync data to the cloud
- Does not require internet (unless using API-based embeddings)
