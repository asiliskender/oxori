# Project Context

- **Owner:** Onur Asiliskender
- **Project:** Oxori — TypeScript CLI toolkit for indexing and searching markdown knowledge bases. Agents use it to read/write a vault of .md files and find the right piece without scanning everything.
- **Stack:** TypeScript, Node.js, commander/yargs (CLI), GitHub Actions, semantic-release, npm
- **Created:** 2026-06-30

## Key CLI & DevOps Facts

- Entry point: `npx oxori` — compiled TypeScript in `dist/`, `bin` entry in `package.json`.
- Commands: `oxori init`, `oxori index`, `oxori search "<query>"` (with `--json` flag).
- Output contract: path + headings + snippet per result. Human-readable default, `--json` for structured.
- CI: GitHub Actions — test + lint on PR; semantic-release on merge to main → npm publish.
- Versioning: Conventional Commits → semantic-release (no manual version bumps).
- First version: 0.1.0.

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

## Learnings

- `"type": "module"` in package.json required for unified v11 (ESM-only)
- tsconfig moduleResolution: NodeNext required with type:module
- biome.json schema version must match installed biome version
- src/ skeleton uses _prefixed unused params to satisfy strict mode without real implementations
