# Flynn — Phase 4 Kickoff ADR
**Date:** 2026-04-05
**By:** Flynn (Lead & Architect)
**refs:** #26 (Phase 4 gate), #45, #46, #47, #50
**Branch:** `feature/phase-4-semantic-search` (based on `feature/pre-phase4-cleanup`)

---

## Context

Phase 4 (Semantic Search) is now in progress. Branch `feature/phase-4-semantic-search` is confirmed — current HEAD is `ea0423c` (docs(scribe): capture D12 directive — commit-to-backlog linking required), identical to `feature/pre-phase4-cleanup`. The branch is clean and ready for Wave 0 deliverables to land.

Three key pieces of technical debt are carried into Phase 4 from Phase 3:
1. **GovernanceRule type gap** — flat shape cannot express required-tag, no-orphan, or max-links rules (Phase 3 Retro A1)
2. **indexer.ts coverage at 47.15%** — carried two consecutive phases (Phase 3 Retro A4)
3. **parser.ts coverage at 80.76%** — below the ≥ 95% target set at Phase 3 gate

Wave 0 addresses items 1–3 explicitly before any semantic search implementation begins.

---

## Wave 0 Scope — Gate Before Wave 1

Wave 0 must complete **in full** before any Phase 4 implementation work (Wave 1+) begins. No semantic search code, no `EmbeddingProvider` interface, no vector storage — nothing except the items listed here.

| Issue | Owner | Deliverable | Gate criterion |
|-------|-------|-------------|----------------|
| #45   | Tron  | GovernanceRule discriminated union in `src/types.ts` | Flynn code-review approval + `tsc --noEmit` clean |
| #46   | Yori  | indexer.ts coverage ≥ 95% | `vitest --coverage` report: indexer.ts ≥ 95% stmts |
| #47   | Yori  | parser.ts coverage ≥ 95% | `vitest --coverage` report: parser.ts ≥ 95% stmts |
| #50   | Dumont | Semantic search architecture doc under `docs/` | Flynn reads and approves before Wave 1 types.ts work |

**Wave 0 is complete when:** all four issues are closed and Flynn has signed off on #45 (types) and #50 (arch doc). #46 and #47 are Yori self-verified via numeric coverage output.

---

## Decision 1: GovernanceRule Discriminated Union — APPROVED

### Proposed shape (#45)

```typescript
type PathRule = {
  ruleType: "path";
  id: string;
  description?: string;
  pattern: string;
  effect: "allow" | "deny";
  appliesTo: "agents" | "humans" | "all";
};

type TagRule = {
  ruleType: "tag";
  id: string;
  description?: string;
  pattern: string;
  requiredTag: string;
  appliesTo: "agents" | "humans" | "all";
};

type LinkRule = {
  ruleType: "link";
  id: string;
  description?: string;
  pattern: string;
  minLinks?: number;
  maxLinks?: number;
  appliesTo: "agents" | "humans" | "all";
};

type GovernanceRule = PathRule | TagRule | LinkRule;
```

### Architectural assessment

**Approved.** The discriminated union on `ruleType` is the correct TypeScript pattern here. It satisfies exhaustiveness checking in switch statements, produces narrowed types in each branch, and makes the evaluator's logic explicit and auditable. The three variants map directly to the three governance concern axes: _where_ (path), _what tags_ (tag), _how connected_ (link).

**Specific approvals:**
- `ruleType` discriminant field: correct. Prefer `ruleType` over `type` to avoid shadowing the built-in `type` keyword in TypeScript type positions.
- `description?` optional on all three: correct. Required in Phase 1 original — making it optional now enables concise programmatic rules without breaking the governance markdown format.
- `appliesTo: "agents" | "humans" | "all"`: note the addition of `"humans"` vs the original `"agents" | "all"`. This is a **breaking change to the existing type**. It is **approved** because: (a) governance is not yet enforced in production (Phase 3 shipped governance.ts but it is new in v0.3.0), and (b) the `"humans"` variant is necessary for `LinkRule` and `TagRule` to be semantically meaningful at all. Architecture principle 4 remains intact — humans are never subject to governance by default, but the type system must be able to express the possibility.
- `minLinks?` / `maxLinks?` both optional: correct. A link rule with neither is a no-op; runtime validation should warn on parse. Document this in the JSDoc.

