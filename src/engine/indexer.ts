import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import type { FileRecord, IndexData, LinkGraph, TagMap } from "../types.js";
import { parseFile } from "./parser.js";

// T3.1 — SHA-256 hash of file contents
export async function computeHash(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

// T3.2 — Recursive .md file listing, excludes .oxori/, relative paths
export async function listMarkdownFiles(vaultPath: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".oxori") continue;
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push(relative(vaultPath, fullPath).split("\\").join("/"));
      }
    }
  }

  await walk(vaultPath);
  return results.sort();
}

// T3.3 — Hash-based reconciliation: skip unchanged, re-parse changed/new, drop deleted
export async function reconcileFiles(
  vaultPath: string,
  existingRecords: FileRecord[],
  filePaths: string[],
): Promise<FileRecord[]> {
  const existingMap = new Map(existingRecords.map((r) => [r.path, r]));
  const newRecords: FileRecord[] = [];

  for (const relPath of filePaths) {
    const fullPath = join(vaultPath, relPath);
    const hash = await computeHash(fullPath);
    const existing = existingMap.get(relPath);

    if (existing && existing.hash === hash) {
      newRecords.push(existing);
    } else {
      const parsed = await parseFile(fullPath);
      newRecords.push({
        path: relPath,
        hash,
        text: parsed.text,
        headings: parsed.headings,
        tags: parsed.tags,
        links: parsed.links,
      });
    }
  }

  return newRecords;
}

// T3.4 — Forward links + backlinks with link resolution
function resolveTarget(target: string, pathSet: Set<string>): string | null {
  if (pathSet.has(target)) return target;
  if (pathSet.has(`${target}.md`)) return `${target}.md`;

  const targetWithExt = target.endsWith(".md") ? target : `${target}.md`;
  const matches: string[] = [];
  for (const path of pathSet) {
    if (path === targetWithExt || path.endsWith(`/${targetWithExt}`)) {
      matches.push(path);
    }
  }

  if (matches.length === 1) return matches[0];

  if (matches.length > 1) {
    console.warn(
      `[oxori] Ambiguous link target "${target}" — multiple files match:\n` +
        matches.map((m) => `  - ${m}`).join("\n") +
        "\n  Link marked as broken. Rename one of the files to make the name unique.",
    );
    return null;
  }

  return null;
}

export function buildLinkGraph(records: FileRecord[]): LinkGraph {
  const pathSet = new Set(records.map((r) => r.path));
  const forward: Record<string, string[]> = {};
  const backlinks: Record<string, string[]> = {};

  for (const record of records) {
    forward[record.path] = [];
    if (!backlinks[record.path]) backlinks[record.path] = [];
  }

  for (const record of records) {
    for (const link of record.links) {
      const resolvedTarget = resolveTarget(link.target, pathSet);
      const isBroken = resolvedTarget === null;

      link.broken = isBroken;

      if (resolvedTarget !== null) {
        forward[record.path].push(resolvedTarget);
        if (!backlinks[resolvedTarget]) backlinks[resolvedTarget] = [];
        backlinks[resolvedTarget].push(record.path);
      }
    }
  }

  return { forward, backlinks };
}

// T3.5 — Tag map: { [tag]: path[] }
export function buildTagMap(records: FileRecord[]): TagMap {
  const tagMap: TagMap = {};
  for (const record of records) {
    for (const tag of record.tags) {
      if (!tagMap[tag]) tagMap[tag] = [];
      tagMap[tag].push(record.path);
    }
  }
  return tagMap;
}

// T3.6 — Orchestrator: composes all steps into complete IndexData
export async function runIndex(
  vaultPath: string,
  existingIndex: IndexData | null,
): Promise<IndexData> {
  const existingRecords = existingIndex?.files ?? [];
  const filePaths = await listMarkdownFiles(vaultPath);
  const files = await reconcileFiles(vaultPath, existingRecords, filePaths);
  const linkGraph = buildLinkGraph(files);
  const tagMap = buildTagMap(files);

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    files,
    linkGraph,
    tagMap,
  };
}
