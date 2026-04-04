# Phase 3 Test Audit + Skeleton Plan — Summary

**Author:** Yori (Test Engineer)  
**Date:** April 3, 2024  
**Status:** ✅ Complete

---

## Part 1: Audit + Fill Existing it.todo() Stubs

### Findings

Audited all existing test files and identified 14 `it.todo()` stubs across the codebase:

| File | Stubs | Fillable? | Action |
|------|-------|-----------|--------|
| `tests/parser.test.ts` | 3 | ❌ No | Error handling requires Phase 3 work |
| `tests/indexer.test.ts` | 8 | ❌ No | Output file writing is Phase 3 feature |
| `tests/query.test.ts` | 3 | ✅ Yes | **FILLED** |
| **Total** | **14** | **3 filled** | **11 remain pending** |

### Filled Tests (Query Module)

All 3 query stubs have been **implemented** as they test Phase 2 functionality:

1. ✅ **"handles leading and trailing whitespace gracefully"** (line 150)
   - Tests that tokenizer correctly handles `"  tag:auth  "`
   - Implementation: Added assertion to verify single token produced

2. ✅ **"throws QUERY_PARSE_ERROR when operator has no right operand"** (line 294)
   - Tests error case: `parse(tokenize("tag:auth AND"))`
   - Implementation: Added try/catch to verify error code and action suggestion

3. ✅ **"throws QUERY_PARSE_ERROR for double operators"** (line 295)
   - Tests error case: `parse(tokenize("tag:x AND AND tag:y"))`
   - Implementation: Added try/catch to verify error code

**Result:** All 3 query tests now pass. Query module test coverage: **50/50 passed** (100%)

### Remaining Stubs (Pending Phase 3)

The following 11 stubs depend on Phase 3 implementations and remain unfilled:

**Parser (3 stubs):**
- `parseFile()` error handling: malformed YAML, file not found, filepath in error

**Indexer (8 stubs):**
- Vault scanning: vault path not found error
- Index file output: .oxori/index directory creation, files.md, tags.md, links.md
- Edge cases: empty vault, duplicate filenames

These are correctly left as stubs because they require:
- Error object contracts not yet finalized (Phase 3)
- File I/O operations to write index outputs (Phase 3)
- Complete errorhandling infrastructure

---

## Part 2: New Phase 3 Test Skeleton Files

### Created: `tests/watcher.test.ts`

Purpose: Tests for `src/watcher.ts` — file system watcher with WatchEvent emission.

**Skeletons (10 it.todo() tests):**

```typescript
describe('watch()', () => {
  it.todo('emits change event when a markdown file is created')
  it.todo('emits change event when a markdown file is modified')
  it.todo('emits change event when a markdown file is deleted')
  it.todo('does not emit change for non-markdown files')
  it.todo('stop() closes the watcher cleanly')
  it.todo('emits error event on invalid vault path')
  it.todo('type field on WatchEvent is correct for create/modify/delete')
  it.todo('path field on WatchEvent is absolute path')
  it.todo('handles rapid successive changes without crashing')
  it.todo('can watch nested subdirectories')
})
```

**Coverage Goals:**
- Core watcher behavior (create, modify, delete)
- File type filtering (.md only)
- Clean shutdown and error handling
- WatchEvent type validation (type field, absolute paths)
- Edge cases (rapid changes, nested directories)

### Created: `tests/governance.test.ts`

Purpose: Tests for `src/governance.ts` — governance rule checking engine.

**Skeletons (10 it.todo() tests):**

```typescript
describe('checkGovernance()', () => {
  it.todo('returns passed:true when no rules are violated')
  it.todo('returns passed:false when a rule is violated')
  it.todo('required-tag rule flags files missing a required tag')
  it.todo('no-orphan rule flags files with no links')
  it.todo('max-links rule flags files exceeding link count')
  it.todo('violations array contains filePath and ruleId')
  it.todo('severity:error violations cause passed:false')
  it.todo('severity:warning violations do NOT cause passed:false')
  it.todo('empty rules array always returns passed:true')
  it.todo('checkedAt field is a valid timestamp')
})
```

