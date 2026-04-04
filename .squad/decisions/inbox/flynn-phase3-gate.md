# Phase 3 Gate Checklist — v0.3.0 (Read/Write API + Governance)

**Written by:** Flynn (Tech Lead / Gatekeeper)
**Date:** 2026-04-04
**Phase:** Phase 3 — Read/Write API and Governance
**Status:** 🔒 GATE OPEN (ready for Wave 1 types submission)

---

## Overview

Phase 3 delivers write capability (SDK + CLI) with governance enforcement on agent writes. This checklist applies all Phase 2 retrospective action items (A1–A8) to prevent previous gate failures.

**Core deliverables:**
- `src/writer.ts` — file creation and append operations
- `src/governance.ts` — governance rule parsing and enforcement
- `src/index.ts` — updated exports for Vault class and new functions
- Updated README.md and docs with Phase 3 features
- CLI commands: `oxori write`, `oxori append`, `oxori config`
- Full test coverage (writer ≥ 90%, governance ≥ 95%, global ≥ 80%)

---

## Gate Criteria

### Foundational Checks (Retro A1, A5, A6, A8)

**Criterion #1: TypeScript compilation clean**
- `pnpm build` must complete with zero TypeScript errors
- `npx tsc --noEmit` passes
- No `any` types introduced (ESLint enforces `@typescript-eslint/no-explicit-any: "error"`)

**Status:** ⏳ Pending Wave 1

---

**Criterion #2: Runtime export check (Retro A1)** ✅ **Binary gate**
- After build, run: `node -e "import('./dist/index.js').then(m => console.log(Object.keys(m)))"`
- Output must include ALL new Phase 3 exports:
  - Type exports: `CreateOptions`, `GovernanceRule`, `Actor`, `WriteAction`, `SearchResult`
  - Function exports: `create`, `append`, `parseGovernance`, `enforceRule`, `open` (Vault class method)
  - Class exports: `Vault` (if class, otherwise just method exports from `open`)
- If any export is missing from dist/index.js, gate **FAILS** immediately — recompile and re-test

**Status:** ⏳ Pending Wave 2 implementation

---

**Criterion #3: Types-first approval (Retro A2)**
- All Phase 3 types must be merged to types.ts BEFORE any writer.ts or governance.ts implementation
- Flynn must review and approve types.ts as a standalone PR before Wave 2 begins
- Types include: `CreateOptions`, `GovernanceRule`, `Actor`, `WriteAction`, `SearchResult`, and any helper types
- Approved types commit must be tagged (e.g., `types-phase3-approved`) before implementation PRs are opened

**Status:** ⏳ Pending Wave 1 (Tron)

---

**Criterion #4: TypeScript signatures in acceptance criteria (Retro A5 + A8)**
- All new Phase 3 function signatures must be documented in `.squad/backlog.md` with exact parameter order and return types
- Examples:
  - `create(path: string, content: string, actor?: Actor): Promise<Result<string, OxoriError>>`
  - `append(path: string, content: string, actor?: Actor): Promise<Result<string, OxoriError>>`
  - `parseGovernance(rules: Record<string, GovernanceRule[]>): Result<GovernanceRule[], OxoriError>`
  - `enforceRule(action: WriteAction, rules: GovernanceRule[]): Result<boolean, OxoriError>`
- Backlog ACs must match actual implemented signatures — no post-hoc changes

**Status:** ✅ Verified in `.squad/backlog.md` (Wave 0 complete)

---

### Test Skeleton Pre-Approval (Retro A3 + A2)

**Criterion #5: Test skeletons written only after types locked**
- Yori must write `tests/writer.test.ts` and `tests/governance.test.ts` ONLY after Tron's types.ts is Flynn-approved
- All test skeletons use `it.todo()` for unimplemented features (not `expect(toThrowError)`)
- Test skeleton PRs must be reviewed before implementation begins (prevent the Phase 1 API mismatch)

**Status:** ⏳ Pending Wave 1 (types locked) → Wave 1 (test skeletons)

---

### Test Coverage Requirements (Retro A4)

**Criterion #6: Coverage thresholds enforced**
- `src/writer.ts` ≥ 90% coverage (lines, functions, branches)
- `src/governance.ts` ≥ 95% coverage (lines, functions, branches)
- `src/index.ts` (Vault class + SDK methods) ≥ 90% coverage
- Global coverage ≥ 80% (aggregate across all modules)
- If any module misses threshold, gate **FAILS** — provide per-file coverage table from `npx vitest run --coverage`

