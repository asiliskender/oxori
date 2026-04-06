# Squad — Way of Working (Team-Agnostic Handbook)

> **Audience:** Every team member (human or AI agent) on any project.
> **Authority:** The Lead & Architect role on your team.
> **Purpose:** A reusable methodology handbook. Fill in project-specific names, modules, and tech stack in a companion document.

This handbook synthesises the principles, processes, and discipline that make a multi-role software team function reliably. It is derived from retrospective findings, process failures, and directorial decisions accumulated across multiple project phases. Read it in full before contributing to any phase.

---

## Table of Contents

1. Team Composition & Role Boundaries
2. Development Model
3. Phase Roadmap
4. Directives
5. Commit Conventions
6. Code Quality Standards
7. Coverage Thresholds
8. Build System
9. Phase Gate Process
10. Code Review Protocol
11. Contract-First Discipline
12. Test Strategy
13. Documentation Standards
14. Retrospective Process
15. Ceremonies
16. Routing Rules
17. Known Gotchas
18. Architectural Principles
19. Anti-Patterns & Retrospective Learnings

---

## 1. Team Composition & Role Boundaries

A typical squad structure. Adapt role names, counts, and domain ownership to your project.

| Role | Responsibilities | Owns |
|------|-----------------|------|
| **Lead / Architect** | Phase gates, API design, code review, final approval on every phase merge | Architecture decisions, gate outcomes |
| **Core Dev** | Core domain modules (parsing, evaluation, business logic) | Domain module files |
| **Platform Dev** | Integration, infrastructure, and platform modules | Platform/integration files |
| **Tester / QA** | All test files, fixtures, coverage | Test suite, coverage reporting |
| **Docs / DevRel** | Documentation, README, release notes | `docs/`, `README.md`, `CHANGELOG.md` |
| **DevOps** | CI/CD pipelines, build config, deployment, package publishing | Pipeline config, build tooling |
| **Product Owner** | Phase priorities, scope, requirements, backlog | Backlog, acceptance criteria |
| **AI Agent Builder** *(optional)* | Agent integration patterns, automation tooling | Agent configuration, tooling scripts |
| **Scribe** *(automatic)* | Session logging, decision capture | Log files, decision ledger |
| **Work Monitor** *(automatic)* | Backlog and queue monitoring | Status reporting |

### Key Boundaries

- **The Lead does not implement features.** The Lead designs interfaces, reviews submissions, approves or blocks gates, and documents decisions. Implementation is always routed to the correct domain owner.
- **Integration roles collaborate on shared domains.** When two roles intersect on a shared system, each role's boundary must be explicit — neither acts unilaterally.
- **Automatic roles (Scribe, Monitor) are never explicitly routed.** They run in the background after every substantial session. Do not assign tasks to them directly.

---

## 2. Development Model

### Feature Branch Model

All work lives on feature branches. **Never commit directly to `main`.**

- Each phase gets one dedicated feature branch: `feature/phase-N-<name>`
- Each phase = one release
- No partial merges — a phase either ships complete or it does not ship
- The Lead must approve all phase merges — no merge without sign-off

### Branch Lifecycle

```
main (protected)
  └── feature/phase-N-<name>
        ├── commits by all roles for that phase
        └── merged to main ONLY after Lead's gate approval
```

### Backlog Management

- A project management tool (GitHub Projects, Linear, Jira, etc.) manages the backlog
- Backlog acceptance criteria **must include precise API/type contracts** — not just behaviour descriptions
  - Example: `indexVault(config: VaultConfig): Promise<Result<IndexState, AppError>>`
  - Why: Writing tests against vague backlog ACs produces an API mismatch when the implementation uses a different contract. This requires a full test rewrite. See §19 Anti-Pattern: Test Skeletons Against Backlog ACs.

---

## 3. Phase Roadmap

Each team defines their own phase breakdown. The key constraint:

| Rule | Detail |
|------|--------|
| Each phase = one release | v0.1.0, v0.2.0, etc. |
| Each phase = one feature branch | Isolated, reviewable |
| Each phase = one gate review | Binary pass/fail, owned by the Lead |

**Write the phase roadmap at project kickoff.** Phases that exist only in informal understanding will be scoped inconsistently. Documented phases with named scope boundaries are the only kind that survive contact with implementation.

