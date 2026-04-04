/**
 * @file query.test.ts
 * @description Test suite for `tokenize()` and `parse()` — Phase 2 Wave 1.
 *
 * Both functions are implemented in src/query.ts. The vast majority of tests
 * here run with real assertions. `it.todo()` is used only for edge-case
 * scenarios that need additional investigation before asserting exact output.
 *
 * Error-throwing contract:
 * - `parse()` throws a plain `OxoriError` object (not a wrapped Error subclass).
 *   Tests use `expect(() => ...).toThrow()` and inspect the caught value directly.
 *
 * Result shapes:
 * - `tokenize(q)` → `Token[]` (no Result wrapper — never fails)
 * - `parse(tokens)` → `QueryAST`  (throws `OxoriError` on bad input)
 */

import { describe, it, expect } from "vitest";
import { tokenize, parse, evaluate } from "../src/query";
import type {
  Token,
  TokenKind,
  QueryAST,
  FilterNode,
  OperatorNode,
  GroupNode,
  OxoriError,
  IndexState,
  FileEntry,
  TagEntry,
  LinkEntry,
} from "../src/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the tokens from `tokenize()` with the trailing EOF stripped. */
function tokensNoEof(query: string): Token[] {
  return tokenize(query).filter((t) => t.kind !== "EOF");
}

/** Asserts a token has the expected kind and value. */
function expectToken(
  t: Token | undefined,
  kind: TokenKind,
  value: string,
): void {
  expect(t).toBeDefined();
  expect(t?.kind).toBe(kind);
  expect(t?.value).toBe(value);
}

// ---------------------------------------------------------------------------
// tokenize()
// ---------------------------------------------------------------------------

describe("tokenize()", () => {
  // -------------------------------------------------------------------------
  describe("basic tokens", () => {
    it("tokenizes empty string to [EOF]", () => {
      const tokens = tokenize("");
      expect(tokens).toHaveLength(1);
      expect(tokens[0]?.kind).toBe("EOF");
      expect(tokens[0]?.value).toBe("");
      expect(tokens[0]?.position).toBe(0);
    });

    it("tokenizes AND OR NOT as OPERATOR tokens", () => {
      const tokens = tokensNoEof("AND OR NOT");
      expect(tokens).toHaveLength(3);
      expectToken(tokens[0], "OPERATOR", "AND");
      expectToken(tokens[1], "OPERATOR", "OR");
      expectToken(tokens[2], "OPERATOR", "NOT");
    });

    it("is case-insensitive for operator keywords", () => {
      const tokens = tokensNoEof("and or not");
      expect(tokens[0]?.kind).toBe("OPERATOR");
      expect(tokens[0]?.value).toBe("AND");
      expect(tokens[1]?.value).toBe("OR");
      expect(tokens[2]?.value).toBe("NOT");
    });

    it("tokenizes LPAREN and RPAREN", () => {
      const tokens = tokensNoEof("()");
      expect(tokens).toHaveLength(2);
      expectToken(tokens[0], "LPAREN", "(");
      expectToken(tokens[1], "RPAREN", ")");
    });

    it("tokenizes filter expressions: field:value", () => {
      const tokens = tokensNoEof("tag:auth");
      expect(tokens).toHaveLength(1);
      expectToken(tokens[0], "FILTER", "tag:auth");
    });

    it("tokenizes filter expressions: field=value", () => {
      const tokens = tokensNoEof("type=decision");
      expect(tokens).toHaveLength(1);
      expectToken(tokens[0], "FILTER", "type=decision");
    });

    it("tokenizes filter expressions: field~value", () => {
      const tokens = tokensNoEof("path~docs");
      expect(tokens).toHaveLength(1);
      expectToken(tokens[0], "FILTER", "path~docs");
    });

    it("tokenizes quoted values — strips surrounding quotes", () => {
      const tokens = tokensNoEof('"multi word"');
      expect(tokens).toHaveLength(1);
      expectToken(tokens[0], "VALUE", "multi word");
    });

    it("tokenizes bare word as VALUE", () => {
      const tokens = tokensNoEof("hello");
      expect(tokens).toHaveLength(1);
      expectToken(tokens[0], "VALUE", "hello");
    });
  });

  // -------------------------------------------------------------------------
  describe("edge cases", () => {
    it("handles multiple whitespace between tokens", () => {
      const tokens = tokensNoEof("tag:auth   AND   type:note");
      expect(tokens).toHaveLength(3);
      expect(tokens[0]?.kind).toBe("FILTER");
      expect(tokens[1]?.kind).toBe("OPERATOR");
      expect(tokens[2]?.kind).toBe("FILTER");
    });

    it("records correct position for each token", () => {
      // "tag:auth AND type:note"
      //  ^0        ^9  ^13
      const tokens = tokenize("tag:auth AND type:note");
      expect(tokens[0]?.position).toBe(0);
      expect(tokens[1]?.position).toBe(9);
      expect(tokens[2]?.position).toBe(13);
    });

    it("EOF token position is at end of input", () => {
      const input = "tag:x";
      const tokens = tokenize(input);
      const eof = tokens[tokens.length - 1];
      expect(eof?.kind).toBe("EOF");
      expect(eof?.position).toBe(input.length);
    });

    it("handles leading and trailing whitespace gracefully", () => {
      const tokens = tokensNoEof("  tag:auth  ");
      expect(tokens).toHaveLength(1);
      expectToken(tokens[0], "FILTER", "tag:auth");
    });
  });
});

