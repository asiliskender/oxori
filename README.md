# oxori

[![npm version](https://img.shields.io/npm/v/oxori.svg)](https://www.npmjs.com/package/oxori)

> Where humans and AI agents think together, in markdown.

Make your markdown vault queryable, traversable, and semantically searchable — without an external database. The index itself is markdown. Oxori is a shared knowledge layer for humans and AI agents.

Your markdown files stay readable, editable, yours. Oxori makes them queryable. Tags and links become a graph you can walk. Frontmatter becomes indexed metadata you can filter. Content becomes semantically searchable via embeddings. Humans write the rules, agents record the decisions.

## Features

- ✅ **Parse markdown files** — extract frontmatter (YAML), tags, wikilinks, typed relations
- ✅ **Build in-memory index** — scan a vault and create `.oxori/index/` markdown files
- ✅ **Human-readable index** — `files.md`, `tags.md`, `links.md` are markdown and Git-friendly
- ✅ **Query engine** — filter files by tag, type, path, frontmatter, title, link
- ✅ **Graph traversal** — BFS walk with cycle detection, direction, and typed relations
- ✅ **CLI commands** — `oxori query`, `oxori walk`, `oxori graph`
- ✅ **File watching** — real-time vault change events (add/change/unlink)
- ✅ **Governance** — policy rules via glob patterns with deny/allow effects
- ✅ **Semantic search** (optional) — embed files with OpenAI or custom providers, find by content similarity

## Installation

```bash
# Install as a dev dependency or globally
npm install --save-dev oxori
# or
npm install -g oxori

# Or use with npx without installing
npx oxori init ./my-vault
```

Requires Node.js 20 or later.

## Quick Start

### Initialize a vault

```bash
oxori init ./my-vault
```

This creates the `.oxori/` folder structure. You can add markdown files to your vault now.

### Index your vault

```bash
cd my-vault
oxori index
```

Output:
```
Scanning vault...
Parsed 42 files
Found 15 tags
Found 128 wikilinks
Index written to .oxori/index/

Summary:
  Files indexed: 42
  Tags: 15
  Links: 128
```

Now `.oxori/index/` contains three markdown files:
- `files.md` — registry of all indexed files with frontmatter
- `tags.md` — tag-to-file mappings
- `links.md` — link graph (source, target, relation)

### Query your vault

```bash
oxori query "tag:auth AND type:decision"
oxori query "tag:auth AND (type:decision OR path:~/docs)" --json
oxori query "NOT tag:draft" --vault ./my-notes
```

### Walk the graph

```bash
oxori walk path/to/note.md
oxori walk path/to/note.md --direction backward --via links
oxori walk path/to/note.md --depth 2 --json
```

### View full graph

```bash
oxori graph
oxori graph --json
```

### SDK Usage

#### Parse and Index

```typescript
import { parseFile } from 'oxori/parser';
import { buildIndex } from 'oxori/indexer';

// Parse a single file
const result = await parseFile('/path/to/note.md');
if (result.ok) {
  console.log(result.value.tags); // Set<string>
  console.log(result.value.wikilinks); // Set<string>
}

// Build index from vault
const indexResult = await buildIndex('/path/to/vault');
if (indexResult.ok) {
  const { state, filesCount, tagsCount, linksCount } = indexResult.value;
  console.log(`Indexed ${filesCount} files, ${tagsCount} tags`);
}
```

#### Query and Walk

```typescript
import { tokenize, parse, evaluate, walk } from 'oxori';

// Query the vault
const ast = parse(tokenize("tag:auth AND type:decision"));
const queryResult = evaluate(ast, state);
console.log(queryResult.totalMatched); // number of matching files

// Walk the link graph
const walkResult = walk("/path/to/note.md", state, {
  direction: "outgoing",
  via: "links",
  depth: 3,
});
console.log([...walkResult.visitOrder]); // paths of reachable files
```

#### File Watcher

```typescript
import { watch } from 'oxori';

const watcher = watch('/path/to/vault');
watcher.on('change', (event) => {
  console.log(`${event.type}: ${event.filepath}`);
  // event.type is 'add' | 'change' | 'unlink'
  // event.filepath is absolute path
  // event.timestamp is milliseconds since epoch
});

watcher.on('error', (err) => {
  console.error('Watch error:', err);
});

// later:
watcher.stop();
```

#### Governance

```typescript
import { checkGovernance } from 'oxori';
import type { GovernanceRule } from 'oxori';

const rules: GovernanceRule[] = [
  {
    id: 'no-drafts',
    description: 'Block writes to draft files',
    pattern: 'drafts/**',
    effect: 'deny',
    appliesTo: 'agents'
  },
  {
    id: 'allow-decisions',
    description: 'Allow all decision files',
    pattern: 'decisions/**',
    effect: 'allow',
    appliesTo: 'agents'
  }
];

const result = checkGovernance(rules, state);
if (!result.passed) {
  result.violations.forEach(v => {
    console.log(`[${v.severity}] ${v.ruleId}: ${v.message}`);
  });
}
```

#### Semantic Search

Semantic search is optional — your vault works fine without embeddings. When enabled, search finds files by content similarity using embeddings.

```typescript
import { indexVault, embedVault, searchVault, createOpenAIProvider } from "oxori";

// Create a provider (built-in OpenAI or custom)
const provider = createOpenAIProvider({ apiKey: process.env.OPENAI_API_KEY });

// Embed all markdown files once
await embedVault("./my-vault", provider);

// Search by semantic similarity
const results = await searchVault("./my-vault", "find notes about TypeScript", provider);
results.forEach(r => {
  console.log(`${r.filepath}: ${(r.score * 100).toFixed(1)}% match`);
});
```

**Key points:**
- Embeddings are stored in `.oxori/vectors/` as binary files.
- Semantic search is completely optional — core Oxori (index, query, walk, governance) works without any setup.
- Use `createStubProvider()` for deterministic offline testing.
- Incremental embedding skips files that haven't changed.

See [docs/semantic-search.md](docs/semantic-search.md) for complete API reference and provider patterns.

## Vault Structure

Oxori works with any folder of markdown files. No special structure required. Example vault:

```
my-vault/
├── .oxori/                        # Oxori index (auto-created)
│   ├── index/
│   │   ├── files.md
│   │   ├── tags.md
│   │   └── links.md
│   └── governance.md              # Rules file
├── decisions/
│   └── api-choice.md
├── tasks/
│   └── implement-auth.md
├── memory/
│   └── auth-notes.md
└── README.md
```

Each file is plain markdown with optional YAML frontmatter:

```markdown
---
type: decision
status: open
tags: [auth, security]
depends_on: [[user-model]]
author: agent:researcher
created_at: 2026-04-03T14:30:00Z
---

# Use OAuth2 for API Authentication

We decided to use OAuth2 because...
```

## Index Files

After running `oxori index`, three markdown files are created under `.oxori/index/`:

### files.md

Registry of all indexed files:

```markdown
---
type: oxori-index
generated_at: 2026-04-03T15:00:00Z
file_count: 42
---

## decisions/api-choice.md
- type: decision
- status: open
- tags: auth, security, sprint-3
- depends_on: [[user-model]]
- links_out: user-model, deploy-v2
- modified: 2026-04-03T14:30:00Z

## tasks/implement-auth.md
- type: task
- ...
```

### tags.md

Tag-to-file mappings:

```markdown
---
type: oxori-tags
generated_at: 2026-04-03T15:00:00Z
tag_count: 15
---

## auth
- decisions/api-choice.md
- tasks/implement-auth.md
- memory/auth-notes.md

## sprint-3
- decisions/api-choice.md
- tasks/implement-auth.md
```

### links.md

Wikilink graph:

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
| memory/auth-notes.md | oauth2-docs | reference |
```

## Architecture

See [docs/architecture.md](docs/architecture.md) for the complete system design, including all 9 layers, data flow, type system, and design decisions.

**Overview:**

Oxori's parser reads markdown files and extracts frontmatter, tags, and wikilinks. The indexer builds three in-memory data structures (files, tags, links) and persists them as markdown files under `.oxori/index/`. These index files are human-readable, Git-friendly, and regenerable at any time.

The query engine filters files by tag, type, path, and frontmatter. Graph traversal walks the wikilink graph and typed relationships. File watching tracks vault changes in real-time. Governance rules control agent write access.

See [docs/architecture.md](docs/architecture.md) for complete system design.

## License

MIT — use Oxori however you like. Your vault, your rules.