---

## 4. Directives

Directives are team-wide rules set by the Lead or project owner. They apply to all phases from their introduction date. Review all active directives at every phase kickoff.

**Adapt these to your project and tech stack:**

| # | Directive | Principle |
|---|-----------|-----------|
| **D1** | No escape hatches in the type system | Enforce at tooling level — linter error, not review suggestion. (e.g., no `any` in TypeScript, no `# type: ignore` in Python.) Use narrowed, precise types. |
| **D2** | Feature branch model | All work on branches. Never commit directly to `main`. |
| **D3** | Contract-first | Shared type/interface contracts reviewed and merged before any implementation begins. |
| **D4** | Atomic commits | One logical change per commit. Meaningful messages. No "wip", no "update". |
| **D5** | Phase boundary = release boundary | No partial phases. A phase ships complete or not at all. |
| **D6** | Different reviewer for revisions after rejection | If an artifact is rejected, the original author does NOT own the next version. A different person does. No exceptions. |
| **D7** | Gate checklist written at kickoff | The Lead writes the phase gate checklist before implementation starts. Not at review time. |
| **D8** | Documentation review before each phase | All team members review docs before each phase kickoff — update stale content, capture retro items, remove outdated references. |
| **D9** | Commit types drive version bumps | The final commit on a phase branch must use the type that reflects the magnitude of changes. `feat:` = minor, `fix:` = patch, `BREAKING CHANGE` in footer = major. |

**Add project-specific directives as they are established.** Directives accumulate — they do not expire.

---

## 5. Commit Conventions

### Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
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
- `[skip ci]` suffix on team-admin/backlog/setup commits that should not trigger CI
- No vague subjects: "wip", "update", "fixes" are rejected at review
- Breaking changes: add `BREAKING CHANGE: <description>` in footer — this triggers a major version bump

### Examples (good)

```
feat(query): add evaluate() with FilterNode, OperatorNode, GroupNode support

Implements the query evaluator against the locked QueryAST contract.
Handles all FilterNode fields and OperatorNode modes (AND/OR/NOT).
```

```
fix(build): configure per-entry banner — CLI shebang only

Default banner config applies globally. Split entries so only
the CLI entry receives the shebang. Library entries must not.
```

---

## 6. Code Quality Standards

### Static Typing

- **Strict mode** — configure the strictest available type checking for your language
- **No escape hatches** — `any` in TypeScript, `# type: ignore` in Python, unchecked casts — none of these are acceptable. Enforce at tooling level.
- **Named exports only** — no default exports (avoids ambiguity in large codebases)
- **Functions over classes** — except when lifecycle state explicitly justifies a class

### Error Handling

All error paths use a structured result type, not exceptions. Adapt this pattern to your language:

```typescript
// TypeScript example
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

function ok<T>(value: T): Result<T, never> { return { ok: true, value }; }
function err<E>(error: E): Result<never, E> { return { ok: false, error }; }
```

**Consumer pattern — always check the error case before accessing the success value:**

```typescript
const result = await doWork();
if (!result.ok) {
  handleError(result.error); // error has code + human-readable action
  return;
}
doSomethingWith(result.value); // safe
```

**Never access the success value without first handling the error case.** This is the single most common misuse of a Result type.

### Error Shape

Every error surface exposes:
- `code` — machine-readable identifier (e.g., `"ENOENT"`, `"PARSE_ERROR"`)
- `message` — human-readable description
- `action` — human-readable next step (e.g., "Check that the file exists and is readable")

### Public API Types

- Use immutable collection types in all public API types (`ReadonlySet<T>`, `ReadonlyMap<K,V>`, `readonly T[]`, frozen dataclasses, etc.)
- Immutability at the type level prevents consumers from accidentally mutating internal state

### Linting

- Run linting as a build-time gate — zero warnings allowed (e.g., `--max-warnings 0`)
- Linting is not a suggestion. It is a gate criterion.

### Inline Documentation

Every exported function requires:
- Summary line
- `@param` for every parameter
- `@returns` describing the return value
- `@throws` if the function can throw (rare if you use Result types)
- Inline comments on non-obvious type fields

---

## 7. Coverage Thresholds

Thresholds are enforced in test config and CI. A gate will not pass if any threshold is unmet.

