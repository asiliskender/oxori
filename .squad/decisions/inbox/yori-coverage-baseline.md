# Coverage Baseline: indexer.ts + parser.ts — Issues #46 + #47

**Author:** Yori (Tester / QA)
**Date:** 2026-04-XX
**Closes:** #46 (indexer), #47 (parser)
**Branch:** `feature/phase-4-semantic-search`

---

## Before / After Coverage

| File        | Stmts (before) | Stmts (after) | Branch (before) | Branch (after) | Funcs (before) | Funcs (after) |
|-------------|---------------|---------------|-----------------|----------------|----------------|---------------|
| indexer.ts  | 47.15%        | **96.02%**    | 80.00%          | **95.74%**     | 57.14%         | **100%**      |
| parser.ts   | 80.76%        | **99.23%**    | 74.07%          | **86.11%**     | 100%           | **100%**      |

---

## What Was Covered

### indexer.ts (47% → 96%)

Previously, only `indexVault` was exercised. Now all exported and internal functions are tested:

- `createEmptyState` — empty Maps, zero counters
- `indexFile` — happy path, re-index (stale removal), FILE_NOT_FOUND, PARSE_ERROR (bad YAML), non-ENOENT stat failure, same-reference return
- `removeFile` — removes entries, no-op for unknown file, preserves shared tags/links
- `removeFileFromState` — now exercised via `indexFile` re-index and `removeFile`
- `indexVault` error paths — VAULT_NOT_FOUND (ENOENT), VAULT_NOT_FOUND (ENOTDIR), parse-error skip + console.warn, empty vault, duplicate filenames in subdirs

### parser.ts (80.76% → 99.23%)

Previously, all errors were hit via fixture files that always succeeded. Added:

- `parseFile` — FILE_NOT_FOUND (ENOENT), PARSE_ERROR (ENOTDIR/non-ENOENT read failure), PARSE_ERROR (malformed YAML)
- `expandTagHierarchy` — unit tests: 1-, 2-, 3-level tags
- `extractWikilinks` — aliased form, .md stripping, lowercase, multi-link, empty input
- `extractTags` — frontmatter array, single-string, `tags: null`, non-string items, dedup
- `extractTypedRelations` — string values, array values, no-wikilink values, empty

---

## Remaining Gaps (by design — unreachable in normal operation)

### indexer.ts line 308–314 (not covered, ~1.5% of statements)
The `catch` block inside the `indexVault` file loop that handles a failed `stat()` call on a `.md` file that was returned by `readdir`. This requires a file to exist at `readdir` time but become un-stat-able before `stat()` is called — a race condition. Not testable without mocking `node:fs/promises`. Documented as dead code in normal operation.

### parser.ts line 218 (not covered, ~0.8% of statements)
The `"Unknown YAML parse error"` fallback triggered when gray-matter throws a non-Error value with no `message` property. In practice, gray-matter delegates to js-yaml which always throws `YAMLException` (a proper `Error` subclass with `message`). This branch is unreachable via the public API without injecting a mock. Documented as dead code.

---

## Notes for Team

- YAML error trigger: `foo: *undefined_anchor` (undefined alias) reliably causes gray-matter 4.x / js-yaml to throw `YAMLException`.
- Non-ENOENT I/O errors: using `/etc/hosts/fake.md` as a path triggers `ENOTDIR` from `stat`/`readFile` without any mocking.
- Both files now exceed the 95% threshold for parser and indexer mandated by project charter.
