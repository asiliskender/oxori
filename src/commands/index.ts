import { access } from "node:fs/promises";
import { runIndex } from "../engine/indexer.js";
import { oxoriDirPath, readIndex, writeIndex } from "../engine/store.js";

export async function indexCommand(vaultPath: string): Promise<void> {
  const oxoriDir = oxoriDirPath(vaultPath);

  // Check .oxori/ exists
  try {
    await access(oxoriDir);
  } catch {
    throw new Error(`Vault not initialized at ${vaultPath}. Run 'oxori init' first.`);
  }

  const existingIndex = await readIndex(vaultPath);
  const newIndex = await runIndex(vaultPath, existingIndex);
  await writeIndex(vaultPath, newIndex);
}
