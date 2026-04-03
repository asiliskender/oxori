# Fixture Design Decisions — Yori

**Date:** 2026-04-03  
**Author:** Yori (Tester / QA)  
**Status:** Active

---

## Context

Phase 1 test fixtures were designed before `src/parser.ts` and `src/indexer.ts` exist.
This document records the design rationale so Tron (implementer) and Flynn (reviewer) can
verify the fixtures match the intended behaviour.

---

## basic-vault — Design Choices

### Why these six files?

Each root-level file in `basic-vault/` tests exactly one concern:

| File | Primary concern |
|------|-----------------|
| `overview.md` | Rich frontmatter + hierarchical tags + wikilink normalisation + dedup |
| `note-one.md` | Simple frontmatter + wikilink deduplication (same link twice in body) |
| `note-two.md` | Typed relations in frontmatter, empty body (relations ≠ wikilinks) |
| `prerequisite.md` | Referenced file for typed relations; also tests multiple tags expansion |
| `no-frontmatter.md` | Parser must return `{}` frontmatter; body contains tags + wikilinks |
| `empty.md` | 0-byte file; parser + indexer must not throw |

### Typed relations isolation (note-two.md)

`note-two.md` has `depends_on: "[[prerequisite]]"` and `blocks: "[[note-one]]"` in frontmatter,
but the body contains no wikilinks. This is the only way to write a deterministic assertion:

```ts
expect(result.wikilinks.has('prerequisite')).toBe(false)
```

If the body also mentioned `[[prerequisite]]`, we could not distinguish "typed relation leaked"
from "body link detected correctly".

### Wikilink normalisation test (overview.md)

`overview.md` body contains both `[[note-one]]` and `[[NOTE-ONE]]`. The expected Set contains
exactly one entry `'note-one'`. This single assertion covers:
- Normalisation to lowercase
- Deduplication after normalisation

Both are tested with one fixture line instead of two separate files.

### Tag deduplication test (overview.md)

Frontmatter tags `project/alpha` and `project/alpha/planning` both expand to include `project`.
Testing `count of 'project' in tag array === 1` is more robust than adding an explicit duplicate
`project/alpha` twice to the YAML, because it tests the _expansion + dedup_ pipeline together.

---

## linked-vault — Design Choices

### Graph topology

The linked-vault was designed to hit all graph edge types in Phase 2:

- **Cycle (A→B→C→A):** Tests cycle-safety in `buildIndex()` (must not loop) and cycle
  detection in the Phase 2 graph walker (must not recurse infinitely).
- **Leaf (node-d):** Tests termination — `wikilinks.size === 0`, `typedRelations.size === 0`.
- **Hub (node-e):** Tests high in-degree detection via `links` map (multiple sources map to same target).
- **Multiple typed targets (node-f):** `related_to: ["[[node-e]]", "[[node-c]]"]` exercises the
  `Map<string, string[]>` shape of `typedRelations` with length > 1.

### Realistic naming

Files are named `node-a` through `node-g` with meaningful titles (API Gateway, Auth Module, etc.)
so fixtures read as real architecture documents, not toy examples. This ensures tests exercise
realistic content lengths and YAML structures.

---

## governance-vault — Design Choices

### Governance.md format

The governance.md was updated to match the spec format:

```markdown
### Rule: Protect secrets
- Pattern: secrets/**
- Effect: deny
- Applies to: agents
```

This is the human-readable format Tron will parse in Phase 3. The format was chosen to be
parseable with simple line-by-line regex (no YAML block) while remaining readable to humans.

### Why `secrets/` subdirectory?

The `secrets/**` glob pattern is the most common real-world governance use case.
Testing it with two files (`api-keys.md`, `passwords.md`) verifies the glob applies
to all files in the directory, not just one.

### Rule evaluation order

Two rules are defined: `deny` first, then `allow **`. This tests that the governance
engine evaluates rules in declaration order and the first match wins. The allow-all rule
at the end should NOT override the deny rule for `secrets/**`.

---

## What's NOT covered by these fixtures

These concerns require additional fixtures or implementation-specific mocks:

1. **Malformed YAML frontmatter** — needs a fixture with invalid YAML like `key: [unclosed`. Held as
   `it.todo()` because the exact error shape (`OxoriError.code`, `.action`) is Tron's decision.

2. **Files with identical names in different subdirectories** — e.g., `a/index.md` and `b/index.md`.
   Held as `it.todo()` because the test needs to verify Map keying by full path.

3. **Empty vault directory** — needs a temp dir with no `.md` files. Held as `it.todo()` because
   creating disposable temp directories in test setup is straightforward but we need the `buildIndex`
   API signature confirmed first.

4. **Index file output (files.md, tags.md, links.md)** — held as `it.todo()` because the exact
   markdown format of the index files is Tron's authoring decision.

---

## Coordination notes for Tron

- `parseFile(filepath)` — assumed to be `async`, throws on error (not `Result<T>` return).
  If implementation uses `Result<T>`, tests in `error handling` describe block need updating.
- `buildIndex(vaultPath)` — assumed to be `async`, returns `IndexState`, throws `OxoriError` on vault not found.
- Typed relations in frontmatter: tested with both single string (`"[[target]]"`) and YAML list
  (`["[[node-e]]", "[[node-c]]"]`). Parser must handle both forms.
- All wikilinks and typed relation targets are expected to be lowercased filename stems (no `.md`).
