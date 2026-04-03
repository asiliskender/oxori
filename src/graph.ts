/**
 * @file graph.ts
 * @description Graph traversal for Oxori vaults.
 *
 * Provides BFS-based walk over the file relationship graph built by the indexer.
 * Supports wikilinks, tag co-occurrence, and typed relations as edge kinds.
 * Cycle detection is implicit: the visited set prevents re-enqueuing any node.
 *
 * All functions are pure — no I/O, no mutation of `IndexState`.
 *
 * @module graph
 */

import type {
  WalkOptions,
  WalkResult,
  WalkDirection,
  Edge,
  IndexState,
} from "./types.js";

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Resolves a lowercase filename stem to an absolute filepath by scanning
 * `state.files`. Returns `undefined` when no matching entry exists.
 */
function stemToPath(stem: string, state: IndexState): string | undefined {
  const lower = stem.toLowerCase();
  for (const entry of state.files.values()) {
    if (entry.filename.toLowerCase() === lower) {
      return entry.filepath;
    }
  }
  return undefined;
}

/** Returns outgoing wikilink edges where `path` is the source. */
function outgoingLinkEdges(path: string, state: IndexState): Edge[] {
  const entry = state.files.get(path);
  if (!entry) return [];
  const edges: Edge[] = [];
  for (const stem of entry.wikilinks) {
    const target = stemToPath(stem, state);
    if (target) edges.push({ source: path, target, kind: "wikilink" });
  }
  return edges;
}

/** Returns incoming wikilink edges where `path` is the target (backlinks). */
function incomingLinkEdges(path: string, state: IndexState): Edge[] {
  const entry = state.files.get(path);
  if (!entry) return [];
  const linkEntry = state.links.get(entry.filename.toLowerCase());
  if (!linkEntry) return [];
  const edges: Edge[] = [];
  for (const source of linkEntry.sources) {
    if (source !== path && state.files.has(source)) {
      edges.push({ source, target: path, kind: "wikilink" });
    }
  }
  return edges;
}

/**
 * Returns tag co-occurrence edges originating from `path`.
 * Tag sharing is symmetric — the edge is always modelled as
 * `source=path, target=neighbor`, regardless of walk direction.
 * Uses the alphabetically first shared tag for determinism.
 */
function tagNeighborEdges(path: string, state: IndexState): Edge[] {
  const entry = state.files.get(path);
  if (!entry || entry.tags.size === 0) return [];

  // Map neighbor path → alphabetically first shared tag.
  const neighborFirstTag = new Map<string, string>();
  for (const tag of [...entry.tags].sort()) {
    const tagEntry = state.tags.get(tag);
    if (!tagEntry) continue;
    for (const neighborPath of tagEntry.files) {
      if (neighborPath !== path && !neighborFirstTag.has(neighborPath)) {
        neighborFirstTag.set(neighborPath, tag);
      }
    }
  }

  const edges: Edge[] = [];
  for (const neighborPath of neighborFirstTag.keys()) {
    if (state.files.has(neighborPath)) {
      edges.push({ source: path, target: neighborPath, kind: "tag" });
    }
  }
  return edges;
}

/**
 * Returns typed-relation edges for `path`, filtered by `relKey` and `direction`.
 * Outgoing: `path` declares the relation; Incoming: another file points to `path`.
 */
function relationEdges(
  path: string,
  relKey: string,
  state: IndexState,
  direction: WalkDirection,
): Edge[] {
  const edges: Edge[] = [];

  if (direction === "outgoing" || direction === "both") {
    const entry = state.files.get(path);
    if (entry) {
      const targets = entry.typedRelations.get(relKey);
      if (targets) {
        for (const stem of targets) {
          const targetPath = stemToPath(stem, state);
          if (targetPath) {
            edges.push({
              source: path,
              target: targetPath,
              kind: "relation",
              relationType: relKey,
            });
          }
        }
      }
    }
  }

  if (direction === "incoming" || direction === "both") {
    const entry = state.files.get(path);
    if (!entry) return edges;
    const currentStem = entry.filename.toLowerCase();
    for (const [candidatePath, candidateEntry] of state.files) {
      if (candidatePath === path) continue;
      const targets = candidateEntry.typedRelations.get(relKey);
      if (!targets) continue;
      for (const stem of targets) {
        if (stem.toLowerCase() === currentStem) {
          edges.push({
            source: candidatePath,
            target: path,
            kind: "relation",
            relationType: relKey,
          });
          break;
        }
      }
    }
  }

  return edges;
}

