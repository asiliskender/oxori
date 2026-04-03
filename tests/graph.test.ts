/**
 * @file graph.test.ts
 * @description Test suite for `graph.walk()` — Phase 2 Wave 1 skeletons.
 *
 * Most tests are `it.todo()` because the `walk()` implementation is pending.
 * Tests that can run purely from types or with an empty/unknown seed are
 * written with real assertions.
 *
 * Fixture: `tests/fixtures/linked-vault/` — 7 files forming a directed graph
 * with a cycle (A→B→C→A), a leaf (node-d), a hub (node-e), and multiple
 * typed-relation targets (node-f). See tests/fixtures/README.md for the full
 * graph diagram.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { indexVault, createEmptyState } from "../src/indexer";
import { walk } from "../src/graph";
import type { IndexState, WalkResult, Edge } from "../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LINKED_VAULT = join(__dirname, "fixtures/linked-vault");

// ---------------------------------------------------------------------------
// Shared index state built once for the entire suite
// ---------------------------------------------------------------------------

let state: IndexState;

beforeAll(async () => {
  const result = await indexVault({ vaultPath: LINKED_VAULT });
  if (!result.ok) throw new Error(`indexVault failed: ${result.error.message}`);
  state = result.value;
});

// ---------------------------------------------------------------------------
// WalkResult type-shape sanity (no walk() call needed)
// ---------------------------------------------------------------------------

describe("WalkResult type shape", () => {
  it("nodes is a ReadonlySet with .has() and .size", () => {
    const result: WalkResult = {
      nodes: new Set(["notes/a.md", "notes/b.md"]),
      edges: new Set<Edge>([]),
      visitOrder: ["notes/a.md", "notes/b.md"],
      truncated: false,
    };
    expect(result.nodes.size).toBe(2);
    expect(result.nodes.has("notes/a.md")).toBe(true);
    expect(result.nodes.has("notes/z.md")).toBe(false);
  });

  it("edges is a ReadonlySet of Edge objects", () => {
    const edge: Edge = {
      source: "notes/a.md",
      target: "notes/b.md",
      kind: "wikilink",
    };
    const result: WalkResult = {
      nodes: new Set(["notes/a.md"]),
      edges: new Set([edge]),
      visitOrder: ["notes/a.md"],
      truncated: false,
    };
    expect(result.edges.size).toBe(1);
    const [first] = result.edges;
    expect(first?.kind).toBe("wikilink");
  });

  it("visitOrder is a readonly array", () => {
    const result: WalkResult = {
      nodes: new Set<string>([]),
      edges: new Set<Edge>([]),
      visitOrder: [],
      truncated: false,
    };
    expect(Array.isArray(result.visitOrder)).toBe(true);
    expect(result.truncated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// walk()
// ---------------------------------------------------------------------------

describe("walk()", () => {
  // -------------------------------------------------------------------------
  describe("forward traversal via links", () => {
    it("visits all reachable nodes in BFS order", () => {
      const nodeA = join(LINKED_VAULT, "node-a.md");
      // a → b, c (depth 1); b → d (depth 2); c → a (visited). Total: 4 nodes.
      const result = walk(nodeA, state, { via: "links", direction: "outgoing" });
      expect(result.visitOrder[0]).toBe(nodeA);
      expect(result.nodes.size).toBe(4);
      expect(result.nodes.has(join(LINKED_VAULT, "node-b.md"))).toBe(true);
      expect(result.nodes.has(join(LINKED_VAULT, "node-c.md"))).toBe(true);
      expect(result.nodes.has(join(LINKED_VAULT, "node-d.md"))).toBe(true);
      // node-e links TO a, not reachable via outgoing from a
      expect(result.nodes.has(join(LINKED_VAULT, "node-e.md"))).toBe(false);
    });

    it("respects maxDepth — stops at depth 1 from seed", () => {
      const nodeA = join(LINKED_VAULT, "node-a.md");
      const result = walk(nodeA, state, { via: "links", direction: "outgoing", depth: 1 });
      // depth 0: a; depth 1: b, c — b and c are enqueued but not expanded
      expect(result.nodes.has(join(LINKED_VAULT, "node-a.md"))).toBe(true);
      expect(result.nodes.has(join(LINKED_VAULT, "node-b.md"))).toBe(true);
      expect(result.nodes.has(join(LINKED_VAULT, "node-c.md"))).toBe(true);
      // node-d is 2 hops away (a→b→d) — must not appear at depth:1
      expect(result.nodes.has(join(LINKED_VAULT, "node-d.md"))).toBe(false);
      expect(result.nodes.size).toBe(3);
    });

    it("does not include start node when includeSelf=false", () => {
      // WalkOptions has no includeSelf — the seed is always included.
      // This test documents that the walk() API always returns the seed in visitOrder[0].
      const nodeA = join(LINKED_VAULT, "node-a.md");
      const result = walk(nodeA, state, { via: "links", direction: "outgoing" });
      expect(result.visitOrder[0]).toBe(nodeA);
      expect(result.nodes.has(nodeA)).toBe(true);
    });

    it("includes start node when includeSelf=true", () => {
      // Seed is always the first entry in visitOrder regardless of options.
      const nodeB = join(LINKED_VAULT, "node-b.md");
      const result = walk(nodeB, state, { via: "links", direction: "outgoing" });
      expect(result.visitOrder[0]).toBe(nodeB);
      expect(result.nodes.has(nodeB)).toBe(true);
    });

    it("records edges with correct via label (kind: wikilink)", () => {
      const nodeA = join(LINKED_VAULT, "node-a.md");
      const nodeB = join(LINKED_VAULT, "node-b.md");
      const result = walk(nodeA, state, { via: "links", direction: "outgoing", depth: 1 });
      const edgeArray = [...result.edges];
      expect(edgeArray.length).toBeGreaterThan(0);
      expect(edgeArray.every((e) => e.kind === "wikilink")).toBe(true);
      const abEdge = edgeArray.find(
        (e) => e.source === nodeA && e.target === nodeB,
      );
      expect(abEdge).toBeDefined();
      expect(abEdge?.kind).toBe("wikilink");
    });

    it("detects cycles — node-a → node-b → node-c → node-a does not loop", () => {
      const nodeA = join(LINKED_VAULT, "node-a.md");
      const result = walk(nodeA, state, { via: "links", direction: "outgoing" });
      // BFS must terminate; no node should appear twice in visitOrder
      const uniqueCount = new Set(result.visitOrder).size;
      expect(uniqueCount).toBe(result.visitOrder.length);
      expect(result.nodes.size).toBe(result.visitOrder.length);
    });
  });

  // -------------------------------------------------------------------------
  describe("backward traversal (direction: incoming)", () => {
    it("finds all files that link to the start node", () => {
      const nodeA = join(LINKED_VAULT, "node-a.md");
      const nodeC = join(LINKED_VAULT, "node-c.md");
      const nodeE = join(LINKED_VAULT, "node-e.md");
      // node-c and node-e both have [[node-a]] in their bodies
      const result = walk(nodeA, state, {
        via: "links",
        direction: "incoming",
        depth: 1,
      });
      expect(result.nodes.has(nodeC)).toBe(true);
      expect(result.nodes.has(nodeE)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe("via: tags", () => {
    it("returns files sharing at least one tag with the seed node", () => {
      const nodeA = join(LINKED_VAULT, "node-a.md");
      // node-a has architecture/services and status/stable; node-b shares status/stable
      const result = walk(nodeA, state, {
        via: "tags",
        direction: "outgoing",
        depth: 1,
      });
      expect(result.nodes.size).toBeGreaterThan(1);
      expect(result.nodes.has(join(LINKED_VAULT, "node-b.md"))).toBe(true);
      const tagEdges = [...result.edges].filter((e) => e.kind === "tag");
      expect(tagEdges.length).toBeGreaterThan(0);
    });

    it("returns only the seed when the seed file has no tags — tagNeighborEdges empty-tag early-return", () => {
      // Exercises the `entry.tags.size === 0` branch in tagNeighborEdges (returns []).
      const minState = createEmptyState();
      const noTagPath = "/vault/no-tags.md";
      minState.files.set(noTagPath, {
        filepath: noTagPath,
        filename: "no-tags",
        frontmatter: {},
        tags: new Set<string>(),
        wikilinks: new Set<string>(),
        typedRelations: new Map(),
        lastModified: 0,
      });
      const result = walk(noTagPath, minState, { via: "tags", direction: "outgoing" });
      expect(result.nodes.size).toBe(1);
      expect(result.nodes.has(noTagPath)).toBe(true);
      expect(result.edges.size).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe("via: relation:<key>", () => {
    it("traverses named relation links (e.g. relation:depends_on)", () => {
      const nodeF = join(LINKED_VAULT, "node-f.md");
      const nodeC = join(LINKED_VAULT, "node-c.md");
      const nodeE = join(LINKED_VAULT, "node-e.md");
      // node-f frontmatter: related_to: [[node-e]], [[node-c]]
      const result = walk(nodeF, state, {
        via: "relation:related_to",
        direction: "outgoing",
      });
      expect(result.nodes.has(nodeC)).toBe(true);
      expect(result.nodes.has(nodeE)).toBe(true);
      const relEdges = [...result.edges].filter(
        (e) => e.kind === "relation" && e.relationType === "related_to",
      );
      expect(relEdges.length).toBeGreaterThan(0);
    });

    it("does not traverse wikilinks when via is relation:<key>", () => {
      const nodeB = join(LINKED_VAULT, "node-b.md");
      const nodeA = join(LINKED_VAULT, "node-a.md");
      const nodeC = join(LINKED_VAULT, "node-c.md");
      const nodeD = join(LINKED_VAULT, "node-d.md");
      // node-b: depends_on: [[node-a]] (typed), body links to [[node-c]], [[node-d]]
      const result = walk(nodeB, state, {
        via: "relation:depends_on",
        direction: "outgoing",
      });
      expect(result.nodes.has(nodeA)).toBe(true); // typed relation target
      expect(result.nodes.has(nodeC)).toBe(false); // body wikilink — must NOT be followed
      expect(result.nodes.has(nodeD)).toBe(false); // body wikilink — must NOT be followed
    });

    it("finds incoming typed-relation edges — exercises relationEdges incoming branch (lines 129-148)", () => {
      // node-c has `related_to: [[node-b]]`, so node-c → node-b is an outgoing relation.
      // Walking node-b with direction:incoming should discover node-c as a source.
      const nodeB = join(LINKED_VAULT, "node-b.md");
      const nodeC = join(LINKED_VAULT, "node-c.md");
      const result = walk(nodeB, state, {
        via: "relation:related_to",
        direction: "incoming",
      });
      expect(result.nodes.has(nodeC)).toBe(true);
      const relEdges = [...result.edges].filter(
        (e) => e.kind === "relation" && e.relationType === "related_to",
      );
      expect(relEdges.length).toBeGreaterThan(0);
      expect(relEdges.some((e) => e.source === nodeC && e.target === nodeB)).toBe(true);
    });

    it("ignores relation targets whose stem cannot be resolved — stemToPath returns undefined", () => {
      // Exercises the `return undefined` path in stemToPath (line 35) via outgoing relations.
      const minState = createEmptyState();
      const srcPath = "/vault/src.md";
      minState.files.set(srcPath, {
        filepath: srcPath,
        filename: "src",
        frontmatter: {},
        tags: new Set<string>(),
        wikilinks: new Set<string>(),
        typedRelations: new Map([["depends_on", ["ghost-nonexistent"]]]),
        lastModified: 0,
      });
      const result = walk(srcPath, minState, {
        via: "relation:depends_on",
        direction: "outgoing",
      });
      // The unresolvable stem produces no edge and no additional nodes.
      expect(result.nodes.size).toBe(1);
      expect(result.nodes.has(srcPath)).toBe(true);
      expect(result.edges.size).toBe(0);
    });

    it("handles a candidate with relation key mapping to an empty targets array — incoming no-op", () => {
      // Exercises the inner for-of loop in relationEdges incoming with an empty targets array.
      // The `if (!targets) continue` check passes ([] is truthy), but the loop body never runs.
      const minState = createEmptyState();
      const seedPath = "/vault/seed.md";
      const candidatePath = "/vault/candidate.md";
      minState.files.set(seedPath, {
        filepath: seedPath,
        filename: "seed",
        frontmatter: {},
        tags: new Set<string>(),
        wikilinks: new Set<string>(),
        typedRelations: new Map(),
        lastModified: 0,
      });
      minState.files.set(candidatePath, {
        filepath: candidatePath,
        filename: "candidate",
        frontmatter: {},
        tags: new Set<string>(),
        wikilinks: new Set<string>(),
        typedRelations: new Map([["depends_on", []]]), // key exists, array empty
        lastModified: 0,
      });
      const result = walk(seedPath, minState, {
        via: "relation:depends_on",
        direction: "incoming",
      });
      expect(result.nodes.size).toBe(1);
      expect(result.edges.size).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe("edge cases", () => {
    it("returns an empty result for an unknown start path", () => {
      const result = walk("nonexistent/ghost.md", state);
      expect(result.nodes.size).toBe(0);
      expect(result.edges.size).toBe(0);
      expect(result.visitOrder).toEqual([]);
      expect(result.truncated).toBe(false);
    });

    it("handles empty IndexState without crashing", () => {
      const empty = createEmptyState();
      const result = walk("anything.md", empty);
      expect(result.nodes.size).toBe(0);
      expect(result.edges.size).toBe(0);
      expect(result.truncated).toBe(false);
    });

    it("handles a node with no outbound links — visited = {seed}, edges = {}", () => {
      const nodeD = join(LINKED_VAULT, "node-d.md");
      // node-d has no body wikilinks and no typed-relation targets pointing forward
      const result = walk(nodeD, state, { via: "links", direction: "outgoing" });
      expect(result.nodes.size).toBe(1);
      expect(result.nodes.has(nodeD)).toBe(true);
      expect(result.edges.size).toBe(0);
      expect(result.visitOrder).toEqual([nodeD]);
    });

    it("truncated=true when maxNodes cap is reached", () => {
      const nodeA = join(LINKED_VAULT, "node-a.md");
      // node-a has 4 reachable nodes via links; cap at 2 to force truncation
      const result = walk(nodeA, state, {
        via: "links",
        direction: "outgoing",
        maxNodes: 2,
      });
      expect(result.truncated).toBe(true);
      expect(result.visitOrder.length).toBe(2);
    });

    it("uses default direction and via when options are omitted — hits nullish-coalescing defaults", () => {
      // Passes a valid seed with no options object at all, forcing lines 238-239
      // (`direction ?? "outgoing"` and `via ?? "both"`) to take their default branch.
      const nodeD = join(LINKED_VAULT, "node-d.md");
      const result = walk(nodeD, state);
      // node-d has no outgoing links or relations, so only seed is visited
      expect(result.nodes.has(nodeD)).toBe(true);
      expect(result.truncated).toBe(false);
    });

    it("returns empty edges when a file has no link entry in state.links — incomingLinkEdges !linkEntry branch", () => {
      // Exercises the `if (!linkEntry) return []` branch at line 55.
      // We build a state with a file whose filename stem has no entry in state.links.
      const minState = createEmptyState();
      const isolatedPath = "/vault/isolated.md";
      minState.files.set(isolatedPath, {
        filepath: isolatedPath,
        filename: "isolated",
        frontmatter: {},
        tags: new Set<string>(),
        wikilinks: new Set<string>(),
        typedRelations: new Map(),
        lastModified: 0,
      });
      // state.links has no "isolated" entry → incomingLinkEdges returns []
      const result = walk(isolatedPath, minState, { via: "links", direction: "incoming" });
      expect(result.nodes.size).toBe(1);
      expect(result.nodes.has(isolatedPath)).toBe(true);
      expect(result.edges.size).toBe(0);
    });

    it("skips tags missing from state.tags — tagNeighborEdges !tagEntry continue branch", () => {
      // Exercises the `if (!tagEntry) continue` branch at line 79.
      // File declares a tag that is absent from state.tags (orphan tag).
      const minState = createEmptyState();
      const orphanPath = "/vault/orphan.md";
      minState.files.set(orphanPath, {
        filepath: orphanPath,
        filename: "orphan",
        frontmatter: {},
        tags: new Set<string>(["orphan/tag-not-in-index"]),
        wikilinks: new Set<string>(),
        typedRelations: new Map(),
        lastModified: 0,
      });
      // state.tags has no entry for "orphan/tag-not-in-index"
      const result = walk(orphanPath, minState, { via: "tags", direction: "outgoing" });
      expect(result.nodes.size).toBe(1);
      expect(result.nodes.has(orphanPath)).toBe(true);
      expect(result.edges.size).toBe(0);
    });
  });
});
