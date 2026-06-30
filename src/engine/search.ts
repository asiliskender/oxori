import type { FileRecord, IndexData, SearchOptions, SearchResult } from "../types.js";

// T4.4 — Extract snippet around first match
export function extractSnippet(text: string, term: string, windowChars = 120): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(term.toLowerCase());
  if (idx === -1) return "";

  const start = Math.max(0, idx - windowChars);
  const end = Math.min(text.length, idx + term.length + windowChars);

  let snippet = text.slice(start, end).trim();

  // Trim to word boundaries
  if (start > 0) {
    const firstSpace = snippet.indexOf(" ");
    if (firstSpace > 0 && firstSpace < 20) snippet = snippet.slice(firstSpace + 1);
    snippet = `…${snippet}`;
  }
  if (end < text.length) {
    const lastSpace = snippet.lastIndexOf(" ");
    if (lastSpace > snippet.length - 20 && lastSpace > 0) snippet = snippet.slice(0, lastSpace);
    snippet = `${snippet}…`;
  }

  return snippet;
}

// T4.1 — Full-text keyword search (body text + headings)
export function fullTextSearch(index: IndexData, term: string): FileRecord[] {
  const lower = term.toLowerCase();
  return index.files.filter(
    (file) =>
      file.text.toLowerCase().includes(lower) ||
      file.headings.some((h) => h.toLowerCase().includes(lower)),
  );
}

// T4.2 — Structural search (links + backlinks for a given file path)
export function structuralSearch(
  index: IndexData,
  filePath: string,
): { links: string[]; backlinks: string[] } {
  return {
    links: index.linkGraph.forward[filePath] ?? [],
    backlinks: index.linkGraph.backlinks[filePath] ?? [],
  };
}

// T4.3 — Tag filter
export function tagSearch(index: IndexData, tag: string): string[] {
  const lower = tag.toLowerCase().replace(/^#/, "");
  for (const [t, paths] of Object.entries(index.tagMap)) {
    if (t.toLowerCase() === lower) return paths;
  }
  return [];
}

// T4.5 — Compose search
export function search(index: IndexData, query: string, opts: SearchOptions): SearchResult[] {
  switch (opts.mode) {
    case "text": {
      const matches = fullTextSearch(index, query);
      return matches.map((file) => {
        // Prefer snippet from body text; fall back to the matching heading
        let snippet = extractSnippet(file.text, query);
        if (!snippet) {
          const matchingHeading = file.headings.find((h) =>
            h.toLowerCase().includes(query.toLowerCase()),
          );
          snippet = matchingHeading ? `[heading] ${matchingHeading}` : "";
        }
        return { path: file.path, headings: file.headings, snippet };
      });
    }

    case "structural": {
      const target = opts.structuralTarget ?? query;
      const { links, backlinks } = structuralSearch(index, target);
      const allPaths = [...new Set([...links, ...backlinks])];
      return allPaths.map((p) => {
        const file = index.files.find((f) => f.path === p);
        return {
          path: p,
          headings: file?.headings ?? [],
          snippet: "",
        };
      });
    }

    case "tag": {
      const tagTarget = opts.tagTarget ?? query;
      const paths = tagSearch(index, tagTarget);
      return paths.map((p) => {
        const file = index.files.find((f) => f.path === p);
        return {
          path: p,
          headings: file?.headings ?? [],
          snippet: "",
        };
      });
    }

    default:
      return [];
  }
}