**Required before merge (#45):**
1. Update `GovernanceViolation` and `GovernanceResult` in `src/types.ts` if they reference `GovernanceRule` shape-dependently.
2. Update `governance.ts` evaluator to exhaustively switch on `ruleType` — no implicit fallthrough.
3. Verify `tsc --noEmit` clean after the discriminated union lands.
4. All existing governance tests must pass (no regressions). The `it.todo()` stubs for required-tag / no-orphan / max-links from Phase 3 may now be filled in — but only after #45 types are merged.

---

## Decision 2: Semantic Search Optionality Principle — CONFIRMED

Semantic search **MUST** be entirely opt-in. The following invariant holds throughout Phase 4:

> `oxori init`, `oxori index`, `oxori query`, `oxori walk`, `oxori graph`, `oxori check` — all MUST work without any embedding configuration, without any API key, and without any network access.

This is already stated in `docs/architecture.md` (Layer 5: "Semantic search is optional"). Phase 4 must **not** introduce any import-time dependency on an embedding library that would break the CLI or SDK if the user has no embedding provider configured.

**Implementation constraint:** `src/semantic.ts` (or equivalent) must use **lazy loading** for the embedding provider. The module is only instantiated when the user explicitly calls a semantic search function. It must never be imported at the top of `src/index.ts` unconditionally.

**Test constraint:** All non-semantic tests must continue to pass with zero changes to their setup, regardless of whether an `OPENAI_API_KEY` is present in the environment.

---

## Decision 3: EmbeddingProvider — Dependency Injection, No Global Singleton

The `EmbeddingProvider` is an interface, not a singleton. It is **always injected** at call time.

```typescript
// Approved pattern:
async function buildEmbedding(
  content: string,
  provider: EmbeddingProvider
): Promise<EmbeddingResult>

// Rejected pattern:
let _provider: EmbeddingProvider | null = null;
function setProvider(p: EmbeddingProvider): void { _provider = p; }
```

Rationale:
- Singleton `setProvider` patterns create hidden global state that breaks test isolation. Yori's coverage work for Phase 4 requires each test to inject a mock provider independently.
- DI makes the dependency visible at the type level — callers cannot forget to supply a provider.
- The Vault SDK (`createVault(config)`) will accept an optional `embeddingProvider` in its config object. If omitted, semantic search functions throw a descriptive `OxoriError` explaining how to configure a provider.

**`EmbeddingProvider` interface minimum surface:**
```typescript
interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  readonly dimensions: number;
  readonly model: string;
}
```
Tron finalizes this in `src/types.ts` as part of Wave 1. Flynn will review before Yori writes test skeletons (types-first discipline, Phase 1 retro A2).

---

## Decision 4: Wave Structure for Phase 4

### Wave 0 — Foundation (in progress, parallel)
Issues: #45, #46, #47, #50
Gate: Flynn approves #45 and #50; Yori confirms #46 and #47 numerically.

### Wave 1 — Type Contracts (blocks Wave 2)
- Tron: `src/types.ts` Phase 4 section — `EmbeddingProvider`, `EmbeddingResult`, `VectorEntry`, `SemanticSearchOptions`, `SemanticSearchResult`, `VaultConfig` extension.
- Flynn: reviews and approves types. No implementation starts until approval.

### Wave 2 — Implementation (parallel fan-out, all block Wave 3)
- Tron: `src/semantic.ts` — embed, store, retrieve with cosine similarity.
- Ram: `src/vectors.ts` — binary vector storage under `.oxori/vectors/`.
- Yori: test skeletons (after Wave 1 types locked). Fills skeletons as Wave 2 implementation lands.

### Wave 3 — Integration (after Wave 2)
- Tron: CLI `oxori search <query>` command.
- Tron: `src/index.ts` re-exports for all Phase 4 public surface (value + type exports, runtime-verified).
- Yori: CLI integration tests for `oxori search`.

### Wave 4 — Documentation and Release (after Wave 3)
- Dumont: README Phase 4 section, `docs/architecture.md` Layer 5 expansion.
- Clu: semantic-release dry-run (this is **mandatory** — deferred three times, it runs before v0.4.0 tag).
- Flynn: Phase 4 gate review.

### Wave dependencies

```
Wave 0 (parallel) → Wave 1 (types) → Wave 2 (impl+tests, parallel) → Wave 3 (integration) → Wave 4 (docs+release) → Gate
```

No Wave 1 commits until Wave 0 issues are all closed. No Wave 2 commits until Flynn approves Wave 1 types.

---

## Decision 5: Ticket-First Rule — Reminder

Every commit in Phase 4 **must** reference a GitHub issue. No exceptions.

Format:
```
feat(semantic): implement cosine similarity search

refs #XX
```
or for closures:
```
feat(semantic): add EmbeddingProvider interface to types.ts

closes #XX
```

This rule was formalized in decision D12 (Scribe: `copilot-directive-20260405.md`). The commit that created this branch references it. All Phase 4 contributors are bound by it.

If there is no issue for the work, open one first. Commits without issue refs will be flagged at gate review.

---

## Coverage Thresholds for Phase 4 Gate

| Module | Threshold |
|--------|-----------|
| semantic.ts | ≥ 90% |
| vectors.ts | ≥ 90% |
| parser.ts | ≥ 95% (carried from Wave 0 #47) |
| indexer.ts | ≥ 95% (carried from Wave 0 #46) |
| governance.ts | ≥ 95% (maintain Phase 3 level) |
| Global | ≥ 80% |

Coverage fix submissions must include a full per-file table (Phase 2 Retro A4).

---

## Summary

Phase 4 is cleared to begin. Wave 0 work is in flight. GovernanceRule discriminated union is architecturally approved pending the implementation conditions above. Semantic search will be optional, lazy-loaded, and DI-based throughout. Clu runs the semantic-release dry-run before this phase tags v0.4.0 — no further deferrals.
