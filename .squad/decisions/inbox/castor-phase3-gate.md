# Phase 3 Gate Checklist — Read/Write API and Governance

**Date:** 2026-04-03 (kickoff)  
**Owner:** Flynn (Phase 3 Gate Keeper)  
**Release Target:** v0.3.0  
**Wave 0 Delivery:** Phase 3 Kickoff (Flynn)

---

## Inherited from Phase 1 & 2 (always required):

1. **TypeScript Compilation: Zero Errors**
   - `npx tsc --noEmit` exits 0
   - All src/ and tests/ compile without errors

2. **Linting: Zero Errors**
   - `npx eslint src/ tests/ --max-warnings 0` exits 0
   - All TypeScript source conforms to eslint rules (including `@typescript-eslint/no-explicit-any: "error"`)

3. **Test Suite: All Non-Todo Tests Pass**
   - `npx vitest run` shows 0 failures
   - Only `it.todo()` stubs are acceptable (must document what they test)

4. **Build: Success and Correct Outputs**
   - `npx tsup` exits 0
   - Produces dist/index.js, dist/index.cjs, dist/cli.js

5. **Shebang: CLI Only, Library Clean**
   - dist/cli.js has `#!/usr/bin/env node` as first line
   - dist/index.js has no shebang (library entry point)
   - dist/index.cjs has no shebang

6. **No `any` Types in Source**
   - `grep -r ": any\| as any\|<any>" src/` returns zero matches
   - TypeScript strict mode enforced

---

## Phase 3 Specific Criteria:

### 7. **Runtime Export Check** ⭐ (New — from Phase 2 Retro A1)
   - Command: `node -e "import('./dist/index.js').then(m => { const required = ['open', 'write', 'append', 'parseGovernance', 'enforceRule']; const missing = required.filter(k => !m[k]); if (missing.length) throw new Error('Missing exports: ' + missing.join(', ')); console.log('✓ All exports present'); })"`
   - Verifies value exports (functions), not just type exports
   - Must pass before gate approval — **binary pass/fail**

### 8. **JSDoc on All Exported Functions**
   - `src/writer.ts` — `create()`, `append()`
   - `src/governance.ts` — `parseGovernance()`, `enforceRule()`
   - `src/index.ts` — `open()`, Vault class and all public methods
   - Each function/method has `@param`, `@returns`, `@throws` tags
   - Class methods documented with parameter and return types

### 9. **Type Exports: Writer and Governance Types**
   - Required exports from src/types.ts (Phase 3 additions):
     - `CreateOptions` (for writer.create)
     - `GovernanceRules`, `GovernanceResult` (for governance parsing)
     - `WriteAction`, `Actor`, `Agent`, `Human` (for enforcement)
     - `SearchResult` (for SDK search)
     - Any other supporting types in the implementation
   - All types documented with JSDoc comments

### 10. **Public API Re-exports: index.ts** ⭐ (Updated — value exports critical)
   - All Phase 1 + Phase 2 + Phase 3 public API re-exported
   - **Type-only exports:** separated with comment `// type-only exports`
   - **Value exports:** separated with comment `// value exports`
     - `export { open } from "./index.js"`
     - `export { create, append } from "./writer.js"`
     - `export { parseGovernance, enforceRule } from "./governance.js"`
   - Verify runtime: all exports present in dist/index.js

### 11. **Writer Module: create and append** ⭐ (New)
   - `create(path: string, options: CreateOptions): Promise<void>`
     - Creates new markdown file with frontmatter
     - Throws if file already exists
     - Handles special characters in frontmatter values
     - Idempotent within constraints (fails on re-run for same path)
     - All dates in ISO 8601 UTC format
   - `append(path: string, content: string): Promise<void>`
     - Appends to file body without touching frontmatter
     - Creates file if not present (convenience behavior)
   - Both accept absolute and relative paths (normalized with path.resolve())
   - Coverage: ≥ 90%

### 12. **Governance Module: parseGovernance and enforceRule** ⭐ (New)
   - `parseGovernance(filePath: string): Promise<GovernanceRules>`
     - Parses .oxori/governance.md
     - Returns structured GovernanceRules with allowedPaths, blockedPaths, requiredFrontmatter
     - Missing governance.md returns default rules (no restrictions)
   - `enforceRule(path: string, action: WriteAction, rules: GovernanceRules, actor: Agent|Human): boolean`
     - Returns true if action allowed, false if denied
     - Humans always bypass governance (returns true for all actions)
     - Agents subject to rules
   - Covers all rule scenarios: simple rules, glob patterns, conflicting rules
   - Coverage: ≥ 95% (critical safety module)

### 13. **SDK API: Vault class and open()** ⭐ (New)
   - `open(path: string): Promise<Vault>`
     - Creates and returns Vault instance
     - Loads index cache (Phase 1 indexer)
     - Parses governance rules (Phase 3)
     - All state initialized and ready for queries/writes
   - `Vault` class public methods:
     - `query(q: string): Promise<Set<string>>` — delegates to Phase 2 query engine
     - `walk(start: string, opts?: WalkOptions): Promise<WalkResult>` — delegates to Phase 2 graph
     - `create(path: string, opts: CreateOptions): Promise<void>` — creates file with governance check
     - `append(path: string, content: string): Promise<void>` — appends with governance check
     - `getGovernanceRules(): GovernanceRules` — returns parsed governance
   - All methods async, all errors handled
   - All public methods documented with TypeDoc
   - Coverage: ≥ 90%