/**
 * Resolves all neighbor edges for `path` according to the resolved walk options.
 * Returns raw edges; global deduplication is handled by `walk`.
 */
function resolveNeighbors(
  path: string,
  state: IndexState,
  options: Required<WalkOptions>,
): Edge[] {
  const { via, direction } = options;
  const edges: Edge[] = [];

  if (via === "links" || via === "both") {
    if (direction === "outgoing" || direction === "both") {
      edges.push(...outgoingLinkEdges(path, state));
    }
    if (direction === "incoming" || direction === "both") {
      edges.push(...incomingLinkEdges(path, state));
    }
  }

  if (via === "tags" || via === "both") {
    edges.push(...tagNeighborEdges(path, state));
  }

  if (via.startsWith("relation:")) {
    const relKey = via.slice("relation:".length);
    edges.push(...relationEdges(path, relKey, state, direction));
  }

  return edges;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Performs a BFS walk of the file relationship graph starting from `start`.
 *
 * Traversal honours:
 * - `depth`     — maximum edge-hop distance from the seed node (default: `Infinity`)
 * - `direction` — `"outgoing"` (default) | `"incoming"` | `"both"`
 * - `via`       — `"links"` | `"tags"` | `"both"` (default) | `"relation:<key>"`
 * - `maxNodes`  — hard cap on visited nodes; sets `truncated: true` when hit
 *
 * The seed node is always included in `nodes` and `visitOrder`.
 * Cycle detection is implicit: the visited set prevents re-enqueuing any node.
 *
 * @param start   - Absolute filepath of the seed node.
 * @param state   - The current vault index state produced by the indexer.
 * @param options - Optional walk configuration; see {@link WalkOptions}.
 * @returns A {@link WalkResult} with visited nodes, edges, visit order, and
 *          truncation status. Returns an empty result if `start` is absent
 *          from `state.files` — never throws.
 *
 * @example
 * // Outgoing wikilinks, depth 2
 * const result = walk("/vault/auth.md", state, {
 *   direction: "outgoing",
 *   via: "links",
 *   depth: 2,
 * });
 * console.log([...result.visitOrder]);
 * // => ["/vault/auth.md", "/vault/login.md", "/vault/session.md"]
 *
 * @example
 * // All tag neighbours capped at 50 nodes
 * const result = walk("/vault/auth.md", state, { via: "tags", maxNodes: 50 });
 * console.log(result.truncated); // true if vault is large
 */
export function walk(
  start: string,
  state: IndexState,
  options?: WalkOptions,
): WalkResult {
  const empty: WalkResult = {
    nodes: new Set<string>(),
    edges: new Set<Edge>(),
    visitOrder: [],
    truncated: false,
  };

  if (!state.files.has(start)) return empty;

  const opts: Required<WalkOptions> = {
    depth: options?.depth ?? Infinity,
    direction: options?.direction ?? "outgoing",
    via: options?.via ?? "both",
    maxNodes: options?.maxNodes ?? Infinity,
  };

  const visited = new Set<string>();
  const visitOrder: string[] = [];
  const edgeKeys = new Set<string>();
  const allEdges: Edge[] = [];
  let truncated = false;

  // BFS queue: [absoluteFilepath, currentDepth]
  const queue: [string, number][] = [[start, 0]];
  visited.add(start);

  while (queue.length > 0) {
    const item = queue.shift();
    if (item === undefined) break;
    const [current, depth] = item;

    visitOrder.push(current);

    if (visitOrder.length >= opts.maxNodes) {
      truncated = true;
      break;
    }

    if (depth >= opts.depth) continue;

    for (const edge of resolveNeighbors(current, state, opts)) {
      const edgeKey = `${edge.source}\0${edge.target}\0${edge.kind}\0${edge.relationType ?? ""}`;
      if (!edgeKeys.has(edgeKey)) {
        edgeKeys.add(edgeKey);
        allEdges.push(edge);
      }
      const neighbor = edge.source === current ? edge.target : edge.source;
      if (!visited.has(neighbor) && state.files.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, depth + 1]);
      }
    }
  }

  return {
    nodes: new Set(visitOrder),
    edges: new Set(allEdges),
    visitOrder,
    truncated,
  };
}

// future: shortestPath, connected components
