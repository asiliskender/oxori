/**
 * @file index.ts
 * @description Public API entry point for the Oxori library.
 *
 * Re-exports all public types, helpers, and functions. Consumers import
 * from `"oxori"` — this file is the single authoritative export surface.
 *
 * @module oxori
 * @since 0.1.0
 */

// Types and Result helpers
export type {
  ParsedFile,
  FileEntry,
  FrontmatterEntry,
  TagEntry,
  LinkEntry,
  TypedRelation,
  IndexState,
  VaultConfig,
  OxoriError,
  Result,
  WatchEvent,
  GovernanceRule,
PathRule,
  TagRule,
  LinkRule,
  // Sprint 3 — Watcher and Governance
  VaultWatcher,
  GovernanceViolation,
  GovernanceResult,
  // Sprint 2 — Query Engine
  Token,
  TokenKind,
  QueryAST,
  QueryNode,
  FilterNode,
  OperatorNode,
  GroupNode,
  QueryResult,
  FilterField,
  // Sprint 2 — Graph Traversal
  Edge,
  WalkOptions,
  WalkResult,
  WalkDirection,
  WalkVia,
  // Phase 4 — Semantic Search
  Embedding,
  EmbeddingProvider,
  OpenAIProviderConfig,
  SearchResult,
  SearchOptions,
  VectorEntry,
  VectorIndex,
  EmbeddingErrorCode,
} from "./types.js";
export { ok, err, FILTER_FIELDS } from "./types.js";

// Parser
export {
  parseFile,
  expandTagHierarchy,
  extractWikilinks,
  extractTags,
  extractTypedRelations,
} from "./parser.js";

// Indexer
export {
  indexVault,
  indexFile,
  removeFile,
  createEmptyState,
} from "./indexer.js";

// Query Engine
export { tokenize, parse, evaluate } from "./query.js";

// Graph Traversal
export { walk } from "./graph.js";

// Governance
export { checkGovernance } from "./governance.js";

// Watcher
export { watch } from "./watcher.js";

/**
 * Semantic Search (Phase 4 — optional)
 *
 * Core Oxori (index, query, walk, governance) works without any setup.
 * Semantic search requires:
 *   1. An embedding provider (createOpenAIProvider or createStubProvider)
 *   2. Running embedVault() or `oxori embed` to build .oxori/vectors/
 *   3. Calling searchVault() to query by semantic similarity
 *
 * If vectors haven't been built, searchVault() returns:
 *   err({ code: "VECTORS_NOT_BUILT", action: "Run 'oxori embed' first." })
 */
// Search (Phase 4)
export {
  createOpenAIProvider,
  createStubProvider,
  cosineSimilarity,
  writeVecFile,
  readVecFile,
  VectorStore,
  searchVault,
  embedVault,
} from "./search.js";
