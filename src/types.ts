// Core types for oxori Phase 1

export interface ParsedFile {
  text: string;
  headings: string[];
  tags: string[];
  links: Array<{ target: string; broken: boolean }>;
}

export interface FileRecord {
  path: string;
  hash: string;
  text: string;
  headings: string[];
  tags: string[];
  links: Array<{ target: string; broken: boolean }>;
}

export interface LinkGraph {
  forward: Record<string, string[]>;
  backlinks: Record<string, string[]>;
}

export type TagMap = Record<string, string[]>;

export interface IndexData {
  version: number;
  updatedAt: string;
  files: FileRecord[];
  linkGraph: LinkGraph;
  tagMap: TagMap;
}

export interface Config {
  version: number;
  createdAt: string;
  vaultPath: string;
}

export type SearchMode = "text" | "structural" | "tag";

export interface SearchOptions {
  mode: SearchMode;
  structuralTarget?: string;
  tagTarget?: string;
}

export interface SearchResult {
  path: string;
  headings: string[];
  snippet: string;
}
