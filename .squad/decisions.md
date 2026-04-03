# Squad Decisions

## Active Decisions

### 2026-04-03: Full sprint backlog created for all 5 phases

**By:** Castor (Product Owner)

**What:** Complete sprint backlog written to `.squad/backlog.md` covering ~38 GitHub issues across all 5 phases. Each phase is a separate shippable npm release (v0.1.0 through v0.5.0). Phase gates owned by Flynn, release notes owned by Dumont.

**Why:** Onur Asiliskender requested full sprint planning before development begins. Clear backlog enables team parallelization (Tron on parser, Ram on graph, Yori on tests) and prevents scope creep by defining phase boundaries explicitly.

**Scope Decisions:**
- Each phase is one npm release — no partial merges to main
- Phase gates (assigned to Flynn) gate all other PRs per phase — design review + approval before merge
- Release notes (assigned to Dumont) are the last issue per phase — document features, breaking changes, migration steps
- Phases 1-3 are "core" (parser, query, write, governance), Phases 4-5 are "extensions" (search, MCP)
- Phase 4 (semantic search) is optional — core Oxori works without embeddings
- Phase 5 (MCP + Obsidian) is the capstone — humans + agents on same vault
- 80% coverage minimum per phase, parser/indexer/governance target 95%
- All phases use conventional commits, atomic commits, and detailed commit messages
- Each phase has integration tests that verify all components work together

**Team Routing:**
- Flynn: Phase gates, architecture review, final approval per phase
- Tron: types, parser, indexer, query, CLI (Phases 1-2)
- Ram: graph, writer, governance, search, MCP, watcher (Phases 2-5)
- Yori: All test suites (Phases 1-5)
- Dumont: All release notes and documentation (Phases 1-5)
- Clu: CI/CD setup (Phase 1)
- Quorra: MCP protocol expertise (Phase 5)

**Next Steps:**
1. Team reviews backlog in `.squad/backlog.md`
2. Each phase starts when previous phase is merged and tagged
3. Developers create PRs linking to the Phase N Kickoff issue
4. Flynn approves/gates each PR per phase
5. On merge to main, tag as v0.X.0 and publish to npm
6. Dumont writes release notes
7. Repeat for next phase

**Success Metric:**
Backlog is complete when: all 5 phases released, 80%+ coverage, full docs, MCP server working, Obsidian compatible, and humans + agents are reading/writing the same vault via Oxori.

## Phase 1 Retrospective — Oxori v0.1.0

**Facilitated by:** Flynn
**Date:** 2026-04-03
**Attendees:** Flynn, Tron, Yori, Clu, Dumont, Castor

---

### ✅ What Went Well

#### 1. Types-first discipline held
Tron wrote `types.ts` before touching parser or indexer code. The discipline of establishing a shared type contract first (ParsedFile, FileEntry, IndexState, Result<T,E>, OxoriError) meant every downstream module had a stable shape to code against. No retrofitting, no "oh we need to add a field" mid-sprint.

#### 2. Result<T,E> pattern carried its weight from day one
Tron's `ok()` / `err()` helpers and the discriminated union on `ok: boolean` proved their worth immediately. Parse errors, ENOENT, and YAML failures all surface as structured `OxoriError` values with `code` and `action` fields — never as uncaught throws. Yori's tests validate this contract end-to-end. The pattern is load-bearing for Phase 2+.

#### 3. Fixture design was thorough and forward-looking (Yori)
`basic-vault/` (6 files, edge cases), `linked-vault/` (7-node directed graph with A→B→C→A cycle), and `governance-vault/` (protected secrets/ dir) cover the core scenarios at depth. The A→B→C→A cycle fixture is especially good — it verifies the indexer is cycle-safe at scan time before Phase 2 graph traversal even exists. Yori also correctly used `tests/.tmp-cli-<n>/` instead of `/tmp` for CLI tests.

#### 4. Clu closed the dual-package gap
The tsup per-entry banner fix and the dual ESM+CJS output (`dist/index.js` + `dist/index.cjs`) were not optional nice-to-haves — they're table stakes for a library that wants to be consumed by both modern and legacy Node.js consumers. Clu also wired up the ESLint 9 flat config with `@typescript-eslint/no-explicit-any: "error"`, which is the right call to enforce no-`any` at the tooling level rather than trusting code review alone.

#### 5. Dumont's documentation is production-grade on v0.1.0
`docs/architecture.md` (1000+ lines, 7 ADRs), `CONTRIBUTING.md`, `RELEASES.md`, `README.md` — all in place at gate. Most projects defer this to "someday". Writing the architecture doc while the decisions were fresh paid off: it surfaced two ADR inconsistencies that were quietly corrected before merge.

#### 6. Flynn's code review caught a real gap before it shipped
The `FrontmatterEntry` issue in `types.ts` was caught at review — not at test time, not post-merge. The explicit review step in the phase gate process works. The gate review checklist (14 criteria) was also a concrete tool, not a vague "looks good to me" approval.