// ---------------------------------------------------------------------------
// parse()
// ---------------------------------------------------------------------------

describe("parse()", () => {
  // -------------------------------------------------------------------------
  describe("basic expressions", () => {
    it("returns { root: null } for empty token stream", () => {
      const ast = parse(tokenize(""));
      expect(ast.root).toBeNull();
    });

    it("parses single filter: tag:auth", () => {
      const ast = parse(tokenize("tag:auth"));
      expect(ast.root).not.toBeNull();
      expect(ast.root?.type).toBe("filter");
      const node = ast.root as FilterNode;
      expect(node.field).toBe("tag");
      expect(node.operator).toBe(":");
      expect(node.value).toBe("auth");
    });

    it("parses AND expression", () => {
      const ast = parse(tokenize("tag:auth AND type:note"));
      expect(ast.root?.type).toBe("and");
      const node = ast.root as OperatorNode;
      expect(node.children).toHaveLength(2);
      expect(node.children[0]?.type).toBe("filter");
      expect(node.children[1]?.type).toBe("filter");
    });

    it("parses OR expression", () => {
      const ast = parse(tokenize("tag:auth OR tag:admin"));
      expect(ast.root?.type).toBe("or");
      const node = ast.root as OperatorNode;
      expect(node.children).toHaveLength(2);
    });

    it("parses NOT expression", () => {
      const ast = parse(tokenize("NOT tag:draft"));
      expect(ast.root?.type).toBe("not");
      const node = ast.root as OperatorNode;
      expect(node.children).toHaveLength(1);
      expect(node.children[0]?.type).toBe("filter");
    });

    it("parses grouped expression with parens", () => {
      const ast = parse(tokenize("(tag:auth)"));
      expect(ast.root?.type).toBe("group");
      const group = ast.root as GroupNode;
      expect(group.child.type).toBe("filter");
    });

    it("parses complex nested: tag:auth AND (type:decision OR path:~/docs)", () => {
      const ast = parse(
        tokenize("tag:auth AND (type:decision OR path:~/docs)"),
      );
      expect(ast.root?.type).toBe("and");
      const and = ast.root as OperatorNode;
      expect(and.children[0]?.type).toBe("filter");
      expect(and.children[1]?.type).toBe("group");
      const group = and.children[1] as GroupNode;
      expect(group.child.type).toBe("or");
    });

    it("bare word becomes implicit OR over title: and link:", () => {
      const ast = parse(tokenize("hello"));
      expect(ast.root?.type).toBe("or");
      const or = ast.root as OperatorNode;
      expect(or.children).toHaveLength(2);
      expect((or.children[0] as FilterNode).field).toBe("title");
      expect((or.children[1] as FilterNode).field).toBe("link");
    });
  });

  // -------------------------------------------------------------------------
  describe("operator precedence", () => {
    it("NOT binds tighter than AND", () => {
      // "NOT tag:draft AND type:note" → (NOT tag:draft) AND type:note
      const ast = parse(tokenize("NOT tag:draft AND type:note"));
      expect(ast.root?.type).toBe("and");
      const and = ast.root as OperatorNode;
      expect(and.children[0]?.type).toBe("not");
      expect(and.children[1]?.type).toBe("filter");
    });

    it("AND binds tighter than OR", () => {
      // "tag:a OR tag:b AND tag:c" → tag:a OR (tag:b AND tag:c)
      const ast = parse(tokenize("tag:a OR tag:b AND tag:c"));
      expect(ast.root?.type).toBe("or");
      const or = ast.root as OperatorNode;
      expect(or.children[0]?.type).toBe("filter");
      expect(or.children[1]?.type).toBe("and");
    });
  });

  // -------------------------------------------------------------------------
  describe("error cases", () => {
    it("throws OxoriError with QUERY_PARSE_ERROR for unbalanced opening paren", () => {
      expect(() => parse(tokenize("(tag:auth"))).toThrow();
      try {
        parse(tokenize("(tag:auth"));
      } catch (e: unknown) {
        const err = e as OxoriError;
        expect(err.code).toBe("QUERY_PARSE_ERROR");
        expect(typeof err.message).toBe("string");
      }
    });

    it("throws OxoriError with QUERY_PARSE_ERROR for stray closing paren", () => {
      expect(() => parse(tokenize("tag:auth)"))).toThrow();
      try {
        parse(tokenize("tag:auth)"));
      } catch (e: unknown) {
        const err = e as OxoriError;
        expect(err.code).toBe("QUERY_PARSE_ERROR");
      }
    });

    it("throws OxoriError with QUERY_UNKNOWN_FIELD for unknown field", () => {
      expect(() => parse(tokenize("author:alice"))).toThrow();
      try {
        parse(tokenize("author:alice"));
      } catch (e: unknown) {
        const err = e as OxoriError;
        expect(err.code).toBe("QUERY_UNKNOWN_FIELD");
        expect(err.message).toMatch(/author/);
      }
    });

    it("OxoriError includes an action suggestion", () => {
      try {
        parse(tokenize("author:alice"));
      } catch (e: unknown) {
        const err = e as OxoriError;
        expect(typeof err.action).toBe("string");
        expect(err.action?.length).toBeGreaterThan(0);
      }
    });

    it("throws QUERY_PARSE_ERROR when operator has no right operand", () => {
      try {
        parse(tokenize("tag:auth AND"));
        expect.fail("Should have thrown");
      } catch (e: unknown) {
        const err = e as OxoriError;
        expect(err.code).toBe("QUERY_PARSE_ERROR");
        expect(err.action?.length || 0).toBeGreaterThan(0);
      }
    });

    it("throws QUERY_PARSE_ERROR for double operators: tag:x AND AND tag:y", () => {
      try {
        parse(tokenize("tag:x AND AND tag:y"));
        expect.fail("Should have thrown");
      } catch (e: unknown) {
        const err = e as OxoriError;
        expect(err.code).toBe("QUERY_PARSE_ERROR");
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Round-trip: tokenize then parse produces stable ASTs
// ---------------------------------------------------------------------------

describe("tokenize() → parse() round-trip", () => {
  it("produces a valid QueryAST for all FILTER_FIELDS", () => {
    const queries = [
      "tag:auth",
      "type:note",
      "path:~/docs",
      "frontmatter:status=active",
      "title:overview",
      "link:readme",
    ];
    for (const q of queries) {
      const ast: QueryAST = parse(tokenize(q));
      expect(ast.root).not.toBeNull();
      expect(ast.root?.type).toBe("filter");
    }
  });

  it("empty query always round-trips to { root: null }", () => {
    for (const q of ["", "  ", "\t"]) {
      const ast = parse(tokenize(q));
      expect(ast.root).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// evaluate()
// ---------------------------------------------------------------------------

describe("evaluate()", () => {
  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function makeEntry(overrides: {
    filepath: string;
    filename: string;
    frontmatter?: Record<string, unknown>;
    tags?: string[];
    wikilinks?: string[];
  }): FileEntry {
    return {
      filepath: overrides.filepath,
      filename: overrides.filename,
      frontmatter: overrides.frontmatter ?? {},
      tags: new Set(overrides.tags ?? []),
      wikilinks: new Set(overrides.wikilinks ?? []),
      typedRelations: new Map(),
      lastModified: 0,
    };
  }

  function makeState(entries: FileEntry[]): IndexState {
    const files = new Map<string, FileEntry>();
    const tags = new Map<string, TagEntry>();
    const links = new Map<string, LinkEntry>();

    for (const entry of entries) {
      files.set(entry.filepath, entry);
      for (const tag of entry.tags) {
        const te = tags.get(tag) ?? { tag, files: new Set<string>() };
        te.files.add(entry.filepath);
        tags.set(tag, te);
      }
      for (const wl of entry.wikilinks) {
        const le = links.get(wl) ?? { target: wl, sources: new Set<string>() };
        le.sources.add(entry.filepath);
        links.set(wl, le);
      }
    }

    return { files, tags, links, totalFiles: files.size, lastIndexed: 0 };
  }

  /** Convenience: parse a query string into a QueryAST. */
  function q(query: string): QueryAST {
    return parse(tokenize(query));
  }

  // -------------------------------------------------------------------------
  // Shared test fixtures
  // -------------------------------------------------------------------------

  const FILE_ALPHA = makeEntry({
    filepath: "/vault/alpha.md",
    filename: "alpha",
    tags: ["project", "project/alpha", "status/active"],
    wikilinks: ["beta", "overview"],
    frontmatter: { type: "note", status: "active" },
  });

  const FILE_BETA = makeEntry({
    filepath: "/vault/beta.md",
    filename: "beta",
    tags: ["project", "project/beta"],
    wikilinks: [],
    frontmatter: { type: "decision", status: "draft" },
  });

  const FILE_GAMMA = makeEntry({
    filepath: "/vault/archive/gamma.md",
    filename: "gamma",
    tags: ["status/archived"],
    wikilinks: ["alpha"],
    frontmatter: { type: "note", author: "agent" },
  });

  const STATE = makeState([FILE_ALPHA, FILE_BETA, FILE_GAMMA]);

  // -------------------------------------------------------------------------
  describe("null root → match all", () => {
    it("returns all files when ast.root is null", () => {
      const result = evaluate({ root: null }, STATE);
      expect(result.totalMatched).toBe(3);
      expect(result.matches.has("/vault/alpha.md")).toBe(true);
      expect(result.matches.has("/vault/beta.md")).toBe(true);
      expect(result.matches.has("/vault/archive/gamma.md")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe("FilterNode: tag field", () => {
    it("matches files with exact tag (operator =)", () => {
      const result = evaluate(q("tag=project/alpha"), STATE);
      expect(result.totalMatched).toBe(1);
      expect(result.matches.has("/vault/alpha.md")).toBe(true);
    });

    it("matches files with tag containing value (operator :)", () => {
      // ":" for tag is also an exact match (same branch as "=")
      const result = evaluate(q("tag:project/alpha"), STATE);
      expect(result.totalMatched).toBe(1);
      expect(result.matches.has("/vault/alpha.md")).toBe(true);
    });

    it("matches files with tag substring (operator ~)", () => {
      // "~" does substring: "project/alpha".includes("alpha") → true
      const result = evaluate(q("tag~alpha"), STATE);
      expect(result.totalMatched).toBe(1);
      expect(result.matches.has("/vault/alpha.md")).toBe(true);
    });

    it("does not match files without the tag", () => {
      const result = evaluate(q("tag=nonexistent"), STATE);
      expect(result.totalMatched).toBe(0);
      expect(result.matches.size).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe("FilterNode: title field", () => {
    it("matches file by stem exact match (=)", () => {
      const result = evaluate(q("title=alpha"), STATE);
      expect(result.totalMatched).toBe(1);
      expect(result.matches.has("/vault/alpha.md")).toBe(true);
    });

    it("matches file by stem contains (:)", () => {
      const result = evaluate(q("title:alp"), STATE);
      expect(result.totalMatched).toBe(1);
      expect(result.matches.has("/vault/alpha.md")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe("FilterNode: link field", () => {
    it("matches files that link to the given stem", () => {
      // alpha.wikilinks has "beta"; gamma.wikilinks has "alpha"
      const result = evaluate(q("link:beta"), STATE);
      expect(result.totalMatched).toBe(1);
      expect(result.matches.has("/vault/alpha.md")).toBe(true);
    });

    it("matches files with link stem containing substring (operator ~)", () => {
      // alpha.wikilinks has "overview" — "over" is a substring
      const result = evaluate(q("link~over"), STATE);
      expect(result.totalMatched).toBe(1);
      expect(result.matches.has("/vault/alpha.md")).toBe(true);
    });

    it("does not match files that do not link to the stem", () => {
      const result = evaluate(q("link:nonexistent"), STATE);
      expect(result.totalMatched).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe("FilterNode: path field", () => {
    it("matches files whose path contains the value (~)", () => {
      const result = evaluate(q("path~archive"), STATE);
      expect(result.totalMatched).toBe(1);
      expect(result.matches.has("/vault/archive/gamma.md")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe("FilterNode: type field", () => {
    it("matches files with matching frontmatter.type", () => {
      const result = evaluate(q("type=decision"), STATE);
      expect(result.totalMatched).toBe(1);
      expect(result.matches.has("/vault/beta.md")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe("FilterNode: frontmatter field", () => {
    it("matches files where any frontmatter value contains the search term", () => {
      // gamma frontmatter has author: "agent" — substring match via "~"
      const result = evaluate(q("frontmatter~agent"), STATE);
      expect(result.totalMatched).toBe(1);
      expect(result.matches.has("/vault/archive/gamma.md")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe("OperatorNode: AND", () => {
    it("returns intersection of two filter results", () => {
      // alpha: type=note ✓ AND tag=status/active ✓ → matches
      // gamma: type=note ✓ AND tag=status/active ✗ → no match
      const result = evaluate(q("type:note AND tag:status/active"), STATE);
      expect(result.totalMatched).toBe(1);
      expect(result.matches.has("/vault/alpha.md")).toBe(true);
    });

    it("returns empty set when no file matches both", () => {
      // type:note matches alpha and gamma; tag:project/beta matches only beta
      const result = evaluate(q("type:note AND tag:project/beta"), STATE);
      expect(result.totalMatched).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe("OperatorNode: OR", () => {
    it("returns union of two filter results", () => {
      const result = evaluate(q("tag:project/alpha OR tag:project/beta"), STATE);
      expect(result.totalMatched).toBe(2);
      expect(result.matches.has("/vault/alpha.md")).toBe(true);
      expect(result.matches.has("/vault/beta.md")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe("OperatorNode: NOT", () => {
    it("returns complement — files NOT matching the child", () => {
      // beta is the only decision; alpha and gamma are notes
      const result = evaluate(q("NOT type=decision"), STATE);
      expect(result.totalMatched).toBe(2);
      expect(result.matches.has("/vault/alpha.md")).toBe(true);
      expect(result.matches.has("/vault/archive/gamma.md")).toBe(true);
      expect(result.matches.has("/vault/beta.md")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe("GroupNode", () => {
    it("group node is transparent — same result as child", () => {
      const grouped = evaluate(q("(tag:project/alpha)"), STATE);
      const ungrouped = evaluate(q("tag:project/alpha"), STATE);
      expect(grouped.totalMatched).toBe(ungrouped.totalMatched);
      expect(grouped.matches.has("/vault/alpha.md")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe("empty state", () => {
    it("returns empty QueryResult when IndexState has no files", () => {
      const emptyState = makeState([]);
      const result = evaluate({ root: null }, emptyState);
      expect(result.totalMatched).toBe(0);
      expect(result.matches.size).toBe(0);
      expect(result.executionMs).toBe(0);
    });
  });
});
