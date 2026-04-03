/**
 * @file indexer.ts
 * @description In-memory vault indexer for Oxori.
 *
 * Walks a vault directory recursively, parses every `.md` file via `parseFile`,
 * and builds an `IndexState` containing three lookup maps: files (by absolute
 * path), tags (by tag string), and links (by lowercase filename stem).
 *
 * Designed for both full vault scans (`indexVault`) and incremental updates
 * (`indexFile`, `removeFile`) driven by the Phase 5 watcher.
 *
 * All operations return `Result<T, OxoriError>` — this module never throws.
 */

import { readdir, stat } from "node:fs/promises";
import { resolve, relative } from "node:path";
import micromatch from "micromatch";
import { parseFile } from "./parser.js";
import { ok, err } from "./types.js";
import type {
  VaultConfig,
  IndexState,
  FileEntry,
  TagEntry,
  LinkEntry,
  ParsedFile,
  OxoriError,
  Result,
} from "./types.js";

// ─── State Factories ─────────────────────────────────────────────────────────

/**
 * Returns a fresh, empty `IndexState` with zeroed counters and empty maps.
 * Use this as the starting point before calling `indexVault` or `indexFile`.
 *
 * @returns A new empty `IndexState`.
 */
export function createEmptyState(): IndexState {
  return {
    files: new Map<string, FileEntry>(),
    tags: new Map<string, TagEntry>(),
    links: new Map<string, LinkEntry>(),
    totalFiles: 0,
    lastIndexed: 0,
  };
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Converts a mutable `ParsedFile` (from the parser) into an immutable `FileEntry`
 * (for the index). The `Set` and `Map` types are directly assignable to their
 * `Readonly` counterparts; typed-relation values are frozen into `readonly` arrays.
 *
 * @param parsed - The `ParsedFile` produced by `parseFile`.
 * @param lastModified - `mtime` in milliseconds from `fs.stat()`.
 * @returns A `FileEntry` ready to be stored in `IndexState.files`.
 */
function parsedFileToEntry(
  parsed: ParsedFile,
  lastModified: number
): FileEntry {
  const typedRelations = new Map<string, readonly string[]>();
  for (const [key, values] of parsed.typedRelations) {
    typedRelations.set(key, Object.freeze([...values]));
  }

  return {
    filepath: parsed.filepath,
    filename: parsed.filename,
    frontmatter: parsed.frontmatter,
    tags: parsed.tags,
    wikilinks: parsed.wikilinks,
    typedRelations,
    lastModified,
  };
}

/**
 * Upserts a `FileEntry` into all three index maps (`files`, `tags`, `links`).
 * Mutates `state` in place.
 *
 * @param entry - The `FileEntry` to add.
 * @param state - The `IndexState` to mutate.
 */
function addFileToState(entry: FileEntry, state: IndexState): void {
  state.files.set(entry.filepath, entry);

  for (const tag of entry.tags) {
    let tagEntry = state.tags.get(tag);
    if (tagEntry === undefined) {
      tagEntry = { tag, files: new Set<string>() };
      state.tags.set(tag, tagEntry);
    }
    tagEntry.files.add(entry.filepath);
  }

  for (const target of entry.wikilinks) {
    let linkEntry = state.links.get(target);
    if (linkEntry === undefined) {
      linkEntry = { target, sources: new Set<string>() };
      state.links.set(target, linkEntry);
    }
    linkEntry.sources.add(entry.filepath);
  }
}

/**
 * Removes a file's contributions from all three index maps (`files`, `tags`,
 * `links`). Tag and link entries with no remaining files are pruned from their
 * respective maps. Mutates `state` in place.
 *
 * @param filepath - Absolute path of the file to remove.
 * @param state - The `IndexState` to mutate.
 */
function removeFileFromState(filepath: string, state: IndexState): void {
  const entry = state.files.get(filepath);
  if (entry === undefined) return;

  state.files.delete(filepath);

  for (const tag of entry.tags) {
    const tagEntry = state.tags.get(tag);
    if (tagEntry !== undefined) {
      tagEntry.files.delete(filepath);
      if (tagEntry.files.size === 0) {
        state.tags.delete(tag);
      }
    }
  }

  for (const target of entry.wikilinks) {
    const linkEntry = state.links.get(target);
    if (linkEntry !== undefined) {
      linkEntry.sources.delete(filepath);
      if (linkEntry.sources.size === 0) {
        state.links.delete(target);
      }
    }
  }
}

// ─── Exported API ────────────────────────────────────────────────────────────

/**
 * Incrementally indexes (or re-indexes) a single file into an existing
 * `IndexState`. If the file was previously indexed, its stale entries are
 * removed before the fresh parse result is applied.
 *
 * @param filePath - Path to the `.md` file to index (relative or absolute).
 * @param state - The `IndexState` to update in place.
 * @returns `ok(state)` with the updated state, or `err(OxoriError)` if the
 *   file cannot be read or parsed.
 *
 * @example
 * const result = await indexFile("./vault/auth.md", state);
 * if (!result.ok) console.error(result.error.message);
 */
export async function indexFile(
  filePath: string,
  state: IndexState
): Promise<Result<IndexState, OxoriError>> {
  const filepath = resolve(filePath);

  let lastModified: number;
  try {
    const fileStat = await stat(filepath);
    lastModified = fileStat.mtimeMs;
  } catch (e: unknown) {
    const isNotFound =
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: unknown }).code === "ENOENT";

    return err({
      message: isNotFound
        ? `File not found: ${filepath}`
        : `Failed to stat file: ${filepath}`,
      code: isNotFound ? "FILE_NOT_FOUND" : "PARSE_ERROR",
      filepath,
    });
  }

  const parseResult = await parseFile(filepath);
  if (!parseResult.ok) {
    return parseResult;
  }

  // Remove stale entries before re-inserting to keep tag/link sets accurate.
  removeFileFromState(filepath, state);

  const entry = parsedFileToEntry(parseResult.value, lastModified);
  addFileToState(entry, state);
  state.totalFiles = state.files.size;

  return ok(state);
}

