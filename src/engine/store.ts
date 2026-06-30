import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config, IndexData } from "../types.js";

const OXORI_DIR = ".oxori";
const INDEX_FILE = "index.json";
const CONFIG_FILE = "config.json";

function oxoriDir(vaultPath: string): string {
  return join(vaultPath, OXORI_DIR);
}

export async function readIndex(vaultPath: string): Promise<IndexData | null> {
  const filePath = join(oxoriDir(vaultPath), INDEX_FILE);
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as IndexData;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error(`Failed to read index.json: ${(err as Error).message}`);
  }
}

export async function writeIndex(vaultPath: string, data: IndexData): Promise<void> {
  const dir = oxoriDir(vaultPath);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, INDEX_FILE), JSON.stringify(data, null, 2), "utf-8");
}

export async function readConfig(vaultPath: string): Promise<Config | null> {
  const filePath = join(oxoriDir(vaultPath), CONFIG_FILE);
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as Config;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error(`Failed to read config.json: ${(err as Error).message}`);
  }
}

export async function writeConfig(vaultPath: string, config: Config): Promise<void> {
  const dir = oxoriDir(vaultPath);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, CONFIG_FILE), JSON.stringify(config, null, 2), "utf-8");
}

export function oxoriDirPath(vaultPath: string): string {
  return oxoriDir(vaultPath);
}
