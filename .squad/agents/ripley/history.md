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

- unified v11 + remark-parse v11 are pure ESM — import as "unified" and "remark-parse" (no .js needed for npm packages, but src imports need .js)
- NodeNext moduleResolution requires explicit .js extensions on relative imports
- remark AST node types: Root, Heading, Text, Code, InlineCode, Paragraph, List, ListItem
- Tags: strip fenced code blocks AND heading lines from raw before regex — order matters
- Links: deduplicate with Set before returning — same [[target]] can appear multiple times
- broken flag initialized false in parser; indexer sets it when cross-referencing all files
- Link resolution: [[target]] tries exact path, then target+.md, then suffix match (path ends with /target.md). This covers flat vaults and nested vaults.
- broken flag mutation: parser initializes false, indexer corrects during buildLinkGraph — safe because reconcileFiles gives us fresh records
- readdir withFileTypes: more efficient than stat() per file
- relative() with split/join for cross-platform path normalization