**Coverage Goals:**
- Core rule evaluation (pass/fail)
- Rule types: required-tag, no-orphan, max-links
- Violation object structure and severity levels
- Edge cases (no rules, empty violations)
- Timestamp validation on GovernanceResult

---

## Part 3: Phase 3 CLI Stubs

Added 12 new `it.todo()` stubs to `tests/cli.test.ts` for Phase 3 commands:

### `oxori watch <path>` (6 stubs)

```typescript
describe('oxori watch', () => {
  it.todo('starts watching a vault directory for changes')
  it.todo('emits watcher events when files are added')
  it.todo('emits watcher events when files are modified')
  it.todo('emits watcher events when files are deleted')
  it.todo('exits gracefully on SIGINT')
  it.todo('prints error and exits if vault path does not exist')
})
```

### `oxori check <path>` (6 stubs)

```typescript
describe('oxori check', () => {
  it.todo('runs governance checks on all files in vault')
  it.todo('outputs violations when rules are violated')
  it.todo('exits with code 0 when all checks pass')
  it.todo('exits with non-zero code when violations found')
  it.todo('accepts --rules flag to specify custom rules file')
  it.todo('outputs JSON when --json flag is passed')
})
```

---

## Test Results Summary

### Before Changes
- Test Files: 5
- Tests Passed: 127
- Tests Todo: 14
- Total: 141

### After Changes
- Test Files: 7 (added watcher.test.ts, governance.test.ts)
- Tests Passed: 130 (3 newly filled from query stubs)
- Tests Todo: 43 (11 existing pending + 20 new Phase 3 + 12 new CLI)
- Total: 173

### Command Output
```
✓ tests/query.test.ts (50 tests) — ALL FILLED
✓ tests/parser.test.ts (19 tests | 3 skipped) — 3 error stubs remain pending
✓ tests/graph.test.ts (24 tests) — complete
✓ tests/indexer.test.ts (23 tests | 8 skipped) — 8 output stubs remain pending
✓ tests/cli.test.ts (37 tests | 12 skipped) — 12 new Phase 3 stubs
↓ tests/watcher.test.ts (10 tests | 10 skipped) — phase 3 skeleton
↓ tests/governance.test.ts (10 tests | 10 skipped) — phase 3 skeleton

Test Files  7 passed | 2 skipped
Tests       130 passed | 43 todo
All tests pass ✅
```

---

## Deliverables Checklist

- ✅ **Part 1:** Audited all existing `it.todo()` stubs
  - 3 query stubs **FILLED AND PASSING**
  - 11 remaining stubs flagged as Phase 3 dependencies
- ✅ **Part 2:** Created Phase 3 skeleton files
  - `tests/watcher.test.ts` — 10 it.todo() stubs for file watcher
  - `tests/governance.test.ts` — 10 it.todo() stubs for governance engine
- ✅ **Part 3:** Added CLI stubs to `tests/cli.test.ts`
  - 6 stubs for `oxori watch` command
  - 6 stubs for `oxori check` command
- ✅ **Validation:** `pnpm test` passes with 130/130 tests
- ✅ **Documentation:** Summary written to this file

---

## Next Steps for Implementation Teams

### Phase 2 Remaining Work (Parser/Indexer)
- **Parser team (Tron):** Implement error handling for parseFile() and fill 3 parser stubs
- **Indexer team (Tron):** Implement index file output and fill 8 indexer stubs

### Phase 3 Implementation Work
- **Watcher team:** Implement `src/watcher.ts` and fill 10 watcher stubs + 6 CLI watch stubs
- **Governance team:** Implement `src/governance.ts` and fill 10 governance stubs + 6 CLI check stubs

### Test Fixture Requirements
- Phase 3 tests will need fixtures in `tests/fixtures/` (to be created during implementation)
- CLI watch/check tests may need isolated temp directories (test setup already in place)

---

## Notes for Test Implementation

1. **WatchEvent Type:** Verify all events emit with `type: "add" | "change" | "unlink"`, absolute `filepath`, and `timestamp` (ms)
2. **GovernanceRule Types:** Tests should cover error vs warning severity levels and their effect on `passed` field
3. **CLI Integration:** Watch and check commands should handle SIGINT/SIGTERM gracefully
4. **Error Messages:** All failures should include `action` suggestion for users
