# Way of Working

> **Audience:** Every team member (human or AI agent) joining any squad.  
> **Purpose:** The methodology handbook — how this kind of team works.  
> Fill in project-specific details (member names, module names, tech stack) in your project's routing table and directives. The principles here are universal.

---

## Table of Contents

1. [Team Composition & Role Boundaries](#1-team-composition--role-boundaries)
2. [Development Model](#2-development-model)
3. [Directives](#3-directives)
4. [Commit Conventions](#4-commit-conventions)
5. [Code Quality Standards](#5-code-quality-standards)
6. [Coverage Thresholds](#6-coverage-thresholds)
7. [Build System](#7-build-system)
8. [Phase Gate Process](#8-phase-gate-process)
9. [Code Review Protocol](#9-code-review-protocol)
10. [Contract-First Discipline](#10-contract-first-discipline)
11. [Test Strategy](#11-test-strategy)
12. [Documentation Standards](#12-documentation-standards)
13. [Retrospective Process](#13-retrospective-process)
14. [Ceremonies](#14-ceremonies)
15. [Routing Rules](#15-routing-rules)
16. [Known Anti-Patterns](#16-known-anti-patterns)
17. [Architectural Principles](#17-architectural-principles)
18. [Debt Ledger](#18-debt-ledger)

---

## 1. Team Composition & Role Boundaries

### Standard Roles

| Role | Responsibility | What They Own |
|------|---------------|---------------|
| **Lead / Architect** | Phase gates, API design, code review, final approval | All phase merges, all PRs, architecture decisions |
| **Core Dev** | Core domain implementation | Core logic modules defined at project start |
| **Platform Dev** | Integration and platform implementation | Integration, platform, and infrastructure modules |
| **Tester / QA** | Quality assurance, test coverage | All test files, all fixtures, coverage reports |
| **Docs / DevRel** | Documentation and developer experience | README, architecture docs, release notes |
| **DevOps** | Build, CI/CD, release pipeline | CI workflows, build config, publish automation |
| **Product Owner** | Scope, priorities, requirements | Backlog, phase scope decisions, trade-offs |
| **Scribe** | Session memory | Decision log, session logs, cross-agent context |
| **Ralph** | Work queue | Backlog monitoring, issue triage, keep-alive |

### Key Boundaries

- **The Lead does not implement features.** The Lead designs interfaces, reviews submissions, approves or blocks gates, and documents decisions. Implementation always routes to the domain owner.
- **Scribe and Ralph are automatic.** Never route work to them explicitly — they run after every substantial session.
- **Where two roles share a domain** (e.g., design vs. implementation of an integration layer), the boundary must be made explicit at kickoff. Neither acts unilaterally.
- **No role reviews their own work.** The Lead reviews all submissions. The author is never the reviewer.

---

## 2. Development Model

### Feature Branch Model

All work lives on feature branches. **Never commit directly to `main`.**

```
main (protected)
  └── feature/phase-N-<name>
        ├── commits by all team members for that phase
        └── merged to main ONLY after Lead's gate approval
```

- Each phase = one dedicated branch: `feature/phase-N-<short-name>`
- Each phase = one release (v0.1.0, v0.2.0, …)
- **No partial merges.** A phase either ships complete or it does not ship.
- **The Lead must approve all phase merges.** No exceptions.

### Backlog Management

- All backlog items live in the team's project tracker (GitHub Projects, Linear, etc.)
- Acceptance criteria **must include precise API/type contracts** — not just behaviour descriptions

  ```
  ❌  "The indexer should load vault files"
  ✅  indexVault(config: VaultConfig): Promise<Result<IndexState, AppError>>
  ```

  Vague ACs produce an API mismatch when the implementation diverges from the tester's assumptions. The result is a full test rewrite. See [§16 Anti-Pattern: Test Skeletons Against Backlog ACs](#anti-pattern-test-skeletons-against-backlog-acs).

---

## 3. Directives

Directives are team-wide rules set by the project owner. They apply to all phases from their introduction date. **Review all active directives at every phase kickoff.**

| # | Directive | What It Means |
|---|-----------|--------------|
| **D1** | No escape hatches in type system | No `any` (TS), no `# type: ignore` (Python), no unsafe casts. Enforced at tooling level — linter error, not review suggestion. |
| **D2** | Feature branch model | All work on branches. Never commit directly to `main`. |
| **D3** | Contract-first | Shared type/interface contracts reviewed and merged before any implementation begins. See [§10](#10-contract-first-discipline). |
| **D4** | Atomic commits | One logical change per commit. Meaningful messages. No "wip", no "update". |
| **D5** | Phase boundary = release boundary | No partial phases. A phase ships complete or not at all. |
| **D6** | Rejection lockout | If an artifact is rejected, the original author does **not** own the next version. A different team member does. No exceptions. |
| **D7** | Gate checklist at kickoff | The Lead writes the phase gate checklist before implementation starts. Not at review time. |
| **D8** | Doc review before each phase | All team members review documentation before phase kickoff — update stale content, capture retro items. |
| **D9** | Commit types drive version bumps | `feat:` = minor bump, `fix:` = patch bump, `BREAKING CHANGE:` in footer = major bump. The final phase commit must reflect the magnitude of changes. |

**Directives accumulate — they do not expire.** Add project-specific directives below as they are established.

---

## 4. Commit Conventions

### Format

```
<type>(<scope>): <subject>

[optional body — explain WHY, not WHAT]

[optional footer(s)]
```

### Types

| Type | When |
|------|------|
| `feat` | New feature — triggers minor version bump |
| `fix` | Bug fix — triggers patch version bump |
| `docs` | Documentation only |
| `test` | Test additions or corrections |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `chore` | Build process, dependency updates, CI config |

### Rules

- **Atomic commits** — one logical change per commit, always
- `[skip ci]` suffix on team-admin/setup commits that should not trigger CI
- No vague subjects: "wip", "update", "fixes" are rejected at review
- Breaking changes: `BREAKING CHANGE: <description>` in footer — triggers major version bump

---

## 5. Code Quality Standards

### Static Typing

- **Strict mode on.** Use the strictest available type-checking config.
- **No escape hatches.** Enforce at tooling level — make it a build failure, not a reviewer suggestion.
- **Named exports only.** No default exports.
- **Functions over classes** — except where lifecycle state explicitly justifies a class.

### Error Handling

All error paths use a structured result type, not uncaught exceptions:

```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

const ok  = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

**Consumer pattern — always handle the error case before accessing the success value:**

```typescript
const result = await doWork();
if (!result.ok) {
  handle(result.error); // error.code = machine-readable, error.action = human-readable next step
  return;
}
use(result.value); // safe
```

**Never access `.value` without first checking `.ok`.** This is the single most common Result-type misuse.

### Error Shape

Every error exposes:
- `code` — machine-readable identifier (`"ENOENT"`, `"PARSE_ERROR"`)
- `message` — human-readable description
- `action` — human-readable next step (`"Check that the file exists"`)

### Public API Types

- Use immutable collection wrappers in all public types: `ReadonlySet<T>`, `ReadonlyMap<K,V>`, `readonly T[]`
- Immutability at the type level prevents consumers from accidentally mutating internal state

### Linting

- Run linting as a gate criterion: `--max-warnings 0`
- Linting is not a suggestion. It is a gate failure.

### Inline Documentation

Every exported function requires:

```typescript
/**
 * Brief summary.
 *
 * @param config - What it is and any constraints
 * @returns What is returned and in what shape
 * @throws Never — errors returned as Result<T,E>
 */
```

---

## 6. Coverage Thresholds

Thresholds are enforced in test config **and** in CI. A gate will not pass if any threshold is unmet.

**Set thresholds per module, not just globally.** A high global threshold can mask a critical module at 0% if other modules are over-covered.

| Module Type | Suggested Minimum |
|-------------|------------------|
| Core domain logic | ≥ 95% |
| Integration / platform modules | ≥ 90% |
| Global | ≥ 80% |

### Thresholds Are a Floor, Not a Definition of Done

Coverage numbers are a minimum. They do not substitute for integration coverage at module seams. You can meet every threshold and still have the main entry point of your tool completely untested.

### Coverage Fix Submissions

Include the **full per-file table** — no selective reporting. Reporting Module A's improvement while omitting Module B (still failing) is a known failure mode. The omission is the signal that the fix is incomplete.

### Known Acceptable Gaps

Some paths cannot be meaningfully tested (e.g., live external API calls without credentials). When this applies:
- Document the gap with explicit rationale
- Track it as phase debt
- Never silently omit it from coverage reports

---

## 7. Build System

### Output Correctness

If your project builds both a library entry and a CLI entry:
- CLI entry gets the shebang (`#!/usr/bin/env node`)
- Library entry does **not**
- Build tool banner/header configs often apply globally — configure per-output explicitly

**Failure mode:** Shebang on the library entry corrupts any bundler that imports your package. It passes all tests and only surfaces in consumers.

### Lockfile Discipline

- **Commit your lockfile** (`pnpm-lock.yaml`, `package-lock.json`, `poetry.lock`, etc.)
- CI runs with `--frozen-lockfile`. Missing lockfile = every clean CI run fails at install.
- Verify at every phase kickoff that the lockfile is staged and not in `.gitignore`.

### Release Pipeline

- All required release plugins must be **explicitly declared** in your manifest — never assume transitive inclusion
- Run the release dry-run (`--dry-run`) before attempting a real release
- Three deferred dry-run validations in a row = mandatory escalation. Assign a single owner and make it a gate criterion.

### Runtime Export Check

After any change to your public API surface file, verify runtime exports:

```bash
node -e "import('./dist/index.js').then(m => console.log(Object.keys(m)))"
```

TypeScript source inspection cannot catch type-vs-value export mismatches. `export type Foo` is erased at build time. `export function foo` is not. This check is a gate criterion.

---

## 8. Phase Gate Process

The gate is the Lead's binary checklist. Every criterion must pass. There are no partial passes.

### Gate Outcomes

| Outcome | Meaning |
|---------|---------|
| **APPROVED** | Merge proceeds |
| **CONDITIONAL PASS** | Named exception documented as phase debt; merge allowed with explicit tracking |
| **BLOCKED** | Failing criteria listed; specific owners assigned to fix |

### Gate Checklist — Inherited (Every Phase)

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | Compiler: zero errors | `tsc --noEmit` → exit 0 |
| 2 | Linter: zero warnings | `eslint --max-warnings 0` → exit 0 |
| 3 | Tests: all non-pending pass | Test runner → zero failures |
| 4 | Build: clean outputs | Build succeeds; all expected output files present |
| 5 | Output format correct | Library entry has no shebang; CLI entry has shebang |
| 6 | Runtime exports verified | Import built library, enumerate keys — all public functions present |
| 7 | No type escape hatches | No `any`, no `@ts-ignore`, no unsafe casts in `src/` |
| 8 | Inline docs complete | All exports have summary, `@param`, `@returns`, `@throws` |
| 9 | README updated | Phase features documented with examples |
| 10 | Architecture doc updated | ADRs written for all major decisions made this phase |
| 11 | Release notes written | Current release notes in place |
| 12 | Coverage thresholds met | Full per-file coverage table passes all thresholds |
| 13 | Lockfile committed | `git status` shows lockfile is clean |
| 14 | Clean clone passes | `clone → install --frozen → build → test` succeeds end-to-end |

**Phase-specific criteria are added by the Lead at kickoff, not discovered at review time (D7).**

### Gate Checklist Amendment Protocol

When scope changes mid-phase (feature deferred, new feature added), the Lead writes a formal amendment:
- Which criteria are deferred (with rationale and target phase)
- Which criteria are added
- Which criteria are modified

**Never silently evaluate against a reduced subset.** Informal scope pivots without an amendment create ambiguity at gate time.

---

## 9. Code Review Protocol

### Who Reviews

The Lead reviews all PRs. Every submission passes through the Lead before merge.

### Rejection Lockout (D6)

**If an artifact is rejected, the original author may not produce the next version.**

A different team member owns the revision — not the author, not even as an advisor.

**Why:** The author of a rejected artifact has a mental model that produced the failure. Returning to the same author risks the same blind spot. A fresh reviewer, briefed on the rejection criteria, produces a more reliable revision.

**Cascade rule:** If the revision is also rejected, the revision author is now also locked out. A third team member owns the next attempt. If all eligible team members have been locked out, escalate to the project owner.

### Review Criteria

Beyond the gate checklist, reviewers verify:
- Type contracts match the locked contract file — no silent deviations
- No API design regressions from prior phases
- Public API surface is coherent — no half-exposed internals
- Inline docs are accurate, not just present
- Tests address the specification, not just the happy path

---

## 10. Contract-First Discipline (D3)

### The Sequence

```
1. Developer writes shared types/interfaces (new phase additions only)
2. Lead reviews → APPROVED or CHANGES REQUESTED
3. APPROVED → QA writes test skeletons against the locked contract
4. Implementation begins (parallel across modules)
5. QA fills in test bodies as implementations stabilise
```

**No step may be skipped or reordered.**

### What "Contract-First" Means in Practice

- The shared types file is written before any implementation module
- The public API surface file (`index.ts`, `__init__.py`, etc.) is defined **alongside** the types file — it is not an afterthought
- Test skeletons are written **against the locked contract** — never against backlog ACs
  - Backlog ACs are product requirements; they are not type contracts
  - Writing tests against vague ACs produces a test rewrite when the implementation takes a different (correct) shape

### Contract Review Checklist

When reviewing the shared types file, the Lead verifies:

| Check | What to Look For |
|-------|-----------------|
| No escape hatches | No `any`, no overly wide `object` or `unknown` where a precise type is possible |
| Correct export keyword | Type exports use `type` keyword; runtime constants use `const` |
| Named exports only | No default exports |
| Per-type documentation | Every exported type has description, usage notes, non-obvious field comments |
| Immutable public types | Public API types use `ReadonlySet`, `ReadonlyMap`, `readonly` arrays |
| No circular imports | The contract file has no imports from implementation files |

### Open Design Questions

When a developer has open design questions (e.g., "should this field be a union or a string?"), they surface them explicitly — they do not silently pick one. The Lead answers them at review time. The decision and rationale are logged in the architecture doc.

---

## 11. Test Strategy

### Ownership

QA owns all test files and all fixtures. No other team member modifies test files without QA involvement.

### Test Writing Sequence

1. Contract locked (Lead approved types + public API surface)
2. QA writes test **skeletons** (describe blocks, test cases — no assertions yet)
3. Implementation proceeds in parallel
4. QA fills in test bodies as each implementation unit stabilises

### Pending Test Discipline

Use pending tests (`it.todo()`, `@pytest.mark.skip`, etc.) for tests that cannot be written yet:
- Integration/e2e tests that need stable implementation output to assert against
- Tests for complex branching that would couple to implementation details

**Do not** write stub tests with trivially-true assertions. These couple test stubs to implementation details and require a full rewrite when the implementation diverges.

```typescript
// ✅ Correct — documents future work, zero coupling
it.todo("should reject writes to protected paths");

// ❌ Wrong — couples to internals, becomes stale
it("should reject writes to protected paths", () => {
  expect(() => write(protectedPath)).toThrow();
});
```

Pending tests are **debt items**, not permanent states. Track them with a target phase.

### Fixture Design

- Cover edge cases, not just happy paths
- Include at least one fixture per known failure mode (e.g., cycle in a graph, malformed input, a permission boundary)
- CLI test isolation: use temp directories inside the project's test output directory, not the OS-level `/tmp`

### Coverage Fix Submissions

1. Run the full coverage suite
2. Include the full per-file table — no selective reporting
3. Report exact numbers: `"graph.ts: 94.73% branch"` not `"graph.ts: above threshold"`

---

## 12. Documentation Standards

### Ownership

Docs role owns all documentation. Team members who implement features write **doc proposals** (inline comments, README section drafts). Docs role finalises.

### Files and Scope

| File | Contents | Rule |
|------|----------|------|
| `README.md` | What is it, how to install, how to use | Only these three things. No roadmap, future plans, team references. |
| `RELEASE-NOTES.md` | Current release notes | Overwrite each release OR append — pick one convention and commit to it. |
| `docs/architecture.md` | ADRs for all major design decisions | Updated each phase. ADR entries are permanent — do not delete old decisions. |
| Domain reference docs | API reference, query language guide, etc. | Written in the phase that introduces the feature. |

### Documentation Is a Gate Criterion (Criteria 9–11)

Docs are not "follow-on cleanup." If the README still shows new features as "coming soon" at gate time, that is a gate failure. Docs must be gate-ready on first submission.

**Source-validated docs pass gate.** Use actual field names, function signatures, and error codes from the implemented source — not from planning documents. Planning documents go stale; source does not.

---

## 13. Retrospective Process

Retrospectives are facilitated by the Lead after every phase.

### Format

1. **What went well** — concrete, named examples. Not vague praise.
2. **What didn't go well** — honest, no euphemisms.
3. **What we learned** — actionable insights with reasoning.
4. **Action items** — owner + priority + target phase.

### Cadence

- After every phase completion → full retrospective
- After a build failure, test failure, or reviewer rejection → abbreviated retro (see [§14 Ceremonies](#14-ceremonies))

### Action Item Tracking

Action items are written to the decision ledger. Reviewed at the next phase kickoff. Verified in the gate checklist.

**Three consecutive deferrals = mandatory escalation.** If an action item has been deferred three phases in a row, it is an ownership problem, not a priority problem. Assign a single owner and make it a gate criterion for the next phase.

### The Compounding Value of Retrospectives

Retrospective action items have compounding value when actually enforced. A checklist item written in Phase N's retro, applied in Phase N+1, prevents exactly the failure mode it was designed to prevent.

> "The ROI of retro action items is measured in failures avoided, not features delivered."

The documents are the mechanism. If they are written and not read, the retro has zero value.

---

## 14. Ceremonies

### Design Review

**Trigger:** Before any multi-developer task involving shared systems or API contracts.

**Agenda:**
1. Review requirements
2. Agree on interfaces and contracts between components
3. Identify risks and edge cases
4. Assign action items

**Attendees:** All team members whose modules are touched by the contract.

### Abbreviated Retrospective

**Trigger:** After a build failure, test failure, or reviewer rejection.

**Agenda:**
1. What happened (facts only)
2. Root cause
3. What changes
4. Action items (owner + target)

This is distinct from the full phase retrospective. It is lightweight and immediate — do not defer it.

---

## 15. Routing Rules

### Principles

1. **Domain ownership is exclusive.** One role owns each module/area. When two roles could handle a task, route to the one whose domain is primary.
2. **Eager by default.** When a task produces downstream work (implementation → tests, implementation → docs), start the downstream work in parallel, not after.
3. **Lead owns review, not implementation.** Route all code review and gate decisions to the Lead. Never back to the author.
4. **Scribe and Ralph are automatic.** They never need explicit routing.

### Routing Table Template

Fill this in for your project:

| Work Type | Route To |
|-----------|----------|
| Architecture decisions, phase gates, API design | Lead / Architect |
| Core domain modules | Core Dev |
| Integration / platform modules | Platform Dev |
| All test files, fixtures, coverage | Tester / QA |
| Documentation, README, release notes | Docs / DevRel |
| CI/CD, build config, deployment | DevOps |
| Phase priorities, scope, requirements, backlog | Product Owner |
| Code review, gate sign-off | Lead / Architect |
| Session logging, decisions merge | Scribe (automatic) |
| Work queue, backlog monitoring | Ralph (automatic) |

### Issue Label Routing

When using GitHub issues, assign `squad:<role>` labels for routing. The Lead triages any issue labelled `squad` (without a role sub-label) and assigns the correct `squad:<role>` label.

---

## 16. Known Anti-Patterns

These are documented failure modes from retrospectives. Every new team member reads this section before contributing.

---

### Anti-Pattern: Test Skeletons Against Backlog ACs

**What happened:** QA wrote test skeletons using backlog ACs as the API spec. The developer made a correct design change (different function signature) that was not reflected in the backlog. Full test rewrite required.

**Fix:** QA writes test skeletons only after the shared contract (types file + public API surface) is reviewed and merged. Backlog ACs are product requirements; they are not type contracts. See [§10 Contract-First Discipline](#10-contract-first-discipline).

---

### Anti-Pattern: Gate Criteria Discovered at Review Time

**What happened:** Gate review uncovered criteria never communicated during implementation ("README must show Phase N features"). Required last-minute work.

**Fix (D7):** Lead writes the full gate checklist at phase kickoff. Every criterion is binary-verifiable from day one. Anything discovered at review time is a process failure. See [§8 Phase Gate Process](#8-phase-gate-process).

---

### Anti-Pattern: Selective Coverage Reporting

**What happened:** A coverage fix submission showed Module A improving while omitting Module B (still failing). The gate failed again on Module B.

**Fix:** Full per-file coverage table required in every coverage fix submission. The omission is always the signal. See [§6 Coverage Thresholds](#6-coverage-thresholds).

---

### Anti-Pattern: Type-vs-Value Export Mismatch

**What happened:** A public API file was updated to export new types. TypeScript source was correct. At build time, type-only exports were erased. The built library was missing runtime exports. All source checks passed; only the runtime import check caught it.

**Fix:** Add a runtime import check to the gate checklist. Run it after every change to the public API surface file. See [§7 Build System](#7-build-system).

---

### Anti-Pattern: Deferred Dry-Run Validation

**What happened:** Release pipeline dry-run was deferred across multiple phases ("not blocking now"). When a real release was attempted, the pipeline had multiple missing plugins and failed.

**Fix:** Run the release dry-run before the first real release attempt. Make it a gate criterion. Three deferrals = single owner assigned + mandatory gate criterion next phase.

---

### Anti-Pattern: Informal Scope Pivot Without Gate Amendment

**What happened:** Phase scope changed mid-phase. The gate checklist was informally reduced without a documented amendment. Ambiguity at gate time about which criteria applied.

**Fix:** Any scope change requires a formal gate checklist amendment from the Lead. No silent subset evaluation. See [§8 Gate Checklist Amendment Protocol](#gate-checklist-amendment-protocol).

---

### Anti-Pattern: Original Author Revising Their Own Rejected Work

**What happened:** An artifact was rejected. The original author was asked to fix it. The second submission had the same blind spot as the first.

**Fix (D6):** Rejection lockout. A different team member owns the revision. See [§9 Code Review Protocol](#9-code-review-protocol).

---

### Anti-Pattern: Permanently Pending Tests

**What happened:** All CLI entry-point tests were pending stubs at gate time. Coverage thresholds passed because the CLI module was excluded. The CLI shipped entirely untested.

**Fix:** Pending tests are debt items with a target phase for completion. They are not a permanent state. Track them in the debt ledger.

---

### Anti-Pattern: Global Stateful Regex (JavaScript/TypeScript)

```typescript
// ❌ WRONG — /g flag maintains lastIndex state on the regex object
const RE = /pattern/g;
function extract(content: string) {
  const results = [];
  let m;
  while ((m = RE.exec(content)) !== null) { results.push(m[1]); }
  return results;
  // second call with same input produces different results — non-deterministic
}

// ✅ CORRECT — new instance per call
function extract(content: string) {
  const re = new RegExp(/pattern/.source, "g");
  const results = [];
  let m;
  while ((m = re.exec(content)) !== null) { results.push(m[1]); }
  return results;
}
```

---

## 17. Architectural Principles

Document these for your project. The format matters as much as the content.

### Data Storage

**Decide once, apply consistently:**
- Where is state stored? (in-memory, filesystem, database, combination)
- What is the source of truth?
- How is concurrency handled? (locks, git, CRDT, last-write-wins)

Ambiguity in the data model is the most common source of subtle bugs across phases.

### Error Architecture

**Decide once, apply consistently:**
- What type represents errors?
- What fields are required on every error? (code, message, action)
- Are errors thrown or returned? (Result type vs exceptions — pick one)

Inconsistent error handling is the second-most common source of subtle bugs across phases.

### Module Boundaries

- Define which modules may import which others at project kickoff
- Circular imports are a symptom of unclear boundaries — treat them as design failures, not implementation details
- The contract/types module must have **no imports from implementation modules** — it is the leaf of the dependency graph

### Public API Surface

Define the public API surface file (`index.ts`, `__init__.py`, etc.) alongside the contract file. It is the contract between your library and its consumers. Treat it as a first-class deliverable, not a final integration step.

---

## 18. Debt Ledger

Maintain an active debt ledger. At every phase kickoff, review it, assign items to the current phase, or explicitly defer with rationale.

| Item | Introduced | Target Phase | Owner | Notes |
|------|-----------|--------------|-------|-------|
| _(example: pending CLI integration tests)_ | Phase 1 | Phase 2 | QA | All CLI paths need it.todo() filled in |

**Three consecutive deferrals = mandatory escalation.** Assign a single owner. Make it a gate criterion.

---

*Maintained by the Lead. All amendments require a commit with a `docs(squad):` prefix. Read before every phase kickoff.*