**Set thresholds per module, not just globally.** A high global threshold can mask a critical module at 0% coverage if other modules are well-covered.

| Module Type | Suggested Minimum |
|-------------|------------------|
| Core domain logic (parsing, evaluation, indexing) | ≥ 95% |
| Integration/platform modules | ≥ 90% |
| Global | ≥ 80% |

### Important: Thresholds Are a Floor

Coverage numbers are a minimum, not a definition of "done". They do not substitute for integration test coverage at module seams. You can have 80%+ coverage with zero tests on the entry point of your tool.

### Coverage Fix Submissions

When submitting a coverage fix, include a **full per-file coverage table** — no selective reporting. Reporting one module's improvement while omitting another that is still failing is a known failure mode. The silence is the signal.

### Known Acceptable Coverage Gaps

Some paths cannot be meaningfully tested (e.g., live external API calls without credentials). When this applies:
- Document the gap explicitly with rationale
- Track it as phase debt
- Do not silently omit from coverage reports

---

## 8. Build System

### Dual-Package Builds (Library + CLI)

If your project builds both a library entry and a CLI entry from the same source:

- The CLI entry gets the shebang (`#!/usr/bin/env node` or equivalent)
- The library entry does NOT
- Build tool defaults often apply banners/headers globally — configure per-entry explicitly

**Failure mode:** If the shebang lands on the library entry, any bundler importing your library gets a corrupt first line. This is a subtle bug that passes all tests but breaks consumers.

### Lockfile Discipline

- **Commit your lockfile** (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `poetry.lock`, etc.)
- CI runs with `--frozen-lockfile` (or equivalent). If the lockfile is missing from the repo, every clean CI run fails at install.

### Release Pipeline

- All required release plugins must be **explicitly declared** in your manifest — do not assume transitive inclusion
- Validate the release pipeline with a dry-run (`--dry-run` flag, if available) **before attempting a real release**
- Deferring dry-run validation across multiple phases is a debt item with compounding risk — eventually the pipeline breaks on real release night

### Gate Build Criteria

```bash
# Verify compilation (TypeScript example)
tsc --noEmit             # zero errors

# Verify runtime exports (not just type exports)
node -e "import('./dist/index.js').then(m => console.log(Object.keys(m)))"
# This catches type-vs-value export mismatches that TypeScript cannot detect
```

The runtime import check is mandatory. Type-only exports are erased at build time; runtime exports are not. Source inspection cannot distinguish these at gate time. Adapt the equivalent check to your language/build system.

---

## 9. Phase Gate Process

The gate is the Lead's binary checklist. Every criterion must pass. There are no partial passes.

### Gate Outcomes

| Outcome | Meaning |
|---------|---------|
| **APPROVED** | Merge proceeds immediately |
| **CONDITIONAL PASS** | Named exception documented as phase N debt item; merge allowed with explicit tracking |
| **BLOCKED** | Specific failing criteria listed, specific owners assigned to fix |

### Gate Checklist (Inherited — Every Phase)

These criteria apply to every phase gate. Phase-specific criteria are written by the Lead at kickoff.

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | Compiler: zero errors | Run compiler in no-emit mode → exit 0 |
| 2 | Linter: zero errors | Run linter with max-warnings 0 → exit 0 |
| 3 | Tests: all non-todo pass | Run test suite → zero failures (todo/skip are not failures) |
| 4 | Build: clean outputs | Build succeeds, all expected output files present |
| 5 | Output format correct | Library entry has no shebang; CLI entry has shebang (if applicable) |
| 6 | Runtime exports verified | Import the built library, enumerate exported keys — all public functions present |
| 7 | No type escape hatches | No `any`, no `// @ts-ignore`, no unchecked casts in source |
| 8 | Inline docs complete | All exported functions have summary, @param, @returns, @throws |
| 9 | README updated | Phase features documented with usage examples |
| 10 | Architecture doc updated | ADRs for all major design decisions made in this phase |
| 11 | Release notes written | Current release notes in place (owned by the docs role) |
| 12 | Coverage thresholds met | Run coverage → all per-module and global thresholds pass |
| 13 | Lockfile committed | Lockfile is not modified/untracked in `git status` |
| 14 | Clean clone passes | `git clone → install --frozen → build → test` succeeds end-to-end |

