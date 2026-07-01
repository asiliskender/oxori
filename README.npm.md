# oxori

> Agents read and write knowledge in natural language, without drowning in it.

[![npm](https://img.shields.io/npm/v/oxori)](https://www.npmjs.com/package/oxori)
[![license](https://img.shields.io/badge/license-MIT-blue)](https://github.com/asiliskender/oxori/blob/main/LICENSE)

Oxori is a CLI toolkit for indexing and searching a markdown knowledge base. Keep a vault of `.md` files — Oxori makes any piece of it findable in milliseconds, no matter how large the vault grows.

## Install

```sh
npx oxori
```

```sh
npm install -g oxori
```

## Usage

```sh
oxori init [path]          # initialize a vault and build the first index
oxori index [path]         # re-index after writing or editing notes
oxori search "query"       # full-text search, returns JSON
oxori search --tag "tag"   # filter by tag
oxori search --link "note.md"  # links and backlinks
```

## Documentation & source

Full documentation, architecture notes, and agent guidelines are on GitHub:
**[github.com/asiliskender/oxori](https://github.com/asiliskender/oxori)**

## License

MIT
