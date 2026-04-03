### 2026-04-03: types.ts design decisions

**By:** Tron

**What:**
- `FileEntry` uses `ReadonlySet`/`ReadonlyMap` (not mutable `Set`/`Map`) to prevent accidental mutation of the in-memory cache — the indexer owns these structures, all other modules are consumers
- `Result<T, E>` tagged union pattern (discriminated on `ok: boolean`) for structured error handling across all modules — helper functions `ok()` and `err()` keep call sites concise
- `ParsedFile.tags` stores ALL ancestor levels of hierarchical tags (not just leaf) — `#project/auth/oauth` → `["project", "project/auth", "project/auth/oauth"]` enabling O(1) prefix matching at query time
- `TypedRelation.source` tracks filepath (not just filename stem) to enable graph traversal by absolute path — avoids an extra resolution step on every edge hop
- `WatchEvent` and `GovernanceRule` defined in Phase 1 to avoid type churn when Phase 3/5 lands
- `IndexState` map keys are consistent conventions: absolute paths for `files`, raw tag strings for `tags`, lowercase stems for `links`
- `typedRelations` values are `readonly string[]` in `FileEntry` vs mutable `string[]` in `ParsedFile` — indexer must copy/freeze parser output before storing in cache

**Why:** These are the foundational contracts for the entire codebase. Getting the mutability boundaries and key conventions right here prevents an entire class of bugs in the indexer, query engine, and graph traversal layers.
