/**
 * @file index.ts
 * @description Public API entry point for the Oxori library.
 *
 * Re-exports all public types, helpers, and functions. Consumers import
 * from `"oxori"` — this file is the single authoritative export surface.
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
} from "./types.js";
export { ok, err } from "./types.js";

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
