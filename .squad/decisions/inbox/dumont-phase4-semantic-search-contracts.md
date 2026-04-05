# Decision: Phase 4 Semantic Search Architecture and Type Contracts

**Date:** 2026-04-05  
**Author:** Dumont (DevRel / Docs)  
**Status:** APPROVED  
**Relates to:** Issue #50, branch `feature/phase-4-semantic-search`

## Summary

Defined the complete Wave 0 (design-first) type contract for Phase 4 semantic search. This contract is **authoritative** — Wave 1 implementation must match it exactly. No breaking changes allowed without a new ADR and documentation update.

## Key Design Decisions

### 1. Optional Semantic Search Layer

**Decision:** Semantic search is entirely optional and requires explicit opt-in via `oxori embed`.

**Rationale:**
- Phase 1–3 Oxori must work with zero configuration and no external dependencies (including OpenAI API).
- Adding optional embeddings allows power users to enhance their vault without forcing dependencies or costs on all users.
- Opt-in prevents accidental API calls and maintains backwards compatibility.

**Consequence:** 
- Error code `VECTORS_NOT_BUILT` guides users to run `oxori embed` before using `vault.search()`.
- Core Vault API is unchanged; search is an additive method.

### 2. Binary Vector Storage (not JSON)

**Decision:** Store vectors in binary format (`.oxori/vectors/*.vec`) with a 16-byte header and IEEE 754 float32 payload.

**Rationale:**
- Binary is 4–5× more compact than JSON (raw bytes vs. ASCII hex digits).
- Faster to load (no parsing, just Buffer → float32array).
- 10,000 files at 1536 dimensions: ~60 MB (binary) vs. ~240 MB (JSON).
- Humans do not need to read vectors — metadata stays in `index.json`.

**Consequence:** 
- Vector files are opaque to humans, but still inspectable with hex dump if needed.
- Index file (`.oxori/vectors/index.json`) remains human-readable for debugging.

### 3. EmbeddingProvider Interface

**Decision:** Define a single `EmbeddingProvider` interface implemented by multiple concrete providers (OpenAI, stub, future custom).

**Rationale:**
- Pluggable architecture — easy to add new embedding models or providers without changing core search logic.
- Stub provider for testing ensures deterministic, offline tests (no real HTTP calls).
- Result<T, E> pattern matches Oxori's error handling style across all layers.

**Consequence:** 
- `embed(text)` returns `Promise<Result<Embedding, OxoriError>>`.
- All providers validate dimensions and return structured errors.
- Tests never need to mock HTTP — `createStubProvider()` handles it.

### 4. Staleness Detection via Content Hash

**Decision:** Track file staleness using SHA-256 content hash (of stripped body), not file mtime.

**Rationale:**
- File mtime is unreliable in distributed workflows (Git checkout, CI/CD, shared drives).
- Content hash reflects actual changes — only changed files are re-embedded.
- Incremental embedding is deterministic: same content always produces the same vector.
- Git-friendly — vectors can be checked in and shared.

**Consequence:** 
- Embedding is deterministic and reproducible.
- Large vaults with few changes re-embed only changed files (fast incremental updates).
- `oxori embed --force` re-embeds all files regardless of staleness.

### 5. Cosine Similarity Scoring

**Decision:** Use cosine similarity [0, 1] for search results, not Euclidean distance.

**Rationale:**
- Cosine similarity is the standard metric for embeddings (accounts for vector length normalization).
- Score range [0, 1] is intuitive (1 = identical, 0 = orthogonal).
- Efficient to compute (dot product of normalized vectors).

**Consequence:** 
- Vectors must be normalized before similarity computation (L2 norm).
- Scores are similarity measures (higher = more similar), not distances (lower = closer).

### 6. Stub Provider for Testing

**Decision:** Provide `createStubProvider()` — a deterministic, offline provider for test suites.

**Rationale:**
- Tests must not make real HTTP calls (slow, flaky, expensive, requires credentials).
- Stub provider uses a simple hash-based algorithm to derive vectors from text — same input always produces same vector.
- Stub provider enables full offline test coverage of search logic without API access.

**Consequence:** 
- All test files MUST use `createStubProvider()` or mock-based providers.
- Stub vectors are not semantically meaningful — they are only for testing vector operations.
- Developers can test locally without OpenAI API key.

## Type Contracts (Locked)

All public types are defined in `docs/semantic-search.md` and locked. Implementation must match exactly:

```typescript
type Embedding = number[];

interface EmbeddingProvider {
  embed(text: string): Promise<Result<Embedding, OxoriError>>;
  readonly dimensions: number;
  readonly model: string;
}

interface OpenAIProviderConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

function createOpenAIProvider(config: OpenAIProviderConfig): EmbeddingProvider;
function createStubProvider(dimensions?: number): EmbeddingProvider;

interface SearchResult {
  filepath: string;
  score: number;
  title?: string;
  excerpt?: string;
}

interface SearchOptions {
  topK?: number;
  minScore?: number;
}
```

## CLI Contracts (Locked)

All CLI commands and flags are specified in `docs/semantic-search.md`:

```bash
oxori embed [--provider --api-key --model --force]
oxori search <query> [--provider --api-key --top-k --min-score --json]
```

## SDK Contracts (Locked)

```typescript
vault.search(query: string, options?: SearchOptions): Promise<Result<SearchResult[], OxoriError>>;
```

## Error Codes (Locked)

8 new error codes defined for semantic search:

| Code | Meaning |
|------|---------|
| `VECTORS_NOT_BUILT` | Index file missing — run `oxori embed` first |
| `EMBEDDING_API_ERROR` | OpenAI API error (4xx, 5xx) |
| `EMBEDDING_NETWORK_ERROR` | Network error during embedding |
| `VECTOR_DIMENSION_MISMATCH` | Stored vector has wrong dimension count |
| `VECTOR_FORMAT_ERROR` | Corrupted `.vec` file (bad magic/format) |
| `FILE_NOT_FOUND` | Source file deleted after embedding |

## OpenAI Integration

**HTTP call specification (locked):**

```
POST {baseUrl}/embeddings
Authorization: Bearer {apiKey}
Content-Type: application/json

{ "input": "{text}", "model": "{model}" }
```

Response: Extract `data[0].embedding` array, validate dimensions, or return `EMBEDDING_API_ERROR`.

**Implementation requirement:** Use Node.js native `fetch()` only (no axios, no node-fetch).

## Wave 0 → Wave 1 Handoff

This document and `docs/semantic-search.md` constitute the **Wave 0 type contract**. Wave 1 implementation must:

1. Match all type signatures exactly (no breaking changes without new ADR).
2. Implement all CLI flags and options as specified.
3. Return the same error codes for the same failure conditions.
4. Use `Result<T, OxoriError>` throughout (already consistent with Oxori's style).
5. Implement `createOpenAIProvider()` and `createStubProvider()` as factories.

**Changes during Wave 1:** If a type contract change is needed:
- Create a new ADR explaining the change and rationale.
- Update `docs/semantic-search.md` with the new contract.
- Require team approval before merging.

## Status

✅ **APPROVED.** Type contracts are locked. Wave 1 implementation can begin with confidence that the contract is stable and complete.

**Artifacts:**
- `docs/semantic-search.md` — 27,091 bytes, 8 sections, 5 ADRs
- Commit `55e9484` — "docs(phase4): write semantic search architecture and type contract design doc" (closes #50)
- `.squad/agents/dumont/history.md` — Updated with completion note
