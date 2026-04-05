# Semantic Search Architecture

> Design-first specification for Phase 4. Implementation must match this type contract exactly.

## Overview

Semantic search adds vector-based similarity search to Oxori, enabling queries like "find all notes about authentication" without exact keyword matching. It is **optional and layered on top of Phases 1–3**: core Oxori requires zero configuration and works perfectly without embeddings.

**The optionality contract:**
- Oxori works with zero configuration (Phases 1–3: parse, index, query, graph, watch, govern).
- Semantic search requires explicit opt-in: run `oxori embed` to build vectors, then `oxori search` to query them.
- If `.oxori/vectors/index.json` does not exist, `vault.search()` returns a clear error: `"Run 'oxori embed' first."`.

**How embeddings flow through the system:**

```
.md files (vault)
    ↓
Parser (extract body text)
    ↓
EmbeddingProvider (text → vector)
    ↓
.oxori/vectors/ (binary storage: *.vec + index.json)
    ↓
vault.search(query) → cosine similarity → SearchResult[]
```

Each `.md` file is embedded once. The embedding is cached and re-used until the file changes (detected via content hash). Search is performed entirely in-memory over loaded vectors — no API calls during search itself.

---

## Type Contracts (TypeScript)

These are the **authoritative type shapes**. Implementation must match these exactly. All types are exported from the main SDK.

### Embedding Representation

```typescript
/**
 * A float32 array representing the vector embedding of a text.
 * Produced by an EmbeddingProvider and stored in binary form in `.oxori/vectors/`.
 * Typically 384–1536 dimensions depending on the model.
 *
 * @example
 * const embedding: Embedding = [0.123, -0.456, 0.789, ...];
 */
type Embedding = number[];
```

### EmbeddingProvider Interface

```typescript
/**
 * Provider interface for text-to-vector embedding.
 *
 * Implementations:
 * - `createOpenAIProvider()` — uses OpenAI's embeddings API (production)
 * - `createStubProvider()` — deterministic hash-based vectors (testing)
 *
 * All implementations return `Result<Embedding, OxoriError>` and respect the
 * Result type contract from src/types.ts.
 *
 * @example
 * const provider = createOpenAIProvider({ apiKey: process.env.OPENAI_API_KEY });
 * const result = await provider.embed("What is authentication?");
 * if (result.ok) {
 *   console.log(`Vector has ${result.value.length} dimensions`);
 * }
 */
interface EmbeddingProvider {
  /**
   * Embed a single text string into a vector.
   *
   * @param text - The text to embed. Can be a sentence, paragraph, or full document body.
   * @returns A Result containing either the Embedding (float32 array) or an OxoriError.
   *
   * @remarks
   * The returned vector is always a float32 array of length `this.dimensions`.
   * No normalization is applied — the provider returns the raw vector from the model.
   * Cosine similarity is computed by the search layer.
   */
  embed(text: string): Promise<Result<Embedding, OxoriError>>;

  /**
   * The dimensionality of vectors produced by this provider.
   *
   * @example
   * OpenAI text-embedding-3-small produces 384 dimensions.
   * OpenAI text-embedding-3-large produces 3072 dimensions.
   */
  readonly dimensions: number;

  /**
   * The model identifier, for logging and index metadata.
   *
   * @example "text-embedding-3-small", "text-embedding-3-large", "stub"
   */
  readonly model: string;
}
```

### Provider Configuration and Factory Functions

