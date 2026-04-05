/**
 * @file parser.ts
 * @description Markdown file parser for Oxori.
 *
 * Reads a `.md` file from disk and extracts all structured data into a
 * `ParsedFile` shape: frontmatter (via gray-matter), hierarchical tags,
 * wikilinks, typed relations, and the stripped body.
 *
 * All operations are pure and wrapped in `Result<T, E>` — this module never
 * throws. Callers discriminate on `result.ok` before accessing `result.value`.
 */

import { readFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import matter from "gray-matter";
import { ok, err } from "./types.js";
import type { ParsedFile, OxoriError, Result } from "./types.js";

/** Regex that matches inline tags in markdown body, e.g. `#project/auth`. */
const TAG_REGEX = /#+([a-zA-Z0-9/_-]+)/g;

/** Regex that matches wikilinks, e.g. `[[Target|alias]]` or `[[Target]]`. */
const WIKILINK_REGEX = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

/**
 * @brief Expands a single tag string into all ancestor levels.
 *
 * @example
 * expandTagHierarchy("project/auth/oauth")
 * // → ["project", "project/auth", "project/auth/oauth"]
 *
 * @param tag - A normalized (lowercase, no `#`) tag string.
 * @returns An array of all ancestor and self levels.
 *
 * @since 0.1.0
 */
export function expandTagHierarchy(tag: string): string[] {
  const segments = tag.split("/");
  const levels: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    levels.push(segments.slice(0, i + 1).join("/"));
  }
  return levels;
}

/**
 * @brief Extracts all wikilink targets from a text string.
 *
 * Handles both plain `[[Target]]` and aliased `[[Target|alias]]` forms.
 * Returns lowercase, trimmed filename stems with no extension.
 *
 * @param text - Any string that may contain `[[...]]` patterns.
 * @returns An array of normalized wikilink targets.
 *
 * @since 0.1.0
 */
export function extractWikilinks(text: string): string[] {
  const targets: string[] = [];
  const re = new RegExp(WIKILINK_REGEX.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const raw = match[1];
    if (raw === undefined) continue;
    // Strip .md extension if present, lowercase and trim
    const stem = raw.replace(/\.md$/i, "").toLowerCase().trim();
    if (stem.length > 0) {
      targets.push(stem);
    }
  }
  return targets;
}

/**
 * @brief Extracts and expands all tags from the markdown body and frontmatter.
 *
 * Scans the body for inline `#tag` patterns and reads `frontmatter.tags`
 * (which may be a `string[]` or a single `string`). All tags are normalized
 * to lowercase and expanded to include their ancestor levels.
 *
 * @param body - Raw markdown body with frontmatter stripped.
 * @param frontmatter - Parsed frontmatter key-value map.
 * @returns A `Set` of all normalized, expanded tag strings.
 *
 * @since 0.1.0
 */
export function extractTags(
  body: string,
  frontmatter: Record<string, unknown>
): Set<string> {
  const raw: string[] = [];

  // Inline body tags: #tag, #project/auth, etc.
  const re = new RegExp(TAG_REGEX.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    const tag = match[1];
    if (tag !== undefined) {
      raw.push(tag);
    }
  }

  // Frontmatter tags array
  const fmTags = frontmatter["tags"];
  if (Array.isArray(fmTags)) {
    for (const item of fmTags) {
      if (typeof item === "string") {
        raw.push(item);
      }
      // Non-string entries are silently skipped per spec
    }
  } else if (typeof fmTags === "string") {
    raw.push(fmTags);
  }

  const result = new Set<string>();
  for (const tag of raw) {
    const normalized = tag.replace(/^#+/, "").toLowerCase().trim();
    if (normalized.length === 0) continue;
    for (const level of expandTagHierarchy(normalized)) {
      result.add(level);
    }
  }
  return result;
}

/**
 * @brief Extracts typed relations from frontmatter.
 *
 * Iterates all frontmatter keys. If a key's value is a string that contains
 * one or more `[[wikilink]]` patterns, the key is treated as a relation type
 * and its wikilink targets are stored in the returned map.
 *
 * @param frontmatter - Parsed frontmatter key-value map.
 * @returns A `Map` of frontmatter key → array of normalized wikilink targets.
 *
 * @since 0.1.0
 */
export function extractTypedRelations(
  frontmatter: Record<string, unknown>
): Map<string, string[]> {
  const relations = new Map<string, string[]>();

  for (const [key, value] of Object.entries(frontmatter)) {
    let targets: string[] = [];

    if (typeof value === "string") {
      targets = extractWikilinks(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") {
          targets.push(...extractWikilinks(item));
        }
      }
    }

    if (targets.length > 0) {
      relations.set(key, targets);
    }
  }

  return relations;
}

/**
 * @brief Reads and parses a single markdown file from disk.
 *
 * Extracts frontmatter, tags (inline + frontmatter array), wikilinks,
 * typed relations, and the raw stripped body. Always returns a `Result` —
 * never throws.
 *
 * @param filePath - Path to the `.md` file. May be relative or absolute;
 *   the returned `filepath` is always resolved to an absolute path.
 * @returns A `Promise` resolving to `ok(ParsedFile)` on success, or
 *   `err(OxoriError)` on file-not-found or YAML parse errors.
 *
 * @example
 * const result = await parseFile("./notes/auth.md");
 * if (!result.ok) {
 *   console.error(result.error.message);
 *   return;
 * }
 * const { tags, wikilinks } = result.value;
 *
 * @since 0.1.0
 */
export async function parseFile(
  filePath: string
): Promise<Result<ParsedFile, OxoriError>> {
  const filepath = resolve(filePath);
  const filename = basename(filePath, ".md");

  let raw: string;
  try {
    raw = await readFile(filepath, "utf-8");
  } catch (e: unknown) {
    const isNotFound =
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: unknown }).code === "ENOENT";

    return err({
      message: isNotFound
        ? `File not found: ${filepath}`
        : `Failed to read file: ${filepath}`,
      code: isNotFound ? "FILE_NOT_FOUND" : "PARSE_ERROR",
      filepath,
    });
  }

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch (e: unknown) {
    const message =
      typeof e === "object" && e !== null && "message" in e
        ? String((e as { message: unknown }).message)
        : "Unknown YAML parse error";
    return err({
      message: `YAML parse error in ${filepath}: ${message}`,
      code: "PARSE_ERROR",
      filepath,
    });
  }

  const frontmatter: Record<string, unknown> = parsed.data ?? {};
  const body: string = parsed.content ?? "";

  const tags = extractTags(body, frontmatter);
  const wikilinks = new Set(extractWikilinks(body));
  const typedRelations = extractTypedRelations(frontmatter);

  return ok({
    filepath,
    filename,
    frontmatter,
    tags,
    wikilinks,
    typedRelations,
    body,
  });
}
