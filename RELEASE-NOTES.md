# Release Notes

## v0.4.0

Oxori v0.4.0 adds semantic search, extends governance rules, and improves test coverage.

### Semantic Search (Optional)

Semantic search is an optional layer on top of core Oxori. Vaults work perfectly without embeddings — index, query, and governance work with or without vectors.

#### Providers

- **`EmbeddingProvider` interface** — Abstract embedding API. Bring your own provider, or use built-ins.
- **`createOpenAIProvider(config)`** — Built-in OpenAI provider using native fetch (no heavy dependencies). Supports `text-embedding-3-small` (default, 1536 dims) and `text-embedding-3-large` (3072 dims). Configure with `{ apiKey, baseUrl?, model? }`.
- **`createStubProvider(dimensions?)`** — Deterministic offline provider for testing. Same text always produces same vector.

#### Vector Storage

- **`VectorStore` class** — Manages `.oxori/vectors/` index. Handles storage, retrieval, and staleness detection via SHA-256 content hashing.
- **Binary `.vec` format** — 4-byte OXOR magic (`0x4f584f52`), u32 version (1), u32 dimensions, N×float32 little-endian. Human-inspectable with `xxd`.
- **Incremental embedding** — `embedVault()` skips files whose content hash hasn't changed and whose embedding model hasn't changed. Use `--force` flag to re-embed all files.

#### Semantic Search API

- **`embedVault(vaultPath, provider, options?)`** — Batch-embed all markdown files. Returns `{ embedded, skipped, failed }`. Store vectors under `.oxori/vectors/index.json` + `.vec` files.
- **`searchVault(vaultPath, query, provider, options?)`** — Find semantically similar files. Returns `SearchResult[]` ranked by `cosineSimilarity`. Options: `topK` (default 10), `minScore` (default 0).
- **`cosineSimilarity(vecA, vecB)`** — Compute cosine similarity between two embeddings.

#### CLI Commands

- **`oxori embed <vaultPath>`** — Embed all markdown files using OpenAI provider (default).
  - `--api-key <key>` or `OXORI_API_KEY` env var
  - `--model <name>` — OpenAI model (default: `text-embedding-3-small`)
  - `--force` — Re-embed all files regardless of staleness
  - `--base-url <url>` — Custom API endpoint

- **`oxori search <vaultPath> <query>`** — Search semantically similar files.
  - `--api-key <key>` or `OXORI_API_KEY` env var
  - `--top-k <number>` — Return top-K results (default 10)
  - `--min-score <number>` — Minimum cosine similarity threshold (default 0)
  - `--json` — Output as JSON

### Governance Rules Extended

`GovernanceRule` is now a **discriminated union** with three variants. Existing rules migrate automatically by adding a `ruleType` field.

- **`PathRule`** — Original pattern-based allow/deny behavior. `{ ruleType: "path", id, pattern, effect, appliesTo, description? }`. Apply to filepaths.
- **`TagRule`** — Require files matching a glob pattern to have a specific tag. `{ ruleType: "tag", id, pattern, requiredTag, description? }`. Useful for enforcing structure (e.g., all decisions must have a status tag).
- **`LinkRule`** — Enforce outbound link count constraints. `{ ruleType: "link", id, pattern, minLinks?, maxLinks?, description? }`. Ensure files are properly connected.

All three types are evaluated by `checkGovernance()` via switch/case on the `ruleType` discriminant, ensuring exhaustive handling. Rules are evaluated in declaration order; first match wins.

### Coverage Improvements

- **`indexer.ts`**: 47% → 96% — Comprehensive error paths, edge cases, and file I/O scenarios.
- **`parser.ts`**: 80% → 99% — Frontmatter variants, tag hierarchies, typed relations, edge cases.

### New Exports

**Types:** `Embedding`, `EmbeddingProvider`, `OpenAIProviderConfig`, `SearchResult`, `SearchOptions`, `VectorEntry`, `VectorIndex`, `EmbeddingErrorCode`, `PathRule`, `TagRule`, `LinkRule`.

**Functions:** `createOpenAIProvider`, `createStubProvider`, `cosineSimilarity`, `writeVecFile`, `readVecFile`, `VectorStore`, `searchVault`, `embedVault`.

### Breaking Changes

**`GovernanceRule` type migration required**

In v0.3.0, `GovernanceRule` was a simple object:
```typescript
const rule: GovernanceRule = {
  id: "no-drafts",
  pattern: "drafts/**",
  effect: "deny",
  appliesTo: "agents",
  description: "Block writes to draft files"
};
```

In v0.4.0, `GovernanceRule` is a discriminated union. Add `ruleType: "path"` to migrate:
```typescript
const rule: GovernanceRule = {
  ruleType: "path",  // ← NEW: discriminator
  id: "no-drafts",
  pattern: "drafts/**",
  effect: "deny",
  appliesTo: "agents",
  description: "Block writes to draft files"
};
```

For TypeScript projects, the type checker will flag old rules. For JavaScript projects, `checkGovernance()` still works but may produce unexpected behavior if the discriminator is missing — ensure migration.

**Migration strategy:** Search your codebase for `GovernanceRule` literals. Add `ruleType: "path"` to all existing rules. New rules can use `"tag"` or `"link"` as needed.

---

# Release Notes — v0.3.0

## What's New

Oxori v0.3.0 extends the query engine with real-time vault monitoring and policy enforcement:

### File Watcher

- **`watch(vaultPath, config?)`** — Real-time file watcher emitting `WatchEvent` (add/change/unlink) for markdown files in your vault. Built on EventEmitter for easy integration with indexers and MCP servers.
- **WatchEvent** — Emitted on file changes with fields: `type` (add/change/unlink), `filepath` (absolute), `timestamp` (ms)

### Governance Rules

- **`checkGovernance(rules, state)`** — Glob-pattern-based governance rule evaluation. Define rules with `id`, `pattern`, `effect` (allow/deny), and `appliesTo` (agents). Returns `GovernanceResult` with violations list.
- **Enforcement** — Policy rules apply to agent writes only; humans bypass governance by design.

### Types

- **New exports** — `VaultWatcher`, `WatchEvent`, `GovernanceRule`, `GovernanceViolation`, `GovernanceResult` are now part of the public API alongside existing query and graph traversal types.

### Documentation

- **README.md** — Updated with "File Watcher" and "Governance" sections with complete code examples.
- **docs/architecture.md** — Added "Sprint 3 Additions" section with watcher and governance implementation details.

### Pure Function Design

Both the watcher and governance layers are implemented as pure functions with no I/O or side effects in core logic, maintaining the SDK's simplicity and testability.