/**
 * Removes a single file from the index. Pure in terms of I/O (no disk access);
 * mutates and returns the provided `state` for chaining convenience.
 *
 * @param filePath - Absolute or relative path of the file to remove.
 * @param state - The `IndexState` to update in place.
 * @returns The same `state` reference with the file's entries removed.
 *
 * @example
 * const updated = removeFile("./vault/old-note.md", state);
 * // updated === state (same reference, mutated in place)
 */
export function removeFile(filePath: string, state: IndexState): IndexState {
  const filepath = resolve(filePath);
  removeFileFromState(filepath, state);
  state.totalFiles = state.files.size;
  return state;
}

/**
 * Performs a full vault scan: walks `config.vaultPath` recursively, parses
 * every `.md` file not matched by `config.excludePatterns`, and returns a
 * fully-populated `IndexState`.
 *
 * Parse errors for individual files are collected and logged to `console.warn`
 * but do **not** abort the scan — the errored file is simply skipped.
 *
 * @param config - Vault configuration including `vaultPath` and optional
 *   `excludePatterns` (micromatch glob syntax, relative to `vaultPath`).
 * @returns `ok(IndexState)` on success, or `err(OxoriError)` with code
 *   `"VAULT_NOT_FOUND"` if `vaultPath` does not exist.
 *
 * @example
 * const result = await indexVault({ vaultPath: "/Users/alice/notes" });
 * if (!result.ok) {
 *   console.error(result.error.message);
 *   return;
 * }
 * const { files, tags, links } = result.value;
 */
export async function indexVault(
  config: VaultConfig
): Promise<Result<IndexState, OxoriError>> {
  const vaultPath = resolve(config.vaultPath);
  const excludePatterns = config.excludePatterns ?? [];

  // Walk the vault — ENOENT on readdir means the vault doesn't exist.
  let allEntries: string[];
  try {
    allEntries = await readdir(vaultPath, { recursive: true }) as string[];
  } catch (e: unknown) {
    const isNotFound =
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: unknown }).code === "ENOENT";

    if (isNotFound) {
      return err({
        message: `Vault directory not found: ${vaultPath}`,
        code: "VAULT_NOT_FOUND",
        filepath: vaultPath,
      });
    }

    return err({
      message: `Failed to read vault directory: ${vaultPath}`,
      code: "VAULT_NOT_FOUND",
      filepath: vaultPath,
    });
  }

  // Filter to .md files only, then apply exclude patterns.
  const mdFiles = allEntries
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => resolve(vaultPath, entry))
    .filter((absPath) => {
      if (excludePatterns.length === 0) return true;
      const relPath = relative(vaultPath, absPath);
      return micromatch([relPath], excludePatterns).length === 0;
    });

  const state = createEmptyState();
  const errors: OxoriError[] = [];

  for (const absPath of mdFiles) {
    let lastModified: number;
    try {
      const fileStat = await stat(absPath);
      lastModified = fileStat.mtimeMs;
    } catch {
      errors.push({
        message: `Failed to stat file: ${absPath}`,
        code: "PARSE_ERROR",
        filepath: absPath,
      });
      continue;
    }

    const parseResult = await parseFile(absPath);
    if (!parseResult.ok) {
      errors.push(parseResult.error);
      continue;
    }

    const entry = parsedFileToEntry(parseResult.value, lastModified);
    addFileToState(entry, state);
  }

  if (errors.length > 0) {
    for (const e of errors) {
      console.warn(`[oxori] Skipped file during indexing: ${e.filepath ?? "unknown"} — ${e.message}`);
    }
  }

  state.totalFiles = state.files.size;
  state.lastIndexed = Date.now();

  return ok(state);
}
