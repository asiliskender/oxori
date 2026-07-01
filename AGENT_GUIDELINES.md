# Oxori — Agent Guidelines

> How agents read, write, and search a knowledge base with Oxori.

This document is written for agents, not humans. It covers everything an agent needs to use an Oxori vault effectively: how to write notes that stay findable, how to run every kind of search, and how to fit Oxori into the most common agent workflows.

---

## Table of Contents

1. [Mental model](#1-mental-model)
2. [Setup](#2-setup)
3. [Writing notes](#3-writing-notes)
   - [File structure](#31-file-structure)
   - [Frontmatter](#32-frontmatter)
   - [Tags](#33-tags)
   - [Wikilinks](#34-wikilinks)
   - [Headings](#35-headings)
   - [Content conventions](#36-content-conventions)
4. [Indexing](#4-indexing)
5. [Searching](#5-searching)
   - [Full-text search](#51-full-text-search)
   - [Tag search](#52-tag-search)
   - [Structural search (links & backlinks)](#53-structural-search-links--backlinks)
   - [Reading search results](#54-reading-search-results)
   - [When search returns nothing](#55-when-search-returns-nothing)
6. [Common workflows](#6-common-workflows)
   - [Starting fresh: init a vault](#61-starting-fresh-init-a-vault)
   - [Writing a new note and making it findable](#62-writing-a-new-note-and-making-it-findable)
   - [Updating an existing note](#63-updating-an-existing-note)
   - [Checking what you know before writing](#64-checking-what-you-know-before-writing)
   - [Following a knowledge thread](#65-following-a-knowledge-thread)
   - [Discovering orphaned knowledge](#66-discovering-orphaned-knowledge)
7. [Tag taxonomy guidelines](#7-tag-taxonomy-guidelines)
8. [Link discipline](#8-link-discipline)
9. [Anti-patterns](#9-anti-patterns)
10. [Quick reference](#10-quick-reference)

---

## 1. Mental model

Oxori treats `.md` files as the source of truth. Everything else (`.oxori/index.json`) is derived, disposable, and always rebuildable.

```
agent writes .md files
          ↓
oxori index   →   .oxori/index.json   (derived, never the source)
          ↓
oxori search  →   reads index.json only (never re-reads .md files)
          ↓
agent reads results → decides to act, read more, or write more
```

**What this means for an agent:**

- Write `.md` files directly. Oxori has no "write" command — that's intentional.
- Call `oxori index` after every write session. Not calling it means search results are stale.
- Trust search results. They come from a precomputed index; they're fast and complete.
- If the index feels wrong, delete `.oxori/` and run `oxori init` — the index rebuilds in seconds from your notes.

---

## 2. Setup

**First time on a vault:**

```sh
oxori init [path]
```

Creates `.oxori/` and builds the first index. `path` defaults to the current directory. Works with existing Obsidian vaults — just point at the folder.

**Verify it worked:**

```sh
oxori search "any word you know is in a note"
```

If you get a result, the vault is live.

**Subsequent sessions:**

```sh
oxori index [path]   # after you write or edit notes
```

You don't need to init again. Just index after changes.

---

## 3. Writing notes

Agents write `.md` files directly — create, edit, delete with normal file operations. Oxori only indexes what's there when you call `oxori index`.

### 3.1 File structure

```
vault/
├── decisions/
│   └── 2026-07-01-use-remark.md
├── architecture/
│   ├── overview.md
│   └── storage.md
├── sessions/
│   └── 2026-07-01-session.md
└── topics/
    └── caching.md
```

Use subdirectories to group by domain. Oxori's search spans the whole vault regardless of depth — structure is for human readability, not search.

Keep filenames:
- lowercase, hyphen-separated (`auth-flow.md`, not `Auth Flow.md`)
- stable once written (changing a filename breaks all `[[wikilinks]]` pointing to it)
- descriptive enough to recognize without opening the file

### 3.2 Frontmatter

YAML frontmatter is optional but useful. Put it at the very top of the file:

```yaml
---
title: Authentication Flow
tags: [auth, security, backend]
created: 2026-07-01
status: active
---
```

**Oxori reads the `tags` field.** Other fields (title, created, status) are ignored by the index — include them for your own bookkeeping.

`tags` accepts either array syntax or a single string:

```yaml
tags: [auth, security]   # preferred — explicit array
tags: auth               # works for a single tag
```

### 3.3 Tags

Tags are the primary dimension for categorical search. Apply them deliberately.

**Two equivalent syntaxes — use either or both:**

```markdown
---
tags: [backend, api]
---

This note covers the #backend API layer and how #auth tokens flow through it.
```

Both frontmatter tags and inline `#tags` are indexed. `oxori search --tag backend` finds a file whether `backend` appears in frontmatter or inline.

**Tag rules:**
- Lowercase only: `#backend`, not `#Backend`
- No spaces: `#auth-flow`, not `#auth flow`
- Nested tags with `/` are supported: `#backend/api`, `#backend/db` — search by the parent (`--tag backend`) or the full path (`--tag backend/api`)
- Tags inside code blocks and headings are ignored by the parser (intentional — those aren't semantic tags)
- Be specific enough to be useful. `#note` on everything is noise. `#decision`, `#api`, `#frontend` are signal.

### 3.4 Wikilinks

Wikilinks connect notes. They're how you build a knowledge graph that structural search can traverse.

**Basic syntax:**

```markdown
See [[architecture/overview]] for the full picture.
```

**With an alias (display text different from the target):**

```markdown
See [[architecture/overview|the architecture overview]] for the full picture.
```

**Linking rules:**
- Link by filename: `[[note-name]]` or `[[note-name.md]]` (both work)
- If two files share the same name in different folders, use the relative path: `[[auth/tokens.md]]` not `[[tokens]]`
- Broken links (pointing at files that don't exist) are silently marked in the index — they won't surface in search results but won't crash anything either
- Link forward to things you expect to create. A broken link now becomes a valid link when you write the target note and run `oxori index`

**When to link:**
- When one note elaborates on a concept mentioned in another
- When a decision depends on context documented elsewhere
- When you're referencing a prior session, decision, or piece of architecture
- When you want to be able to discover related notes via structural search

**Don't over-link.** If everything links to everything, the graph loses meaning. Link when there's a genuine knowledge dependency.

### 3.5 Headings

Headings are returned in search results as orientation context. Write them to communicate at a glance:

```markdown
# Authentication Flow

## Overview

## Token lifecycle

### Access tokens
### Refresh tokens

## Error handling
```

When search returns `"headings": ["Authentication Flow", "Token lifecycle", "Refresh tokens"]`, an agent can often decide whether to read the full file without opening it.

Practical rules:
- One `#` (H1) per file — the file title
- Use `##` and `###` to break content into named sections
- Keep headings descriptive: `## Refresh token expiry` beats `## 2.3`

### 3.6 Content conventions

**Write for retrieval.** The full text of each note is indexed. A keyword that appears in the note will match a full-text search for that keyword. This means:
- Name things consistently. If you call it "content hash" in three notes and "file hash" in one, a search for "content hash" misses the fourth note.
- Repeat important terms. Don't rely on synonyms within a note if you want it found by multiple queries.
- Include context. A snippet of a few sentences is returned in search results. Make those sentences carry meaning even out of context.

**Keep notes atomic.** One note = one concept, decision, or topic. A 10,000-word document is harder to surface precisely than ten focused 1,000-word notes with clear headings and tags.

**Date session notes.** When writing a session log or decisions log, include the date in the filename (`2026-07-01-auth-decision.md`) and in the frontmatter. This lets you filter chronologically via search.

---

## 4. Indexing

Always run `oxori index` after writing or editing notes:

```sh
oxori index [path]
```

This is fast on large vaults — Oxori uses content hashes and only re-parses files that changed. You won't wait long even on thousands of files.

**When to index:**
- After creating a new note
- After editing an existing note
- After deleting a note
- After moving or renaming a note
- Before searching, if you've written anything since the last index

**When NOT to index:**
- Before writing (no-op, nothing changed)
- Repeatedly in a tight loop (once after your write session is enough)

**If the index is corrupted or stale:**

```sh
rm -rf .oxori/ && oxori init [path]
```

This rebuilds everything from scratch. Since the index is purely derived, you lose nothing.

---

## 5. Searching

All searches read from `index.json` — never from the `.md` files. Search is always fast regardless of vault size.

### 5.1 Full-text search

```sh
oxori search "query" [path]
```

Finds every file where the query appears in the body text or headings. Case-insensitive. Supports multi-word phrases.

**Examples:**

```sh
oxori search "content hash"
oxori search "authentication token expiry"
oxori search "migration strategy"
```

**JSON output (default — use this in agents):**

```sh
oxori search "content hash"
```

```json
[
  {
    "path": "architecture/storage.md",
    "headings": ["Storage Layer", "Change detection"],
    "snippet": "…each file record stores a content hash; on re-index, hashes are compared and only changed files are re-parsed…"
  }
]
```

**Human-readable output (for inspection):**

```sh
oxori search "content hash" --pretty
```

```
📄 architecture/storage.md
   Headings: Storage Layer › Change detection
   …each file record stores a content hash; on re-index, hashes are compared and only changed files are re-parsed…
────────────────────────────────────────────────────────────
```

**Search tips:**
- Use specific, domain-relevant terms. `oxori search "hash"` returns everything with the word hash; `oxori search "content hash"` is more precise.
- Quotes are optional for single words but required for multi-word phrases: `oxori search "auth token"` (exact phrase) vs `oxori search auth` (any file with "auth").
- The search is over the full body text — not just titles or headings. A term buried in paragraph 4 of a note will still match.

### 5.2 Tag search

```sh
oxori search --tag "tagname" [path]
```

Returns every file carrying that tag (frontmatter or inline). Exact match on the tag name.

**Examples:**

```sh
oxori search --tag "backend"
oxori search --tag "decision"
oxori search --tag "backend/api"    # nested tag — exact path
```

**Output:**

```json
[
  {
    "path": "decisions/2026-07-01-storage.md",
    "headings": ["Storage decision"],
    "snippet": ""
  },
  {
    "path": "architecture/storage.md",
    "headings": ["Storage Layer"],
    "snippet": ""
  }
]
```

Note: tag search returns an empty snippet — the result is a file list, not a text match. Use the path and headings to decide whether to read the file.

**When to use tag search:**
- "Show me all decisions" → `oxori search --tag "decision"`
- "What have we documented about the frontend?" → `oxori search --tag "frontend"`
- "List all session notes" → `oxori search --tag "session"`

Tag search is the right tool when you want to enumerate a category. Full-text search is better when you're looking for a specific piece of knowledge.

### 5.3 Structural search (links & backlinks)

```sh
oxori search --link "filename.md" [path]
```

Returns two groups:
- Files that `filename.md` links **to** (`"direction": "link"`)
- Files that link **to** `filename.md` (`"direction": "backlink"`)

**Examples:**

```sh
oxori search --link "overview.md"
oxori search --link "architecture/storage.md"   # use path if names collide
```

**Output:**

```json
[
  {
    "path": "architecture/storage.md",
    "direction": "link",
    "headings": ["Storage Layer"],
    "snippet": ""
  },
  {
    "path": "sessions/2026-06-30-session.md",
    "direction": "backlink",
    "headings": ["What we built"],
    "snippet": ""
  }
]
```

**Reading structural results:**
- `"direction": "link"` — the target file points to these. Follow them to go deeper into a topic.
- `"direction": "backlink"` — these files point to the target. Follow them to find context, history, or things that depend on this note.

**When to use structural search:**
- "What does `decisions/auth.md` connect to?" → follow `link` results
- "What sessions or notes reference `architecture/overview.md`?" → follow `backlink` results
- "Is this note isolated (no backlinks) or well-connected?" → use structural search to check

**If the filename is ambiguous** (same name in two folders), use the full relative path:

```sh
oxori search --link "auth/tokens.md"    # not just tokens.md
```

### 5.4 Reading search results

Every result returns the same three fields:

| Field | What it tells you | When to use it |
|-------|------------------|----------------|
| `path` | Where the file is | Navigate to the file; include in links |
| `headings` | How the file is organized | Decide if the file is worth reading |
| `snippet` | The relevant excerpt (full-text) or empty (tag/structural) | Decide if you have enough without opening the file |

**Decision rule:**
- Snippet answers your question → you're done. No need to read the full file.
- Snippet is close but incomplete → read the file at `path`.
- Snippet is irrelevant → the term matched somewhere in the file that isn't relevant; ignore this result.
- Result list is empty → see [When search returns nothing](#55-when-search-returns-nothing).

### 5.5 When search returns nothing

An empty result set means no file in the index matched your query. This is a clean, non-error state. Consider:

1. **Index is stale.** Did you write a note but forget to run `oxori index`? Run it now and search again.
2. **Query is too specific.** Try a broader term. `"authentication"` instead of `"JWT refresh token rotation"`.
3. **Different terminology.** The knowledge exists but uses different words. Try synonyms.
4. **Knowledge doesn't exist yet.** Write the note.

Do not assume a negative result means a corrupted index. Oxori returns an empty array cleanly. Check the above before escalating.

---

## 6. Common workflows

### 6.1 Starting fresh: init a vault

```sh
mkdir my-vault && cd my-vault
oxori init
# write your first notes
oxori index
oxori search "first term"
```

### 6.2 Writing a new note and making it findable

1. Create the file with meaningful tags and at least one wikilink if relevant:

```markdown
---
title: Content Hashing Strategy
tags: [architecture, indexing, performance]
---

# Content Hashing Strategy

Oxori uses a SHA-256 hash of each file's content to detect changes. On [[indexing]], only files whose hash differs from the stored value are re-parsed.

## Why hashing

Comparing file modification times is unreliable across environments. Content hashes are deterministic and portable.

## Hash storage

The hash lives in each file's record in `index.json`. It is recomputed on every `oxori index` run and compared in-memory before any file is re-parsed.

See also: [[architecture/storage]]
```

2. Run the index:

```sh
oxori index
```

3. Verify it's findable:

```sh
oxori search "content hash"
```

### 6.3 Updating an existing note

1. Edit the `.md` file directly.
2. Run `oxori index` — only the changed file is re-parsed.
3. Search to confirm the update is reflected.

There's no partial-update API. Edit the file; index the vault.

### 6.4 Checking what you know before writing

Before writing a new note, search for existing knowledge to avoid duplication:

```sh
oxori search "topic you're about to write about"
oxori search --tag "relevant-tag"
```

If relevant notes exist:
- Read them (use the `path` from results).
- Extend them rather than creating a duplicate.
- Add a wikilink from the existing note to anything you add.

If nothing exists, proceed to write. This is the correct workflow for building a non-redundant knowledge base.

### 6.5 Following a knowledge thread

You found a note via full-text search. You want to understand its context and connections:

```sh
# 1. Find the note
oxori search "topic"

# 2. See what it connects to
oxori search --link "path/to/note.md"

# 3. Follow a linked note
oxori search --link "path/to/linked-note.md"

# 4. Find all notes on the same tag
oxori search --tag "shared-tag"
```

This lets you traverse the knowledge graph without reading every file end-to-end.

### 6.6 Discovering orphaned knowledge

A note with no backlinks is either foundational (intentionally standalone) or forgotten. To find notes that nothing links to, use structural search on each file and check whether backlinks are empty.

There's no single command for this in Phase 1 — it's a scripted operation if you need it:

```sh
for file in $(find . -name "*.md" ! -path "./.oxori/*"); do
  backlinks=$(oxori search --link "$file" | jq '[.[] | select(.direction=="backlink")] | length')
  if [ "$backlinks" -eq 0 ]; then echo "orphan: $file"; fi
done
```

Use orphan checks periodically to surface forgotten knowledge that should be linked or removed.

---

## 7. Tag taxonomy guidelines

Tags work best when the team agrees on a shared vocabulary. Inconsistent tags fracture the knowledge base. Establish your taxonomy before writing at scale.

**Suggested base tags for an agent-driven knowledge base:**

| Tag | What goes here |
|-----|----------------|
| `decision` | A recorded architectural or product decision |
| `architecture` | Design and structural notes |
| `session` | Notes from a specific work session |
| `api` | API design, contracts, endpoints |
| `frontend` | UI, client-side concerns |
| `backend` | Server, database, processing |
| `auth` | Authentication and authorization |
| `performance` | Benchmarks, targets, optimizations |
| `bug` | Bug reports and root-cause analyses |
| `research` | Exploratory notes, comparisons, unknowns |
| `todo` | Things not yet done (flag them; link to the decision when resolved) |

**Guidelines:**
- Agree on the vocabulary before writing. A note tagged `#backend-api` and one tagged `#api/backend` are not the same tag to Oxori.
- Use the most specific applicable tag, not the most general. A note about JWT refresh tokens should be `#auth` (and possibly `#backend`), not just `#note`.
- Nest with `/` when a parent-child relationship is real: `#backend/db`, `#backend/api`. Don't nest arbitrarily.
- Review and consolidate tags periodically. Tags accumulate entropy. A quarterly pass keeps them useful.

---

## 8. Link discipline

Wikilinks are how search becomes navigation. A knowledge base with no links is just a bag of files. Links make it a graph you can traverse.

**Link when:**
- Note B provides context or elaboration for something mentioned in Note A
- A decision references the architecture it affects
- A session note references the features or components worked on
- You're writing a note that supersedes or relates to an earlier note

**Don't link when:**
- The relationship is trivial ("this note exists")
- You'd need to create a spurious note just to have something to link to
- The link would be circular with no informational value

**Maintain link integrity:**
- When you rename a file, update all `[[wikilinks]]` pointing to it (or leave the old name as an alias)
- When you delete a note, search for its backlinks and update or remove them
- After a rename or delete, run `oxori index` — broken links are silently marked in the index

**Check link health:**

```sh
# Find what links to a file you're about to rename or delete
oxori search --link "notes/old-name.md"
```

Update every `backlink` result before renaming or deleting.

---

## 9. Anti-patterns

These patterns degrade search quality and knowledge graph usefulness. Avoid them.

**Dumping everything into one file.** One 5,000-word file with all session notes is harder to retrieve precisely than five focused notes. Split by topic or decision, not just by session.

**No tags.** A vault with no tags offers only full-text search. Tag search is the fastest way to enumerate a category. Apply at least one tag per note.

**Inconsistent terminology.** Calling the same concept "auth token," "JWT," and "access credential" in three different notes means a search for any one term misses the others. Pick a term; use it consistently.

**Forgetting to index.** Writing notes and never running `oxori index` means search results are always stale. Make `oxori index` the last step of every write session.

**Searching without indexing first.** If you just wrote or edited notes, always index before searching. There is no auto-reindex.

**Linking to everything.** Promiscuous linking makes structural search noisy. If everything is connected to everything, following links stops being useful. Link with intention.

**Using frontmatter `tags` AND inline `#tags` redundantly for the same tag in the same file.** Both are indexed — having `tags: [auth]` in frontmatter AND `#auth` inline just adds clutter. Pick one convention per note (frontmatter for categorical tags, inline for incidental references is a reasonable split).

**Naming files with spaces or capital letters.** `My Note.md` is technically valid but creates friction in wikilinks and CLI usage. Use `my-note.md`.

**Running `oxori init` on an already-initialized vault.** `init` stops and reports an error if `.oxori/` already exists. Use `oxori index` for updates.

---

## 10. Quick reference

### Commands

| Command | When to use |
|---------|-------------|
| `oxori init [path]` | First time on a vault; creates `.oxori/` and builds the first index |
| `oxori index [path]` | After writing or editing any notes |
| `oxori search "query" [path]` | Full-text search across all notes |
| `oxori search --tag "tag" [path]` | Find all notes with a specific tag |
| `oxori search --link "file.md" [path]` | Find what a note links to and what links back to it |

### Output flags

| Flag | Effect |
|------|--------|
| _(default)_ | JSON output — use this in agents |
| `--pretty` | Human-readable text output |

### Note checklist

Before running `oxori index` after writing a note, verify:

- [ ] File is in the right subdirectory
- [ ] Filename is lowercase and hyphen-separated
- [ ] Frontmatter `tags` are set (at minimum one tag)
- [ ] H1 heading matches the note's purpose
- [ ] Relevant wikilinks are included (at least one if a related note exists)
- [ ] Terminology is consistent with other notes on this topic

### Search decision tree

```
Need to find something?
│
├─ You know the category → --tag search
│   oxori search --tag "decision"
│
├─ You know a keyword → full-text search
│   oxori search "specific term"
│
├─ You have a file and want context → structural search
│   oxori search --link "path/to/file.md"
│
└─ Result is empty?
    ├─ Run oxori index first, then retry
    ├─ Try a broader/synonymous term
    └─ The knowledge doesn't exist yet — write it
```
