## Phase 3 Retrospective — Oxori v0.3.0

**Facilitated by:** Flynn
**Date:** 2026-04-04
**Attendees:** Flynn, Tron, Ram, Yori, Clu, Dumont, Castor
**Gate result:** ✅ APPROVED — first clean gate pass (12/12 on attempt #1)

---

### ✅ What Went Well

#### 1. First clean gate pass in the project's history — 12/12 on attempt #1
Phase 1 passed on attempt #1 (but with 11 untested CLI paths carried as debt). Phase 2 required 3 gate runs (5 failures → 1 failure → pass). Phase 3 passed every criterion on the first submission. This is the most concrete evidence that the retro action item discipline works — the process improved measurably across three phases.

#### 2. Phase 2 retro action items A1–A8 delivered — 7/8 applied and verified
The retro wasn't a ceremony that produced a document nobody read. Seven of eight action items from Phase 2 were directly applied and verified at gate:

| AI | Action | Applied? | Impact |
|----|--------|----------|--------|
| A1 | Runtime export check in gate | ✅ | `watch` and `checkGovernance` confirmed in dist/index.js — the exact class of failure that blocked Phase 2 twice |
| A2 | Value exports alongside type exports | ✅ | 18 exports confirmed at runtime; no type-vs-value mismatch |
| A3 | `it.todo()` for stubs, not throwError | ✅ | All 27 todos use `it.todo()` — no test rewrites from stub coupling |
| A4 | Full per-file coverage table | ✅ | Full table submitted with gate — no silent omissions |
| A5 | Ram confirms signatures from types.ts before implementation | ✅ | Implementation matched types; no parameter order mismatches |
| A6 | Gate checklist written at kickoff | ✅ | `flynn-phase3-gate.md` written in Wave 0, before any implementation |
| A7 | semantic-release dry-run | ⚠️ Deferred | Not verified — Clu responsibility pre-publish. Carried to Phase 4. |
| A8 | Backlog ACs include TS function signatures | ✅ | Contracts matched implementation |

A1 and A6 were the highest-impact items. Writing the gate checklist at kickoff (A6) gave the team a concrete target list. The runtime export check (A1) directly prevented the Phase 2 failure mode.

#### 3. Coverage numbers exceeded thresholds across all new modules
- **governance.ts: 100%** (all dimensions) — against a 90% threshold. Yori added 7 extra tests beyond the original 10 stubs, reaching 13 real assertions. This is the right approach for a safety-critical module.
- **watcher.ts: 97.43% stmts / 92.3% branch / 100% funcs** — the 2.57% uncovered is a platform-specific branch (macOS `fs.watch` emits "rename" instead of "change"). Yori documented this explicitly — the uncovered branch runs on Linux and is not a test gap.
- **Global: 84.6%** — exceeds 80% threshold. Up from 82.72% at Phase 2 close.

#### 4. Wave structure and parallel fan-out worked cleanly
Wave 0 (kickoff): Flynn wrote gate checklist + Castor refined backlog + Tron planned types + Yori designed fixtures.
Wave 1: Tron implemented watcher.ts + Ram implemented governance.ts + Yori wrote test skeletons — all in parallel after types were locked.
No wave produced a blocking dependency surprise. The types-first discipline (A2) meant Wave 1 implementation started from a locked contract, not a moving target.

#### 5. Types-first discipline held for the third consecutive phase
Tron's type contracts (`WatchEvent`, `GovernanceRule`, `VaultWatcher`, `GovernanceViolation`, `GovernanceResult`) were locked before any implementation code was written. Yori's test skeletons were written against these locked types. No API mismatch between tests and implementation in Phase 3 — the exact pattern that caused the most friction in Phase 1 and Phase 2.

#### 6. Test skeleton quality improved — 10/10 watcher stubs filled, governance stubs correctly triaged
Yori filled all 10 watcher stubs to real assertions (100% conversion). For governance, 6/10 original stubs were filled, 4 were correctly left as `it.todo()` with explicit justifications documenting that the underlying rule types don't exist in the implementation. This is the right call — tests shouldn't fake coverage for unimplemented features.

#### 7. Dumont's documentation was accurate on first submission
README, architecture.md, and RELEASES.md all used correct field names (`filepath` not `path`, `"add"/"change"/"unlink"` not `"create"/"modify"/"delete"`) and correct API signatures. In Phase 2, README was still showing Phase 2 features as "🔜 future work" at first gate. In Phase 3, docs were gate-ready on first attempt.

#### 8. Conventional commit discipline and atomic commits maintained
Every Phase 3 commit (`02748e1`, `437f5e8`, `ac3644c`, `9a832f9`, `d0275f9`) follows the `feat/test/docs/chore` convention with correct scoping. The commit history is clean and trustworthy for release notes.

---

### ❌ What Was Harder Than Expected

#### 1. GovernanceRule type gap — 4 rule types not implementable in the current architecture
The `GovernanceRule` type was defined in Phase 1's `types.ts` with 5 fields: `id`, `description`, `pattern`, `effect`, `appliesTo`. The implementation in `src/governance.ts` supports exactly one rule evaluation mode: glob-based path pattern matching with deny/allow effects. Four governance features from the test skeletons and backlog are not implementable against this type shape:

- **required-tag**: needs a `requiredTags: string[]` field and access to `IndexState.tags` — not just filepath matching
- **no-orphan**: needs link-count evaluation via `IndexState.links` — not a glob pattern
- **max-links**: needs a `maxLinks: number` field and link counting — not a path pattern
- **severity:warning**: the type supports it (`GovernanceViolation.severity: "error" | "warning"`) but `checkGovernance` only ever emits `"error"` — there's no rule-level severity field to trigger warning-only violations

**Root cause:** `GovernanceRule` was designed as a single shape (pattern + effect) without anticipating that different rule types need fundamentally different evaluation inputs. A `required-tag` rule doesn't match against filepaths — it inspects file metadata. The type needed to be a discriminated union from the start: `GovernanceRule = PathRule | TagRule | LinkRule`.

**Lesson:** When a type is designed to support "future rule types," the future shapes should be sketched as a discriminated union during type design — not deferred to "Phase N+1." The single-shape approach created a false sense of completeness.

#### 2. WatchEvent field name discrepancy discovered during implementation
Yori's original test skeletons included stubs like `'type field on WatchEvent is correct for create/modify/delete'` — using assumed event names (`create/modify/delete`) rather than the actual field values (`add/change/unlink`). The `WatchEvent.filepath` field was also documented inconsistently as `path` in early planning.

Tron's implementation used the correct field names from `types.ts` (`filepath`, `add/change/unlink`), and Yori corrected the test stubs during fill-in. No test rewrite was needed because the stubs were `it.todo()` (per Retro A3), but the discrepancy reveals a gap:

**Root cause:** The test skeletons were written against the *conceptual behavior* ("a file is created") rather than the *type contract* (`WatchEvent.type === "add"`). Even though A2 was followed (skeletons after types locked), the stub *descriptions* used natural-language assumptions instead of type-level vocabulary.

**Lesson:** Test stub descriptions should use exact type field values. `'emits WatchEvent with type "add" when file created'` is better than `'emits change event when a markdown file is created'`. The stub description is a micro-contract.

#### 3. pnpm-lock.yaml missing at Phase 3 start — CI infrastructure debt
The `pnpm-lock.yaml` was not committed during Phase 1 or Phase 2. It was added as commit `336864b` at Phase 3 start. This means CI would have failed on a clean clone before this fix — `pnpm install --frozen-lockfile` requires the lockfile to exist.

**Root cause:** The lockfile was in `.gitignore` or never staged during initial project setup. Clu fixed CI infrastructure in Phase 2 (release.yml, Node 24, semantic-release), but the lockfile gap was not caught because local `pnpm install` generates it on the fly.

**Lesson:** The gate checklist should include a "clean clone + install" verification step. If CI can't reproduce the build from a fresh clone, the lockfile is either missing or stale.

#### 4. Scope pivot from Write API to Watcher + Governance
The original Phase 3 backlog defined "Read/Write API and Governance" as the scope — with `src/writer.ts` (create/append), governance, and a Vault SDK class. The actual Phase 3 delivery was **Watcher + Governance** — `src/watcher.ts` and `src/governance.ts`, with no writer or Vault SDK. The 22-criterion gate checklist written at kickoff included criteria for writer.ts, Vault class, and SDK tests that were never evaluated.

The scope change was the right call — watcher + governance are foundational for Phase 4/5 MCP integration. But the gate checklist was effectively reduced from 22 criteria to 12 without a formal rescoping decision. The unused 10 criteria (writer, Vault SDK, integration tests, indexer coverage) should be explicitly carried to Phase 4.

---

### 💡 Key Learnings

#### 1. Retro action items have compounding value when actually enforced
A1 (runtime export check) was written in the Phase 2 retro. It was applied in Phase 3. The exact failure it prevents (type-vs-value export mismatch) did not occur. This is the invisible win — the failure that didn't happen because the process worked. The ROI of retro action items is measured in failures avoided, not features delivered.

#### 2. Gate checklist at kickoff is now a proven pattern — three phases validate it
Phase 1: no formal kickoff checklist (gate criteria discovered at review). Phase 2: checklist written at kickoff, but 5 failures still occurred (implementation didn't check against it). Phase 3: checklist at kickoff + retro discipline = first-attempt pass. The checklist isn't sufficient alone — the team has to actually verify against it before submitting for gate. Phase 3 proved both sides.

#### 3. `it.todo()` discipline prevents test-rewrite cascades
Phase 1's `expect(toThrowError)` stubs required rewriting when implementation differed. Phase 2's graph.test.ts had parameter order baked into stubs. Phase 3's `it.todo()` stubs were either filled correctly or left as documented future work — no rewrite cycle. The discipline from Retro A3 is now validated across one full phase.

#### 4. Coverage thresholds alone don't guarantee architectural completeness
governance.ts hit 100% coverage, but that 100% only covers the glob-based path pattern rule type. Four conceptual rule types (required-tag, no-orphan, max-links, severity:warning) are not testable — not because tests are missing, but because the type system doesn't support them. Coverage measures what's implemented, not what's designed.

#### 5. A scope pivot should update the gate checklist formally
The Phase 3 gate checklist had 22 criteria. 12 were evaluated. 10 were implicitly dropped when scope changed from Write API to Watcher + Governance. Future scope changes should produce a formal "gate checklist amendment" documenting which criteria are deferred, added, or modified — not just silently evaluated against a subset.

#### 6. Platform-specific behavior (macOS fs.watch) should be documented, not chased
Yori correctly documented the watcher.ts branch coverage gap (line 28: `type = "change"` path unreachable on macOS because `fs.watch` emits `"rename"` for all operations). Rather than adding platform-detection hacks to reach 100%, the decision was to document and move on. This is the right call for CI that runs on a single platform.

---

### 🔧 Action Items for Phase 4

| # | Action | Owner | Priority | Notes |
|---|--------|-------|----------|-------|
| A1 | GovernanceRule type extension — refine as discriminated union (`PathRule \| TagRule \| LinkRule`) or add `ruleType` discriminator field + type-specific fields for required-tag, no-orphan, max-links. Create Phase 4 backlog issue with exact type shapes. | Castor + Tron | **P1** | Current single-shape `GovernanceRule` can't express tag/link rules. This is a types-first design task for Wave 0. |
| A2 | WatchEvent canonical field check — at Wave 0, Tron must verify EVERY type field name against existing `types.ts` before writing test stub descriptions. Stub descriptions must use exact field values (`"add"`, not `"create"`; `filepath`, not `path`). | Tron + Yori | **P1** | A single naming discrepancy in stub descriptions creates confusion even if code is correct. |
| A3 | Carry deferred gate criteria from Phase 3's 22-criterion checklist — writer.ts, Vault SDK class, integration tests, indexer coverage improvement — as explicit Phase 4 backlog items with original criterion numbers for traceability | Castor | **P1** | 10 criteria were implicitly dropped during scope pivot. They need formal tracking. |
| A4 | indexer.ts coverage: 47.15% → 95%+ — this has been carried across two phases. Phase 4 must address it or formally accept the debt with documented rationale. | Yori | **P1** | Carried from Phase 2. Three phases of "will fix next phase" is a pattern, not a plan. |
| A5 | parser.ts coverage: 80.76% → 95%+ — below target since Phase 1. Same treatment as A4. | Yori | **P2** | Less critical than indexer but still below stated target. |
| A6 | semantic-release dry-run (Phase 2 Retro A7, still deferred) — must be validated before v0.3.0 is actually published to npm | Clu | **P1** | Deferred from Phase 2 → Phase 3 → now Phase 4. Three deferrals = mandatory next phase. |
| A7 | Gate checklist amendment protocol — when scope changes mid-phase, produce a formal "gate checklist v2" documenting which criteria are deferred, added, or modified. Don't silently evaluate against a subset. | Flynn | **P2** | Prevents the 22-to-12 implicit reduction pattern. |
| A8 | Clean clone verification — add `git clone → pnpm install --frozen-lockfile → pnpm build → pnpm test` as a gate criterion to catch missing lockfiles, uncommitted dependencies, or environment-specific assumptions | Clu | **P2** | pnpm-lock.yaml gap would have been caught by this. |

---

### 📊 Gate Performance Analysis

#### What made Phase 3 pass on attempt #1 vs Phase 2's two failures?

Three specific factors:

1. **A6 (gate checklist at kickoff) + team actually checking against it.** Phase 2 had a checklist too, but implementors submitted without verifying all criteria. Phase 3's narrower scope (12 criteria vs 22) made it feasible for each agent to self-verify before submission. Fewer criteria = less surface area for oversight.

2. **A1 (runtime export check) eliminated the most common Phase 2 failure.** The type-vs-value export mismatch caused 2 of 5 Phase 2 first-gate failures. With the runtime check baked into the gate criteria, Tron verified exports before submission.

3. **A3 (it.todo() discipline) eliminated test-rewrite friction.** Phase 2's test stubs had implementation assumptions baked in (parameter order, throw semantics). Phase 3's `it.todo()` stubs were either filled from the locked type contract or left as documented future work. No rewrite cycle consumed implementation time.

#### Gate criteria maturity

| Category | Status | Notes |
|----------|--------|-------|
| TypeScript compilation, linting, build | ✅ Well-established | Never failed in any phase |
| Test suite (non-todo pass) | ✅ Well-established | Never failed |
| Runtime export check | ✅ Proven (Phase 3) | Prevented Phase 2's #1 failure mode |
| Coverage thresholds | ⚠️ Needs vigilance | indexer.ts at 47.15% carried 2 phases; parser.ts at 80.76% |
| README/docs updated | ⚠️ Needs vigilance | Failed in Phase 2, passed in Phase 3 — one success doesn't establish the pattern |
| CLI integration tests | ⚠️ Needs vigilance | Phase 3 used it.todo() stubs for watch/check CLI — real tests needed in Phase 4 |
| semantic-release verification | ❌ Never verified | Deferred three consecutive phases |

---

### 🤝 Team Dynamics

#### Coordination patterns that worked well
- **Tron + Ram parallel implementation in Wave 1** — watcher and governance developed independently against the same locked type contract. No merge conflicts, no API coordination needed. The types-first discipline is the coordination mechanism.
- **Yori's triage of governance stubs** — rather than forcing coverage on unimplemented features, Yori correctly classified 4 stubs as `it.todo()` with explanations. This is product judgment in test engineering, not just code coverage optimization.
- **Dumont's source-validated documentation** — docs used actual field names from source files, not assumptions from planning documents. This is the first phase where docs were gate-ready on first submission.

#### Handoff frictions
- **Scope pivot was informal** — the shift from Write API to Watcher + Governance happened without a formal decision document. The gate checklist went from 22 to 12 criteria without an amendment. Future pivots need a `decisions/inbox` entry.
- **Clu's A7 (semantic-release dry-run) deferred for three consecutive phases** — this is not a handoff friction per se, but a dependency that keeps being punted. If no one owns the timeline, it won't happen. Phase 4 must either do it or remove it from the action items.

---

### Phase 4 Readiness

**Status: ✅ Ready to begin**

Phase 3 delivered watcher and governance — the two modules needed for real-time vault monitoring and agent write policy. 153 tests passing, 84.6% global coverage, runtime exports confirmed, docs complete.

**Debt carried into Phase 4:**
- indexer.ts at 47.15% (carried since Phase 2)
- parser.ts at 80.76% (below 95% target since Phase 1)
- semantic-release dry-run never validated (A7 deferred 3×)
- 4 governance rule types unimplemented (required-tag, no-orphan, max-links, severity:warning)
- 10 gate criteria from Phase 3's 22-criterion checklist deferred (writer.ts, Vault SDK, etc.)
- 6 CLI it.todo() stubs for watch/check commands

**Phase 4 scope (from now.md):**
1. Governance rule extensions (required-tag, no-orphan, max-links, severity:warning)
2. Coverage improvements (indexer.ts → 95%+, parser.ts → 95%+)
3. CLI integration (wire watch/check commands, fill 6 it.todo stubs)
4. MCP planning and preparation

Good sprint, team. Three phases in, and the process is measurably better than where we started. The first clean gate pass isn't luck — it's the compound interest on retro action items that were actually enforced. Phase 4 is where governance gets real (discriminated unions, tag/link rules) and the remaining debt gets paid.

— Flynn