#### 7. Conventional commits + atomic commits were followed correctly
Every commit in the log is properly prefixed (`feat`, `fix`, `docs`, `test`, `chore`), scoped, and single-purpose. The `[skip ci]` discipline on squad/backlog/setup commits was clean. This makes the `RELEASES.md` changelog trustworthy.

#### 8. Regex g-flag gotcha was caught and documented (Tron)
Module-level `/g` regex reused across multiple `exec()` calls is a non-deterministic bug that has burned many JS developers. Tron caught it, fixed it (`new RegExp(source, "g")` per call), and documented it in their history. This kind of explicit documentation of gotchas is exactly what prevents the same bug in Phase 2.

---

### ❌ What Didn't Go Well

#### 1. API mismatch between Yori's test skeletons and Tron's implementation (HIGHEST FRICTION)
Yori wrote `tests/parser.test.ts` and `tests/indexer.test.ts` against a pre-implementation API that differed from what Tron actually built:

- **parser.test.ts**: Tests accessed `result.frontmatter` directly. Actual API returns `Promise<Result<ParsedFile, OxoriError>>` — requires `result.ok` guard + `result.value.*` access.
- **indexer.test.ts**: Tests imported a non-existent `buildIndex(path: string)` function. Actual API is `indexVault(config: VaultConfig)` with `VaultConfig` object + Result unwrapping.

This required a full pass through both test files to fix import paths, remove stale fs scaffolding, and rewrite all active test assertions. It also removed `beforeEach`/`afterEach` temp-dir setup from indexer tests that never applied to an in-memory indexer.

**Root cause:** The test skeletons were written before the implementation contract was finalized in `types.ts`, using backlog acceptance criteria as the "API spec." The backlog AC (`buildIndex(vaultPath: string)`) was stale — Tron made a deliberate design change to `VaultConfig` and `indexVault` that was correct but not propagated to Yori.

#### 2. tsup banner bug — shebang leaked into all dist outputs
The initial `tsup.config.ts` applied the `#!/usr/bin/env node` banner globally, meaning `dist/index.js` (the library entry) would also have received the shebang. Clu caught and fixed this (per-entry banner configuration), but this is a build correctness issue that required a dedicated fix commit (`fix(build): fix tsup config — split entries for per-entry shebang, add CJS`). If it had shipped undetected, any bundler importing the library would have received a corrupt first line.

#### 3. Missing `FrontmatterEntry` named export in initial types.ts (Tron)
The backlog acceptance criterion explicitly required `FrontmatterEntry` as a named export from `types.ts`. Tron's first submission used inline `Record<string, unknown>` instead. Flynn caught this in code review and assigned revision to Ram (per review protocol: different agent than author). One revision cycle was required. Small in isolation, but it's the kind of oversight that becomes a breaking API change if it ships and consumers depend on the inline type.

#### 4. `@types/micromatch` missing from devDependencies — discovered mid-implementation (Tron)
When writing `indexer.ts`, Tron hit a TS7016 implicit-any error because `@types/micromatch` wasn't in `devDependencies`. This is a dependency discovery that should happen during types/design time, not mid-implementation. The fix is trivial but the interruption pattern — "write code, hit type error, install package, continue" — compounds when it happens multiple times.

#### 5. CLI tests are all `it.todo()` — 11 untested paths at gate
All 11 `tests/cli.test.ts` tests remain as `it.todo()` stubs. The gate criterion was "all non-todo tests pass", which is satisfied technically. But the CLI commands (`oxori init`, `oxori index`) are entirely untested by automated tests at v0.1.0. Yori correctly noted that CLI e2e tests require knowing exact output strings and exit codes from the implementation — but the implementation (cli.ts) was written before those tests were filled in, and the loop was never closed in Phase 1.

#### 6. `src/index.ts` was a late addition — not planned in early backlog issues
The Phase 1 gate criterion #2 ("src/index.ts exports the full public API") passed, but `src/index.ts` was not explicitly listed in the early backlog issue for types or parser. It was created as part of the final integration work. This means there was a brief period where the build config referenced `./dist/index.js` but no `src/index.ts` existed to produce it.

---

### 💡 What We Learned

#### 1. Test skeletons must be written against a locked contract, not backlog ACs
The backlog ACs are product requirements, not TypeScript contracts. Writing test skeletons before `types.ts` is finalized creates drift. The fix: Yori writes test skeletons only after `types.ts` is reviewed and merged. Implementation details (`VaultConfig`, `Result<T,E>` wrapping) must be visible before test code is written.

#### 2. Public API shape (index.ts exports) must be the first deliverable, not an afterthought
The library's public API surface — what `src/index.ts` re-exports — should be defined alongside types.ts as a first class deliverable. It's the contract between the library and its consumers. Treating it as an implementation detail discovered at gate is backwards.