**Criterion #6 Acceptance:** Final coverage report must include:
```
File | Lines | Uncovered | Statements | Branches | Functions
-----|-------|-----------|------------|----------|----------
writer.ts | 95% | 0 lines | 96% | 94% | 95%
governance.ts | 97% | 0 lines | 98% | 96% | 97%
index.ts | 91% | 1 line | 92% | 90% | 91%
(all other modules) | ≥80% | ... | ... | ... | ...
Global | 82% | ... | 83% | 81% | 82%
```

**Status:** ⏳ Pending Wave 2 (implementation + tests)

---

### CLI Integration Tests (Retro A7)

**Criterion #7: CLI tests for all new commands**
- `tests/cli.test.ts` must have dedicated test suites for:
  - `oxori write <path> <content>` — create new file with write command
  - `oxori append <path> <content>` — append to existing file
  - `oxori config` — view/set governance configuration (if applicable)
  - `oxori check <path>` — check file against governance rules (if implemented)
- Each command must be tested with:
  - Happy path (valid inputs, success)
  - Error path (missing file, permission denied, governance violation)
  - Governance scenarios (agent blocked, human allowed)
- All CLI tests must pass: `npx vitest run tests/cli.test.ts`

**Status:** ⏳ Pending Wave 3 (CLI implementation + tests)

---

### Documentation Updates (Retro A8)

**Criterion #8: README updated with Phase 3 features**
- README.md must include:
  - Write API usage examples (create, append)
  - Governance rules explanation and example syntax
  - CLI commands documentation (write, append, config, check)
  - Migration/upgrade guide for users moving from v0.2.0 → v0.3.0
- All code examples must be runnable and match actual API

**Status:** ⏳ Pending Wave 4 (documentation)

---

**Criterion #9: Architecture docs updated**
- docs/architecture.md must include:
  - Phase 3 ADR: Write API design (create vs append rationale)
  - Governance rule enforcement workflow (decision tree)
  - Actor model (human vs agent distinction)
  - Integration diagram: Vault + Writer + Governance flow
  - Per-entry tsup banner decision codified (from Phase 2 A5)
- Any new architectural decisions (e.g., sync vs async, in-memory vs disk governance cache) must be documented

**Status:** ⏳ Pending Wave 4 (documentation)

---

### Writer Module Requirements

**Criterion #10: writer.ts implementation complete**
- Exports: `create()`, `append()`
- Signatures (from approved types):
  - `create(path: string, content: string, actor?: Actor): Promise<Result<ParsedFile, OxoriError>>`
  - `append(path: string, content: string, actor?: Actor): Promise<Result<ParsedFile, OxoriError>>`
- All JSDoc documented with parameter descriptions, return type, and example
- Error cases: path validation, ENOENT, EACCES, disk full, governance violation
- Result wrapper: always returns `Result<ParsedFile, OxoriError>` — never throws uncaught
- `npx tsc --noEmit` passes for writer.ts

**Status:** ⏳ Pending Wave 2 (Ram)

---

**Criterion #11: writer.ts test coverage ≥ 90%**
- `tests/writer.test.ts` must include:
  - ✓ Create new file (happy path)
  - ✓ Append to existing file (happy path)
  - ✓ Create with existing path (error: file exists)
  - ✓ Append to non-existent file (error: ENOENT)
  - ✓ Invalid path (error: validation)
  - ✓ Permission denied (error: EACCES)
  - ✓ Frontmatter preservation on append
  - ✓ Typed relations updated on write
  - ✓ Tag extraction on create/append
  - ✓ Wikilink tracking on write
  - ✓ Actor identity in metadata (if tracked)
  - ✓ Governance rule enforcement integration (agent vs human)
- All 12+ tests must pass
- Coverage: writer.ts ≥ 90% (lines, functions, branches)

**Status:** ⏳ Pending Wave 2 (Yori)

---

### Governance Module Requirements

**Criterion #12: governance.ts implementation complete**
- Exports: `parseGovernance()`, `enforceRule()`
- Signatures (from approved types):
  - `parseGovernance(rules: Record<string, GovernanceRule[]>): Result<GovernanceRule[], OxoriError>`
  - `enforceRule(action: WriteAction, rules: GovernanceRule[]): Result<boolean, OxoriError>`
- All JSDoc documented
- Supports rule types: path glob patterns, forbidden keywords, protected paths, agent-only restrictions
- All JSDoc documented with parameter descriptions and examples
- Error cases: invalid glob syntax, malformed rules, unknown rule types
- Result wrapper: always returns `Result<...>` — never throws uncaught
- `npx tsc --noEmit` passes for governance.ts

**Status:** ⏳ Pending Wave 2 (Ram)

---

