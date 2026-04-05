import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { ok, err } from "./types.js";
import type {
  Embedding,
  EmbeddingProvider,
  OpenAIProviderConfig,
  SearchResult,
  SearchOptions,
  VectorEntry,
  VectorIndex,
  OxoriError,
  Result,
} from "./types.js";

export function createOpenAIProvider(config: OpenAIProviderConfig): EmbeddingProvider {
  const baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
  const model = config.model ?? "text-embedding-3-small";

  return {
    model,
    dimensions:
      model === "text-embedding-3-small" ? 1536
      : model === "text-embedding-3-large" ? 3072
      : 1536, // safe default for unknown models
    async embed(text: string): Promise<Result<Embedding, OxoriError>> {
      try {
        const response = await fetch(`${baseUrl}/embeddings`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ input: text, model }),
        });

        if (!response.ok) {
          const body = await response.text();
          return err({
            code: "EMBEDDING_API_ERROR",
            message: `OpenAI API error ${response.status}: ${body}`,
            action: "Check your API key and model name.",
          });
        }

        const data = (await response.json()) as {
          data: Array<{ embedding: number[] }>;
        };
        // data.data[0] is always present on a successful OpenAI embeddings response
        return ok(data.data[0]!.embedding);
      } catch (e) {
        return err({
          code: "EMBEDDING_PROVIDER_ERROR",
          message: `Network error: ${e instanceof Error ? e.message : String(e)}`,
          action: "Check your internet connection.",
        });
      }
    },
  };
}

export function createStubProvider(dimensions = 3): EmbeddingProvider {
  return {
    model: "stub",
    dimensions,
    async embed(text: string): Promise<Result<Embedding, OxoriError>> {
      // Deterministic: same text → same vector. Uses char codes + position.
      const vec = new Array<number>(dimensions).fill(0) as number[];
      for (let i = 0; i < text.length; i++) {
        (vec[i % dimensions] as number) += text.charCodeAt(i);
      }
      // Normalize to unit vector (cosine similarity works correctly on unit vectors)
      const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + (v ?? 0) * (v ?? 0), 0));
      const normalized = magnitude > 0 ? vec.map((v) => (v ?? 0) / magnitude) : vec;
      return ok(normalized);
    },
  };
}

