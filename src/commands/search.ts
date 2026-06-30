import { access } from "node:fs/promises";
import { search } from "../engine/search.js";
import { oxoriDirPath, readIndex } from "../engine/store.js";
import type { SearchOptions, SearchResult } from "../types.js";

export async function searchCommand(
  vaultPath: string,
  query: string,
  opts: SearchOptions,
): Promise<SearchResult[]> {
  const oxoriDir = oxoriDirPath(vaultPath);

  try {
    await access(oxoriDir);
  } catch {
    throw new Error(`Vault not initialized at ${vaultPath}. Run 'oxori init' first.`);
  }

  const indexData = await readIndex(vaultPath);
  if (!indexData) {
    throw new Error(`Index not found at ${vaultPath}. Run 'oxori init' first.`);
  }

  return search(indexData, query, opts);
}
