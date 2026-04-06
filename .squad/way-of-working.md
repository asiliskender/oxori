# Oxori Squad — Way of Working

> **Audience:** Every team member (human or AI agent) working on Oxori.
> **Authority:** Flynn (Lead & Architect)
> **Last updated:** Phase 4 (v0.4.0)

This document is the canonical internal handbook for the Oxori squad. It synthesises every retrospective finding, directive, routing decision, coding standard, and process pattern established across Phases 1–4. Read it in full before contributing to any phase.

---

## Table of Contents

1. [Team Composition & Role Boundaries](#1-team-composition--role-boundaries)
2. [Development Model](#2-development-model)
3. [Phase Roadmap](#3-phase-roadmap)
4. [Directives (D1–D10)](#4-directives-d1d10)
5. [Commit Conventions](#5-commit-conventions)
6. [Code Quality Standards](#6-code-quality-standards)
7. [Coverage Thresholds](#7-coverage-thresholds)
8. [Build System](#8-build-system)
9. [Phase Gate Process](#9-phase-gate-process)
10. [Code Review Protocol](#10-code-review-protocol)
11. [Types-First Discipline](#11-types-first-discipline)
12. [Test Strategy](#12-test-strategy)
13. [Documentation Standards](#13-documentation-standards)
14. [Retrospective Process](#14-retrospective-process)
15. [Ceremonies](#15-ceremonies)
16. [Routing Rules](#16-routing-rules)
17. [Known Gotchas](#17-known-gotchas)
18. [Architectural Decisions](#18-architectural-decisions)
19. [Retrospective History & Learnings](#19-retrospective-history--learnings)

---

## 1. Team Composition & Role Boundaries

| Agent | Role | Owns |
|-------|------|------|
| **Flynn** | Lead & Architect | Phase gates, API design, code review, final approval on every phase merge |
| **Tron** | Core Dev | `parser.ts`, `indexer.ts`, `query.ts`, `types.ts` |
| **Ram** | Platform Dev | `graph.ts`, `search.ts`, `watcher.ts`, `writer.ts`, `mcp.ts` |
| **Yori** | Tester / QA | All test files, test fixtures, coverage |
| **Dumont** | DevRel / Docs | `docs/`, `README.md`, release notes |
| **Clu** | DevOps | GitHub Actions, CI/CD, npm publish, build config |
| **Castor** | Product Owner | Phase priorities, scope, requirements, backlog |
| **Quorra** | AI Agent Builder | MCP server design, agent integration patterns |
| **Scribe** | Silent Logger | Automatic session logging, decisions merge |
| **Ralph** | Work Monitor | Automatic backlog/queue monitoring |

### Key Boundaries

- **Flynn does not implement features.** Flynn designs interfaces, reviews submissions, approves or blocks gates, and documents decisions. Implementation is always routed to the correct domain owner.
- **Quorra and Ram collaborate on MCP.** Quorra designs agent interaction patterns; Ram implements the server. Neither acts unilaterally on MCP scope.
- **Scribe and Ralph are automatic.** Never route work to them explicitly — they run in the background after every substantial session.

---

## 2. Development Model

### Feature Branch Model (D2)

All work lives on feature branches. **Never commit directly to `main`.**

- Each phase gets one dedicated feature branch: `feature/phase-N-<name>`
  - Example: `feature/phase-4-semantic-search`
- Each phase = one npm release (v0.1.0 → v0.5.0)
- No partial merges — a phase either ships complete or it does not ship
- Flynn must approve all phase merges — no merge without his sign-off

### Branch Lifecycle

```
main (protected)
  └── feature/phase-N-<name>
        ├── commits by all agents for that phase
        └── merged to main ONLY after Flynn's gate approval
```

### Backlog Management

- **GitHub Projects** manages the backlog (migrated from `.squad/backlog.md` at pre-Phase 4 cleanup)
- Backlog acceptance criteria **must include TypeScript function signatures** — not just behaviour descriptions
  - Example: `indexVault(config: VaultConfig): Promise<Result<IndexState, OxoriError>>`
  - Why: The Phase 1 API mismatch (Yori wrote tests for `buildIndex(path)`, Tron built `indexVault(config)`) was caused by vague backlog ACs. Retro A7.

---

## 3. Phase Roadmap

| Phase | Name | Scope | Version | Status |
|-------|------|-------|---------|--------|
| 1 | Parser + Markdown Index | `types.ts`, `parser.ts`, `indexer.ts`, CLI init/index | v0.1.0 | ✅ Complete |
| 2 | Query Engine + Graph Walk | `query.ts`, `graph.ts`, CLI query/walk/graph | v0.2.0 | ✅ Complete |
| 3 | Write API + Governance | `watcher.ts`, `governance.ts` | v0.3.0 | ✅ Complete |
| 4 | Semantic Search | `search.ts`, `vectors.ts`, `semantic.ts` | v0.4.0 | ✅ Complete |
| 5 | MCP Server + Obsidian Compat | `mcp.ts`, Obsidian compatibility | v0.5.0 | 🔜 Planned |

**Each phase = one npm release = one feature branch = one gate review.**

---

## 4. Directives (D1–D10)

Directives are team-wide rules set by Onur Asiliskender. They apply to all phases from their introduction date. Review all active directives at every phase kickoff.

| # | Directive | Details |
|---|-----------|---------|
| **D1** | No `any` types | Enforced at tooling level via `@typescript-eslint/no-explicit-any: "error"` in ESLint flat config. Not a review suggestion — a hard build failure. Use `unknown` and narrow. |
| **D2** | Feature branch model | All work on feature branches. Never commit directly to `main`. Main is protected. |
| **D3** | Types-first | `types.ts` reviewed and merged before any implementation begins. See [§11](#11-types-first-discipline). |
| **D4** | Atomic commits | One logical change per commit. Meaningful messages. No "wip", no "update". |
| **D5** | Phase boundary = release boundary | No partial phases. A phase ships complete or not at all. |
| **D6** | Different agent for revisions after rejection | If an artifact is rejected, the original author does NOT own the next version. A different agent does. No exceptions. |
| **D7** | Gate checklist written at kickoff | Flynn writes the phase gate checklist **before** any implementation starts. Not at review time. |
| **D8** | `.md` file review before each phase | All team members review `.md` files before each phase kickoff — update stale content, capture retro items, remove outdated references. |
| **D9** | Conventional commit format at phase end | The final commit on a phase branch must use the type that reflects the magnitude of changes, because `GitVersion` + `semantic-release` derive the semver bump from commit messages. `feat:` = minor, `fix:` = patch, `BREAKING CHANGE` in footer = major. |
| **D10** | No `CONTRIBUTING.md` | `CONTRIBUTING.md` has been removed. Remove all references to it from `README.md`, `docs/`, `.github/`, etc. |

---

## 5. Commit Conventions

### Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

### Types

| Type | When to Use |
|------|-------------|
| `feat` | New feature — triggers minor version bump |
| `fix` | Bug fix — triggers patch version bump |
| `docs` | Documentation only |
| `test` | Test additions or corrections |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `chore` | Build process, dependency updates, CI config |

### Rules

- **Atomic commits** — one logical change per commit, always
- `[skip ci]` suffix on squad/backlog/setup commits that should not trigger CI
- No vague subjects: "wip", "update", "fixes" are rejected at review
- Breaking changes: add `BREAKING CHANGE: <description>` in footer — this triggers a major version bump

### Examples (good)

```
feat(query): add evaluate() with FilterNode, OperatorNode, GroupNode support

Implements the query evaluator against locked QueryAST contract.
Handles all FilterNode fields (title, tag, link, frontmatter, type, date)
and all OperatorNode modes (AND/OR/NOT). GroupNode is preserved post-parse
for round-trip serialization.
```

```
fix(build): configure per-entry tsup banner — shebang on CLI only

The default tsup banner applies globally. Split entries so only
dist/cli.js receives #!/usr/bin/env node. Library dist/index.js
and dist/index.cjs must not have a shebang.
```

---

## 6. Code Quality Standards

### TypeScript

- **Strict mode** — `tsconfig.json` has `"strict": true`
- **No `any`** — D1, enforced by ESLint. Use `unknown` and narrow with type guards
- **`type` keyword for all type exports** — `export type Foo = ...`; `const` for runtime-needed values (e.g., `FILTER_FIELDS`)
- **Named exports only** — no default exports
- **Functions over classes** — except `Vault` and the MCP server, which have lifecycle state that justifies a class

### Error Handling

All error paths use the `Result<T,E>` discriminated union pattern:

```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// Constructors
function ok<T>(value: T): Result<T, never> { return { ok: true, value }; }
function err<E>(error: E): Result<never, E> { return { ok: false, error }; }
```

**Consumer pattern — always guard with `.ok` before accessing `.value`:**

```typescript
const result = await parseFile(path);
if (!result.ok) {
  // handle result.error (OxoriError with code + action)
  return;
}
// safe to use result.value here
```

**Never access `.value` directly without a `.ok` guard.** This is the single most common Result<T,E> misuse.

### Public API Types

- Use `ReadonlySet<T>` and `ReadonlyMap<K,V>` in all public API types — immutability guarantees at the type level
- `OxoriError` shape: `{ code: string; message: string; action: string }` — every error surface exposes a `code` (machine-readable) and `action` (human-readable next step)

### ESLint

- ESLint 9 flat config (`eslint.config.js`)
- `@typescript-eslint/no-explicit-any: "error"` — hard error, not warning
- Gate criterion: `npx eslint src/ tests/ --max-warnings 0` must exit zero

### JSDoc

Every exported function must have a JSDoc block with:
- `@description` or leading summary line
- `@param` for every parameter
- `@returns` describing the return value
- `@throws` if the function can throw (rare — most errors are `Result<T,E>`)
- Field-level inline comments on non-obvious type fields

---

## 7. Coverage Thresholds

Thresholds are enforced in `vitest.config.ts` and in CI. A gate will not pass if any threshold is unmet.

| Module | Minimum Coverage |
|--------|-----------------|
| `parser.ts` | ≥ 95% |
| `indexer.ts` | ≥ 95% |
| `governance.ts` | ≥ 95% |
| `semantic.ts` | ≥ 90% |
| `vectors.ts` | ≥ 90% |
| `query.ts` | ≥ 90% |
| `graph.ts` | ≥ 90% |
| **Global** | ≥ 80% |

### Important: Thresholds Are a Floor

Coverage numbers are a minimum, not a definition of "done". They do not substitute for integration test coverage at module seams. The Phase 1 experience (80%+ coverage, 11 untested CLI paths) proved this clearly.

### Coverage Fix Submissions

When submitting a coverage fix, include a **full per-file coverage table** — no selective reporting. The Phase 2 gate was blocked twice partly because Yori's fix submission reported query.ts improvement but omitted that graph.ts was still failing. Retro A4.

### Known Acceptable Coverage Gaps

- `search.ts`: Live OpenAI API paths are untestable without credentials or a fetch mock. Track as Phase debt with explicit rationale — do not silently omit from reports.

---

## 8. Build System

### tsup Dual-Package Build

The project builds three outputs:

| Output | Format | Shebang |
|--------|--------|---------|
| `dist/index.js` | ESM library entry | ❌ None |
| `dist/index.cjs` | CJS library entry | ❌ None |
| `dist/cli.js` | CLI entry | ✅ `#!/usr/bin/env node` |

**Critical:** The tsup default banner applies globally. You must configure the shebang **per-entry**. If `dist/index.js` receives the shebang, any bundler importing the library gets a corrupt first line. This is a Phase 1 bug that was caught by Clu before it shipped.

```typescript
// tsup.config.ts — correct pattern
export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    // NO banner here
  },
  {
    entry: { cli: "src/cli.ts" },
    banner: { js: "#!/usr/bin/env node" },
  },
]);
```

### pnpm

- `pnpm-lock.yaml` **must be committed** — CI runs `pnpm install --frozen-lockfile` on a clean clone. Missing lockfile = CI failure on every clean run. This was a Phase 3 debt item (carried from Phase 1–2) finally fixed at Phase 3 start.

### semantic-release

All required plugins must be **explicitly declared** in `package.json`. Do not assume transitive inclusion:

```json
"devDependencies": {
  "@semantic-release/changelog": "...",
  "@semantic-release/git": "...",
  "@semantic-release/github": "...",
  "@semantic-release/npm": "...",
  "@semantic-release/release-notes-generator": "...",
  "@semantic-release/exec": "..."
}
```

The `@semantic-release/exec` plugin is needed for README version sync. The release pipeline has been deferred for dry-run validation across three phases (Phases 2, 3, 4) — Clu must validate it with `pnpm semantic-release --dry-run` before v0.4.0+ publish.

### Gate Build Criteria

```bash
npx tsc --noEmit          # zero errors
npx tsup                  # clean build, all three dist outputs present
node -e "import('./dist/index.js').then(m => console.log(Object.keys(m)))"
# ↑ runtime export check — verifies function exports, not just type exports
```

The runtime export check is mandatory. TypeScript source inspection alone cannot detect type-vs-value export mismatches (`export type Foo` is erased at build time; `export function foo` is not). This distinction caused two Phase 2 gate failures.

---

## 9. Phase Gate Process

The gate is Flynn's binary checklist. Every criterion must pass. There are no partial passes.

### Gate Outcomes

| Outcome | Meaning |
|---------|---------|
| **APPROVED** | Merge proceeds immediately |
| **CONDITIONAL PASS** | Named exception documented as Phase N debt item; merge allowed with explicit tracking |
| **BLOCKED** | Specific failing criteria listed, specific agents assigned to fix |

### Gate Checklist (Inherited — Every Phase)

These criteria apply to every phase gate. Phase-specific criteria are written by Flynn at kickoff.

| # | Criterion | Verification Command |
|---|-----------|---------------------|
| 1 | TypeScript: zero errors | `npx tsc --noEmit` → exit 0 |
| 2 | ESLint: zero errors | `npx eslint src/ tests/ --max-warnings 0` → exit 0 |
| 3 | Tests: all non-todo pass | `npx vitest run` → zero failures (todo and skip are not failures) |
| 4 | Build: clean outputs | `npx tsup` → `dist/index.js`, `dist/index.cjs`, `dist/cli.js` all present |
| 5 | Shebang correct | `dist/cli.js` has `#!/usr/bin/env node`; `dist/index.js` does NOT |
| 6 | Runtime exports verified | `node -e "import('./dist/index.js').then(m => console.log(Object.keys(m)))"` — all public functions present |
| 7 | No `any` in `src/` | `grep -r "any" src/` returns no `any` type annotations |
| 8 | JSDoc complete | All exported functions have `@param`, `@returns`, `@throws` |
| 9 | README updated | Phase features documented with usage examples |
| 10 | `docs/architecture.md` updated | ADRs for all major design decisions made in this phase |
| 11 | `RELEASE-NOTES.md` written | Dumont owns — current release notes in place, no history |
| 12 | Coverage thresholds met | `npx vitest run --coverage` → all per-module and global thresholds pass |
| 13 | `pnpm-lock.yaml` committed | `git status` shows lockfile is not modified/untracked |
| 14 | Clean clone passes | `git clone → pnpm install --frozen-lockfile → pnpm build → pnpm test` succeeds |

### Gate Checklist Written at Kickoff (D7)

Flynn writes the phase-specific criteria **before any implementation begins**. Phase 2's failures were partially caused by criteria that were only understood at review time. Writing the checklist at kickoff gives every agent a concrete, binary-verifiable target list from day one.

**Phase 3 validated this.** Phase 3 was the first clean gate pass (12/12 on attempt #1). The primary contributors: A6 (checklist at kickoff) + A1 (runtime export check) + A3 (it.todo() discipline). Not luck — compound interest on retro action items.

### Gate Checklist Amendment Protocol

When scope changes mid-phase (e.g., Phase 3's pivot from Write API to Watcher + Governance), Flynn must produce a formal "gate checklist amendment" documenting:
- Which criteria are deferred (with rationale and target phase)
- Which criteria are added
- Which criteria are modified

Do not silently evaluate against a subset. Phase 3's 22-criterion checklist was reduced to 12 without a formal amendment — this is a known process debt (Retro A7 for Phase 4).

---

## 10. Code Review Protocol

### Who Reviews

Flynn reviews all PRs. Every submission passes through Flynn before merge.

### Reviewer Rejection Lockout (D6)

**If an artifact is REJECTED, the original author may not produce the next version.**

A different agent must own the revision — not the author, not even as an advisor.

**Precedent:** Phase 1 — Tron submitted `types.ts` → Flynn rejected (missing `FrontmatterEntry` named export) → Ram did the revision (not Tron). This is the canonical example.

**Why this rule exists:** The author of a rejected artifact has a mental model that produced the failure. Returning to the same author for the fix risks the same blind spot. A fresh agent, briefed on the rejection criteria, produces a more reliable revision.

### Review Criteria

Reviewers check (in addition to gate criteria):
- Type contracts match the locked `types.ts`
- No API design regressions from prior phases
- Public API surface is coherent (no half-exposed internals)
- JSDoc is accurate (not just present)
- Test coverage addresses the specification, not just the happy path

---

## 11. Types-First Discipline (D3)

### The Sequence

```
1. Tron writes types.ts (new phase types only)
2. Flynn reviews types.ts → APPROVED or CHANGES REQUESTED
3. If APPROVED: Yori writes test skeletons against locked contract
4. Implementation begins (Tron/Ram in parallel)
5. Yori fills in test bodies as implementations land
```

**No step may be skipped or reordered.**

### What "Types-First" Means in Practice

- `src/types.ts` is written before any implementation module
- `src/index.ts` public API surface is defined **alongside** `types.ts` — it is not an afterthought
- Test skeletons are written **against the locked TypeScript contract** — never against backlog ACs
  - Backlog ACs are product requirements; they do not substitute for TypeScript type contracts
  - The Phase 1 API mismatch (`buildIndex(path)` vs `indexVault(config: VaultConfig)`) was caused by Yori using backlog ACs as the spec. This required a full test rewrite.

### Flynn's Type Review Checklist

When reviewing `types.ts`, Flynn verifies:

| Check | Description |
|-------|-------------|
| Zero `any` | No `any` type anywhere |
| `type` keyword | All type exports use `type` keyword; runtime constants use `const` |
| Named exports | No default exports |
| Named `FrontmatterEntry` | This was a Phase 1 rejection — always verify explicitly |
| Per-type JSDoc | Every exported type has `@description`, `@remarks`, `@example` |
| Field-level docs | Non-obvious fields have inline comments |
| `ReadonlySet`/`ReadonlyMap` | Public API types use immutable collections |
| Zero `src/` imports | `types.ts` must have no imports from other source files |

### Open Design Questions

When Tron has open type design questions (e.g., "should `FilterNode.field` be `FilterField` or `string`?"), they are answered by Flynn in the review decision. Examples from Phase 2:

- `OperatorNode.children` for NOT: Keep `QueryNode[]` — runtime assert covers one-child constraint; tuple adds construction friction
- `FilterNode.field` as `string`: Field validation belongs in the evaluator; `FilterField` adds fixture friction
- Preserve `GroupNode`: Yes — round-trip serialization and MCP tooling need it
- `WalkResult.edges` as `ReadonlySet<Edge>`: Correct — deduplication semantics are right for edges

---

## 12. Test Strategy

### Ownership

Yori owns all test files and all fixtures. No other agent modifies test files without Yori's involvement.

### Test Writing Sequence

1. Types locked (Flynn approved `types.ts`)
2. Yori writes test **skeletons** (describe blocks, it() calls, no assertions yet)
3. Implementation proceeds
4. Yori fills in test bodies as each implementation unit stabilises

### `it.todo()` Discipline (Retro A3)

Use `it.todo()` for any test that cannot be fully written yet:
- Integration/e2e tests that need exact output strings from a stable implementation
- Tests for complex branching that would couple to implementation details

**Do NOT use** `expect(fn).toThrow()` stubs — these couple test stubs to implementation details and require a full rewrite when the implementation diverges. Phase 1 and Phase 2 both had test rewrite cycles caused by this.

```typescript
// ✅ Correct — documents future work, no coupling
it.todo("should reject writes to governance-protected paths");

// ❌ Wrong — couples to implementation, requires rewrite
it("should reject writes to governance-protected paths", () => {
  expect(() => writeFile(protectedPath, content)).toThrow();
});
```

### Fixture Vaults

All fixtures live in `tests/fixtures/`:

| Fixture | Contents | Purpose |
|---------|----------|---------|
| `basic-vault/` | 6 files, edge cases | Core parsing, frontmatter, tags, wikilinks |
| `linked-vault/` | 7-node directed graph, A→B→C→A cycle | Graph traversal, cycle safety — verifies the indexer is cycle-safe before Phase 2 graph code exists |
| `governance-vault/` | Protected `secrets/` directory | Governance enforcement |

**CLI test isolation:** Use `tests/.tmp-cli-<n>/` for CLI integration test temp directories. **Never `/tmp`.**

### Coverage Strategy

When submitting a coverage fix:
1. Run `npx vitest run --coverage`
2. Include the **full per-file table** in your submission — no selective reporting
3. Report exact numbers: "graph.ts: 94.73% branch" not "graph.ts: above threshold"

Phase 2 gate was blocked twice. The second blockage was a single criterion: graph.ts at 87.84% when it needed 90%. The fix submission from Yori reported query.ts improvement but omitted graph.ts entirely. That silence was the signal that the fix was incomplete.

---

## 13. Documentation Standards

### Ownership

Dumont owns all documentation. Agents who implement features write **doc proposals** (inline JSDoc, README section drafts). Dumont finalises.

### Files and Scope

| File | Contents | Rules |
|------|----------|-------|
| `README.md` | What is it, how to install, how to use | **Only** these three things. No roadmap, phases, future plans, team references (D7) |
| `RELEASE-NOTES.md` | Current release notes only | **No history** — overwrite with each release (D6). Replaces the old `RELEASES.md`. |
| `docs/architecture.md` | ADRs for all major design decisions | Updated each phase. ADR entries are permanent — do not delete old decisions |
| `docs/query-language.md` | Query language reference | Dumont's Phase 2 doc, 9200+ words, production-grade |

**Note:** `CONTRIBUTING.md` has been deleted (D10). Remove all references to it.

### Inline JSDoc

All public exports require:

```typescript
/**
 * Evaluates a parsed query AST against an index state.
 *
 * @param ast - The parsed query AST from `parse()`
 * @param state - The current vault index state
 * @returns A QueryResult with matching file paths and count
 * @throws Never — errors are returned as Result<T,E>
 */
export function evaluate(ast: QueryAST, state: IndexState): QueryResult { ... }
```

Doxygen-compatible format (D5). The `@description`, `@param`, `@returns`, `@throws` fields are mandatory on all public exports.

### Documentation Is a Gate Criterion

Docs are not "follow-on cleanup." At Phase 2's first gate, README still showed Phase 2 features as "🔜 future work" — that was a gate failure. Docs must be gate-ready on first submission.

**Phase 3 validated source-validated docs.** Dumont used actual field names from source files (`filepath`, `"add"/"change"/"unlink"`) rather than planning document assumptions. This was the first phase where docs passed gate on the first attempt.

---

## 14. Retrospective Process

Retrospectives are facilitated by Flynn after every phase. They follow a strict format.

### Format

1. **What went well** — concrete, named examples (not vague praise)
2. **What didn't go well** — honest, no euphemisms
3. **What we learned** — actionable insights with reasoning
4. **Action items** — owner + priority + phase target

### Cadence

- After every phase completion
- After a build failure / test failure / reviewer rejection (abbreviated retro via ceremony)

### Action Item Tracking

Action items are written to `.squad/decisions.md` under the phase retrospective section. They are reviewed at the **next** phase kickoff (D4) and verified in the gate checklist. Deferred items carry their original ID across phases (e.g., "Phase 2 Retro A7" remained labelled as A7 through Phase 4).

**Three consecutive deferrals = mandatory.** The semantic-release dry-run (Phase 2 A7) was deferred at Phases 2, 3, and 4. That pattern indicates an ownership gap, not a priority decision.

### Retrospective Value (Compound Interest)

The Phase 3 clean gate pass (first in project history) is directly attributable to Phase 2 retro action items being enforced:

| Retro Item | Applied In | Failure Mode Prevented |
|------------|-----------|----------------------|
| A1 — Runtime export check | Phase 3 gate checklist | Type-vs-value export mismatch (caused 2/5 Phase 2 failures) |
| A3 — it.todo() discipline | Phase 3 test writing | Test-rewrite cycle from implementation coupling |
| A6 — Gate checklist at kickoff | Phase 3 Wave 0 | Criteria discovered at review time |

The retro is not a ceremony that produces documents nobody reads. The documents are the mechanism.

---

## 15. Ceremonies

### Design Review

**Trigger:** Automatically before any multi-agent task involving shared systems or API contracts.

**Format:**
1. Review requirements
2. Agree on interfaces and contracts
3. Identify risks
4. Assign action items

**Who attends:** All agents whose modules are touched by the contract.

### Retrospective (Abbreviated)

**Trigger:** Automatically after a build failure, test failure, or reviewer rejection.

**Format:**
1. What happened (facts only)
2. Root cause
3. What changes
4. Action items (owner + target)

This abbreviated retro is distinct from the full phase retrospective. It is lightweight and immediate — do not defer it.

---

## 16. Routing Rules

### Primary Routing Table

| Work Type | Route To |
|-----------|----------|
| Architecture decisions, phase gates, API design | **Flynn** |
| `parser.ts`, `indexer.ts`, `query.ts`, `types.ts` | **Tron** |
| `graph.ts`, `search.ts`, `watcher.ts`, `writer.ts`, `mcp.ts` | **Ram** |
| All test files, test fixtures, coverage | **Yori** |
| `docs/`, `README.md`, release notes | **Dumont** |
| GitHub Actions, CI/CD, npm publish, build config | **Clu** |
| Phase priorities, scope, requirements, backlog | **Castor** |
| MCP server design, agent interaction patterns | **Quorra** |
| Code review, reviewer gates, phase sign-off | **Flynn** |
| Session logging, decisions merge | **Scribe** (automatic) |
| Work queue, backlog monitoring | **Ralph** (automatic) |

### Issue Label Routing

| Label | Who Acts |
|-------|----------|
| `squad` | Flynn triages, assigns `squad:<member>` label |
| `squad:flynn` | Architecture, review, decisions |
| `squad:tron` | Parser, indexer, query engine, types |
| `squad:ram` | Graph, search, watcher, writer, MCP impl |
| `squad:yori` | Tests, fixtures, coverage |
| `squad:dumont` | Docs, README, release notes |
| `squad:clu` | CI/CD, DevOps, releases |
| `squad:castor` | Product, scope, priorities |
| `squad:quorra` | Agent integration, MCP design |

### Routing Principles

1. **Eager by default** — spawn all agents who could usefully start work, including anticipatory downstream work (e.g., Yori writes test skeletons from spec while Tron finalises implementation)
2. **When two agents could handle it** — pick the one whose domain is primary
3. **Quick facts → coordinator answers directly** — don't spawn an agent for questions already in context
4. **Team fan-out** — spawn all relevant agents in parallel when work can be parallelised

---

## 17. Known Gotchas

These are documented failure modes from retrospectives. Every new agent must read this section.

### JavaScript Regex `/g` Flag at Module Level

```typescript
// ❌ WRONG — module-level regex with /g is non-deterministic across exec() calls
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;
function extractLinks(content: string) {
  const links = [];
  let m;
  while ((m = WIKILINK_RE.exec(content)) !== null) { links.push(m[1]); }
  return links;
}

// ✅ CORRECT — create new RegExp instance per call
function extractLinks(content: string) {
  const re = new RegExp(/\[\[([^\]]+)\]\]/g.source, "g");
  const links = [];
  let m;
  while ((m = re.exec(content)) !== null) { links.push(m[1]); }
  return links;
}
```

The `/g` flag maintains `lastIndex` state on the regex object. Reusing it across calls causes non-deterministic behaviour. Caught and documented by Tron in Phase 1.

### tsup Banner: Default Is Global

The `banner` config in tsup applies to all entries unless configured per-entry. If you set a shebang at the top level:

```typescript
// ❌ This adds shebang to ALL dist outputs
export default defineConfig({ banner: { js: "#!/usr/bin/env node" } });
```

Use per-entry config (see [§8 Build System](#8-build-system)).

### `@types/*` Packages: Check at Dependency Planning Time

When adding a dependency to `package.json`, immediately check whether `@types/<pkg>` is needed and add it to `devDependencies`. Do not discover missing `@types` mid-implementation (a TS7016 error halts work).

### semantic-release: All Plugins Must Be Explicit

Do not assume any `@semantic-release/*` plugin is a transitive dependency. Every plugin that fires during release must be declared in `package.json devDependencies`. The `@semantic-release/exec` plugin for README version sync is often missed.

### search.ts: Live API Paths Are Untestable

The live OpenAI API paths in `search.ts` cannot be meaningfully tested without credentials or a fetch mock. This is an accepted coverage gap. When submitting coverage reports, acknowledge this explicitly with rationale — do not silently omit `search.ts` from the per-file table.

### Result<T,E> Consumer Pattern

```typescript
// ❌ WRONG — accessing .value without checking .ok
const result = await parseFile(path);
doSomething(result.value); // TypeScript may allow this, but it's semantically wrong

// ✅ CORRECT — always guard with .ok
const result = await parseFile(path);
if (!result.ok) {
  handleError(result.error);
  return;
}
doSomething(result.value); // safe
```

### Type-vs-Value Export Mismatch

TypeScript source inspection cannot detect this class of bug. `export type Foo` is erased at build time. `export function foo` is not. Always run the runtime import check after any index.ts change:

```bash
node -e "import('./dist/index.js').then(m => console.log(Object.keys(m)))"
```

This caught the Phase 2 gate failure where `tokenize`, `parse`, `evaluate`, and `walk` were present as types in `src/index.ts` but not as runtime exports in `dist/index.js`.

### pnpm-lock.yaml Must Be Committed

`pnpm install --frozen-lockfile` (used in CI) requires the lockfile to exist. If it is in `.gitignore` or was never staged, every clean CI run fails at install. Verify the lockfile is committed at each phase kickoff.

---

## 18. Architectural Decisions

Full ADRs are in `docs/architecture.md`. These are the key decisions that cross-cut every module.

### Data Storage

- **No external database.** Filesystem + in-memory Maps/Sets is the source of truth.
- The `.oxori/` directory in the vault root holds the index (`index/files.md`, `index/tags.md`, `index/links.md`) and vectors (`vectors/`).
- **Git handles concurrency.** No application-level locks. This is a deliberate choice — Oxori is a single-user (or explicitly-coordinated multi-user) tool, not a concurrent database.

### Wikilinks

- Format: `[[filename]]` — no extension, no path prefix
- Matching: case-insensitive on the file stem
- Resolution: looks up the stem in `IndexState.links` (populated by `indexer.ts`)

### Tags

- Support hierarchy: `#project/auth/oauth` matches the tag itself **and** all ancestors (`project`, `project/auth`)
- Stored as raw strings in `IndexState.tags`

### Frontmatter

- **Schemaless** — any YAML key-value pair is indexed
- `FrontmatterEntry` = `Record<string, unknown>` (named export, not inline type)
- Typed relations via frontmatter keys: e.g., `depends_on: [[file]]` — the key name is the relation type

### Query AST

- `QueryNode` is a discriminated union: `FilterNode | OperatorNode | GroupNode`
- `OperatorNode` covers AND/OR/NOT — `children: QueryNode[]` — runtime assert verifies NOT has exactly one child
- `GroupNode` is **preserved post-parse** (not erased) — needed for round-trip serialisation and MCP tooling

### Error Surface

- `OxoriError`: `{ code: string; message: string; action: string }`
- `code` = machine-readable identifier (e.g., `"ENOENT"`, `"PARSE_ERROR"`)
- `action` = human-readable next step (e.g., `"Check that the file exists and is readable"`)

### Vector Search

- Optional module — core Oxori works without embeddings
- `search.ts` uses HTTP-based embedding API (OpenAI-compatible)
- Vectors stored in `.oxori/vectors/` as binary files
- Similarity: cosine similarity over float32 arrays

### Module Architecture

```
parser.ts     — reads .md files, extracts frontmatter/tags/wikilinks
indexer.ts    — builds IndexState from parsed files, maintains Maps/Sets
query.ts      — tokenizes query strings, parses to AST, evaluates against IndexState
graph.ts      — BFS/DFS walk on wikilink graph, cycle prevention, maxNodes
watcher.ts    — chokidar-based incremental index updates
governance.ts — reads .oxori/governance.md, enforces rules on agent writes
search.ts     — vector embeddings, cosine similarity search
writer.ts     — creates/appends files with convention-compliant frontmatter
mcp.ts        — Model Context Protocol server (Phase 5)
```

---

## 19. Retrospective History & Learnings

### Phase 1 (v0.1.0) — Key Findings

**What went well:**
- Types-first discipline held — `types.ts` before any implementation
- `Result<T,E>` pattern from day one — all error paths structured
- Fixture design thorough and forward-looking (cycle-safe `linked-vault/`)
- Clu fixed the dual-package tsup shebang leak before it shipped
- Dumont's docs were production-grade at v0.1.0 (most projects defer this)
- Flynn's review caught `FrontmatterEntry` missing — the process works

**What didn't go well:**
- API mismatch: Yori's skeletons used `buildIndex(path)`, Tron built `indexVault(config)` — full test rewrite required
- tsup shebang leaked to all dist outputs initially
- `FrontmatterEntry` missing from initial `types.ts`
- `@types/micromatch` discovered mid-implementation
- 11 CLI tests were `it.todo()` at gate

**Critical action items applied in Phase 2:**
- A2: Test skeletons only after `types.ts` + `index.ts` are merged
- A7: Backlog ACs must include TypeScript function signatures

---

### Phase 2 (v0.2.0) — Key Findings

**Gate history:** 3 attempts (5 failures → 1 failure → APPROVED)

**What went well:**
- Types-first discipline respected — no API mismatch this phase
- Wave parallelism: Tron + Ram in parallel
- Ram's BFS graph walk solid on first submission
- Phase 1 CLI debt (11 `it.todo()`) cleared at Phase 2 kickoff
- Clu proactively fixed CI/release pipeline

**What didn't go well:**
- Gate blocked twice — 5 failures on first run
- graph.ts coverage submitted with omission: fix reported query.ts but not graph.ts
- `tokenize`, `parse`, `evaluate`, `walk` function exports missing from `dist/index.js`
- graph.test.ts had parameter order `walk(state, path)` but implementation was `walk(path, state)` — required test rewrite
- indexer.ts coverage at 47.15% (target 95%)

**Critical action items applied in Phase 3:**
- A1: Runtime export check mandatory in every gate checklist
- A4: Full per-file coverage table required in all fix submissions

---

### Phase 3 (v0.3.0) — Key Findings

**Gate history:** 1 attempt — APPROVED (first clean gate pass in project history)

**What went well:**
- First clean gate pass — 12/12 on attempt #1
- Phase 2 retro actions (A1, A3, A6) directly contributed
- Types-first held — no API mismatch
- Dumont's docs source-validated (used actual field names from source)
- Clu added `pnpm-lock.yaml` (Phase 1–2 CI debt cleared)
- Conventional commit discipline throughout

**What didn't go well:**
- Scope pivot (Write API → Watcher + Governance) was informal — gate checklist reduced from 22 to 12 without an amendment document
- CLI tests for watch/check remained `it.todo()` — carried to Phase 4
- semantic-release dry-run deferred for the third consecutive time

**Lesson (most important):** "The retro action items have compounding value when actually enforced. A1 (runtime export check) was written in Phase 2 retro, applied in Phase 3, and the exact failure it prevents did not occur. The ROI of retro action items is measured in failures avoided, not features delivered."

**Critical action items for Phase 4:**
- A7: Gate checklist amendment protocol when scope changes
- A8: Clean clone verification as gate criterion

---

### Phase 4 (v0.4.0) — Context

Phase 4 delivered semantic search (`search.ts`, `vectors.ts`, `semantic.ts`). Debt carried in:
- indexer.ts coverage at 47.15% (carried from Phase 2 — three phases of "will fix next phase")
- semantic-release dry-run never validated (deferred from Phase 2)
- GovernanceRule type gap (single-shape can't express tag/link rules — needs discriminated union)
- writer.ts, Vault SDK (deferred from Phase 3 scope pivot)

---

### Debt Ledger (Active)

| Item | Carried From | Phase Target | Owner |
|------|-------------|--------------|-------|
| indexer.ts coverage < 95% | Phase 2 | Phase 5 | Yori |
| semantic-release dry-run | Phase 2 | Phase 5 (MANDATORY — 4th deferral not acceptable) | Clu |
| GovernanceRule discriminated union | Phase 3 | Phase 5 | Tron + Castor |
| writer.ts implementation | Phase 3 | Phase 5 | Ram |
| Vault SDK class | Phase 3 | Phase 5 | Ram + Tron |
| watch/check CLI integration tests | Phase 3 | Phase 5 | Yori |

---

*This document is maintained by Flynn. All amendments require a commit to `.squad/way-of-working.md` with a `docs(squad):` prefix. Read it before every phase kickoff.*