#### 3. Per-entry banner configuration in tsup is non-obvious and must be explicit
The default tsup banner behavior applies globally. Any project that builds both a CLI and a library from the same repo must explicitly configure per-entry banners. This should be in the project scaffolding decisions document, not discovered through a bug.

#### 4. The "different agent reviews than original author" protocol works
Flynn assigned the `FrontmatterEntry` revision to Ram rather than back to Tron. This introduces a second pair of eyes before the fix is merged, and breaks the "author reviews their own work" failure mode. Keep this protocol in Phase 2+.

#### 5. The phase gate checklist is the right tool — make it the single source of truth
The 14-criterion gate checklist in `flynn-phase1-gate.md` was the most concrete artifact in the phase. Every criterion is binary and verifiable by running a command. This is better than a prose "phase complete" declaration. Phase 2 should have its own equivalent checklist written at kickoff, not at review time.

#### 6. Documenting gotchas in agent history files is leverage
Tron's history entry on the `g`-flag regex gotcha and the `readdir` recursive return type is exactly the kind of institutional knowledge that prevents repeated bugs. Dumont's architecture ADRs serve the same function at the design level. Both practices should be maintained as first-class responsibilities.

#### 7. Coverage thresholds enforce commitment but can't substitute for integration tests
80%+ line/function/branch coverage is enforced in vitest.config.ts and CI. But with all CLI tests as `it.todo()`, the real-world entry point of the tool is unvalidated by automated tests. Coverage thresholds are a floor, not a ceiling — and they don't protect the seams between modules.

---

### 🔧 Action Items for Phase 2

| # | Action | Owner | Priority | Notes |
|---|--------|-------|----------|-------|
| A1 | Lock `src/index.ts` as the first deliverable in Phase 2 — define public API exports before any feature implementation begins | Flynn + Tron | **P1** | Gate criterion. Must be reviewed and merged before indexer/parser Phase 2 work starts. |
| A2 | Yori writes test skeletons only after implementation contracts are merged (types.ts + index.ts) — not against backlog ACs | Flynn (process owner) | **P1** | Prevents the API mismatch pattern from Phase 1. Add to CONTRIBUTING.md. |
| A3 | Fill in all 11 `it.todo()` CLI tests in `tests/cli.test.ts` at Phase 2 kickoff | Yori | **P1** | These are Phase 1 debt. CLI is shipped untested. Fix before any Phase 2 CLI expansion. |
| A4 | Add `@types/*` packages to devDependencies during dependency planning, not discovery | Tron | **P2** | When a dep is added to package.json, immediately check `@types/<pkg>` availability and install. |
| A5 | Codify the "per-entry tsup banner" decision in docs/architecture.md | Clu | **P2** | Prevents the same build bug from recurring when Phase 2 adds new entry points (e.g., bin/query). |
| A6 | Write Phase 2 gate checklist at kickoff (not at review time) | Flynn | **P2** | Derive from Phase 1 checklist template. Add Phase 2-specific criteria: query AST, graph traversal, CLI query/walk/graph commands. |
| A7 | Backlog ACs must include TypeScript function signatures (not just behavior descriptions) | Castor | **P2** | E.g., `indexVault(config: VaultConfig): Promise<Result<IndexState, OxoriError>>` — removes ambiguity that caused the Yori API mismatch. |
| A8 | Run `npx vitest run` and verify zero non-todo failures as a local pre-commit check — add to CONTRIBUTING.md | Clu | **P3** | Prevents shipping with broken tests that only show up in CI. |
| A9 | Add `FrontmatterEntry` export usage examples to docs/architecture.md | Dumont | **P3** | The export exists and passed review, but its intended consumer pattern is not documented. |

---

### Phase 2 Readiness

**Status: ✅ Ready to begin**

Phase 1 delivered its full scope: types, parser, indexer, CLI init/index, full CI/CD, dual ESM+CJS build, and comprehensive documentation. The 31 passing tests give us a stable regression suite to build on top of. The `Result<T,E>` pattern, `ReadonlySet`/`ReadonlyMap` in `FileEntry`, and the `IndexState` map key conventions (absolute paths for files, raw tag strings for tags, lowercase stems for links) are all load-bearing design decisions that Phase 2's query engine and graph traversal will depend on directly.

**Debt carried into Phase 2:**
- 11 CLI tests are `it.todo()` — must be addressed at Phase 2 kickoff before any new CLI work begins (A3)
- `src/index.ts` public API surface was created late — Phase 2 must define it as deliverable #1 (A1)

**Phase 2 primary concern:**
The query AST + evaluator is the highest complexity module in the project to date. Tron should design the tokenizer/AST types (analogous to Phase 1's `types.ts`) before Yori writes any test skeletons, and before any query evaluation logic is written. Get the token/node shapes reviewed by Flynn and locked before implementation begins.

Good sprint, team. We shipped a real v0.1.0 with a clean foundation. Phase 2 is where we find out if the type system and index design hold up under real query load.

— Flynn

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
