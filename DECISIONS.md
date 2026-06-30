# Oxori — Decisions

> Companion to VISION.md. The vision says *why* Oxori exists; this captures the *decisions* made about how we're building it.
> Decisions here are deliberate. When something is deferred, it's marked Phase 2+.

---

## Where knowledge lives

- Knowledge lives in an **`/oxori` folder** of plain markdown files.
- The folder is **Obsidian-compatible**: both **linking** (`[[...]]` syntax) and **tagging** (`#tag` syntax) follow the same convention Obsidian uses, so a human can open `/oxori` as an Obsidian vault and see the graph, backlinks, and tags directly.
- `init` can also be run **on an existing Obsidian vault** — Oxori adopts it rather than forcing a fresh start.
- **Source of truth is always the markdown.** Everything else is derived from it.

---

## The index

- Search **never scans all the markdown files.** It goes through an index. This is the whole point — the right information stays findable no matter how large the base grows.
- The index is **separate, derived, and disposable.** It is built from the markdown and can be deleted and rebuilt at any time. If it is ever lost or corrupted, it is regenerated from the markdown. It is important, but it is never the authority.
- The index lives under `/oxori` (likely in a `.oxori/` subfolder).
- **Phase 1 index holds:** a full-text representation of each file's body (so a keyword can be matched to every file it appears in), each file's headings/tags, and the link graph (who links to whom, including backlinks).
- **Phase 2** adds embeddings as an additional layer on top of this same index.

---

## Search — two phases

**Phase 1 (now):** full-text keyword search + structural (links & backlinks) + tags. A keyword search returns **every file the word appears in** (in the file's body, not just its title/tags/links) — the same behavior Obsidian gives a human searching a vault. Runs over the index, not by scanning the raw files each time.

**Phase 2 (later):** semantic search via embeddings. Embeddings exist only to **bridge a connection when there is no explicit link** — never as a storage format, never as a compressed stand-in for the text. Deferred for now; treated as feature work.

---

## Commands (Phase 1)

- **`init`** — creates the `/oxori` folder (or adopts an existing vault) and builds the first index.
- **`search`** — queries the index and returns matches. Does not scan the markdown.
- **`index`** — applies changes in the markdown (new / edited files) to the index.

**Writing has no command.** An agent writes a markdown file directly into `/oxori`, then is expected to call `oxori index` so the index knows about the change. Oxori does not write content; it only makes content findable. (This keeps Oxori passive — it doesn't think for the agent, it just indexes what was written.)

*(`context` was considered and dropped — it was just a mode of `search`.)*

---

## Output & interfaces

- **The CLI output is for the agent.** Plain CLI — an agent runs `oxori search "..."` (e.g. via bash) and reads the result.
- **The human interface is Obsidian itself.** Oxori doesn't build a separate human UI; a person opens the same `/oxori` vault in Obsidian. This is how the "one knowledge base, two first-class consumers" idea is served without building two UIs.
- **MCP** (a protocol for agents to connect to tools directly) is a possible later layer on top of the CLI. Not needed for Phase 1.

---

## Implementation

- **Language: TypeScript.** Chosen for easy, fast distribution via `npx oxori` (zero-install). The earlier TypeScript scaffold was discarded because it was built while the thesis was still unclear — TS itself was never the problem.

---

## Engineering practices

**Repository & hosting**
- Project lives on **GitHub**.
- **MIT license.**

**Branching & workflow**
- **Trunk-based development.** Short-lived branches, merged into `main` via **PR**.
- **Direct commits to `main` are forbidden** — everything goes through a PR.

**Commits & versioning**
- **Conventional Commits** for commit messages.
- **Versioning is derived from commit messages** (no GitVersion). This drives automated releases via **semantic-release**, which: determines the version, generates the **changelog** automatically, publishes to npm, and cuts the GitHub release.

**CI/CD**
- Pipelines on **GitHub Actions**.
- On **PR**: run tests, run the **linter**. (Linting runs on PRs, not on every commit.)
- On merge to `main`: semantic-release publishes the package to the **npm registry** so `npx oxori` works.

**Testing**
- **Unit tests** required, aligned with the architecture. **Integration tests** where feasible.
- **Coverage is measured and reported, but not enforced as a hard gate** — no merge-blocking threshold.

**Tooling**
- Package manager: **npm**.
- Linter/formatter: TypeScript linter (e.g. ESLint, or Biome) — runs on PRs.
- **Dependabot** for automated dependency-update PRs and security hygiene.

**Documentation**
- Lives in the **README** and other markdown files in the repo. No separate docs site for now.

---

## Deferred (Phase 2+)

- **Embeddings / semantic search** — see Search above.
- **MCP server** — layer over the CLI when needed.
- **Multi-agent concurrency** — what happens when several agents write the same file at once. Not a concern for now: content is the agent's responsibility; Oxori returns whatever was written.

---

## Current snapshot

| Area | Decision |
|---|---|
| Location | `/oxori` folder, Obsidian-compatible (links `[[...]]` + tags `#tag`), adoptable via `init` |
| Search (Phase 1) | full-text keyword (every file a word appears in) + structural + tags, over the index |
| Index | separate, derived, disposable, under `/oxori` |
| Commands | `init`, `search`, `index` |
| Writing | agent writes md directly, then calls `index` |
| Output | plain CLI for the agent; Obsidian for the human |
| Language | TypeScript, `npx oxori` |
| Hosting / license | GitHub, MIT |
| Workflow | trunk-based, short-lived branches, PR to `main`, no direct commits |
| Commits / versioning | Conventional Commits → semantic-release (version, changelog, npm publish, GH release) |
| CI/CD | GitHub Actions: tests + lint on PR; publish to npm on merge |
| Testing | unit required, integration where feasible; coverage measured, not gated |
| Tooling | npm, **Biome** (lint + format, PR), Dependabot |
| Docs | README + repo markdown |
| Deferred | embeddings, MCP, concurrency |

---

## Build decisions (Phase 1 — resolved 2026-06-30)

These were open questions resolved before build started. See also `PLAN.md`.

| # | Question | Decision |
|---|---|---|
| OQ1 | Linter | **Biome** — single tool for lint + format, zero config overhead |
| OQ2 | CLI vault path | **Optional `[path]` arg, defaults to `process.cwd()`** on all three commands |
| OQ3 | `oxori index` when `.oxori/` missing | **Error: "run oxori init first"** — init and index are distinct operations |
| OQ4 | Snippet window size | **±120 characters** around first match, trimmed at word boundaries |
| OQ5 | `#tag` inside heading text | **Not extracted** — headings are structural, not tag annotations |
| OQ6 | Search mode selection | **Flags**: default full-text, `--tag "#rust"` for tags, `--link "note-a"` for structural |
| OQ7 | Broken links in `FileRecord` | **`links: Array<{ target: string, broken: boolean }>`** — single consistent shape |
