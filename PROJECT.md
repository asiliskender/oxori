# Oxori — Project Docs

**Oxori is how agents read and write knowledge in natural language, without drowning in it.**

This folder holds the project's planning documents. Start at the top and read down — each doc assumes the ones above it.

---

## Where to find what

| Document | What's in it | Read it when you want to know… |
|---|---|---|
| **[VISION.md](./VISION.md)** | The thesis (*md is the new db*), the problem, what Oxori is, and how we'll know it works. | *Why* Oxori exists and what it is — the one-page pitch. |
| **[DECISIONS.md](./DECISIONS.md)** | Every settled decision: where knowledge lives, the index, two-phase search, the commands, output, language, and all engineering practices (git, CI/CD, versioning, testing, license). | *What* we decided and the reasoning behind each choice. |
| **[ARCHITECTURE_HIGH_LEVEL.md](./ARCHITECTURE_HIGH_LEVEL.md)** | Conceptual shape: the components (CLI, engine, parser, index store, files), how they talk, and the two flows (write/update, read/search). | The system's *shape* — components and data flow, no implementation detail. |
| **[ARCHITECTURE_LOW_LEVEL.md](./ARCHITECTURE_LOW_LEVEL.md)** | Concrete Phase 1 design: on-disk layout, `index.json` structure, parsing (remark + Obsidian layer), hash-based change detection, module boundaries, command walkthroughs. | *How* it's actually built — formats, modules, mechanisms. |
| **[SPEC.md](./SPEC.md)** | Exactly what gets built: command behavior, the search-output contract, broken-link handling, performance target, edge cases, scope boundary, and the end-to-end definition of done. | What "done" means — the buildable, testable spec for the team. |

---

## Reading order

- **New to the project?** VISION → DECISIONS.
- **About to build?** ARCHITECTURE_HIGH_LEVEL → ARCHITECTURE_LOW_LEVEL → SPEC.
- **Just need to know if it's finished?** SPEC § Definition of done.

---

## The shape in one line each

- **VISION** — why: knowledge stays in natural language; it stays findable no matter how big the base grows.
- **DECISIONS** — what: `/oxori` vault, Obsidian-compatible, separate disposable JSON index, `init`/`index`/`search`, TypeScript via `npx oxori`.
- **HIGH-LEVEL** — components and two flows; Oxori is a mechanism, not a mind.
- **LOW-LEVEL** — `index.json` + hash-based reindex + remark/Obsidian parsing; Phase 1.
- **SPEC** — search returns path + headings + snippet; human-readable default with `--json`; done = the 7-step scenario.

Phase 1 scope. Semantic search (embeddings) is Phase 2 and noted where it plugs in.
