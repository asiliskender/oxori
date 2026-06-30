### 2026-06-30T18:25: Open questions resolved by Onur

**OQ1 — Linter:** Biome. Single tool for lint + format, zero config.

**OQ2 — CLI vault path:** Optional [path] argument, defaults to process.cwd(). All three commands (init, index, search) accept it.

**OQ3 — Missing .oxori/ on index:** Error with "run oxori init first". Init and index are distinct operations.

**OQ4 — Snippet window:** ±120 characters around first match, trimmed at word boundaries.

**OQ5 — Tag extraction in headings:** Do NOT extract #tags from heading text. A heading is structural, not a tag annotation.

**OQ6 — Search mode selection:** Flags. Default is full-text (`oxori search "term"`), `--tag "#rust"` for tag filter, `--link "note-a"` for structural.

**OQ7 — Broken links in FileRecord:** Array of objects: `links: Array<{ target: string, broken: boolean }>`.
