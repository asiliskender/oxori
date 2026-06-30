# Project Context

- **Owner:** Onur Asiliskender
- **Project:** Oxori — TypeScript CLI toolkit for indexing and searching markdown knowledge bases. Agents use it to read/write a vault of .md files and find the right piece without scanning everything.
- **Stack:** TypeScript, Node.js, unified/remark (markdown parsing), JSON index, GitHub Actions, semantic-release, npm
- **Created:** 2026-06-30

## Key Architecture Facts

- Modules: `cli` → `commands` → (`parser`, `indexer`, `search`) → `store` → fs. Dependencies one way only.
- Index is `index.json` under `.oxori/` — derived, disposable, plain JSON.
- Parser: unified/remark for standard markdown + thin custom step for `[[wikilinks]]` and `#tags`.
- Change detection: content hash per file stored in index.
- Search never touches `.md` files — answers from `index.json` only.

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
