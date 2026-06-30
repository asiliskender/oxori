# Project Context

- **Owner:** Onur Asiliskender
- **Project:** Oxori — TypeScript CLI toolkit for indexing and searching markdown knowledge bases. Agents use it to read/write a vault of .md files and find the right piece without scanning everything.
- **Stack:** TypeScript, Node.js, Vitest (testing), GitHub Actions
- **Created:** 2026-06-30

## Key Testing Facts

- Testing framework: Vitest (or Jest — to be confirmed during setup).
- Coverage measured and reported, NOT enforced as a hard gate.
- Unit tests: modules in isolation (parser, indexer, store, search, cli).
- Integration tests: real temp dirs, real file writes, real index.json output.
- Phase 1 Definition of Done = 7-step acceptance scenario in SPEC.md § 8.
- Edge cases to cover: empty vault, corrupt index (rebuild), deleted files, broken [[links]], zero search results, `init` on already-initialized vault.

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- Vitest works with ESM (type: module) out of the box — no special config needed
- Use os.tmpdir() + randomUUID() for test isolation, not shared fixtures
- afterEach cleanup with force:true prevents test failures from leaking temp files
- parser.test.ts needs real file writes — parseFile reads from disk
- store.test.ts: malformed JSON test requires manually writing corrupt content to .oxori/
- Integration tests import command functions directly — cleaner than spawning a child process
- searchCommand needs an initialized vault — always call initCommand first in integration tests
- indexCommand after edit: overwrite the file, then call indexCommand; check record.text changed
- indexCommand after delete: rm the file, call indexCommand, verify files array doesn't include path