export function cosineSimilarity(a: Embedding, b: Embedding): number {
  if (a.length !== b.length) return 0;
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/** Write an Embedding to a binary .vec file. */
export function writeVecFile(filepath: string, embedding: Embedding): void {
  const buf = Buffer.allocUnsafe(12 + embedding.length * 4);
  buf.writeUInt32LE(0x4f584f52, 0); // magic "OXOR"
  buf.writeUInt32LE(1, 4); // version
  buf.writeUInt32LE(embedding.length, 8); // dimensions
  for (let i = 0; i < embedding.length; i++) {
    buf.writeFloatLE(embedding[i] ?? 0, 12 + i * 4);
  }
  writeFileSync(filepath, buf);
}

/** Read an Embedding from a binary .vec file. */
export function readVecFile(filepath: string): Result<Embedding, OxoriError> {
  try {
    const buf = readFileSync(filepath);
    if (buf.length < 12) {
      return err({
        code: "VECTOR_FILE_CORRUPT",
        message: "File too small",
        action: "Re-run oxori embed.",
      });
    }
    const magic = buf.readUInt32LE(0);
    if (magic !== 0x4f584f52) {
      return err({
        code: "VECTOR_FILE_CORRUPT",
        message: "Invalid magic bytes",
        action: "Re-run oxori embed.",
      });
    }
    const version = buf.readUInt32LE(4);
    if (version !== 1) {
      return err({
        code: "VECTOR_FILE_CORRUPT",
        message: `Unknown version: ${version}`,
        action: "Upgrade oxori.",
      });
    }
    const dims = buf.readUInt32LE(8);
    if (buf.length !== 12 + dims * 4) {
      return err({
        code: "VECTOR_FILE_CORRUPT",
        message: "Dimension count mismatch",
        action: "Re-run oxori embed.",
      });
    }
    const embedding: Embedding = [];
    for (let i = 0; i < dims; i++) {
      embedding.push(buf.readFloatLE(12 + i * 4));
    }
    return ok(embedding);
  } catch (e) {
    return err({
      code: "VECTOR_FILE_CORRUPT",
      message: `Could not read ${filepath}: ${e instanceof Error ? e.message : String(e)}`,
      action: "Re-run oxori embed.",
    });
  }
}

export class VectorStore {
  private readonly vectorsDir: string;
  private readonly indexPath: string;
  private index: VectorIndex;

  constructor(vaultPath: string) {
    this.vectorsDir = resolve(vaultPath, ".oxori", "vectors");
    this.indexPath = join(this.vectorsDir, "index.json");
    this.index = this.loadIndex();
  }

  private loadIndex(): VectorIndex {
    if (existsSync(this.indexPath)) {
      try {
        return JSON.parse(readFileSync(this.indexPath, "utf8")) as VectorIndex;
      } catch {
        return { version: 1, entries: {} };
      }
    }
    return { version: 1, entries: {} };
  }

  private saveIndex(): void {
    mkdirSync(this.vectorsDir, { recursive: true });
    writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2));
  }

  /** Hash file content for staleness detection. */
  static contentHash(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  /** Check if a file's vector is stale (content changed or model changed). */
  isStale(filepath: string, contentHash: string, model: string): boolean {
    const entry = this.index.entries[filepath];
    if (!entry) return true;
    return entry.contentHash !== contentHash || entry.model !== model;
  }

  /** Store an embedding for a file. */
  store(
    filepath: string,
    embedding: Embedding,
    contentHash: string,
    model: string
  ): void {
    mkdirSync(this.vectorsDir, { recursive: true });
    // Use SHA-256 of the filepath for a stable, collision-resistant filename
    const hash = createHash("sha256").update(filepath).digest("hex").slice(0, 16);
    const vecFile = `${hash}.vec`;
    writeVecFile(join(this.vectorsDir, vecFile), embedding);
    const entry: VectorEntry = {
      filepath,
      contentHash,
      model,
      dimensions: embedding.length,
      embeddedAt: new Date().toISOString(),
      vecFile,
    };
    this.index.entries[filepath] = entry;
    this.saveIndex();
  }

  /** Load an embedding for a file. */
  load(filepath: string): Result<Embedding, OxoriError> {
    const entry = this.index.entries[filepath];
    if (!entry) {
      return err({
        code: "VECTORS_NOT_BUILT",
        message: `No vector for ${filepath}`,
        action: "Run oxori embed first.",
      });
    }
    return readVecFile(join(this.vectorsDir, entry.vecFile));
  }

  /** List all filepaths with stored vectors. */
  list(): string[] {
    return Object.keys(this.index.entries);
  }

  /** Check if the store has been built (has any entries). */
  isBuilt(): boolean {
    return existsSync(this.indexPath) && Object.keys(this.index.entries).length > 0;
  }

  /** Get the full index. */
  getIndex(): VectorIndex {
    return this.index;
  }
}

/**
 * Search a vault using semantic similarity.
 * Requires vectors to have been built with embedVault() or oxori embed.
 */
export async function searchVault(
  vaultPath: string,
  query: string,
  provider: EmbeddingProvider,
  options: SearchOptions = {}
): Promise<Result<SearchResult[], OxoriError>> {
  const store = new VectorStore(vaultPath);
  if (!store.isBuilt()) {
    return err({
      code: "VECTORS_NOT_BUILT",
      message: "No vector index found.",
      action: "Run 'oxori embed' first to build the search index.",
    });
  }

  const queryResult = await provider.embed(query);
  if (!queryResult.ok) return queryResult;
  const queryVec = queryResult.value;

  const topK = options.topK ?? 10;
  const minScore = options.minScore ?? 0;
  const filepaths = store.list();

  const results: SearchResult[] = [];
  for (const filepath of filepaths) {
    const vecResult = store.load(filepath);
    if (!vecResult.ok) continue; // skip corrupt files silently

    const entry = store.getIndex().entries[filepath];
    // Skip vectors with mismatched dimensions — they cannot be compared
    if (entry && entry.dimensions !== queryVec.length) continue;

    const score = cosineSimilarity(queryVec, vecResult.value);
    if (score >= minScore) {
      results.push({ filepath, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return ok(results.slice(0, topK));
}
