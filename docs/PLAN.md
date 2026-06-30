# Oxori — Phase 1 Build Plan

> Produced by Dallas (Lead) — 2026-06-30.
> Companion to SPEC.md (what done looks like) and ARCHITECTURE_LOW_LEVEL.md (how it's built).
> 40 tasks, 10 milestones, 57 dependencies. All tasks are Phase 1 only.

---

## Team

| Name | Role | Owns |
|---|---|---|
| Dallas 🏗️ | Lead | Architecture review, PR gating, scope enforcement |
| Ripley 🔧 | Engine Dev | parser, indexer, store, search, commands modules |
| Parker 🖥️ | CLI & DevOps | CLI layer, GitHub Actions, npm release, README |
| Lambert 🧪 | Tester | All unit, integration, and acceptance tests |

---

## Milestone Map

```
M0 Scaffold
 ├─► M1 Parser  ──────────────────────────────────────────────┐
 ├─► M2 Store   ──────────────────────────────────────────────┤
 └─► M3 Indexer (needs M1 + M2) ──────────────────────────►  M5 Commands ─► M6 CLI ─► M9
                 └─► M4 Search (needs M3) ────────────────►   M5            M8 CI/CD
                                                                └─► M7 Tests ───────►  (sign-off)
```

**Critical path:** T0.1 → T0.4 → T1.3 → T3.3 → T3.6 → T4.5 → T5.3 → T6.4 → T7.6 → T9.2

**Earliest parallelism:** After T0.4, Ripley can split across M1/M2/M3 simultaneously; Lambert can start M7 tests as each module ships.

---

## M0 — Project Scaffold

> Parker owns. Everything else is blocked until M0 exits.

| ID | Task | Owner | Depends on |
|---|---|---|---|
| T0.1 | Initialize `package.json`: name `oxori`, version `0.1.0`, `"type": "module"`, scripts (build/test/lint), devDeps: typescript, @types/node, biome, vitest | Parker | — |
| T0.2 | Write `tsconfig.json`: target ES2022, module NodeNext, `outDir: dist`, `rootDir: src`, strict on | Parker | T0.1 |
| T0.3 | Write `biome.json`: consistent style, no `any`, lint + format script | Parker | T0.1 |
| T0.4 | Create `src/` skeleton: `src/cli.ts`, `src/commands/`, `src/engine/parser.ts`, `src/engine/indexer.ts`, `src/engine/store.ts`, `src/engine/search.ts` — empty exports, `tsc` compiles clean | Parker | T0.2 |
| T0.5 | Add `bin: { "oxori": "./dist/cli.js" }` to `package.json`; verify `npm run build && node dist/cli.js` exits without crashing | Parker | T0.4 |

**Exit criterion:** `npm run build` succeeds; `npm run lint` runs; `npm test` runs (zero tests, zero failures).

---

## M1 — Parser Module

> Ripley. T1.1 and T1.2 can be built in parallel.

| ID | Task | Owner | Depends on |
|---|---|---|---|
| T1.1 | Implement remark-based parser in `src/engine/parser.ts`: unified + remark-parse AST → extract `{ text: string, headings: string[] }` (text = paragraphs/lists, no headings/code) | Ripley | T0.4 |
| T1.2 | Implement Obsidian syntax extractor: `[[target]]` and `[[target\|alias]]` → `links[]` (target only); `#tag` and `#nested/tag` → `tags[]`; skip matches inside fenced code blocks; skip `#` heading markers | Ripley | T0.4 |
| T1.3 | Compose into `parseFile(filePath): Promise<ParsedFile>` returning `{ text, headings, tags, links }` — sole public export | Ripley | T1.1, T1.2 |

**Exit criterion:** `parseFile` on a real `.md` with wikilinks, tags, and headings returns the correct shape.

---

## M2 — Store Module

> Ripley. Runs in parallel with M1.

| ID | Task | Owner | Depends on |
|---|---|---|---|
| T2.1 | Implement `src/engine/store.ts`: `readIndex`, `writeIndex`, `readConfig`, `writeConfig` — null on missing, descriptive throw on corrupt JSON; all paths resolve to `<vaultPath>/.oxori/` | Ripley | T0.4 |
| T2.2 | Define TypeScript interfaces in `src/types.ts`: `IndexData`, `Config`, `FileRecord`, `LinkGraph`, `TagMap` | Ripley | T0.4 |

**Exit criterion:** Round-trip write + read of `index.json` and `config.json` works. Missing → null. Types compile cleanly.

---

## M3 — Indexer Module

> Ripley. Depends on M1 + M2. T3.1 and T3.2 can start after T0.4.

| ID | Task | Owner | Depends on |
|---|---|---|---|
| T3.1 | Implement `computeHash(filePath): Promise<string>` — SHA-256 via Node `crypto`, hex digest | Ripley | T0.4 |
| T3.2 | Implement `listMarkdownFiles(vaultPath): Promise<string[]>` — recursive, excludes `.oxori/`, returns relative paths | Ripley | T0.4 |
| T3.3 | Implement `reconcileFiles(vaultPath, existingRecords, filePaths): Promise<FileRecord[]>` — new → parse+hash+add; hash differs → re-parse+replace; hash matches → skip; file gone → drop | Ripley | T3.1, T3.2, T1.3, T2.2 |
| T3.4 | Implement `buildLinkGraph(records): LinkGraph` — forward links + inverted backlinks; broken links (target not in records) stored with `broken: true` | Ripley | T3.3 |
| T3.5 | Implement `buildTagMap(records): TagMap` — derive `{ [tag]: path[] }` from all records | Ripley | T3.3 |
| T3.6 | Compose `runIndex(vaultPath, existingIndex\|null): Promise<IndexData>` — orchestrates T3.2→T3.3→T3.4→T3.5 | Ripley | T3.3, T3.4, T3.5, T2.1 |

**Exit criterion:** `runIndex` on a 3-note vault returns correct records, links, backlinks, and tag map. Re-run with no changes skips all parsing.

---

## M4 — Search Module

> Ripley. Depends on M3 types. T4.1–T4.4 can run in parallel.

| ID | Task | Owner | Depends on |
|---|---|---|---|
| T4.1 | `fullTextSearch(index, term): FileRecord[]` — case-insensitive match against `record.text` | Ripley | T2.2 |
| T4.2 | `structuralSearch(index, filePath): { links, backlinks }` — link graph lookup | Ripley | T2.2 |
| T4.3 | `tagSearch(index, tag): string[]` — case-insensitive tag map lookup | Ripley | T2.2 |
| T4.4 | `extractSnippet(text, term, window=120): string` — ±120 chars around first occurrence, trimmed at word boundaries | Ripley | — |
| T4.5 | Compose `search(index, query, opts: SearchOptions): SearchResult[]` where `SearchResult = { path, headings, snippet }` — delegates to T4.1/T4.2/T4.3, attaches snippets, returns `[]` on no match | Ripley | T4.1, T4.2, T4.3, T4.4 |

**Exit criterion:** Keyword, structural, and tag queries return correct results. Empty-result case returns `[]`.

---

## M5 — Commands Layer

> Ripley. Depends on M3 + M4 + M2. All three can be built in parallel.

| ID | Task | Owner | Depends on |
|---|---|---|---|
| T5.1 | `commands/init.ts` — check `.oxori/` exists (friendly error if so), create it, write `config.json`, call `runIndex(null)`, write `index.json` | Ripley | T3.6, T2.1 |
| T5.2 | `commands/index.ts` — check `.oxori/` exists (error: "run oxori init first" if not), load `index.json`, call `runIndex`, write back | Ripley | T3.6, T2.1 |
| T5.3 | `commands/search.ts` — load `index.json`, call `search(index, query, opts)`, return `SearchResult[]` | Ripley | T4.5, T2.1 |

**Exit criterion:** Each command works correctly when called directly in a Node test against a fixture vault.

---

## M6 — CLI Layer

> Parker. Depends on M5. Wire-up only — no business logic.

| ID | Task | Owner | Depends on |
|---|---|---|---|
| T6.1 | `src/cli.ts` with commander: `oxori init [path]`, `oxori index [path]`, `oxori search <query> [path]` with `--json` flag; all path args optional, default `process.cwd()` | Parker | T5.1, T5.2, T5.3 |
| T6.2 | Human-readable output: `📄 path`, `  Headings: ...`, `  ...snippet...`, separator per result; `No matches found.` for empty; errors to stderr with non-zero exit | Parker | T6.1 |
| T6.3 | `--json` output: `JSON.stringify(results)` to stdout; `[]` for no matches; `{ error }` to stderr with non-zero exit | Parker | T6.1 |
| T6.4 | End-to-end verify: `npm run build && npx . init ./test-vault && npx . index ./test-vault && npx . search "hello" ./test-vault` runs clean; `--json` outputs valid JSON | Parker | T6.2, T6.3 |

**Exit criterion:** All three commands work from the terminal. `--json` produces parseable JSON. Errors exit non-zero.

---

## M7 — Tests

> Lambert. Can start writing tests as soon as the corresponding module ships.

| ID | Task | Owner | Depends on |
|---|---|---|---|
| T7.1 | Parser unit tests: plain markdown, `[[target]]`, `[[target\|alias]]`, `#tag`, `#tag` in code block (not extracted), `#` as heading marker (not as tag) | Lambert | T1.3 |
| T7.2 | Store unit tests: write+read round-trip for index.json and config.json; missing → null; malformed JSON → descriptive error | Lambert | T2.1 |
| T7.3 | Indexer unit tests: hash determinism, new/changed/unchanged/deleted file cases, backlink inversion, broken link flag, tag map grouping | Lambert | T3.6 |
| T7.4 | Search unit tests: keyword match/no-match/case-insensitive, structural links+backlinks, tag filter, `extractSnippet` with and without match | Lambert | T4.5 |
| T7.5 | Integration tests (real temp dirs): init empty dir, init already-initialized (error), init zero .md files (empty index), index after new file, index after edit, index after delete, searchCommand returns correct result | Lambert | T5.1, T5.2, T5.3 |
| T7.6 | **Acceptance test** — SPEC §8, 7-step scenario: (1) empty folder, (2) `init`, (3) write 3 notes with `[[links]]` and `#tags`, (4) `index`, (5) keyword search returns path+headings+snippet, (6) structural query returns correct backlink, (7) `--json` returns valid JSON with same data | Lambert | T6.1, T7.5 |

**Exit criterion:** `npm test` passes all tests. Coverage report generated. **T7.6 is the Phase 1 definition of done.**

---

## M8 — CI/CD & Release

> Parker. T8.1 and T8.4 can start after M0.

| ID | Task | Owner | Depends on |
|---|---|---|---|
| T8.1 | `.github/workflows/pr.yml`: on PR to `main` → `npm ci`, `npm run build`, `npm test`, `npm run lint` | Parker | T0.1 |
| T8.2 | `.releaserc.json`: semantic-release plugins — commit-analyzer, release-notes-generator, changelog, npm, github | Parker | T6.4 |
| T8.3 | `.github/workflows/release.yml`: on push to `main` → `npm ci`, `npm run build`, semantic-release (reads `NPM_TOKEN`, `GITHUB_TOKEN`) | Parker | T8.2 |
| T8.4 | `.github/dependabot.yml`: weekly npm dependency updates | Parker | T0.1 |

**Exit criterion:** PR workflow passes on a test branch. `semantic-release --dry-run` produces expected version bump.

---

## M9 — Documentation & Sign-off

| ID | Task | Owner | Depends on |
|---|---|---|---|
| T9.1 | `README.md` v1: one-liner, `npx oxori` install, three commands with minimal example, `--json` example, pointers to SPEC/DECISIONS/ARCHITECTURE | Parker | T6.4 |
| T9.2 | **Dallas architecture review**: verify module boundaries (cli→commands→engine→store→fs, no violations), types match spec contract, no Phase 2 features leaked, all SPEC edge cases handled — final sign-off gate | Dallas | T7.6, T9.1 |

**Exit criterion:** T9.2 passes. Version 0.1.0 ships.

---

## Resolved Design Decisions

> Settled before build started. Do not reopen without a team discussion.

| # | Question | Decision |
|---|---|---|
| OQ1 | Linter | **Biome** — single tool for lint + format, zero config |
| OQ2 | CLI vault path | **Optional `[path]` arg, defaults to `process.cwd()`** for all three commands |
| OQ3 | `oxori index` when `.oxori/` missing | **Error: "run oxori init first"** — init and index are distinct |
| OQ4 | Snippet window size | **±120 characters** around first match, trimmed at word boundaries |
| OQ5 | `#tag` in heading text | **Not extracted** — headings are structural, not tag annotations |
| OQ6 | Search mode selection | **Flags**: `oxori search "term"` (text), `--tag "#rust"`, `--link "note-a"` |
| OQ7 | Broken links in `FileRecord` | **`links: Array<{ target: string, broken: boolean }>`** |

---

## Dependency Reference

```
T0.1 → T0.2, T0.3
T0.2 → T0.4 → T0.5
T0.4 → T1.1, T1.2, T2.1, T2.2, T3.1, T3.2
T1.1 + T1.2 → T1.3
T1.3 + T2.1 + T2.2 + T3.1 + T3.2 → T3.3
T3.3 → T3.4, T3.5
T3.4 + T3.5 + T2.1 → T3.6
T2.2 → T4.1, T4.2, T4.3  (T4.4 independent)
T4.1 + T4.2 + T4.3 + T4.4 → T4.5
T3.6 + T2.1 → T5.1, T5.2
T4.5 + T2.1 → T5.3
T5.1 + T5.2 + T5.3 → T6.1
T6.1 → T6.2, T6.3 → T6.4
T0.1 → T8.1, T8.4  (can start after M0)
T6.4 → T8.2 → T8.3
T6.4 → T9.1
T1.3 → T7.1  |  T2.1 → T7.2  |  T3.6 → T7.3  |  T4.5 → T7.4
T5.1 + T5.2 + T5.3 → T7.5 → T7.6 ← T6.1
T7.6 + T9.1 → T9.2
```
