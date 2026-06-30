import { access, mkdir } from "node:fs/promises";
import { runIndex } from "../engine/indexer.js";
import { oxoriDirPath, writeConfig, writeIndex } from "../engine/store.js";

export async function initCommand(vaultPath: string): Promise<void> {
  const oxoriDir = oxoriDirPath(vaultPath);

  // Check if already initialized
  try {
    await access(oxoriDir);
    throw new Error(`Vault already initialized at ${vaultPath}. Remove .oxori/ to reinitialize.`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  // Create .oxori/ directory
  await mkdir(oxoriDir, { recursive: true });

  // Write default config
  await writeConfig(vaultPath, {
    version: 1,
    createdAt: new Date().toISOString(),
    vaultPath,
  });

  // Build initial index
  const indexData = await runIndex(vaultPath, null);
  await writeIndex(vaultPath, indexData);
}
