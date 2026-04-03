### 2026-04-03: types.ts review verdict
**By:** Flynn
**Verdict:** CHANGES REQUESTED

---

## Findings

### ❌ Issue 1 — `FrontmatterEntry` not exported (BLOCKER)

The Phase 1 backlog explicitly lists `FrontmatterEntry` as a required named export. It is absent. `Record<string, unknown>` is used inline in both `ParsedFile` and `FileEntry`. While semantically equivalent, a named `FrontmatterEntry` type is required for:
- Consistent import surface (`import type { FrontmatterEntry } from './types'`)
- Future narrowing/extension without touching `ParsedFile`/`FileEntry` signatures

**Fix:** Add the following and substitute the inline `Record<string, unknown>` usages in `ParsedFile` and `FileEntry`:
```typescript
/**
 * Schemaless frontmatter representation.
 * Any YAML key-value is valid — no predefined schema enforced.
 */
export type FrontmatterEntry = Record<string, unknown>;
```
Then in `ParsedFile` and `FileEntry`, change `frontmatter: Record<string, unknown>` → `frontmatter: FrontmatterEntry`.

---

### ❌ Issue 2 — Individual types lack JSDoc (BLOCKER)

The file header JSDoc is excellent. However, the backlog criterion "Types documented with JSDoc" means each **exported type** should carry its own JSDoc block. None of `ParsedFile`, `FileEntry`, `TagEntry`, `LinkEntry`, `TypedRelation`, `IndexState`, `VaultConfig`, `OxoriError`, `Result`, `WatchEvent`, `GovernanceRule` have per-type JSDoc.

**Fix:** Add a JSDoc comment above each exported type explaining:
- What the type represents
- Any non-obvious field semantics (e.g., why `FileEntry` uses `ReadonlySet`/`ReadonlyMap` vs `ParsedFile`)
- Phase relevance for Phase 3-5 types

Example for `ParsedFile`:
```typescript
/**
 * Output of the parser for a single markdown file.
 * Mutable by design — the parser builds this incrementally.
 * Contrast with {@link FileEntry}, which is the read-only index record.
 */
export type ParsedFile = { ... };
```

---

### ✅ No `any` types — PASS

Zero `any` found. `unknown` is used correctly throughout.

### ✅ Named exports only — PASS

No default exports. `ok` and `err` are named function exports (utility constructors for `Result<T,E>`) — acceptable here.

### ✅ `type` keyword — PASS

All structural definitions use `type`, not `interface`. Correct per PROJECT.md conventions.

### ✅ Zero src/ dependencies — PASS

No imports from other `src/` modules. Types are self-contained.

### ✅ API surface quality — PASS (with notes)

- `ParsedFile` vs `FileEntry` mutability split (mutable for parser, readonly for index) is good design — but **must be explained in JSDoc** (Issue 2 above).
- `TagEntry.files` and `LinkEntry.sources` are mutable `Set<string>` while `FileEntry` uses `ReadonlySet`. Minor inconsistency — acceptable for Phase 1 since these are index-builder intermediates, but should be noted in JSDoc.
- `Result<T, E>` with `ok()`/`err()` constructors is a clean pattern.
- Phase 2-5 types (`IndexState`, `VaultConfig`, `WatchEvent`, `GovernanceRule`) are forward-looking and do not create breaking changes — approved as-is.

---

## Summary

Two blockers, both straightforward to fix:
1. Add `FrontmatterEntry` as a named export and use it in `ParsedFile`/`FileEntry`
2. Add per-type JSDoc to all exported types

---

## Action

**Assigned to:** Ram (not Tron — original author cannot self-revise per team protocol)

Ram: implement the two fixes above in `src/types.ts`, then re-submit for Flynn's approval.

No other src/ files need to change — `FrontmatterEntry` is a transparent alias so any existing code using `Record<string, unknown>` stays type-compatible.
