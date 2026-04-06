# Test Fixtures

This directory contains markdown vault fixtures used by the Oxori test suite.
Each sub-vault is designed to test a specific concern. Fixtures use realistic
content — not toy examples — so tests catch real-world edge cases.

---

## `basic-vault/`

**Purpose:** Unit tests for `parseFile()` and `buildIndex()`. Small, clean, deterministic.

### Files

| File | What it tests |
|------|---------------|
| `overview.md` | Rich frontmatter (title, type, date, tags array, author), multiple body wikilinks, hierarchical tags `project/alpha/planning`, uppercase wikilink `[[NOTE-ONE]]` for normalisation test, duplicate `[[note-two]]` link for dedup test |
| `note-one.md` | Basic frontmatter, body links `[[overview]]` twice (wikilink deduplication) |
| `note-two.md` | Typed relations only — `depends_on: [[prerequisite]]`, `blocks: [[note-one]]`, empty body (typed relations must NOT bleed into wikilinks Set) |
| `prerequisite.md` | Hierarchical tags `project/alpha/planning` + `status/active`; referenced by note-two's typed relations |
| `no-frontmatter.md` | **No YAML frontmatter at all** — tests that parser returns `{}` for frontmatter; body has `#project/beta`, `#status/pending` and body wikilinks `[[overview]]`, `[[note-one]]` |
| `empty.md` | **0 bytes** — tests that parser and indexer handle empty files without throwing |

The `decisions/`, `memory/`, `tasks/` subdirectories contain legacy fixture files
that pre-date the structured fixture design. They are still valid markdown and add
realistic variety to indexer scanning tests.

### Key test scenarios covered

- Frontmatter extraction into plain `Record<string, unknown>`
- `filename` stem derivation from filepath
- Hierarchical tag expansion (all ancestor levels)
- Tag deduplication after expansion (both `project/alpha` and `project/alpha/planning` expand to `project` — only one entry)
- Body tag scanning (`#tag` in raw markdown)
- Body wikilink extraction (`[[target]]`)
- Wikilink normalisation to lowercase
- Wikilink deduplication
- Typed relation identification (`depends_on: "[[target]]"`)
- Typed relations isolated from body wikilinks Set
- Empty file handling
- No-frontmatter handling

---

## `linked-vault/`

**Purpose:** Graph traversal tests — cycle detection, hub nodes, leaf nodes, multiple
typed relation targets. Used by `buildIndex()` and (Sprint 2) the graph walker.

### Graph structure

```
node-a ──→ node-b ──→ node-c ──→ node-a   (cycle: A→B→C→A)
       ──→ node-c ──→ node-d               (leaf)
node-e ──→ node-a
       ──→ node-d
node-f ──→ node-b
node-g ──→ node-d
```

### Files

| File | Role | Outgoing links | Typed relations |
|------|------|----------------|-----------------|
| `node-a.md` | API Gateway | `[[node-b]]`, `[[node-c]]` | `implements: [[node-d]]` |
| `node-b.md` | Auth Module | `[[node-c]]`, `[[node-d]]` | `depends_on: [[node-a]]` |
| `node-c.md` | Session Store | `[[node-a]]` | `related_to: [[node-b]]` |
| `node-d.md` | Database Layer | _(none — leaf)_ | _(none)_ |
| `node-e.md` | Load Balancer (hub) | `[[node-a]]`, `[[node-d]]` | _(none)_ |
| `node-f.md` | Notification Service | `[[node-b]]` | `related_to: ["[[node-e]]", "[[node-c]]"]` |
| `node-g.md` | Metrics Exporter | `[[node-d]]` | `implements: [[node-d]]` |

### Key test scenarios covered

- Cyclic wikilinks do not cause infinite loops in `buildIndex()`
- Leaf nodes (`node-d`) have empty `wikilinks` and `typedRelations`
- Hub nodes (`node-e`) can be detected by `links` map in-degree
- Multiple typed relation targets per key (`node-f.related_to` → `['node-e', 'node-c']`)
- Typed graph edges (`implements`, `depends_on`, `related_to`)

---

## `governance-vault/`

**Purpose:** Sprint 3 governance rule parsing and enforcement. Kept minimal — it is
the governance layer's fixture, not a general-purpose vault.

### Structure

```
governance-vault/
├── .oxori/
│   └── governance.md        ← governance rule definitions (spec format)
├── public-note.md           ← accessible to all
└── secrets/
    ├── api-keys.md          ← deny pattern: secrets/**
    └── passwords.md         ← deny pattern: secrets/**
```

### `governance.md` rules

| Rule | Pattern | Effect | Applies to |
|------|---------|--------|------------|
| Protect secrets | `secrets/**` | deny | agents |
| Allow all reads | `**` | allow | all |

### Key test scenarios covered

- Governance rule parsing from markdown (Sprint 3)
- `secrets/**` pattern denies agent writes
- Files outside protected paths remain accessible
- Rule evaluation order (first match wins — deny before allow)