### Gate Checklist Written at Kickoff (D7)

The Lead writes the phase-specific criteria **before any implementation begins**. This gives every team member a concrete, binary-verifiable target list from day one. Gate criteria discovered at review time are a process failure, not an unavoidable surprise.

**Evidence:** The first clean gate pass in a project's history typically correlates with the first phase where the checklist was written at kickoff, not at review time.

### Gate Checklist Amendment Protocol

When scope changes mid-phase (e.g., a feature is pivoted or deferred), the Lead must produce a formal amendment documenting:
- Which criteria are deferred (with rationale and target phase)
- Which criteria are added
- Which criteria are modified

Do not silently evaluate against a reduced subset without an amendment on record.

---

## 10. Code Review Protocol

### Who Reviews

The Lead reviews all PRs. Every submission passes through the Lead before merge.

### Reviewer Rejection Lockout (D6)

**If an artifact is REJECTED, the original author may not produce the next version.**

A different team member must own the revision — not the author, not even as an advisor.

**Why this rule exists:** The author of a rejected artifact has a mental model that produced the failure. Returning to the same author for the fix risks the same blind spot. A fresh reviewer, briefed on the rejection criteria, produces a more reliable revision.

**Canonical example:** Developer A submits a types file → Lead rejects (missing required named export) → Developer B does the revision (not Developer A). This introduces a second perspective before the fix is merged.

### Review Criteria

Reviewers check (in addition to gate criteria):
- Type/interface contracts match the locked contract file
- No API design regressions from prior phases
- Public API surface is coherent (no half-exposed internals)
- Inline docs are accurate (not just present)
- Test coverage addresses the specification, not just the happy path

---

## 11. Contract-First Discipline (D3)

### The Sequence

```
1. Developer writes shared types/interfaces (new phase additions only)
2. Lead reviews → APPROVED or CHANGES REQUESTED
3. If APPROVED: QA writes test skeletons against locked contract
4. Implementation begins (in parallel across modules)
5. QA fills in test bodies as implementations land
```

**No step may be skipped or reordered.**

### What "Contract-First" Means in Practice

- The shared type/interface file is written before any implementation module
- The public API surface (`index.ts`, `__init__.py`, etc.) is defined **alongside** the contract file — it is not an afterthought
- Test skeletons are written **against the locked contract** — never against backlog acceptance criteria
  - Backlog ACs are product requirements; they do not substitute for precise type contracts
  - Writing tests against vague ACs produces an API mismatch when the implementation uses a different contract. This requires a full test rewrite.

### Lead's Contract Review Checklist

When reviewing the shared contract file, the Lead verifies:

| Check | Description |
|-------|-------------|
| No escape hatches | No `any`, no `object`, no `unknown` where a precise type is possible |
| Export keyword | All type exports use the correct export keyword for your language |
| Named exports only | No default exports |
| Per-type documentation | Every exported type has description, usage notes, and non-obvious field comments |
| Immutable public types | Public API types use immutable collection wrappers |
| No circular imports | The contract file has no imports from implementation files |

### Open Design Questions

When a developer has open design questions on the contract, they surface them explicitly for the Lead to answer at review time — not silently pick one. Document the decision and rationale in the architecture log.

---

## 12. Test Strategy

### Ownership

The QA role owns all test files and all fixtures. No other team member modifies test files without QA involvement.

### Test Writing Sequence

1. Contract locked (Lead approved shared types)
2. QA writes test **skeletons** (describe blocks, test cases, no assertions yet)
3. Implementation proceeds
4. QA fills in test bodies as each implementation unit stabilises

### Pending Test Discipline

Use pending tests (`it.todo()`, `@pytest.mark.skip`, etc.) for any test that cannot be fully written yet:
- Integration/e2e tests that need exact output from a stable implementation
- Tests for complex branching that would couple to implementation details

**Do NOT** write stub tests that make trivially-true assertions (e.g., `expect(() => fn()).toThrow()` without specifying the error). These couple test stubs to implementation details and require a full rewrite when the implementation diverges.

```typescript
// ✅ Correct — documents future work, no coupling
it.todo("should reject writes to governance-protected paths");

// ❌ Wrong — couples to implementation, requires rewrite
it("should reject writes to governance-protected paths", () => {
  expect(() => writeFile(protectedPath, content)).toThrow();
});
```

