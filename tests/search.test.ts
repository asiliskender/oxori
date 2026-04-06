/**
 * @file search.test.ts
 * @description Comprehensive tests for Phase 4 semantic search — src/search.ts.
 *
 * All tests use createStubProvider() — no real API calls are made.
 * Temp directories use tests/.tmp-search-{name}/ patterns (never /tmp).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import {
  createStubProvider,
  cosineSimilarity,
  writeVecFile,
  readVecFile,
  VectorStore,
  searchVault,
  embedVault,
} from "../src/search.js";

// ── createStubProvider ────────────────────────────────────────────────────────

describe("createStubProvider", () => {
  it("returns deterministic embeddings for the same text", async () => {
    const provider = createStubProvider(3);
    const r1 = await provider.embed("hello world");
    const r2 = await provider.embed("hello world");
    expect(r1).toEqual(r2);
  });

  it("returns different embeddings for different text", async () => {
    const provider = createStubProvider(3);
    const r1 = await provider.embed("foo");
    const r2 = await provider.embed("bar");
    expect(r1).not.toEqual(r2);
  });

  it("returns a unit vector (magnitude ≈ 1)", async () => {
    const provider = createStubProvider(4);
    const result = await provider.embed("test text");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const mag = Math.sqrt(result.value.reduce((s, v) => s + v * v, 0));
    expect(mag).toBeCloseTo(1, 5);
  });

  it("uses the specified dimensions", async () => {
    const provider5 = createStubProvider(5);
    const r = await provider5.embed("x");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toHaveLength(5);
  });

  it("has model: 'stub' and correct dimensions property", () => {
    const p = createStubProvider(7);
    expect(p.model).toBe("stub");
    expect(p.dimensions).toBe(7);
  });

  it("returns ok:true result", async () => {
    const provider = createStubProvider(3);
    const result = await provider.embed("any text");
    expect(result.ok).toBe(true);
  });

  it("embeds empty string without crashing", async () => {
    const provider = createStubProvider(3);
    const result = await provider.embed("");
    // empty string → all zeros → magnitude 0 → returns zero vector, but result must be ok
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(3);
  });
});

// ── cosineSimilarity ──────────────────────────────────────────────────────────

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("returns 0 for mismatched dimension lengths", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("returns 0 for zero vectors", () => {
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });

  it("is symmetric — f(a,b) === f(b,a)", () => {
    const a = [0.5, 0.5, 0.0];
    const b = [0.0, 0.5, 0.5];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a));
  });

  it("handles non-unit vectors correctly", () => {
    // [2,0] and [3,0] are parallel → cosine = 1
    expect(cosineSimilarity([2, 0], [3, 0])).toBeCloseTo(1);
  });
});

// ── writeVecFile / readVecFile ────────────────────────────────────────────────

describe("writeVecFile / readVecFile", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = resolve("tests/.tmp-search-vec");
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("round-trips an embedding through binary format", () => {
    const filepath = join(tmpDir, "test.vec");
    const original = [0.1, 0.2, 0.3, 0.4];
    writeVecFile(filepath, original);
    const result = readVecFile(filepath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // float32 precision — use toBeCloseTo
    original.forEach((v, i) => expect(result.value[i]).toBeCloseTo(v, 5));
  });

  it("round-trips correct dimension count", () => {
    const filepath = join(tmpDir, "dims.vec");
    const original = [1, 2, 3, 4, 5, 6];
    writeVecFile(filepath, original);
    const result = readVecFile(filepath);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(6);
  });

  it("handles single-dimension embedding", () => {
    const filepath = join(tmpDir, "single.vec");
    writeVecFile(filepath, [0.999]);
    const result = readVecFile(filepath);
    expect(result.ok).toBe(true);
  });

  it("handles large embeddings (1536 dims)", () => {
    const filepath = join(tmpDir, "large.vec");
    const large = Array.from({ length: 1536 }, (_, i) => i / 1536);
    writeVecFile(filepath, large);
    const result = readVecFile(filepath);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(1536);
  });

  it("returns error for non-existent file", () => {
    const result = readVecFile(join(tmpDir, "missing.vec"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VECTOR_FILE_CORRUPT");
  });

  it("returns error for corrupt file (wrong magic bytes)", () => {
    const filepath = join(tmpDir, "corrupt.vec");
    // 12 bytes with wrong magic (0x00000000 instead of 0x4F584F52)
    writeFileSync(
      filepath,
      Buffer.from([0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80, 0x3f]),
    );
    const result = readVecFile(filepath);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VECTOR_FILE_CORRUPT");
  });

  it("returns error for too-small file (< 12 bytes)", () => {
    const filepath = join(tmpDir, "small.vec");
    writeFileSync(filepath, Buffer.from([0x52, 0x4f, 0x58, 0x4f])); // only 4 bytes
    const result = readVecFile(filepath);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VECTOR_FILE_CORRUPT");
  });

  it("returns error when dimension count mismatches file size", () => {
    const filepath = join(tmpDir, "mismatch.vec");
    // magic=OXOR, version=1, dims=10 but no float data following
    const buf = Buffer.allocUnsafe(12);
    buf.writeUInt32LE(0x4f584f52, 0); // magic
    buf.writeUInt32LE(1, 4);           // version
    buf.writeUInt32LE(10, 8);          // claims 10 dims but no data
    writeFileSync(filepath, buf);
    const result = readVecFile(filepath);
    expect(result.ok).toBe(false);
  });
});

// ── VectorStore ───────────────────────────────────────────────────────────────

describe("VectorStore", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = resolve("tests/.tmp-search-store");
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("isBuilt() returns false for empty vault", () => {
    const store = new VectorStore(tmpDir);
    expect(store.isBuilt()).toBe(false);
  });

  it("stores and loads an embedding", async () => {
    const store = new VectorStore(tmpDir);
    const provider = createStubProvider(3);
    const r = await provider.embed("hello");
    if (!r.ok) throw new Error("embed failed");

    const filepath = join(tmpDir, "note.md");
    const content = "# Hello";
    const contentHash = VectorStore.contentHash(content);
    store.store(filepath, r.value, contentHash, "stub");

    const loaded = store.load(filepath);
    expect(loaded.ok).toBe(true);
  });

  it("loaded embedding values match stored values", async () => {
    const store = new VectorStore(tmpDir);
    const provider = createStubProvider(3);
    const r = await provider.embed("round-trip");
    if (!r.ok) throw new Error("embed failed");

    const filepath = join(tmpDir, "rt.md");
    store.store(filepath, r.value, VectorStore.contentHash("round-trip"), "stub");

    const loaded = store.load(filepath);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      r.value.forEach((v, i) => expect(loaded.value[i]).toBeCloseTo(v, 5));
    }
  });

  it("isBuilt() returns true after storing", async () => {
    const store = new VectorStore(tmpDir);
    const provider = createStubProvider(3);
    const r = await provider.embed("x");
    if (!r.ok) throw new Error();
    store.store(join(tmpDir, "a.md"), r.value, VectorStore.contentHash("x"), "stub");
    expect(store.isBuilt()).toBe(true);
  });

  it("isStale() returns true for new (unknown) file", () => {
    const store = new VectorStore(tmpDir);
    expect(store.isStale("/some/file.md", "hash123", "stub")).toBe(true);
  });

  it("isStale() returns false for unchanged file with same model", async () => {
    const store = new VectorStore(tmpDir);
    const provider = createStubProvider(3);
    const r = await provider.embed("content");
    if (!r.ok) throw new Error();
    const fp = join(tmpDir, "f.md");
    const hash = VectorStore.contentHash("content");
    store.store(fp, r.value, hash, "stub");
    expect(store.isStale(fp, hash, "stub")).toBe(false);
  });

  it("isStale() returns true if content changed", async () => {
    const store = new VectorStore(tmpDir);
    const provider = createStubProvider(3);
    const r = await provider.embed("original");
    if (!r.ok) throw new Error();
    const fp = join(tmpDir, "changed.md");
    const oldHash = VectorStore.contentHash("original");
    store.store(fp, r.value, oldHash, "stub");
    const newHash = VectorStore.contentHash("modified content");
    expect(store.isStale(fp, newHash, "stub")).toBe(true);
  });

  it("isStale() returns true if model changed", async () => {
    const store = new VectorStore(tmpDir);
    const provider = createStubProvider(3);
    const r = await provider.embed("content");
    if (!r.ok) throw new Error();
    const fp = join(tmpDir, "f.md");
    const hash = VectorStore.contentHash("content");
    store.store(fp, r.value, hash, "stub");
    expect(store.isStale(fp, hash, "different-model")).toBe(true);
  });

  it("load() returns error for missing file", () => {
    const store = new VectorStore(tmpDir);
    const result = store.load("/nonexistent/file.md");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VECTORS_NOT_BUILT");
  });

  it("list() returns empty array for fresh store", () => {
    const store = new VectorStore(tmpDir);
    expect(store.list()).toHaveLength(0);
  });

  it("list() returns all stored filepaths", async () => {
    const store = new VectorStore(tmpDir);
    const provider = createStubProvider(3);
    for (const name of ["a", "b", "c"]) {
      const r = await provider.embed(name);
      if (!r.ok) throw new Error();
      store.store(join(tmpDir, `${name}.md`), r.value, VectorStore.contentHash(name), "stub");
    }
    const list = store.list();
    expect(list).toHaveLength(3);
  });

  it("contentHash() is deterministic for same content", () => {
    const h1 = VectorStore.contentHash("same content");
    const h2 = VectorStore.contentHash("same content");
    expect(h1).toBe(h2);
  });

  it("contentHash() differs for different content", () => {
    const h1 = VectorStore.contentHash("content a");
    const h2 = VectorStore.contentHash("content b");
    expect(h1).not.toBe(h2);
  });

  it("getIndex() returns stored entry metadata", async () => {
    const store = new VectorStore(tmpDir);
    const provider = createStubProvider(3);
    const r = await provider.embed("meta");
    if (!r.ok) throw new Error();
    const fp = join(tmpDir, "meta.md");
    const hash = VectorStore.contentHash("meta");
    store.store(fp, r.value, hash, "stub");
    const index = store.getIndex();
    expect(index.entries[fp]).toBeDefined();
    expect(index.entries[fp]?.model).toBe("stub");
    expect(index.entries[fp]?.dimensions).toBe(3);
  });
});

// ── embedVault ────────────────────────────────────────────────────────────────

describe("embedVault", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = resolve("tests/.tmp-search-embed");
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("embeds all markdown files in a vault", async () => {
    writeFileSync(join(tmpDir, "note1.md"), "# Note 1\nHello world");
    writeFileSync(join(tmpDir, "note2.md"), "# Note 2\nFoo bar");
    writeFileSync(join(tmpDir, "readme.txt"), "not markdown"); // should be ignored

    const provider = createStubProvider(4);
    const result = await embedVault(tmpDir, provider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.embedded).toBe(2);
    expect(result.value.skipped).toBe(0);
    expect(result.value.failed).toBe(0);
  });

  it("skips already-embedded files on re-run", async () => {
    writeFileSync(join(tmpDir, "note.md"), "# Note\ncontent");
    const provider = createStubProvider(4);

    // First run
    await embedVault(tmpDir, provider);
    // Second run — should skip
    const result = await embedVault(tmpDir, provider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.embedded).toBe(0);
    expect(result.value.skipped).toBe(1);
  });

  it("re-embeds files when force:true", async () => {
    writeFileSync(join(tmpDir, "note.md"), "# Note\ncontent");
    const provider = createStubProvider(4);
    await embedVault(tmpDir, provider);
    const result = await embedVault(tmpDir, provider, { force: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.embedded).toBe(1);
    expect(result.value.skipped).toBe(0);
  });

  it("returns embedded:0, skipped:0, failed:0 for empty vault", async () => {
    const provider = createStubProvider(4);
    const result = await embedVault(tmpDir, provider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.embedded).toBe(0);
    expect(result.value.skipped).toBe(0);
    expect(result.value.failed).toBe(0);
  });

  it("ignores dotfiles and .oxori directory", async () => {
    writeFileSync(join(tmpDir, "note.md"), "# Real note");
    // Create a dot-directory — embedVault skips entries starting with '.'
    mkdirSync(join(tmpDir, ".hidden"), { recursive: true });
    writeFileSync(join(tmpDir, ".hidden", "secret.md"), "# Hidden");

    const provider = createStubProvider(4);
    const result = await embedVault(tmpDir, provider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.embedded).toBe(1);
  });

  it("re-embeds file when content changes between runs", async () => {
    const notePath = join(tmpDir, "note.md");
    writeFileSync(notePath, "# Original content");
    const provider = createStubProvider(4);

    await embedVault(tmpDir, provider);

    // Modify the file
    writeFileSync(notePath, "# Modified content");
    const result = await embedVault(tmpDir, provider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.embedded).toBe(1);
    expect(result.value.skipped).toBe(0);
  });

  it("recurses into subdirectories", async () => {
    mkdirSync(join(tmpDir, "sub"), { recursive: true });
    writeFileSync(join(tmpDir, "root.md"), "# Root");
    writeFileSync(join(tmpDir, "sub", "child.md"), "# Child");

    const provider = createStubProvider(4);
    const result = await embedVault(tmpDir, provider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.embedded).toBe(2);
  });
});

// ── searchVault ───────────────────────────────────────────────────────────────

describe("searchVault", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = resolve("tests/.tmp-search-vault");
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns VECTORS_NOT_BUILT when no index exists", async () => {
    const provider = createStubProvider(4);
    const result = await searchVault(tmpDir, "test query", provider);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VECTORS_NOT_BUILT");
  });

  it("returns results after embedding the vault", async () => {
    writeFileSync(join(tmpDir, "typescript.md"), "TypeScript is a typed superset of JavaScript");
    writeFileSync(join(tmpDir, "python.md"), "Python is a dynamic scripting language");

    const provider = createStubProvider(8);
    await embedVault(tmpDir, provider);

    const result = await searchVault(tmpDir, "typed programming language", provider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.length).toBeGreaterThan(0);
    expect(result.value[0]).toHaveProperty("filepath");
    expect(result.value[0]).toHaveProperty("score");
    expect(result.value[0]!.score).toBeGreaterThanOrEqual(0);
    expect(result.value[0]!.score).toBeLessThanOrEqual(1);
  });

  it("returns results sorted by descending score", async () => {
    writeFileSync(join(tmpDir, "a.md"), "cats are fluffy animals");
    writeFileSync(join(tmpDir, "b.md"), "dogs are loyal animals");

    const provider = createStubProvider(8);
    await embedVault(tmpDir, provider);
    const result = await searchVault(tmpDir, "animals", provider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (let i = 1; i < result.value.length; i++) {
      expect(result.value[i - 1]!.score).toBeGreaterThanOrEqual(result.value[i]!.score);
    }
  });

  it("respects topK option", async () => {
    for (let i = 0; i < 5; i++) {
      writeFileSync(join(tmpDir, `note${i}.md`), `Note number ${i} about various topics`);
    }
    const provider = createStubProvider(4);
    await embedVault(tmpDir, provider);
    const result = await searchVault(tmpDir, "notes", provider, { topK: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.length).toBeLessThanOrEqual(3);
  });

  it("respects minScore option — excludes below-threshold results", async () => {
    writeFileSync(join(tmpDir, "note.md"), "completely unrelated content xyz");
    const provider = createStubProvider(4);
    await embedVault(tmpDir, provider);
    const result = await searchVault(tmpDir, "test", provider, { minScore: 0.99 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result.value.forEach((r) => expect(r.score).toBeGreaterThanOrEqual(0.99));
  });

  it("returns empty array when minScore is higher than all scores", async () => {
    writeFileSync(join(tmpDir, "unrelated.md"), "aaabbbccc");
    const provider = createStubProvider(4);
    await embedVault(tmpDir, provider);
    const result = await searchVault(tmpDir, "zzz", provider, { minScore: 1.01 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(0);
  });

  it("each result has filepath and score properties", async () => {
    writeFileSync(join(tmpDir, "doc.md"), "documentation file");
    const provider = createStubProvider(4);
    await embedVault(tmpDir, provider);
    const result = await searchVault(tmpDir, "doc", provider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const r of result.value) {
      expect(typeof r.filepath).toBe("string");
      expect(typeof r.score).toBe("number");
    }
  });

  it("skips vectors with mismatched dimensions (different provider)", async () => {
    writeFileSync(join(tmpDir, "note.md"), "some content");
    // Embed with 4-dim provider
    const provider4 = createStubProvider(4);
    await embedVault(tmpDir, provider4);

    // Search with 8-dim provider — dimensions won't match, results should be 0
    const provider8 = createStubProvider(8);
    const result = await searchVault(tmpDir, "query", provider8);
    // Either VECTORS_NOT_BUILT (index exists but no matching dims) or empty results
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    } else {
      expect(result.error.code).toBe("VECTORS_NOT_BUILT");
    }
  });
});
