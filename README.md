# oxori

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

Returns matching files with **path + headings + snippet**. Searches the index — never scans the raw files.

**Search modes:**

| Mode | Flag | Example |
|------|------|---------|
| Full-text (default) | — | `oxori search "wristband"` |
| Tag filter | `--tag` | `oxori search --tag "#rust"` |
| Structural (links) | `--link` | `oxori search --link "note-a.md"` |

**JSON output:**

```sh
oxori search "wristband" --json
```

Returns the same data as structured JSON — useful for agents that prefer to parse.

**Example output:**

```
📄 notes/decision-log.md
   Headings: Architecture › Storage
   …the wristband approach was chosen for its low overhead…
────────────────────────────────────────────────────────────
```

## How it works

- Knowledge lives in plain `.md` files — the same files a human reads in Obsidian
- Oxori builds a derived, disposable `index.json` from your notes
- `[[wikilinks]]` and `#tags` follow Obsidian conventions
- The index is always rebuildable from the markdown — delete `.oxori/` and run `oxori init` to start fresh

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