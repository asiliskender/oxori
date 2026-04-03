# Oxori

**Where humans and AI agents think together, in markdown.**

Your markdown files stay as they are — readable, editable, yours. Oxori makes them queryable, traversable, and searchable. Tags and links become a graph you can walk. Frontmatter becomes structured data you can filter. Content becomes semantically searchable. Humans write the rules, agents record the decisions. 


## What Oxori Does

- **Indexes** your markdown files into a markdown-based index under `.oxori/` — no external database, the index itself is human-readable and Git-versioned
- **Queries** files by any frontmatter field, tag, or combination (`status:open AND tag:auth`)
- **Walks** the link graph between files with configurable depth — find related decisions, dependencies, and context through wikilinks and typed relations
- **Searches** content semantically using vector embeddings — find relevant files by meaning, not just keywords
- **Reads and writes** — both humans and agents can create, read, and update files through a shared API
- **Governs** access through markdown rules — define which agents can write where, enforced at the API layer

## Who Is This For

- **AI agent developers** who need structured, persistent, shared memory for their agents
- **Humans working with agents** who want to see, edit, and govern what their agents know
- **Teams** where multiple agents and humans collaborate on the same knowledge base

## Quick Start

```bash
# Run directly with npx (no install needed)
npx oxori init ./my-vault
npx oxori index

# Or install globally
npm install -g oxori

# Query by frontmatter
oxori query "type:decision AND status:open"

# Walk the link graph from a file
oxori walk decisions/api-choice.md --depth 2

# Search semantically
oxori search "authentication approach"

# Create a new file
oxori write decisions/caching-strategy.md \
  --type decision --status open --author agent:planner \
  --tags "performance,infrastructure" \
  --body "We should use Redis because..."

# View the graph
oxori graph --format mermaid
```

## Programmatic Usage

```typescript
import { Oxori } from "oxori";

const vault = await Oxori.open("./my-vault");

// Query
const decisions = await vault.query("type:decision AND status:open");

// Walk the graph
const related = await vault.walk("decisions/api-choice.md", { depth: 2 });

// Write (governance-checked)
await vault.write("memory/auth-notes.md", {
  frontmatter: { type: "memory", author: "agent:researcher", tags: ["auth"] },
  body: "OAuth2 was chosen for the public API.",
});

// Search semantically
const results = await vault.search("authentication approach");
```

## Vault Structure

Oxori works with any folder of markdown files. No special structure required. A typical vault might look like:

```
my-vault/
├── .oxori/                        # Oxori index and config (auto-generated)
│   ├── index/
│   │   ├── files.md               # file registry with frontmatter summary
│   │   ├── tags.md                # tag to file mappings
│   │   └── links.md               # link graph (source, target, relation)
│   ├── vectors/                   # embedding cache (binary, not source of truth)
│   └── governance.md              # access rules for agents
├── agents/
│   └── researcher.md              # agent persona, rules, limits
├── decisions/
│   └── api-choice.md              # type: decision, status, depends_on
├── tasks/
│   └── implement-auth.md          # type: task, assignee, priority, blocks
├── memory/
│   └── user-preferences.md        # learned facts, observations
└── logs/
    └── session-2026-04-03.md      # execution history
```

Each file is a regular markdown file with optional YAML frontmatter:

```markdown
---
type: decision
status: open
tags: [auth, security, sprint-3]
depends_on: [[user-model]]
blocks: [[deploy-v2]]
author: agent:researcher
created_at: 2026-04-03T14:30:00Z
---

# Use OAuth2 for API Authentication

We decided to use OAuth2 because...

Related: [[api-choice]], [[security-review]]
```

## Governance

Governance rules live in `.oxori/governance.md` and constrain **agents only** — humans have full access (via Obsidian or any editor). Rules are enforced at the CLI/SDK/MCP layer.

```markdown
---
type: governance
---

## Write Rules

- `rules/` — human-only, agents cannot modify
- `memory/` — agents can create and append, humans can read and edit
- `decisions/` — agents can create with status:draft, only humans can set status:approved
- All agent-created files must include `author` and `created_at` in frontmatter
- Agents cannot delete files

## Agent Permissions

- agent:researcher — read all, write to memory/ and logs/
- agent:planner — read all, write to tasks/ and decisions/
```

## Obsidian Compatibility

Oxori is designed to work alongside Obsidian. Humans use Obsidian as the visual interface, agents use CLI/MCP — same vault, different doors.

Oxori conventions are Obsidian-compatible:
- Standard YAML frontmatter
- `[[wikilink]]` syntax for internal links
- `#tag` and `#tag/subtag` for hierarchical tags
- Plain markdown files, no proprietary format

The `.oxori/` folder is the only addition. Exclude it in Obsidian settings if needed.

## How It Works

1. **Your markdown files are the source of truth.** Always.
2. **The index is also markdown.** Stored under `.oxori/index/`, human-readable, Git-versioned. Not a database — a derived summary that can be regenerated from the source files at any time.
3. **A graph layer** builds a traversable network from wikilinks and typed relations in frontmatter.
4. **A semantic layer** (optional) embeds file content for vector similarity search. Embeddings are cached under `.oxori/vectors/` as binary — derived data, not source of truth. Delete them and they regenerate.
5. **Governance** is a markdown file read at runtime. It constrains agent writes, not human access.
6. **Multi-agent concurrency** is handled by Git — branch, merge, resolve conflicts. Oxori does not manage locks.

## Integrations

- **CLI** — `oxori` command for terminal and scripting
- **TypeScript SDK** — `import { Oxori } from "oxori"` for agent frameworks
- **MCP Server** — plug into Claude, Cursor, or any MCP-compatible client
- **Obsidian** — humans use Obsidian as the UI for the same vault

## Philosophy

- **Markdown-first.** Everything is markdown — files, index, governance, config.
- **No lock-in.** Delete Oxori and your files are still just markdown. Delete `.oxori/` and regenerate.
- **Local-first.** Your data stays on your machine. No cloud required.
- **Convention over configuration.** Frontmatter is your schema. Tags are your index. Links are your relations.
- **Governance constrains agents, not humans.** Humans are the owners. Agents operate within defined boundaries.

## Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| Faz 1 | Parse and markdown-based index | Next |
| Faz 2 | Query engine and graph walk | Planned |
| Faz 3 | Read/write API and governance | Planned |
| Faz 4 | Semantic vector search | Planned |
| Faz 5 | MCP server and Obsidian compatibility | Planned |

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup. CI/CD runs on GitHub Actions — every push triggers linting, type checking, and tests. Releases are auto-versioned from conventional commits.

## License

MIT

