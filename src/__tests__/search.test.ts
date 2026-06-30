import { describe, expect, it } from "vitest";
import { extractSnippet, fullTextSearch, structuralSearch, tagSearch } from "../engine/search.js";
import type { FileRecord, IndexData } from "../types.js";

function makeRecord(overrides: Partial<FileRecord> & { path: string }): FileRecord {
  return {
    hash: "abc",
    text: "",
    headings: [],
    tags: [],
    links: [],
    ...overrides,
  };
}

function makeIndex(overrides?: Partial<IndexData>): IndexData {
  return {
    version: 1,
    parserVersion: 2,
    updatedAt: new Date().toISOString(),
    files: [],
    linkGraph: { forward: {}, backlinks: {} },
    tagMap: {},
    ...overrides,
  };
}

describe("fullTextSearch", () => {
  it("keyword match — term appears in file text → returned in results", () => {
    const index = makeIndex({
      files: [
        makeRecord({ path: "a.md", text: "The Rust programming language is great." }),
        makeRecord({ path: "b.md", text: "Python is also popular." }),
      ],
    });
    const results = fullTextSearch(index, "rust");
    expect(results.map((r) => r.path)).toContain("a.md");
    expect(results.map((r) => r.path)).not.toContain("b.md");
  });

  it("keyword no match — term not in any file → returns []", () => {
    const index = makeIndex({
      files: [makeRecord({ path: "a.md", text: "Hello world." })],
    });
    const results = fullTextSearch(index, "typescript");
    expect(results).toEqual([]);
  });

  it("keyword case-insensitive — 'Rust' matches file containing 'rust'", () => {
    const index = makeIndex({
      files: [makeRecord({ path: "a.md", text: "Learning rust is fun." })],
    });
    const results = fullTextSearch(index, "Rust");
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("a.md");
  });

  it("heading match — term only in heading → file still returned", () => {
    const index = makeIndex({
      files: [
        makeRecord({
          path: "a.md",
          text: "Some body content here.",
          headings: ["Introduction to Rust"],
        }),
        makeRecord({ path: "b.md", text: "Another document.", headings: ["Python Basics"] }),
      ],
    });
    const results = fullTextSearch(index, "rust");
    expect(results.map((r) => r.path)).toContain("a.md");
    expect(results.map((r) => r.path)).not.toContain("b.md");
  });

  it("heading match case-insensitive — 'RUST' matches heading 'Introduction to Rust'", () => {
    const index = makeIndex({
      files: [makeRecord({ path: "a.md", text: "", headings: ["Introduction to Rust"] })],
    });
    const results = fullTextSearch(index, "RUST");
    expect(results).toHaveLength(1);
  });
});

describe("structuralSearch", () => {
  it("file A links to B → structuralSearch returns B in links, A in B's backlinks", () => {
    const index = makeIndex({
      files: [
        makeRecord({ path: "a.md", links: [{ target: "b.md", broken: false }] }),
        makeRecord({ path: "b.md" }),
      ],
      linkGraph: {
        forward: { "a.md": ["b.md"] },
        backlinks: { "b.md": ["a.md"] },
      },
    });

    const fromA = structuralSearch(index, "a.md");
    expect(fromA.links).toContain("b.md");
    expect(fromA.backlinks).toEqual([]);

    const fromB = structuralSearch(index, "b.md");
    expect(fromB.backlinks).toContain("a.md");
    expect(fromB.links).toEqual([]);
  });

  it("filename-only match — 'b.md' resolves to 'subdir/b.md'", () => {
    const index = makeIndex({
      files: [makeRecord({ path: "a.md" }), makeRecord({ path: "subdir/b.md" })],
      linkGraph: {
        forward: { "a.md": ["subdir/b.md"], "subdir/b.md": [] },
        backlinks: { "subdir/b.md": ["a.md"], "a.md": [] },
      },
    });

    const result = structuralSearch(index, "b.md");
    expect(result.backlinks).toContain("a.md");
    expect(result.resolvedPath).toBe("subdir/b.md");
  });

  it("ambiguous filename — throws with list of conflicting paths", () => {
    const index = makeIndex({
      files: [makeRecord({ path: "a/note.md" }), makeRecord({ path: "b/note.md" })],
      linkGraph: {
        forward: { "a/note.md": [], "b/note.md": [] },
        backlinks: { "a/note.md": [], "b/note.md": [] },
      },
    });

    expect(() => structuralSearch(index, "note.md")).toThrow(/Ambiguous file name "note\.md"/);
    expect(() => structuralSearch(index, "note.md")).toThrow("a/note.md");
    expect(() => structuralSearch(index, "note.md")).toThrow("b/note.md");
  });
});

describe("tagSearch", () => {
  it("tag filter — tagSearch returns correct files for a tag", () => {
    const index = makeIndex({
      files: [
        makeRecord({ path: "a.md", tags: ["rust"] }),
        makeRecord({ path: "b.md", tags: ["python"] }),
      ],
      tagMap: { rust: ["a.md"], python: ["b.md"] },
    });
    const results = tagSearch(index, "rust");
    expect(results).toContain("a.md");
    expect(results).not.toContain("b.md");
  });
});

describe("extractSnippet", () => {
  it("extractSnippet with match — returns string containing the term, length ~240 chars max", () => {
    const text =
      "The quick brown fox jumps over the lazy dog. " +
      "Rust is a systems programming language that runs blazingly fast, " +
      "prevents segfaults, and guarantees thread safety. " +
      "It is great for writing reliable and efficient software.";
    const snippet = extractSnippet(text, "rust");

    expect(snippet.toLowerCase()).toContain("rust");
    expect(snippet.length).toBeLessThanOrEqual(250);
  });

  it("extractSnippet no match — returns empty string", () => {
    const snippet = extractSnippet("Hello world, nothing special here.", "typescript");
    expect(snippet).toBe("");
  });
});