```typescript
/**
 * Configuration for the OpenAI embeddings provider.
 *
 * @example
 * const config: OpenAIProviderConfig = {
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   model: "text-embedding-3-small",
 *   baseUrl: "https://api.openai.com/v1"
 * };
 */
interface OpenAIProviderConfig {
  /** OpenAI API key. Required. */
  apiKey: string;

  /**
   * Embedding model to use. Optional.
   * @default "text-embedding-3-small"
   */
  model?: string;

  /**
   * Base URL for the OpenAI API. Optional, for custom endpoints.
   * @default "https://api.openai.com/v1"
   */
  baseUrl?: string;
}

/**
 * Create an EmbeddingProvider backed by OpenAI's embeddings API.
 *
 * Makes HTTP POST requests to https://api.openai.com/v1/embeddings (or custom baseUrl).
 * Use in production or whenever you have network access and an OpenAI API key.
 *
 * @param config - Configuration including API key, model, and optional baseUrl.
 * @returns An EmbeddingProvider instance.
 *
 * @throws Never throws synchronously. HTTP errors are returned as OxoriError in Result.
 *
 * @example
 * const provider = createOpenAIProvider({
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   model: "text-embedding-3-small"
 * });
 * const result = await provider.embed("Hello, world!");
 * if (result.ok) {
 *   console.log(`Got embedding with ${result.value.length} dimensions`);
 * } else {
 *   console.error(result.error.message);
 * }
 */
function createOpenAIProvider(config: OpenAIProviderConfig): EmbeddingProvider;

/**
 * Create a deterministic stub provider for testing.
 *
 * Never makes HTTP calls. Instead, derives a vector from the text deterministically
 * using a simple hash function (see implementation notes). Allows tests to run offline
 * and with reproducible results.
 *
 * @param dimensions - The dimensionality of vectors to produce. Optional.
 * @default 3 (smallest useful size for testing)
 *
 * @returns An EmbeddingProvider instance with the given dimensions.
 *
 * @example
 * // In tests
 * const provider = createStubProvider(3); // Small vectors for fast tests
 * const result = await provider.embed("test");
 * console.log(result.value); // deterministic [0.x, 0.y, 0.z] derived from "test"
 *
 * @remarks
 * The stub provider's vector is derived as follows:
 * 1. Sum the char codes of all characters in the text.
 * 2. Hash the sum to a pseudo-random seed (consistent for same input).
 * 3. Generate `dimensions` float32 values using the seed (deterministic PRNG).
 * 4. Return the vector without normalization.
 *
 * Stub vectors are suitable only for testing. They do not represent meaningful semantics.
 * Use createOpenAIProvider for production.
 */
function createStubProvider(dimensions?: number): EmbeddingProvider;
```

### Search Results and Options

```typescript
/**
 * A single result from a semantic search query.
 *
 * @example
 * {
 *   filepath: "/vault/auth/oauth.md",
 *   score: 0.87,
 *   title: "OAuth 2.0 Implementation",
 *   excerpt: "OAuth 2.0 is an open standard for access delegation..."
 * }
 */
interface SearchResult {
  /** Absolute path to the file. */
  filepath: string;

  /**
   * Cosine similarity score, in the range [0, 1].
   * 1.0 = identical semantics, 0 = orthogonal.
   */
  score: number;

  /**
   * The `title` field from the file's frontmatter, if present.
   * Optional — files without frontmatter title omit this field.
   */
  title?: string;

  /**
   * First ~200 characters of the file body, with frontmatter stripped.
   * Useful for previewing matched content. Truncated with "…" if longer.
   * Optional — included to provide context in UI displays.
   */
  excerpt?: string;
}

/**
 * Options for semantic search queries.
 */
interface SearchOptions {
  /**
   * Maximum number of results to return.
   * @default 10
   */
  topK?: number;

  /**
   * Minimum cosine similarity threshold [0, 1].
   * Results below this score are excluded.
   * @default 0
   */
  minScore?: number;
}
```

---

## Binary Vector Storage Format

Vectors are stored in `.oxori/vectors/` as binary files for compact storage and fast loading.

### Vector File Format (`.vec` files)

Each embedded file gets one `.vec` file: `.oxori/vectors/{filepath-hash}.vec`.

**Binary layout:**
```
[0–3]     Magic number: 0x4F584F52 (UTF-8 "OXOR", 4 bytes, big-endian)
[4–7]     Version: u32 little-endian (current: 1)
[8–11]    Dimensions: u32 little-endian (e.g., 1536 for text-embedding-3-small)
[12–end]  Vector data: N × float32 (IEEE 754, little-endian)
```

**Example (3-dimensional vector `[0.1, -0.5, 0.9]`):**
```
4F 58 4F 52  01 00 00 00  03 00 00 00  CD CC CD 3D  00 00 00 BF  66 66 66 3F
```