### Fixture Design

- Fixtures should cover edge cases, not just happy paths
- Include at least one fixture that tests a failure mode your architecture must handle (e.g., a cycle in a graph, a malformed input, a permission boundary)
- CLI test isolation: use temp directories inside the test output directory, not the OS temp directory

### Coverage Strategy

When submitting a coverage fix:
1. Run the coverage suite
2. Include the **full per-file table** in your submission — no selective reporting
3. Report exact numbers: "graph.ts: 94.73% branch" not "graph.ts: above threshold"

Selective coverage reporting (showing the improved file, omitting the still-failing file) is a known failure mode. The omission is always the signal that the fix is incomplete.

---

## 13. Documentation Standards

### Ownership

The Docs role owns all documentation. Team members who implement features write **doc proposals** (inline comments, README section drafts). The Docs role finalises.

### Files and Scope

| File | Contents | Rules |
|------|----------|-------|
| `README.md` | What is it, how to install, how to use | Only these three things. No roadmap, future plans, team references |
| `RELEASE-NOTES.md` or `CHANGELOG.md` | Current release notes | Overwrite with each release OR append — pick one convention and commit to it |
| `docs/architecture.md` | ADRs for all major design decisions | Updated each phase. ADR entries are permanent — do not delete old decisions |
| Domain-specific reference docs | API reference, query language guide, etc. | Written in the phase that introduces the feature |

### Inline Documentation

All public exports require a documentation block. Minimum:

```
Summary line

@param name - description
@returns description
@throws description (or "Never — errors are returned as Result<T,E>")
```

### Documentation Is a Gate Criterion

Docs are not "follow-on cleanup." If a phase's README still shows new features as "coming soon" at gate time, that is a gate failure. Docs must be gate-ready on first submission.

**Lesson from practice:** Docs pass gate on the first attempt when the author uses actual field names from the implemented source — not planning document assumptions. Source-validated docs are the only kind that survive gate review.

---

## 14. Retrospective Process

Retrospectives are facilitated by the Lead after every phase. They follow a strict format.

### Format

1. **What went well** — concrete, named examples (not vague praise)
2. **What didn't go well** — honest, no euphemisms
3. **What we learned** — actionable insights with reasoning
4. **Action items** — owner + priority + phase target

### Cadence

- After every phase completion (full retrospective)
- After a build failure / test failure / reviewer rejection (abbreviated retrospective via ceremony)

### Action Item Tracking

Action items are written to the team's decision ledger. They are reviewed at the **next** phase kickoff and verified in the gate checklist. Deferred items carry their original ID across phases.

**Three consecutive deferrals = mandatory escalation.** If an action item has been deferred at three consecutive phase kickoffs, it is no longer a priority question — it is an ownership question. Assign a single owner and make it a gate criterion.

### Retrospective Value (Compound Interest)

Retrospective action items have **compounding value when actually enforced**. A gate checklist item written in one phase's retro, applied in the next phase, prevents exactly the failure mode it was designed to prevent.

> "The ROI of retro action items is measured in failures avoided, not features delivered."

The retro is not a ceremony that produces documents nobody reads. The documents are the mechanism.

---

## 15. Ceremonies

### Design Review

**Trigger:** Before any multi-role task involving shared systems or API contracts.

**Format:**
1. Review requirements
2. Agree on interfaces and contracts between components
3. Identify risks and edge cases
4. Assign action items

**Who attends:** All team members whose modules are touched by the contract.

### Abbreviated Retrospective

**Trigger:** After a build failure, test failure, or reviewer rejection.

**Format:**
1. What happened (facts only)
2. Root cause
3. What changes
4. Action items (owner + target)

This abbreviated retro is distinct from the full phase retrospective. It is lightweight and immediate — do not defer it.

---

## 16. Routing Rules

### How to Define Routing

Each project defines its own routing table mapping work types to roles. The principles that make routing effective:

1. **Domain ownership is exclusive** — one role owns each module/area. When two people could handle a task, pick the one whose domain is primary.
2. **Eager by default** — when a task produces downstream work (e.g., implementation produces test surface), start the downstream work in parallel, not after.
3. **The Lead owns review, not implementation** — route all code review and gate decisions to the Lead, not back to the author.
4. **Automatic roles are never explicitly routed** — Scribe and Monitor roles run after every substantial session without needing to be assigned.

