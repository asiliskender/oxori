# Oxori — Spec (Phase 1)

> What exactly gets built. This records the *answers* to OPEN_QUESTIONS.md.
> Companion to VISION (why), DECISIONS (what we decided), and the two ARCHITECTURE docs (how).
> Phase 1 only. Semantic search is explicitly out (Phase 2).

---

## 1. Commands

Three commands. Writing notes is the agent's job (it writes `.md` directly), not a command.

### `oxori init`
- Creates `.oxori/` beside the markdown, writes `config.json`, runs a full index, writes `index.json`.
- Adopting an existing Obsidian vault uses the same path — the `.md` files are already there.
- **Never overwrites an already-initialized vault.** If `.oxori/` already exists, it stops and reports that the vault is already initialized rather than clobbering it.

### `oxori index`
- Brings `index.json` up to date with the markdown via hash-based reconciliation.
- Called by an agent after it writes or edits notes.

### `oxori search "<query>"`
- Answers from `index.json` only. Never scans the `.md` files.
- Matching modes: full-text keyword (every file the term appears in), structural (links & backlinks), tag filter.

---

## 2. Search output (the contract)

The most important contract in the project — the agent reads this to decide what to do.

**Each result returns: path + headings + snippet.**
- `path` — relative path to the matching file
- `headings` — the file's headings, for orienting context
- `snippet` — the relevant excerpt (where the term appears)

This is deliberately the middle ground: enough for the agent to judge relevance and often act without opening the file, but not the whole file (which would re-bloat context). Returning only paths was rejected (forces a second read); returning full content was rejected (defeats the purpose).

### Output format
- **Default: human-readable text.** A person or agent can read it directly.
- **`--json` flag: structured JSON.** Same information, machine-parseable, for agents that prefer to parse.
- The agent chooses; human-readable is the default.

---

## 3. Broken links

- A link to a non-existent note (`[[missing]]`) is **marked as broken in the index.**
- It is **not surfaced in `search` output** — Oxori stays passive. The mark sits in the index; it is not pushed at the agent unless specifically asked for. (Surfacing/reporting could be a later, opt-in capability.)

---

## 4. Performance target

- **Phase 1 target: up to ~10,000 files**, with `search` returning fast enough to feel instant (sub-second).
- **Scaling goal (not Phase 1): ~100,000 files.** If/when the vault approaches this, the plain-JSON index may need a search library (e.g. MiniSearch — still JSON, still non-binary) layered in. Out of scope for Phase 1.

---

## 5. Edge cases & errors

- **`init` on an already-initialized vault** → stop, report, do not overwrite.
- **Vault with zero `.md` files** → init succeeds, produces an empty index.
- **Corrupt `index.json`** → treat as rebuildable; regenerate from the markdown (it is derived and disposable).
- **Empty search result** → clean "no matches" message; non-error exit.
- **Deleted file present in index** → its record is dropped on the next `index`.

---

## 6. Repo & git hygiene

- **`.oxori/` may be committed or gitignored — left to the developer.** It is derived and disposable, so gitignoring is reasonable, but Oxori does not force either.
- **LICENSE: MIT**, present in the repo.
- **First version: 0.1.0.**
- **README v1**: what Oxori is (one-liner from VISION), install (`npx oxori`), the three commands with a minimal example, and a pointer to the other docs.
- Conventional Commits; short-lived branches; PR to `main`; no direct commits to `main`.

---

## 7. Explicitly out of scope (Phase 1)

- **Semantic search / embeddings** — Phase 2.
- No watch mode (no auto-reindex on file change; `index` is explicit).
- No MCP server (plain CLI only; MCP is a later layer).
- No config UI.
- No multi-vault support.

---

## 8. Definition of done (acceptance scenario)

Phase 1 is done when this end-to-end scenario works:

1. Start with an empty folder.
2. `oxori init` → `.oxori/` and an (empty) index are created.
3. Write 3 markdown notes by hand, with `[[...]]` links between them and at least one `#tag`.
4. `oxori index` → the index reflects all three files, their links, backlinks, and tags.
5. `oxori search "<word in one note>"` → returns that note with path + headings + snippet.
6. Follow a structural query → the backlink of a linked note is correctly returned.
7. `oxori search --json "<word>"` → same result as step 5 in structured form.

When all seven hold, Phase 1 ships as 0.1.0.