**Notes:**
- Magic is checked to validate file integrity.
- Version allows future format evolution.
- Dimensions are stored for validation during load (must match the model's expected dimensions).
- All multi-byte values are little-endian for consistency with Node.js Buffer and IEEE 754 on x86-64.

### Index File (`.oxori/vectors/index.json`)

Maps filepath → metadata and detects staleness.

```typescript
/**
 * Index file structure: .oxori/vectors/index.json
 *
 * @example
 * {
 *   "version": 1,
 *   "model": "text-embedding-3-small",
 *   "dimensions": 1536,
 *   "files": {
 *     "/vault/auth.md": {
 *       "vectorHash": "abc123def456",
 *       "contentHash": "sha256:...",
 *       "embeddedAt": 1712332800000,
 *       "provider": "openai"
 *     },
 *     "/vault/api.md": { ... }
 *   }
 * }
 */
interface VectorIndexFile {
  /** Index format version. */
  version: number;

  /** Model used to generate these vectors (e.g., "text-embedding-3-small"). */
  model: string;

  /** Dimension count (must match all *.vec files). */
  dimensions: number;

  /** Map of absolute filepath → file metadata. */
  files: Record<
    string,
    {
      /** Hash of the .vec file path (stable identifier). */
      vectorHash: string;

      /** SHA-256 hash of the file content (for staleness detection). */
      contentHash: string;

      /** Timestamp when this vector was generated (ms since epoch). */
      embeddedAt: number;

      /** Provider name (e.g., "openai", "stub"). For future use. */
      provider: string;
    }
  >;
}
```

### Staleness Detection

A vector is **stale** if any of these conditions is true:

1. The source file content has changed (compare SHA-256 hash of file body).
2. The index.json model or dimensions differ from the current provider.
3. The vector file is missing from disk.

During `oxori embed --force`, all vectors are re-computed regardless of staleness. Without `--force`, only stale vectors are updated.

---

## OpenAI HTTP Call

Exact specification of the HTTP request to OpenAI's embeddings API.

**Endpoint:** `POST {baseUrl}/embeddings` (default: `https://api.openai.com/v1/embeddings`)

**Headers:**
```
Authorization: Bearer {apiKey}
Content-Type: application/json
```

**Request body:**
```json
{
  "input": "{text}",
  "model": "{model}"
}
```

**Response (200 OK):**
```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [0.123, -0.456, 0.789, ...]
    }
  ],
  "model": "text-embedding-3-small",
  "usage": {
    "prompt_tokens": 8,
    "total_tokens": 8
  }
}
```

**Implementation notes:**
- Use Node.js native `fetch()` (available in Node 18+). No axios, no node-fetch.
- Extract `data[0].embedding` from the response.
- Validate that `embedding.length === expectedDimensions` (else return OxoriError with code `"VECTOR_DIMENSION_MISMATCH"`).
- HTTP errors (4xx, 5xx) return OxoriError with code `"EMBEDDING_API_ERROR"` and include the HTTP status and response body in the error message.
- Network errors return OxoriError with code `"EMBEDDING_NETWORK_ERROR"`.

---

## CLI Interface

### `oxori embed` Command

Builds the vector index by embedding all files in the vault.

```bash
oxori embed [options]
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--provider <name>` | string | `"openai"` | Embedding provider (`"openai"` or `"stub"`). |
| `--api-key <key>` | string | `$OXORI_API_KEY` env var | Provider API key. Falls back to environment variable. |
| `--model <model>` | string | Provider-specific default | Override the default model (e.g., `"text-embedding-3-large"`). |
| `--force` | boolean | `false` | Re-embed all files even if vectors are current. |

**Behavior:**

1. Load or create the vault index (via `Vault` initialization).
2. Scan all indexed files.
3. For each file (unless skipped due to staleness):
   - Read file body from disk.
   - Call `provider.embed(body)`.
   - Save vector to `.oxori/vectors/{hash}.vec`.
   - Record metadata in index.json.
4. Write `.oxori/vectors/index.json` with all metadata.
5. Print summary: `"Embedded {N} files, {M} from cache, {K} errors."` or JSON with `--json`.

**Error handling:**
- If a single file fails to embed, log the error, record it, and continue with the next file.
- Exit code 0 if at least one file was embedded; exit 1 if all failed or vault is empty.
- With `--json`, return `{ success: bool, embedded: N, cached: M, errors: [{filepath, message}] }`.

**Examples:**

```bash
# Embed entire vault with OpenAI (uses OXORI_API_KEY env var)
oxori embed

# Embed with custom API key
oxori embed --api-key "sk-..."

# Use the stub provider for testing
oxori embed --provider stub

# Re-embed all files, ignoring staleness
oxori embed --force

# Use a larger model
oxori embed --model "text-embedding-3-large"

# Output JSON for parsing
oxori embed --json
```

### `oxori search` Command

Query the vector index for semantically similar files.

```bash
oxori search <query> [options]
```

**Positional arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `query` | string | Yes | The search query (e.g., `"authentication flow"`). |

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--provider <name>` | string | `"openai"` | Embedding provider. Must match the one used by `oxori embed`. |
| `--api-key <key>` | string | `$OXORI_API_KEY` env var | Provider API key (needed to embed the query). |
| `--top-k <n>` | number | `10` | Maximum results to return. |
| `--min-score <n>` | number | `0` | Minimum similarity score [0–1]. |
| `--json` | boolean | `false` | Output results as JSON. |

**Behavior:**

1. Load the vault index.
2. Load `.oxori/vectors/index.json`. If missing, exit with error: `"Vectors not built. Run 'oxori embed' first."` (exit code 1).
3. Call `provider.embed(query)` to embed the search query.
4. Load all `.vec` files from disk.
5. Compute cosine similarity between query vector and each file vector.
6. Sort by descending score, filter by `minScore`, and return top `topK` results.
7. Print results as plain text (human-readable table) or JSON (with `--json`).

**Output (plain text):**
```
Score  Title                        Path
─────────────────────────────────────────────────────
0.91   OAuth 2.0 Implementation     /vault/auth/oauth.md
0.85   JWT Authentication          /vault/auth/jwt.md
0.72   Session Management          /vault/auth/session.md
```

**Output (JSON):**
```json
[
  {
    "filepath": "/vault/auth/oauth.md",
    "score": 0.91,
    "title": "OAuth 2.0 Implementation",
    "excerpt": "OAuth 2.0 is an open standard for access delegation..."
  },
  { ... }
]
```

**Error handling:**
- If `.oxori/vectors/index.json` does not exist: exit with code 1 and error message `"Vectors not built. Run 'oxori embed' first."`.
- If the query embedding fails (API error): exit with code 1 and print the error.
- If no results meet `minScore`: print `"No results found." ` (exit code 0).

**Examples:**

```bash
# Simple semantic search
oxori search "authentication"

# Return top 5 results
oxori search "how to write tests" --top-k 5

# Only return high-confidence matches (similarity > 0.8)
oxori search "deployment" --min-score 0.8

# Output JSON for programmatic use
oxori search "API design" --json

# Use stub provider for testing
oxori search "test query" --provider stub
```

---

## SDK Integration

The `Vault` class gains a new `search()` method in Phase 4.

```typescript
/**
 * Semantic search across the vault using vector similarity.
 *
 * Requires vectors to be pre-computed by `oxori embed`.
 * If `.oxori/vectors/index.json` is missing, returns an error.
 *
 * @param query - The search query (e.g., "authentication flow").
 * @param options - Optional search parameters (topK, minScore).
 * @returns A Result containing either SearchResult[] or OxoriError.
 *
 * @remarks
 * **Optionality contract:** If vectors are not available, returns:
 * ```
 * err({
 *   code: "VECTORS_NOT_BUILT",
 *   message: "Vector index not found.",
 *   action: "Run 'oxori embed' first to build the search index."
 * })
 * ```
 *
 * This error is recoverable and expected in normal operation — it guides
 * the user to run the setup step.
 *
 * @example
 * const vault = await Oxori.open("/path/to/vault");
 *
 * // Search without error handling (will throw if vectors are missing)
 * const result = await vault.search("authentication");
 * if (result.ok) {
 *   result.value.forEach(r => console.log(r.title, r.score));
 * } else {
 *   console.error(result.error.action);
 * }
 *
 * // Search with options
 * const result = await vault.search("JWT tokens", {
 *   topK: 5,
 *   minScore: 0.75
 * });
 *
 * @since 0.4.0
 */
vault.search(
  query: string,
  options?: SearchOptions
): Promise<Result<SearchResult[], OxoriError>>;
```

**Implementation considerations:**

1. **Provider initialization:** The Vault constructor (or a new `useProvider()` method) should store an EmbeddingProvider instance. The provider is passed at initialization or defaults to stub (for safety in tests).
2. **Query embedding:** When `search()` is called, embed the query using the stored provider.
3. **Vector loading:** Load `.oxori/vectors/index.json` and all `.vec` files from disk (no in-memory cache at this layer — the SDK consumer is responsible for caching if needed).
4. **Cosine similarity:** Compute the dot product of (normalized query vector) and each (normalized file vector), sort by descending score, filter by `minScore`, and return top `topK` results.
5. **Error handling:** Return descriptive errors for missing vectors, API failures, and file I/O issues.

---

## Mock/Stub Provider (for Tests)

The stub provider is used in all test suites to ensure deterministic, offline test runs.

### `createStubProvider(dimensions = 3): EmbeddingProvider`

**Behavior:**

- Never makes HTTP calls.
- Deterministically derives a vector from the input text using a hash-based algorithm.
- Returns the same vector for the same input every time (within the same process).

**Hash algorithm:**

1. Sum the Unicode code point of every character in the text: `sum = text.charCodeAt(i) for all i`.
2. Use the sum as a seed for a pseudo-random number generator (PRNG).
3. Generate `dimensions` float32 values in the range [-1, 1] using the seeded PRNG.
4. Return the vector as-is (not normalized).

**Example:**

```typescript
const provider = createStubProvider(3);

const result1 = await provider.embed("hello");
// result1.value might be: [0.123, -0.456, 0.789]

const result2 = await provider.embed("hello");
// result2.value is: [0.123, -0.456, 0.789] (same as result1)

const result3 = await provider.embed("world");
// result3.value is: [0.234, 0.567, -0.891] (different input → different vector)
```

**Usage in tests:**

```typescript
import { createStubProvider } from "oxori/semantic-search";
import { describe, it, expect } from "vitest";

describe("Search", () => {
  it("should return results sorted by similarity", async () => {
    const provider = createStubProvider(3);
    const vault = await Oxori.open("/path/to/test/vault", { provider });

    // Assume /vault/a.md contains "authentication"
    // and /vault/b.md contains "authorization"

    const result = await vault.search("authentication");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0].filepath).toContain("a.md");
      expect(result.value.length).toBeGreaterThan(0);
    }
  });
});
```

**Important:** All test files MUST use `createStubProvider()` or a mock-based provider. Tests MUST NOT call `createOpenAIProvider()` with real API keys or allow accidental HTTP calls.

---

## Performance Notes

### Embedding (batch operation)

- **Speed:** Depends on the provider. OpenAI embeddings API takes ~50–200ms per API call (plus network latency). Embedding 1000 files typically takes 1–5 minutes.
- **Scaling:** Designed for batch runs, not real-time. `oxori embed` is meant to run periodically (e.g., nightly) or as a CI step, not on every file change.
- **Incremental updates:** Staleness detection (via content hash) ensures only changed files are re-embedded. A vault with 100 files and 1 changed file will embed only the changed file.
- **Memory:** Vectors are not kept in memory during embedding — each vector is written to disk before loading the next. Peak memory usage is O(1) per file, not O(n) total.

### Search (in-memory operation)

- **Speed:** Cosine similarity is fast — computing similarity for 10,000 files typically takes < 100ms on modern hardware.
- **Scaling:** Search performance is linear in the number of files. No database queries or external APIs needed.
- **Memory:** All vectors are loaded into memory for a search query. A vault with 10,000 files at 1536 dimensions per vector requires ~60 MB of memory (10,000 × 1536 × 4 bytes).

### Storage

- **Per-file storage:** Each vector at 1536 dimensions (text-embedding-3-small) uses 4 bytes × 1536 = 6144 bytes ≈ 6 KB per file.
- **10,000-file vault:** 60 MB of `.vec` files.
- **Index file:** `.oxori/vectors/index.json` is a few KB (one metadata entry per file).

---

## Implementation Notes

### Vector Normalization

Cosine similarity requires normalized vectors (unit length). The SDK search layer normalizes both the query vector and file vectors on load:

```typescript
function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0));
  return norm === 0 ? vec : vec.map(x => x / norm);
}

