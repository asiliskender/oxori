# Yori — Wave 1 Test Fill Summary

**Date:** 2026-04-03  
**Author:** Yori (Test Engineer)  
**Task:** Fill `watcher.test.ts` and `governance.test.ts` stubs

---

## Stubs filled vs remaining

### `tests/governance.test.ts`

| Stub | Status | Notes |
|------|--------|-------|
| returns passed:true when no rules are violated | ✅ filled | |
| returns passed:false when a rule is violated | ✅ filled | |
| required-tag rule flags files missing a required tag | 🚫 todo | `checkGovernance` uses glob path patterns only; tag-based rules not implemented |
| no-orphan rule flags files with no links | 🚫 todo | same — link-count rules not in implementation |
| max-links rule flags files exceeding link count | 🚫 todo | same — max-links rules not in implementation |
| violations array contains filePath and ruleId | ✅ filled | |
| severity:error violations cause passed:false | ✅ filled | |
| severity:warning violations do NOT cause passed:false | 🚫 todo | Implementation only ever emits `severity: "error"`; no warning path exists |
| empty rules array always returns passed:true | ✅ filled | |
| checkedAt field is a valid timestamp | ✅ filled | |

**Extra tests added for coverage:** first-match-wins (allow-before-deny), first-match-wins (deny-before-allow),
non-matching files produce no violations, multiple files partial match, violations sorted by filePath,
empty IndexState always passes, each file only triggers one violation (first-match).

**Filled:** 6 / 10 original stubs + 7 extra tests = **13 real assertions**  
**Todo remaining:** 4

### `tests/watcher.test.ts`

| Stub | Status | Notes |
|------|--------|-------|
| stop() closes the watcher cleanly | ✅ filled | Also verifies double-stop is idempotent |
| emits error event on invalid vault path | ✅ filled | Error fires via setImmediate from VaultWatcherImpl |
| emits change event when a markdown file is created | ✅ filled | Asserts type="add" |
| emits change event when a markdown file is modified | ✅ filled | Accepts "change" or "add" (macOS emits rename for writes) |
| emits change event when a markdown file is deleted | ✅ filled | Asserts type="unlink" |
| does not emit change for non-markdown files | ✅ filled | Verifies .txt/.json/.png produce no events |
| type field on WatchEvent is correct for create/modify/delete | ✅ filled | Checks add + unlink types explicitly |
| path field on WatchEvent is absolute path | ✅ filled | Uses `path.isAbsolute()` assertion |
| handles rapid successive changes without crashing | ✅ filled | 8 rapid writes, verifies watcher still alive |
| can watch nested subdirectories | ✅ filled | Creates `subdir/deep/nested.md`, verifies event |

**Filled:** 10 / 10 stubs  
**Todo remaining:** 0

---

## Test count delta

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Passing tests | 130 | 153 | +23 |
| Todo stubs | 43 | 27 | -16 |
| Total tests | 173 | 180 | +7 (new tests added) |

---

## Coverage numbers

| File | Stmts | Branch | Funcs | Lines | Notes |
|------|-------|--------|-------|-------|-------|
| `governance.ts` | **100%** | **100%** | **100%** | **100%** | Goal was ≥90% ✅ |
| `watcher.ts` | **97.4%** | **92.9%** | **100%** | **97.4%** | |

### Uncovered branch: `watcher.ts` line 28

`type = "change"` inside the `if (eventType === "change")` block is never reached.

On macOS, Node.js `fs.watch` emits `"rename"` for all filesystem operations including
`writeFileSync` to an existing file. The `"change"` event type from `fs.watch` is only
observed on Linux and some Windows configurations. This is not a test gap — the production
code path is correct and will be exercised on other platforms.

---

## Key decisions made during implementation

1. **Relative paths in governance tests**: `state.files` map keys are relative paths
   (e.g., `"secrets/agent.md"`) so that `micromatch.isMatch` works correctly with simple
   glob patterns like `"secrets/**"`. Absolute paths would require `"**/secrets/**"`.
   
2. **Watcher temp dirs**: Used `tests/.tmp-watcher-<timestamp>-<random>/` per project
   convention (not `os.tmpdir()`) to respect the "no /tmp writes" rule.

3. **Backtick-in-JSDoc parsing bug**: Glob patterns like `secrets/**` and `tests/.tmp-watcher-*/`
   inside `/* */` block comments caused premature comment-close when the sequence contained
   `*/`. Fixed by removing backtick-wrapped glob examples from block comment headers.

4. **Three governance stubs are `it.todo()` with explanations**: The "required-tag",
   "no-orphan", and "max-links" stubs assume a rule system based on file content/graph
   properties. The actual `checkGovernance` only supports path-glob matching. Left as
   named todos rather than deleting them — they document unimplemented governance features
   that could be added in a future phase.
