# Squad Decisions

## Active Decisions

No decisions recorded yet.

### 2026-06-30: M0 scaffold complete
**By:** Parker
**What:** Project skeleton created. npm install, build, lint, test all pass.
Key choices: unified v11 (ESM-only, matches type:module), commander v12, vitest v2.
**Files:** package.json, tsconfig.json, biome.json, src/ skeleton (8 files)

### 2026-06-30T19:17: Directive — plan in permanent md files
**By:** Onur Asiliskender (via Coordinator)
**What:** All planning artifacts (plan, decisions) must be written to permanent markdown files in the repo root, not only in .squad/ session state.
**Files created:** PLAN.md (40-task build plan), DECISIONS.md updated (OQ1-OQ7), PROJECT.md updated (PLAN.md reference added)

### 2026-06-30: M1 + M2 complete
**By:** Ripley
**What:** Parser and store modules implemented. parseFile() uses remark AST for text/headings, regex on code-stripped content for Obsidian syntax. Store uses fs/promises with explicit null-on-missing, throw-on-corrupt behavior.
**Key:** unified/remark-parse are pure ESM — import paths need .js extension in NodeNext mode.

### 2026-06-30: M3 indexer complete
**By:** Ripley
**What:** Full indexer — computeHash, listMarkdownFiles, reconcileFiles, buildLinkGraph (with link resolution + broken flag), buildTagMap, runIndex.
**Key:** Link resolution checks exact path, path+.md extension, and filename suffix match. broken flag is mutated on FileRecord.links during buildLinkGraph — this is intentional, the parser sets false and the indexer corrects it.

### 2026-06-30: T7.1 + T7.2 tests complete
**By:** Lambert
**What:** 11 unit tests passing for parser and store modules.
**Approach:** Real temp dirs via os.tmpdir() + randomUUID() for isolation. Cleanup in afterEach.
**Note any issues found in the implementation here if any.**

No implementation bugs found. Parser correctly strips headings from text, ignores tags in code fences,
and handles [[target|alias]] by returning only the target. Store correctly returns null on ENOENT and
throws a descriptive error (not a raw SyntaxError) on corrupt JSON.

### 2026-06-30: T8.1 + T8.4 complete
**By:** Parker
**What:** PR CI workflow and Dependabot configured.
**Note:** Dependabot also configured for github-actions ecosystem — keeps action versions current automatically.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