function cosineSimilarity(a: number[], b: number[]): number {
  return a.reduce((sum, x, i) => sum + x * b[i], 0);
}
```

### Content Hash for Staleness

Use SHA-256 to compute the hash of the file body (frontmatter stripped):

```typescript
import { createHash } from "crypto";

function contentHash(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}
```

Store this hash in the index. On next embed run, compare:
- Current hash (read file, strip frontmatter, hash body).
- Stored hash (read from index.json).
- If different → vector is stale, re-embed.

### Filepath Hashing for Vector Files

Map filepath → stable hash for the `.vec` filename. Use SHA-256:

```typescript
function vectorHash(filepath: string): string {
  return createHash("sha256").update(filepath).digest("hex").slice(0, 16);
}

// Example: /vault/auth/oauth.md → .oxori/vectors/abc123def456.vec
```

### Error Codes

New error codes for semantic search layer:

| Code | Meaning | Action |
|------|---------|--------|
| `VECTORS_NOT_BUILT` | Index file missing | Run `oxori embed` |
| `EMBEDDING_API_ERROR` | OpenAI API error (4xx, 5xx) | Check API key, rate limits, OpenAI status |
| `EMBEDDING_NETWORK_ERROR` | Network error during embedding | Check network connectivity |
| `VECTOR_DIMENSION_MISMATCH` | Stored vector has wrong dimension count | Run `oxori embed --force` to rebuild |
| `VECTOR_FORMAT_ERROR` | Corrupted `.vec` file (bad magic or format) | Delete `.oxori/vectors/` and run `oxori embed` |
| `FILE_NOT_FOUND` | Source file deleted after embedding | Run `oxori embed` to sync vectors |

---

## Design Decisions (ADRs)

### ADR: Optional Semantic Search Layer

**Decision:** Semantic search is optional and requires explicit opt-in via `oxori embed`.

**Rationale:**
- Core Oxori (Phases 1–3) must work with zero configuration and no external dependencies.
- Adding optional embeddings allows users to enhance their vault without forced dependencies on OpenAI or other APIs.
- Opt-in prevents accidental costs (API calls) and maintains backwards compatibility.

**Consequence:** New users must run `oxori embed` before using `vault.search()`. Error messages guide them to this step.

### ADR: Binary Vector Storage

**Decision:** Store vectors in binary format (`.oxori/vectors/*.vec`) rather than JSON.

**Rationale:**
- Binary is 4–5× more compact than JSON (raw floats vs. ASCII digits).
- Faster to load (no parsing, just Buffer → float32 array).
- 10,000 files at 1536 dimensions: 60 MB (binary) vs. 240 MB (JSON).
- Humans do not need to read vectors — only metadata in `index.json`.

**Consequence:** Vector files are opaque to humans, but metadata and index file remain human-readable. Lossy (vectors cannot be edited by hand, but this is not a use case).

### ADR: Stub Provider for Testing

**Decision:** Provide `createStubProvider()` for deterministic, offline testing.

**Rationale:**
- Tests must not make real HTTP calls (slow, flaky, costly).
- Stub provider ensures reproducible results — same text always produces the same vector.
- Stub provider can be used locally during development.

**Consequence:** Tests must use `createStubProvider()`, not `createOpenAIProvider()`. Stub vectors are not semantically meaningful — they are only for testing vector operations (similarity, storage, loading).

### ADR: Staleness via Content Hash

**Decision:** Track file staleness using SHA-256 content hash rather than file modification time.

**Rationale:**
- File mtime can change without content changing (e.g., Git checkout, file copy).
- Content hash reflects actual changes — only changed files are re-embedded.
- Supports distributed workflows where mtime is not reliable (e.g., CI/CD, shared drives).

**Consequence:** Embedding is deterministic — same file content always produces the same vector (assuming same provider and model). Git-friendly — vectors can be cached and checked in (optional).

### ADR: Cosine Similarity (not L2 distance)

**Decision:** Use cosine similarity [0, 1] for search scoring, not Euclidean distance.

**Rationale:**
- Cosine similarity is the standard for embeddings (normalizes for vector length).
- Score range [0, 1] is intuitive (1 = identical, 0 = orthogonal).
- Cosine similarity is fast to compute (dot product of normalized vectors).

**Consequence:** Vectors must be normalized before similarity computation. Scores are not distances — they are similarity measures (higher = more similar).

---

## Summary

Phase 4 adds optional semantic search to Oxori without breaking backwards compatibility. The design prioritizes simplicity, determinism, and offline testing:

- **Optionality:** Core Oxori works without vectors. Semantic search requires `oxori embed`.
- **Type contracts:** Clear TypeScript interfaces that implementation must match exactly.
- **Binary storage:** Compact, fast-loading `.vec` files + human-readable `index.json`.
- **Deterministic testing:** Stub provider ensures offline, reproducible tests.
- **Performance:** Batch embedding is slow but incremental. Search is fast and in-memory.

This design is a Wave 0 artifact — the type contract that Wave 1 (implementation) must implement exactly. Changes to type signatures, CLI flags, or SDK method names require a new decision and documentation update.
