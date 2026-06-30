<p align="center">
  <img src="./assets/logo.png" alt="oxori" />
</p>

> Agents read and write knowledge in natural language, without drowning in it.

[![npm](https://img.shields.io/npm/v/oxori)](https://www.npmjs.com/package/oxori)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Oxori is a CLI toolkit for indexing and searching a markdown knowledge base. Use it when your vault of `.md` files grows large enough that scanning everything is no longer practical — Oxori keeps the right information findable no matter how big the base gets.

## Install

No install required:

```sh
npx oxori
```

Or install globally:

```sh
npm install -g oxori
```

## Usage

### Initialize a vault

```sh
oxori init [path]
```

Creates `.oxori/` beside your markdown files and builds the first index. If `path` is omitted, uses the current directory. Works with existing [Obsidian](https://obsidian.md) vaults.

### Update the index

```sh
oxori index [path]
```

Call this after writing or editing notes. Re-indexes only what changed (hash-based — fast on large vaults).

### Search

```sh
oxori search [query] [path]
```

Returns matching files with **path + headings + snippet**. Searches the index — never scans the raw files. **Output is JSON by default** — pipe it to `jq` or consume directly in your agent.

**Search modes:**

| Mode | Flag | Example |
|------|------|---------|
| Full-text | — | `oxori search "database migration"` |
| Tag filter | `--tag` | `oxori search --tag "backend"` |
| Structural (links) | `--link` | `oxori search --link "note.md"` |

**Notes on each mode:**

- **Full-text** searches both body text and headings — a file matches if the term appears anywhere.
- **Tag filter** reads both YAML frontmatter (`tags: [backend, api]`) and inline `#tag` syntax.
- **Structural** accepts a filename (`note.md`) or full relative path (`folder/note.md`). If two files share the same name, use the full path to disambiguate.

**Structural search** returns two groups (Obsidian-style):

```sh
oxori search --link "note.md"
```

```json
[
  { "path": "notes/overview.md", "direction": "link", "headings": ["Intro"], "snippet": "" },
  { "path": "notes/setup.md", "direction": "backlink", "headings": ["Setup"], "snippet": "" }
]
```

- `"direction": "link"` — files that `note.md` links **to**
- `"direction": "backlink"` — files that link **to** `note.md`

**Default JSON output:**

```sh
oxori search "database migration"
```

```json
[
  {
    "path": "notes/architecture.md",
    "headings": ["Design", "Storage Layer"],
    "snippet": "…the database migration strategy relies on versioned schemas…"
  }
]
```

**Human-readable output (`--pretty`):**

```sh
oxori search "database migration" --pretty
```

```
📄 notes/architecture.md
   Headings: Design › Storage Layer
   …the database migration strategy relies on versioned schemas…
────────────────────────────────────────────────────────────
```

## How it works

- Knowledge lives in plain `.md` files — the same files a human reads in Obsidian
- Oxori builds a derived, disposable `index.json` from your notes
- `[[wikilinks]]` and `#tags` follow Obsidian conventions — both frontmatter and inline tags are supported
- The index is always rebuildable from the markdown — delete `.oxori/` and run `oxori init` to start fresh
- When Oxori is upgraded, `oxori index` automatically re-parses all files if the parser logic changed

## Docs

| Document | What's in it |
|----------|-------------|
| [VISION.md](./VISION.md) | Why Oxori exists — the *md is the new db* thesis |
| [DECISIONS.md](./DECISIONS.md) | Every engineering decision and its rationale |
| [ARCHITECTURE_HIGH_LEVEL.md](./ARCHITECTURE_HIGH_LEVEL.md) | Components and data flows |
| [ARCHITECTURE_LOW_LEVEL.md](./ARCHITECTURE_LOW_LEVEL.md) | Storage formats, modules, parsing approach |
| [SPEC.md](./SPEC.md) | Exact command behavior and definition of done |
| [PLAN.md](./PLAN.md) | Phase 1 build plan |

## License

MIT