### Template Routing Table

Populate this with your team's actual role names:

| Work Type | Role |
|-----------|------|
| Architecture decisions, phase gates, API design | **Lead / Architect** |
| Core domain modules | **Core Dev** |
| Integration/platform modules | **Platform Dev** |
| All test files, test fixtures, coverage | **Tester / QA** |
| Documentation, README, release notes | **Docs / DevRel** |
| CI/CD, build config, deployment | **DevOps** |
| Phase priorities, scope, requirements, backlog | **Product Owner** |
| Code review, gate sign-off | **Lead / Architect** |
| Session logging, decisions merge | **Scribe** (automatic) |
| Work queue, backlog monitoring | **Work Monitor** (automatic) |

### Issue Label Routing

When using GitHub issues, assign `squad:<role>` labels for routing. The Lead triages any issue labelled `squad` (without a role sub-label) and assigns the correct `squad:<role>` label.

---

## 17. Known Gotchas

These are documented failure modes. Every new team member reads this section.

### Global Stateful Regex (JavaScript/TypeScript)

```typescript
// ❌ WRONG — module-level regex with /g flag is non-deterministic
const RE = /pattern/g;
function extract(content: string) {
  const results = [];
  let m;
  while ((m = RE.exec(content)) !== null) { results.push(m[1]); }
  return results;
}

// ✅ CORRECT — create a new RegExp instance per call
function extract(content: string) {
  const re = new RegExp(/pattern/.source, "g");
  const results = [];
  let m;
  while ((m = re.exec(content)) !== null) { results.push(m[1]); }
  return results;
}
```

The `/g` flag maintains `lastIndex` state on the regex object. Reusing a module-level instance across calls produces non-deterministic behaviour. Always create a new instance per invocation.

### Build Tool Banners Apply Globally by Default

Build tools that support a banner/header option (shebang, copyright notice, etc.) typically apply it to all outputs. If you have multiple outputs with different requirements (e.g., CLI gets shebang, library does not), configure the banner **per-output**. Check the default behaviour of your specific build tool — it is almost never per-entry.

### Type Declarations vs. Runtime Exports

Type-only exports (`export type Foo`) are erased at compile time. Runtime exports (`export function foo`) are not. TypeScript source inspection cannot detect a type-vs-value export mismatch. Always verify with a runtime import check after any changes to your public API surface file:

```bash
node -e "import('./dist/index.js').then(m => console.log(Object.keys(m)))"
```

This is a gate criterion. It has caught real bugs that passed all other checks. Adapt the equivalent check to your language/build system.

### Dependency Types at Planning Time, Not Mid-Implementation

When adding a new dependency, immediately check whether a type package is needed (`@types/<pkg>` in TypeScript, type stubs in Python, etc.) and declare it. Discovering a missing type package mid-implementation halts work unnecessarily.

### Release Plugin Completeness

Release automation systems (semantic-release, release-it, etc.) often have required plugins that are easy to overlook. Every plugin that fires during release must be explicitly declared — do not assume transitive inclusion. Run a dry-run before attempting a real release.

### Lockfile Must Be Committed

If your CI runs with a frozen lockfile flag, the lockfile must be committed to the repository. Verify at every phase kickoff that the lockfile is not in `.gitignore` and is staged.

### Selective Coverage Reporting

Submitting a coverage fix that shows improvement in one module while omitting another that is still failing is a known failure mode. Always include the full per-file table. The omission is always the signal.

---

## 18. Architectural Principles

These are the cross-cutting decisions that every team member must know. Replace the examples with your project's decisions, but keep the format.

### Data Storage

Document your data model decision explicitly:
- Where is state stored? (in-memory, filesystem, database, combination)
- What is the source of truth?
- How is concurrency handled? (locks, git, CRDT, event sourcing, etc.)

Ambiguity in the data model is the most common source of subtle bugs. Write it down.

### Error Architecture

Document your error surface:
- What type represents errors?
- What fields are required on every error? (code, message, action)
- Are errors thrown or returned? (Result type vs exceptions)

