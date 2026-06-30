import { readFile } from "node:fs/promises";
import type { Heading, Root, Text } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { ParsedFile } from "../types.js";

// --- Obsidian syntax helpers ---

/**
 * Extract [[wikilinks]] from raw markdown text.
 * Handles [[target]] and [[target|alias]] — returns target only.
 * Does NOT process content inside fenced code blocks or inline code.
 */
function extractLinks(raw: string): string[] {
  const withoutFences = raw.replace(/```[\s\S]*?```/g, "");
  const withoutCode = withoutFences.replace(/`[^`]*`/g, "");

  const links = [...withoutCode.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)].map((m) =>
    m[1].trim(),
  );
  return [...new Set(links)];
}

/**
 * Extract #tags from raw markdown text.
 * Rules:
 * - Match #word and #nested/word
 * - NOT inside fenced code blocks or inline code
 * - NOT heading markers (# at start of line after optional whitespace)
 * - Tag must start with a letter (not a digit or symbol)
 */
function extractTags(raw: string): string[] {
  const withoutFences = raw.replace(/```[\s\S]*?```/g, "");
  const withoutCode = withoutFences.replace(/`[^`]*`/g, "");
  const withoutHeadings = withoutCode.replace(/^#{1,6}\s+.*/gm, "");

  const tags = [...withoutHeadings.matchAll(/#([a-zA-Z][a-zA-Z0-9_/]*)/g)].map((m) => m[1]);
  return [...new Set(tags)];
}

// --- Remark-based text and heading extraction ---

type MdastNode = Root["children"][number];

function extractTextFromNode(node: MdastNode): string {
  if (node.type === "code" || node.type === "inlineCode") return "";
  if (node.type === "heading") return "";
  if (node.type === "text") return (node as Text).value;

  if ("children" in node && Array.isArray(node.children)) {
    return (node.children as MdastNode[])
      .map((child) => extractTextFromNode(child as MdastNode))
      .join(" ");
  }
  return "";
}

function extractHeadingText(node: Heading): string {
  return node.children
    .filter((c) => c.type === "text")
    .map((c) => (c as Text).value)
    .join(" ");
}

// --- Public API ---

export async function parseFile(filePath: string): Promise<ParsedFile> {
  const raw = await readFile(filePath, "utf-8");

  const processor = unified().use(remarkParse);
  const tree = processor.parse(raw) as Root;

  const headings: string[] = [];
  const textParts: string[] = [];

  for (const node of tree.children) {
    if (node.type === "heading") {
      headings.push(extractHeadingText(node));
    } else {
      const text = extractTextFromNode(node).trim();
      if (text) textParts.push(text);
    }
  }

  const text = textParts.join(" ").replace(/\s+/g, " ").trim();

  const rawLinks = extractLinks(raw);
  const tags = extractTags(raw);

  // broken flag initialized false; indexer sets it when cross-referencing all files
  const links = rawLinks.map((target) => ({ target, broken: false }));

  return { text, headings, tags, links };
}