**Criterion #13: governance.ts test coverage ≥ 95%**
- `tests/governance.test.ts` must include:
  - ✓ Parse simple path rules (exact match)
  - ✓ Parse glob patterns in rules
  - ✓ Parse forbidden keywords rules
  - ✓ Parse agent-only restrictions
  - ✓ Parse protected path rules
  - ✓ Enforce rule: agent blocked on protected path
  - ✓ Enforce rule: human allowed on protected path
  - ✓ Enforce rule: forbidden keyword violation
  - ✓ Enforce rule: glob pattern match
  - ✓ Enforce rule: glob pattern non-match
  - ✓ Enforce rule: multiple rules (OR logic)
  - ✓ Enforce rule: conflicting rules (priority)
  - ✓ Edge case: empty rules list (allow all)
  - ✓ Edge case: malformed rules (error)
  - ✓ Edge case: case sensitivity on keywords
  - ✓ Integration: governance-vault fixture scenario
- All 16+ tests must pass
- Coverage: governance.ts ≥ 95% (lines, functions, branches)

**Status:** ⏳ Pending Wave 2 (Yori)

---

### Vault SDK and Integration

**Criterion #14: Vault class and SDK methods**
- `src/index.ts` must export `Vault` class with methods:
  - `open(vaultPath: string): Promise<Result<Vault, OxoriError>>` (static factory)
  - Instance methods:
    - `query(filter: string): Promise<QueryResult>`
    - `walk(source: string, options?: WalkOptions): Promise<WalkResult[]>`
    - `create(path: string, content: string, actor?: Actor): Promise<Result<ParsedFile, OxoriError>>`
    - `append(path: string, content: string, actor?: Actor): Promise<Result<ParsedFile, OxoriError>>`
    - `getGovernanceRules(): Promise<GovernanceRule[]>`
- All methods async, all documented with JSDoc
- Vault class methods delegate to writer.ts and governance.ts (no logic duplication)
- Error handling: descriptive messages, Result wrapper everywhere

**Status:** ⏳ Pending Wave 3 (Ram)

---

**Criterion #15: SDK integration tests**
- `tests/index.test.ts` must include:
  - ✓ Open vault (happy path)
  - ✓ Open vault (path not found)
  - ✓ Query integration (Vault.query wraps query.ts)
  - ✓ Walk integration (Vault.walk wraps graph.ts)
  - ✓ Create via Vault (delegates to writer.ts)
  - ✓ Append via Vault (delegates to writer.ts)
  - ✓ Governance rules retrieval
  - ✓ Governance enforcement on create (agent blocked)
  - ✓ Governance enforcement on create (human allowed)
  - ✓ End-to-end: create → query → verify
  - ✓ End-to-end: append → walk → verify
  - ✓ Multiple opens on same vault (state isolation)
  - ✓ Concurrent operations (if applicable)
  - ✓ Integration with governance-vault fixture
- All 14+ tests must pass
- Coverage: index.ts (Vault class) ≥ 90%

**Status:** ⏳ Pending Wave 3 (Yori)

---

### CLI Commands

**Criterion #16: CLI commands implemented**
- `oxori write <path> <content>` — create new file via CLI
- `oxori append <path> <content>` — append to existing file via CLI
- `oxori config` — view/set governance configuration
- `oxori check <path>` — validate file against governance rules (if implemented)
- All commands support `--vault` flag for non-current-directory vaults
- All commands use Vault SDK internally (thin CLI wrappers)
- All commands print user-friendly status/error messages
- No default exports in CLI modules — named exports only

**Status:** ⏳ Pending Wave 3 (Tron)

---

**Criterion #17: All 14 existing it.todo() stubs resolved**
- Phase 1 and Phase 2 left 14 `it.todo()` test stubs scattered across test files
- By end of Phase 3, ALL must be resolved:
  - Either filled with actual test implementations
  - Or explicitly removed with justification documented in commit message
- No PR may merge with unresolved `it.todo()` stubs that relate to delivered features

**Status:** ⏳ Pending Wave 3 and Wave 4 (cleanup)

---

### Build and Release (Retro A6, A7)

**Criterion #18: pnpm build succeeds**
- `pnpm build` must complete with zero errors
- Produces dist/index.js (ESM) and dist/index.cjs (CJS)
- dist/index.js has correct shebang (if applicable) and no shebang in library entry
- All TypeScript errors resolved
- All ESLint warnings resolved (or explicitly ignored with comments)

**Status:** ⏳ Pending Wave 2 build

---

**Criterion #19: pnpm test passes, 127+ existing + 40+ new tests**
- `pnpm test` (or `npx vitest run`) must complete with all tests passing
- Test count breakdown:
  - Existing: 127+ tests from Phase 1 & 2
  - Phase 3: 40+ new tests
    - writer.test.ts: 12+ tests
    - governance.test.ts: 16+ tests
    - index.test.ts: 14+ tests
  - Total: 167+ tests all passing