This decision must be made once and applied consistently. Inconsistent error handling is the second-most common source of subtle bugs.

### Module Boundaries

Document which modules may import which other modules. Circular imports are a symptom of unclear boundaries. The contract/types module must have **no imports from implementation modules** — it is the leaf of your dependency graph.

### Public API Surface

Define your public API surface file (e.g., `src/index.ts`, `src/__init__.py`) alongside your contract file. It is not an afterthought. It is the contract between your library and its consumers.

---

## 19. Anti-Patterns & Retrospective Learnings

These are real failure modes. Apply them regardless of project or tech stack.

### Anti-Pattern: Test Skeletons Against Backlog ACs

**What happened:** QA wrote test skeletons using backlog acceptance criteria as the API spec. The developer made a deliberate design change (different function signature, different parameter shape) that was correct but not reflected in the backlog. Required a full test rewrite.

**Fix:** QA writes test skeletons only after the shared contract (types file + public API surface) is reviewed and merged. Backlog ACs are product requirements; they are not type contracts.

---

### Anti-Pattern: Gate Criteria Discovered at Review Time

**What happened:** Gate review uncovered criteria that were never communicated to the team during implementation (e.g., "README must show Phase N features"). Required last-minute work.

**Fix:** Lead writes the full gate checklist at phase kickoff. Every criterion is binary-verifiable from day one. Anything discovered at review time is a process failure, not an implementation failure.

---

### Anti-Pattern: Selective Coverage Reporting

**What happened:** A coverage fix was submitted that showed improvement in Module A but omitted Module B, which was still failing. The fix appeared complete; the gate failed again on Module B.

**Fix:** Full per-file coverage table required in every coverage fix submission. No selective reporting.

---

### Anti-Pattern: Type-vs-Value Export Mismatch

**What happened:** A public API file was updated to export new types. The exports were correct in TypeScript source. At build time, type-only exports were erased. The built library was missing the runtime exports. All source checks passed; the runtime import check was the only thing that caught it.

**Fix:** Add a runtime import check to the gate checklist. Run it after every change to the public API surface file.

---

### Anti-Pattern: Deferred Dry-Run Validation

**What happened:** Release pipeline dry-run validation was deferred across multiple phases because "it's not blocking release right now." When a real release was attempted, the pipeline had multiple missing plugins and failed.

**Fix:** Run the release dry-run before the first real release attempt. Make it a gate criterion. Three deferrals in a row means it is an ownership problem — assign a single owner.

---

### Anti-Pattern: Informal Scope Pivot Without Gate Amendment

**What happened:** Phase scope changed mid-phase (a feature was moved to the next phase). The gate checklist was informally reduced without a documented amendment. At gate time, there was ambiguity about which criteria applied.

**Fix:** Any scope change requires a formal gate checklist amendment from the Lead — which criteria are deferred, which are added, which are modified. No silent subset evaluation.

---

### Anti-Pattern: Original Author Revising Their Own Rejected Work

**What happened:** An artifact was rejected. The original author was asked to fix it. The second submission had the same blind spot as the first.

**Fix:** D6 — Rejection Lockout. A different team member owns the revision. The author's mental model produced the failure; a fresh perspective is required for the fix.

---

### Anti-Pattern: Pending Tests as Permanent State

**What happened:** All entry-point tests were `it.todo()` stubs. Coverage thresholds were met because the module was excluded. The feature shipped entirely untested by automated tests.

**Fix:** Pending tests (`it.todo()`, `@pytest.mark.skip`, etc.) are acceptable for tests that need stable implementation output to fill in. They are not acceptable as a permanent state. Track them as debt items with a target phase for completion.

---

### Debt Ledger

Maintain an active debt ledger. At every phase kickoff, review it and assign items to the current phase or mark them as explicitly deferred.

| Item | Introduced | Target Phase | Owner | Notes |
|------|-----------|--------------|-------|-------|
| _(example)_ | Phase 2 | Phase 4 | QA | CLI integration tests |

**Three consecutive deferrals = mandatory escalation.** Assign a single owner and make it a gate criterion.

---

*This document is team-agnostic. Fill in project-specific details (team member names, module names, routing table, tech stack) in a project-specific companion document.*

*Maintained by the Lead. All amendments require a commit with a `docs(squad):` prefix.*