### 14. **CLI Commands: Testable and Functional** ⭐ (Updated for Phase 3)
   - `oxori write [--title T] [--tags t1,t2] [--path p] [--body B] [--frontmatter json]`
     - Creates new file, auto-generates filename from title if --path not provided
     - All options work correctly
   - `oxori append [file] [--body B]`
     - Appends content to file
   - `oxori config`
     - Shows vault path, governance rules, index stats, last reindex time
   - All commands respect --vault flag for targeting specific vault
   - **All commands must have CLI integration tests** (Criterion #15 — not separate)

### 15. **CLI Integration Tests: write, append, config** ⭐ (New — from Phase 2 Retro A7)
   - `tests/cli.test.ts` includes describe blocks for write, append, config commands
   - Minimum test cases (functional + error paths):
     - `oxori write` with all options
     - `oxori write` without --path (auto-filename)
     - `oxori append` to existing file
     - `oxori append` to non-existent file
     - `oxori config` output format
   - Tests for governance scenarios (if --agent flag simulating agent write):
     - Agent blocked from writing to .oxori/
     - Human allowed to write to protected paths
   - All tests pass with `pnpm test`
   - Coverage included in overall metrics (≥ 80%)

### 16. **Coverage: 80% Overall, 90% New Modules, 95% Governance** ⭐ (Updated)
   - Overall statement/branch/function/line coverage: ≥ 80%
   - `src/writer.ts` coverage: ≥ 90%
   - `src/governance.ts` coverage: ≥ 95% (safety-critical)
   - `src/index.ts` (SDK/Vault) coverage: ≥ 90%
   - Phase 1-2 modules maintain their existing coverage (parser/indexer ≥ 95%, query/graph ≥ 90%)
   - Full report: `npx vitest run --coverage` shows all modules
   - **Coverage submission must include per-file table** (from Phase 2 Retro A4)

### 17. **Documentation: Writer/Governance/SDK and Updated README** ⭐ (New — from Phase 2 Retro A8)
   - `docs/write-api.md` — complete API reference for create(), append(), with examples
   - `docs/governance.md` — how to write governance.md files, rule syntax, examples, enforcement behavior
   - `docs/sdk-api.md` — Vault class reference, open(), all methods, examples
   - `README.md` updated with Phase 3 features:
     - Section on write capabilities (create, append examples)
     - Section on governance and agent-vs-human semantics
     - Section on SDK usage (open, query, walk, write examples)
     - Update version reference from v0.2.0 to v0.3.0
   - `docs/architecture.md` updated with Phase 3 section

### 18. **Governance Safety: No Bypass for Agents** ⭐ (New)
   - Verify code enforces: agents always subject to rules, humans always bypass
   - Test: create scenario where agent is denied by rule, confirm error thrown with suggestion
   - Test: human write to same path, confirm success (governance not checked for humans)
   - Code review confirms no backdoor in safeWrite() or Vault write methods

### 19. **Performance Thresholds: Write Operations** ⭐ (New)
   - All write operations (create, append) complete in < 100ms
   - Measured on test fixtures (basic-vault, governance-vault)
   - Governance enforcement overhead < 20ms per write

### 20. **Frontmatter Conventions Implemented** ⭐ (New)
   - All created files include consistent frontmatter:
     - `title` (from CreateOptions or auto-generated)
     - `tags` (array format in YAML)
     - `created_at` (ISO 8601 UTC)
     - `updated_at` (ISO 8601 UTC)
     - Custom fields from CreateOptions.frontmatter (schemaless)
   - Frontmatter roundtrips correctly (parse → modify → re-serialize)

### 21. **Indexer Incremental Update on Write** ⭐ (New)
   - After successful write (create or append), vault index is updated:
     - New file entry added to index
     - Tags extracted and indexed
     - Wikilinks indexed (if any)
   - Index consistency verified: query for newly created file returns correct results

### 22. **Phase 2 Debt: Indexer Coverage** ⭐ (Debt from Phase 2)
   - `src/indexer.ts` coverage improved from 47.15% to ≥ 90%
   - Incremental indexing paths (`indexFile`, `removeFileFromState`) covered
   - Edge cases: empty files, special characters in filenames, concurrent write scenarios

---

## Summary

**Total Criteria: 22** (6 inherited + 16 Phase 3 specific)

**Critical New Criteria (must pass for gate approval):**
- #7: Runtime export check (catches type-vs-value mismatch)
- #11-12: Writer and governance modules implemented and covered
- #13-14: SDK Vault class and CLI commands working
- #15: CLI integration tests (not just unit tests)
- #16: Coverage thresholds (especially governance ≥ 95%)
- #18-21: Safety, performance, consistency verified

**Success Metric:**
All 22 criteria pass on first gate run (target: minimize gate blocks). Fix submissions must include full per-file coverage table and address all criteria in one submission.

---

## Wave 0 Delivery Checklist

- [ ] This gate checklist written (Wave 0 — Flynn's responsibility)
- [ ] Dumont agrees on docs structure (Wave 0 — async with implementation)
- [ ] Yori designs test fixtures: governance-vault/ with sample governance.md (Wave 0)
- [ ] Ready for Wave 1: Tron writes Phase 3 types (create, governance, Vault types)