- No test marked as `skip` or `only` (except intentional `it.todo()` stubs being retired)

**Status:** ⏳ Pending Wave 2-3 implementation

---

**Criterion #20: Coverage thresholds verified (full table)**
- `npx vitest run --coverage` must be run before gate approval
- Full per-file coverage table (Retro A4 requirement):
  - writer.ts ≥ 90%
  - governance.ts ≥ 95%
  - index.ts ≥ 90%
  - parser.ts ≥ 95% (inherited from Phase 1, must not regress)
  - indexer.ts ≥ 90% (Phase 2 improvement target)
  - query.ts ≥ 90% (Phase 2)
  - graph.ts ≥ 90% (Phase 2)
  - all other modules ≥ 80%
  - **Global ≥ 80%**
- If any module below threshold, gate **FAILS** — no exceptions
- Yori submits full coverage report with gate PR

**Status:** ⏳ Pending Wave 4 (Yori final check)

---

**Criterion #21: RELEASES.md updated with v0.3.0 entry**
- RELEASES.md must include:
  - **v0.3.0 entry** with:
    - Release date
    - New features: write API, governance enforcement, Vault SDK, CLI commands
    - Breaking changes (if any)
    - Migration guide (upgrading from v0.2.0)
    - Contributors and co-authored-by credits
- Entry must follow same format as v0.1.0 and v0.2.0

**Status:** ⏳ Pending Wave 4 (Dumont)

---

**Criterion #22: CI pipeline green on main + semantic-release dry-run (Retro A7)**
- GitHub Actions CI must pass all checks on main branch before tag:
  - `npm install` / `pnpm install` (dependency resolution)
  - `pnpm lint` (ESLint clean)
  - `pnpm build` (no TypeScript errors)
  - `pnpm test --coverage` (all tests pass, coverage thresholds)
  - `npm run coverage-check` (coverage badges generated)
- **Semantic-release dry-run:** Before first v0.3.0 release, run:
  - `pnpm semantic-release --dry-run`
  - Verify that exec plugin fires, git assets are staged, README version synced
  - This catches configuration errors before actual release

**Status:** ⏳ Pending Wave 4 (Clu, Flynn final approval)

---

## Phase 3 Gate Workflow

### Wave 0 (Types Planning) — Kickoff
- Flynn writes this gate checklist ✅ (done)
- Tron plans types.ts additions (no code)
- Yori designs test fixtures (governance-vault/)
- **Gate:** Checklist reviewed and agreed by team

### Wave 1 (Types Locked) — Type Review
- Tron implements types.ts Phase 3 additions
- Yori writes test skeletons (after types approved)
- **Gate:** Flynn reviews types.ts PR → approves → merge
- **Blocker:** No implementation work begins until types approved

### Wave 2 (Implementation) — Core Modules
- Ram implements writer.ts and governance.ts
- Yori implements writer + governance tests
- **Gate:** All tests pass, coverage ≥ 90% / ≥ 95%

### Wave 3 (SDK + CLI) — Integration
- Ram implements Vault class
- Tron implements CLI commands
- Yori implements SDK + CLI tests
- **Gate:** All integration tests pass, e2e scenarios verified

### Wave 4 (Docs + Release) — Final Gate
- Dumont writes all documentation
- Yori verifies final coverage
- Clu runs semantic-release dry-run
- Flynn final gate check (all 22 criteria)
- **Gate:** PASS → merge to main → tag v0.3.0 → publish to npm

---

## Retro Action Item Mapping

| Retro Item | Phase 3 Application | Criterion # |
|------------|-------------------|------------|
| A1 | Runtime export check added to gate | #2 |
| A2 | Types-first approval: types before implementation | #3 |
| A3 | Test skeletons with it.todo() after types locked | #5 |
| A4 | Full coverage table in gate report | #6, #20 |
| A5 | Function signatures in backlog ACs | #4 |
| A6 | Gate checklist written at kickoff (this doc) | #1-22 |
| A7 | CLI tests for write/append/config/check | #7 |
| A8 | README updated with Phase 3 features | #8 |

---

## Sign-Off

**Gate Status:** 🟡 OPEN (awaiting Wave 1 types)

**Gate Owner:** Flynn

**Required Approvals Before Merge:**
- [ ] Flynn: Gate checklist review and team agreement
- [ ] Tron: types.ts Phase 3 additions ready for Wave 1
- [ ] Castor: Backlog ACs aligned with criteria
- [ ] Dumont: Documentation structure confirmed

**Next Step:** Tron submits types.ts as Wave 1 kickoff.

---

**Document Version:** Phase 3 Gate v1.0
**Last Updated:** 2026-04-04
**Phase 3 Release Target:** v0.3.0 (npm)
