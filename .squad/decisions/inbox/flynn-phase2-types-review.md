# Review: Phase 2 Type Contracts (Query Engine + Graph Traversal)

**Author:** Flynn (Lead & Architect)  
**Date:** 2025-07-13  
**Status:** ✅ APPROVED  
**Reviewing:** `src/types.ts` lines 381–682 + Tron's design decision `tron-phase2-type-contracts.md`

---

## Verdict: ✅ APPROVED

All five verification criteria pass. `src/index.ts` updated. `npx tsc --noEmit` exits zero.

---

## Verification Results

### 1. No `any` types
✅ **Pass.** Scanned the Phase 2 sections (lines 381–682). Zero uses of the `any` type. All mentions of "any" appear only in comment prose (e.g., "any YAML is valid"). Types use `string`, `number`, `boolean`, `ReadonlySet<T>`, `readonly T[]`, and `unknown` where appropriate.

### 2. All exported types use the `type` keyword
✅ **Pass.** Every Phase 2 type declaration uses `export type { ... }`. The one exception, `FILTER_FIELDS`, correctly uses `export const` — it must be a value (not erased by the compiler) so the evaluator can iterate over it at runtime. This is the correct and intended design.

### 3. Named exports only, no defaults
✅ **Pass.** No `export default` anywhere in the Phase 2 sections. All types and the `FILTER_FIELDS` const are named exports.

### 4. All types have JSDoc
✅ **Pass.** Every Phase 2 type has a `@description`, `@remarks`, and `@example` block. Field-level inline JSDoc comments are present on non-obvious fields (`relationType?`, `truncated`, `position`, etc.). Quality is high — the doc blocks explain semantics, not just structure.

### 5. Types are complete for `query.ts` and `graph.ts`
✅ **Pass.** The type surface covers:
- **Tokenizer:** `Token`, `TokenKind` — sufficient for a tokenizer that emits a stream of tokens with positions.
- **Parser:** `QueryAST`, `QueryNode`, `FilterNode`, `OperatorNode`, `GroupNode` — the full AST for a recursive descent parser.
- **Evaluator:** `QueryResult`, `FilterField`, `FILTER_FIELDS` — result shape and runtime field validation.
- **Graph:** `Edge`, `WalkDirection`, `WalkVia`, `WalkOptions`, `WalkResult` — full walk API surface including deduplication semantics.

### 6. `src/index.ts` — Phase 2 re-exports
✅ **Updated.** Added all Phase 2 types to `src/index.ts`:
```typescript
export type { Token, TokenKind, QueryAST, QueryNode, FilterNode, OperatorNode, GroupNode,
              QueryResult, FilterField, Edge, WalkOptions, WalkResult, WalkDirection, WalkVia } from "./types.js";
export { ok, err, FILTER_FIELDS } from "./types.js";
```

### 7. `npx tsc --noEmit`
✅ **Zero errors.** Confirmed after updating `src/index.ts`.

---

## Answers to Tron's 4 Open Questions

### Q1: `OperatorNode.children` for NOT — `[QueryNode]` vs `QueryNode[]`?

**Decision: Keep `QueryNode[]`.**

Enforcing `[QueryNode]` as a tuple type adds construction friction — the parser must cast, and TypeScript's tuple narrowing on `children[0]` doesn't remove the need for a runtime bounds check anyway. The evaluator asserts `children.length === 1` at runtime with a clear error message. Static enforcement is over-engineering for a constraint that is never violated once the parser is correct. If the parser has a bug that produces a `NOT` with zero or two children, the runtime assertion catches it immediately.

### Q2: `FilterNode.field` typed as `FilterField` vs `string`?

**Decision: Keep `string`.**

The circular dependency (`FilterNode → FilterField → FILTER_FIELDS`) is manageable at a technical level, but the benefit is marginal: field name validation belongs in the evaluator, not in the type system. Changing to `FilterField` would mean every test fixture constructing a `FilterNode` directly must use a literal from `FILTER_FIELDS` — unnecessary friction for test authoring. The evaluator validates field names at runtime with a helpful error message. The current `string` type plus runtime validation is the right split.

### Q3: Preserve `GroupNode` or erase during parsing?

**Decision: Preserve `GroupNode`.**

The cost is one extra `case "group"` in the evaluator switch. The benefit is real: round-trip serialization (query → AST → string) can faithfully reconstruct parenthesization, and MCP tool responses that include the parsed AST are more debuggable when grouping is visible. Erasing is a premature optimization — add it later if the evaluator proves complex, not before.

### Q4: `WalkResult.edges` as `ReadonlySet<Edge>` vs `readonly Edge[]`?

**Decision: `ReadonlySet<Edge>`** (Tron's implementation already uses this — confirmed correct).

Graph edges should appear once even when multiple walks traverse the same edge. Deduplication is semantically more correct than ordered traversal for edges. If a caller needs ordered edge traversal, they can derive it from `visitOrder` (which already preserves node discovery order as a `readonly string[]`). `ReadonlySet` prevents accidental mutation, and the deduplication semantics are what downstream callers (MCP graph viewer, CLI `walk` output) will want by default.

---

## Notes for Yori (Test Skeleton Author)

Now that types are locked:
- `FilterNode`, `OperatorNode`, `GroupNode`, `QueryAST` are the shapes to construct in parser test fixtures.
- `QueryResult.matches` is a `ReadonlySet<string>` — test assertions should use `.has()` not index access.
- `WalkResult.edges` is a `ReadonlySet<Edge>` — equality checks need set comparison, not array comparison.
- `WalkResult.visitOrder` is `readonly string[]` — array index access is fine here.
- `FILTER_FIELDS` is importable at runtime; use it in evaluator tests to assert unknown fields are rejected.

---

## No Changes Requested

The type contracts are clean, well-documented, and complete. Tron's design decisions are sound. Yori may begin writing test skeletons against these types immediately.
