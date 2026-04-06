# Way of Working

> **Audience:** Every team member — human or AI agent — on any squad.  
> **Purpose:** A project-agnostic, team-agnostic playbook. The principles apply regardless of language, framework, domain, or team composition.  
> **Usage:** Adopt as-is. Extend with a project-specific companion (routing table, tech stack directives, module ownership). Never override the core principles here.

---

## Table of Contents

1. [Roles & Boundaries](#1-roles--boundaries)
2. [How We Plan Work](#2-how-we-plan-work)
3. [How We Branch & Commit](#3-how-we-branch--commit)
4. [How We Maintain Quality](#4-how-we-maintain-quality)
5. [How We Gate a Sprint](#5-how-we-gate-a-sprint)
6. [How We Review Code](#6-how-we-review-code)
7. [Contract-First Discipline](#7-contract-first-discipline)
8. [How We Test](#8-how-we-test)
9. [How We Document](#9-how-we-document)
10. [How We Retrospect](#10-how-we-retrospect)
11. [Ceremonies](#11-ceremonies)
12. [How Work Is Routed](#12-how-work-is-routed)
13. [Anti-Patterns (Retro-Derived)](#13-anti-patterns-retro-derived)
14. [Debt Ledger](#14-debt-ledger)

---

## 1. Roles & Boundaries

### The Standard Roles

Every squad needs these capabilities. Names and headcount vary — the responsibilities do not.

| Role | Core Responsibility | Owns |
|------|---------------------|------|
| **Lead / Architect** | Sprint gates, interface design, final approval | All merges to main, all architecture decisions |
| **Implementer(s)** | Building what was designed | Their assigned modules / components |
| **QA / Tester** | Quality assurance, test coverage | All test files, all fixtures, all coverage reports |
| **Docs** | Developer experience, documentation | README, architecture log, release notes |
| **DevOps** | Build pipeline, CI/CD, releases | CI workflows, build config, deployment automation |
| **Product Owner** | Scope, priorities, backlog | Sprint scope decisions, trade-off calls |

Smaller teams merge roles. Larger teams split them. The responsibilities stay.

### Non-Negotiable Boundaries

**The Lead does not implement.** The Lead designs, reviews, gates, and decides. When the Lead also implements, there is no one to review the Lead's work. **This is not allowed.** If the team is too small to avoid it, the Lead's code is subject to mandatory review by the most senior available non-Lead member before merge.

**The Lead has a deputy.** The Lead nominates one team member as deputy at sprint kickoff. If the Lead is unavailable (unreachable for more than half a working session), the deputy holds gate authority temporarily: they may review code and block merges, but may not approve a gate or merge to main without a quorum decision from at least two other role-holders. The deputy appointment is written in the sprint scope document.

**No one reviews their own work.** The author of a submission is never its reviewer.

**When two roles overlap on a shared system**, the boundary between them must be written down at kickoff. Unwritten boundaries are resolved by whoever acts first — which produces inconsistent results.

**Automatic roles (Scribe, monitor) are never routed to explicitly.** They run after every substantial session. Routing work to them wastes the session.

### Sign-Off Requirements

Work is not done when it is implemented. Work is done when it has been signed off by the relevant roles:

| Work Type | Required Sign-Offs |
|-----------|-------------------|
| Code change | Lead (code review) |
| New contract / interface | Lead (contract review) |
| Test suite | QA (coverage + correctness) |
| Documentation | Docs (accuracy + completeness) |
| Architecture decision (ADR) | Lead + relevant role-holders impacted by the decision |
| Sprint gate | Lead + QA + Docs + DevOps (all gate criteria met) |
| Release | Lead + DevOps (pipeline validated) |

No sprint merges without all required sign-offs. Partial sign-offs are not sign-offs.

---

## 2. How We Plan Work

### Feature Branch Model

All work lives on feature branches. **Direct commits to `main` are not allowed.**

```
main (protected)
  └── feature/sprint-N-<short-name>
        ├── work by all team members for this sprint
        └── merged to main ONLY after the Lead's gate sign-off
```

Every sprint has exactly one feature branch. Every sprint produces exactly one release. No partial sprints. No partial merges.

### Sprints

A sprint is a bounded unit of work with:
- A named scope (what is in and what is explicitly out)
- A feature branch
- A gate checklist (written at kickoff, not at review time)
- A release version on successful merge

**Sprints should be sized so the team can ship a working, tested, documented increment.** If a sprint cannot ship something end-to-end functional, it is too small or too fragmented. Combine or re-scope.

**Sprint sizing heuristic:** A sprint should represent work that can be completed and gated in one focused sprint of team effort — typically one to three weeks depending on team size and cadence. A sprint contains all the work needed to ship a user-facing or integration-ready capability. If two features can be shipped and used independently, they belong in separate sprints. If a feature requires two sprints to be useful, the sprint boundary should be at the first independently testable increment.

### Backlog

All work items live in the team's project tracker. Every item must have:

1. **A clear outcome** — what "done" looks like from the outside
2. **A precise contract** — the exact interface, signature, or schema the implementation must match

```
❌  "The auth module should handle login"
✅  POST /auth/login → { token: string, expiresAt: ISO8601 } | { error: { code, message, action } }
```

Vague acceptance criteria produce implementation–test mismatches. When the tester writes tests against a vague AC and the implementer interprets it differently, the result is a complete test rewrite. The fix is precision in the AC, not flexibility in the test.

### Kickoff Checklist

Before any sprint begins:

- [ ] Sprint scope is written down, agreed, and signed by the Product Owner (what is in, what is explicitly out)
- [ ] Trade-off authority is clear: **the Product Owner owns scope and business priority; the Lead owns architecture and technical feasibility.** If they conflict, the Product Owner states the business constraint and the Lead states the technical constraint — the resolution is written down as a formal decision, not a verbal compromise.
- [ ] Gate checklist is written (owned by the Lead)
- [ ] Contracts / interfaces for new modules are **assigned for drafting** (not yet drafted, not yet approved — the drafting sequence follows in §7)
- [ ] Debt items from the previous sprint are reviewed and assigned or explicitly deferred
- [ ] Each team member knows which modules they own for this sprint
- [ ] Lead deputy is nominated for this sprint

### Feature Flags

A feature flag is acceptable when an implementation spans multiple sprints or when a capability must be deployed but not yet user-visible. Feature flags are not shortcuts around incomplete work.

A feature flag is valid only if:
1. The disabled code path is fully tested (tests pass in both the enabled and disabled state)
2. The flag is documented in the architecture log with the target sprint for its removal
3. The flag cannot surface to end users while disabled — only internal or CI-level access is permitted

A feature flag that ships untested disabled code is technical debt, not a sprint increment.

---

### Branch Names

```
feature/sprint-N-<short-name>    # sprint branches
fix/<short-description>         # hotfixes on top of main
docs/<short-description>        # documentation-only branches
```

### Commit Format

```
<type>(<scope>): <subject>

[body — explain WHY, not WHAT]

[footer — breaking changes, issue references]
```

### Commit Types

| Type | When |
|------|------|
| `feat` | New capability added |
| `fix` | Defect corrected |
| `docs` | Documentation only |
| `test` | Test additions or corrections |
| `refactor` | Code restructured, no behavior change |
| `chore` | Build, tooling, dependency updates |

### Commit Rules

- **One logical change per commit.** A commit that does two things should be two commits.
- **Subject line is imperative, specific, lowercase.** Not "wip", not "update", not "stuff".
- **Body explains the why** when the why is non-obvious.
- **Breaking changes go in the footer:** `BREAKING CHANGE: <description>` — this signals a major version increment.
- **Skip CI when appropriate:** commits that only touch team tooling, backlog, or planning files should not trigger the full pipeline.

### What "Atomic" Means in Practice

An atomic commit can be reverted without breaking anything else. If reverting a commit requires also reverting three other commits to keep the codebase functional, the commit was not atomic.

---

## 4. How We Maintain Quality

### The Non-Negotiables

These apply to every project, every sprint, every language:

**1. Use your language's strictest type-checking mode.**  
Types are the cheapest form of documentation and the cheapest form of testing. Turning off type strictness to "move faster" produces slower movement within a few iterations.

**2. Enforce quality at tooling level, not at review level.**  
If a rule matters, make it a build failure. Rules enforced only by human review are inconsistently applied and produce reviewer fatigue.

**3. Structure errors; do not scatter them.**  
Every error surface should produce a value with at minimum:
- A machine-readable `code` (for programmatic handling)
- A human-readable `message` (for logs and debugging)
- A human-readable `action` (what the caller should do next)

Callers should not need to inspect exception types or parse error strings to handle errors correctly.

**4. Handle errors at the call site, not somewhere upstream.**  
Return errors as values where practical. Unhandled exceptions that propagate silently to a generic handler hide the actual failure point and make debugging harder.

**5. Immutability in shared interfaces.**  
Public interfaces should not allow callers to mutate internal state. Use immutable types at API boundaries.

**6. Functions over stateful objects where possible.**  
Stateless functions are easier to test, easier to compose, and easier to reason about. Reserve stateful objects for things that genuinely have lifecycle — connections, event emitters, long-lived caches, subscription managers. "Prefer functions" does not mean "never use objects" — it means the burden of justification lies with the stateful design, not the stateless one.

**7. Handle errors at the call site, not somewhere upstream.**  
Return errors as values where practical. Unhandled exceptions that propagate silently to a generic handler hide the actual failure point and make debugging harder. For async or streaming contexts, the call site is the first consumer of the async result — the handler that awaits, subscribes to, or reads from the async source. Error handling must be placed at that boundary, not deferred to a parent or caller that has already lost the original context.

### Code Review Expectations

Reviews check:
- Correctness against the locked contract
- No regressions against prior sprints
- No half-exposed internals in the public interface
- Inline docs are accurate — not just present
- Tests cover the specification, not just the happy path
- No escape hatches (type casts to `any`, explicit `unsafe`, `# type: ignore`, lint suppressions in source)

**Escape hatch detection — QA verifies at gate:**
- No type suppressions or unsafe casts in source files (test files are exempt with justification)
- Any suppression in test files is QA-owned: document the exception inline with a comment explaining why it is necessary and when it can be removed

---

## 5. How We Gate a Sprint

The gate is the Lead's binary checklist. Every criterion passes or the sprint does not merge.

### Gate Outcomes

| Outcome | What It Means |
|---------|--------------|
| **APPROVED** | All criteria pass. Merge proceeds. |
| **CONDITIONAL PASS** | One named exception, documented as sprint debt with explicit owner and target. Merge allowed. |
| **BLOCKED** | One or more criteria fail. Specific failures listed. Specific owners assigned. |

### Gate Checklist — Universal Criteria (Every Sprint)

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | Static analysis: zero errors | Run type-checker, compiler, or linter in strict mode → exit 0 |
| 2 | Linter: zero warnings | Run linter with strictest flag → exit 0 |
| 3 | Tests: all non-pending pass | Run full test suite → zero failures |
| 4 | Build: all outputs present and correct | Build succeeds; verify output files exist |
| 5 | Public interface exports verified at runtime | Import or load the built artifact, enumerate exported names — all expected symbols present and callable |
| 6 | No escape hatches in source | No unsafe type casts, no lint suppressions in source |
| 7 | Inline docs complete | All public exports have summary, parameters, return, and error docs |
| 8 | README updated | Sprint capabilities documented with usage examples |
| 9 | Architecture log updated | Design decisions from this sprint recorded as ADRs |
| 10 | Release notes written | Changelog entry for this release complete |
| 11 | Coverage thresholds met | Full per-file coverage table passes all project-defined thresholds |
| 12 | Lockfile / dependency manifest committed | Reproducible install verified |
| 13 | Clean install passes | Fresh checkout → install → build → test succeeds end-to-end |

**Sprint-specific criteria are written by the Lead at sprint kickoff** — not discovered at review time. Anything the team did not know was required until gate day is a process failure, not a technical failure.

### Gate Checklist Amendment Protocol

When scope changes mid-sprint, the Lead writes a formal amendment documenting:
- Which criteria are deferred (with rationale and target sprint)
- Which criteria are added
- Which criteria are modified

No silent subset evaluation. Informal scope pivots without an amendment create ambiguity at gate time and erode trust in the checklist.

### Who Signs Off at the Gate

The gate is not a solo exercise by the Lead. All sign-offs must be in place:

- **Lead** — architecture, code quality, interface correctness
- **QA** — coverage completeness, test correctness, full per-file table
- **Docs** — README accuracy, architecture log completeness, release notes
- **DevOps** — clean install validated, build pipeline confirmed

A sprint does not merge until all four sign-offs are recorded.

### Conditional Pass Stacking Limit

A CONDITIONAL PASS carries exactly one named exception into the next sprint. If that exception is deferred again — becoming a conditional exception in a second consecutive sprint — it must be treated as a debt ledger item subject to the three-deferral rule (§14). A single exception deferred three sprints in a row is automatically elevated to a gate blocker for the next sprint. It cannot receive another CONDITIONAL PASS.

---

## 6. How We Review Code

### The Lead Reviews Everything

All PRs pass through the Lead before merge. The Lead is the reviewer for code correctness, architecture consistency, and API surface coherence.

**Rejection Lockout**

**If the Lead rejects an artifact, the original author does not own the next version.**

A different team member takes the revision. The author may not advise, co-author, or pair on the revision. The revision must be independently produced.

**Why:** The author's mental model produced the failure. Sending the fix back to the same author risks the same blind spot. A fresh perspective, briefed on the rejection criteria, produces a more reliable revision.

**Artifact scope:** The lockout applies to the specific files or interfaces directly implicated in the rejection — not the entire PR. If a PR contains six files and two are rejected, the lockout covers those two files only. The original author may continue work on the non-implicated files.

**Cascade:** If the revision is also rejected, the revision author is now also locked out. A third team member takes the next attempt.

**Lockout escalation:** If all eligible team members have been locked out of an artifact, this is an escalation signal — not an implementation problem, but a design problem. The Product Owner is notified. The Lead reviews the artifact history and decides: (a) revert to an earlier approved design, (b) bring in external review, or (c) treat as a blocking debt item — design the artifact from scratch next sprint with explicit Lead involvement from the start. Re-admitting a locked-out author is not an option without explicit Product Owner sign-off and a written rationale.

### What Rejection Lockout Is Not

It is not punitive. It is structural. The original author continues to work on other tasks in parallel. The lockout applies only to the implicated artifact, only for that revision cycle.

### Review Turnaround

Code review is not a batch job. A submitted PR should receive review feedback within one working session — not "when I get to it." Review debt is a team throughput problem, not an individual problem.

**Author response SLA:** Once review feedback is delivered, the author must address it and re-submit within one working session. If the author cannot respond within that window, they explicitly hand off to another implementer and notify the Lead. Silent non-response blocks the pipeline.

---

## 7. Contract-First Discipline

### The Problem It Solves

When an implementer and a tester both start from the same backlog item but interpret the interface differently, the result is a test suite that passes with the implementation the tester expected but not with the implementation that was actually built. The fix is always a full test rewrite.

The root cause is not imprecision in the implementation or carelessness in the tests. The root cause is that both people were working from a description of behavior, not a binding interface contract.

### The Sequence

```
1. Implementer drafts the shared interface contract (new types, signatures, schemas)
2. Lead reviews the contract → APPROVED or CHANGES REQUESTED
3. On APPROVED: QA writes test skeletons against the locked contract
4. Implementation begins (across all modules, in parallel)
5. QA fills in test assertions as each implementation unit stabilises
```

**No step is optional. No step is reordered.**

**Implementer owns the draft; Lead owns the approval.** The kickoff ceremony assigns contracts for drafting — it does not draft them. Drafting happens when the implementer has enough context to specify the interface precisely. A contract drafted by the Lead at kickoff without implementer input is an architecture decree, not a contract — and decrees do not surface implementation constraints early enough.

### Contract Amendment Protocol

When a locked, approved contract must change mid-implementation because a design assumption was wrong, the following applies:

1. The implementer raises the change request explicitly — no silent deviations
2. The Lead reviews: approve the amendment or reject the implementation approach
3. If the amendment is approved: QA is notified immediately; test skeletons against the old contract are invalidated; new skeletons are written against the amended contract before implementation continues
4. The amendment is recorded in the architecture log as a decision with rationale
5. A CONDITIONAL PASS is not a substitute for a contract amendment — a gate pass does not retroactively legitimise an unrecorded contract mutation

### What a Contract Looks Like

A contract is the exact interface between modules — not a description of what it does, but the precise shape of what it takes and what it returns:

- For an API: endpoint path, method, request schema, response schema, error codes
- For a library function: signature, parameter types, return type, error type
- For a message queue: message schema, topic/queue name, delivery guarantees
- For a CLI command: argument names and types, flag semantics, exit codes, stdout/stderr shape

Prose descriptions are not contracts. Diagrams are not contracts. A contract is precise enough that two developers can implement and test against it independently and arrive at compatible results.

### Contract Review Checklist

When reviewing a proposed contract, the Lead verifies:

| Check | What to Look For |
|-------|-----------------|
| Precision | Every input and output has an explicit type and shape — no "object", no "any", no implicit |
| Completeness | All error cases are in the contract — not just the happy path |
| Immutability | Shared data structures at API boundaries are immutable — callers cannot mutate internal state |
| Independence | The contract file has no runtime dependencies on implementation files |
| Documentation | Every exported item has a description, parameter docs, return docs, and error docs |

### Open Questions Surface at Contract Time, Not Implementation Time

When a developer has a design question while writing the contract ("should this return a union type or raise an exception?"), they surface it explicitly for the Lead to answer at review — they do not silently pick one. The decision and its rationale go into the architecture log. Silent decisions produce inconsistent patterns across modules.

### Dependency Stability at Contract Time

When drafting the interface contract, verify that all external dependencies required are:
- Stable (not alpha, not pre-release)
- Actively maintained
- Compatible with the project's existing dependency graph

Unstable dependencies are a known risk. If a dependency is unavoidably unstable, the risk is documented in the ADR and QA is involved in designing error case tests that cover dependency failure modes. Do not discover dependency gaps during implementation — discovery during implementation breaks flow and invalidates work already done.

---

## 8. How We Test

### QA Owns Tests

QA owns all test files and all fixtures. No other team member modifies test files without QA involvement. This is not a territorial rule — it is a coherence rule. A test suite written by multiple hands without a single owner becomes incoherent.

### Test Writing Sequence

1. Contract is locked (Lead approved)
2. QA writes test **skeletons**: describe blocks, test cases named, assertions empty
3. Implementation proceeds in parallel
4. QA fills in assertions as each implementation unit stabilises

**Skeleton completeness requirement:** Every skeleton must include structure for:
- Happy path with representative inputs
- All documented error cases from the contract
- Boundary and edge conditions (empty input, maximum values, missing required fields)

Minimum test case count is derived from contract complexity and confirmed by the Lead at kickoff review. A skeleton that covers only happy path is not a skeleton — it is an incomplete draft.

**Implementer stabilisation signal:** "Stabilised" means the implementer explicitly notifies QA that a module is ready for assertion fill-in. QA does not poll. If a module is not signalled, QA marks it pending with the implementer as owner.

**Handoff for usability:** If QA needs a code sample or usage example to fill assertions, the implementer provides it as a comment or example file. QA cleans it up afterward. Waiting for documentation that does not exist yet is not QA's problem — it is a handoff gap.

### Pending Tests Are Debt, Not Done

Use your test framework's pending mechanism (`it.todo()`, `@pytest.mark.skip`, `xit`, etc.) for tests that cannot be written yet:
- Tests that need stable implementation output to assert against
- Tests that would couple to internal implementation details

**Pending tests are not a permanent state.** Every pending test is a debt item. It has an owner and a target sprint for completion.

**Tracking requirement:** Every pending test must have:
1. A debt ledger entry (introduced sprint, target sprint, owner, closure condition)
2. An inline comment in the test file with the debt item ID
3. The test framework's pending mechanism applied — do not leave empty assertions without marking pending

The test suite at gate time must show:
- Zero unintentional failures
- All pending tests explicitly acknowledged, tracked, and linked to their debt entries

**Do not** write stub tests with trivially-true assertions. A stub test that always passes gives a false sense of coverage and must be rewritten when the implementation diverges.

### When Implementation Diverges from the Locked Contract

If QA discovers during assertion fill-in that the implementation diverges from the locked contract:

1. QA stops filling assertions and escalates to the Lead immediately — no silent adjustment of the test
2. The Lead decides: approve a contract amendment (following the Contract Amendment Protocol in §7) or reject the implementation
3. Until the Lead decides, QA marks the affected test cases pending with the divergence noted inline
4. No QA owns the decision to diverge — this is always a Lead decision

### Fixture Design

Fixtures should cover:
- The happy path with representative inputs
- Known edge cases (empty, maximum, boundary values)
- At least one known failure mode per subsystem (invalid input, missing resource, permission boundary)

**Fixture constraints:**
- Fixtures must not inspect or depend on implementation internals (private methods, internal state inspection). If a fixture requires access to private state to set up, the contract is leaking implementation — fix the contract.
- Fixtures are module-scoped by default. Sharing fixtures across modules creates coupling between test suites that break when either module is refactored. Cross-module fixtures require Lead approval.
- Test cases must not depend on execution order. Each test is independently set up and torn down. Shared state between tests is a reliability failure waiting to happen.

Fixtures that only test the happy path produce a test suite that does not fail when the system breaks in the ways systems actually break.

### Coverage Is a Floor, Not a Ceiling

Coverage thresholds are set per project. The threshold is a minimum. Passing the threshold does not mean the system is well-tested — it means the worst-case floor has been cleared.

**New modules:** All new modules are expected to meet the project's coverage threshold on their first gate submission. Partial coverage on first submission is a debt item, not an acceptable default.

**Modified modules:** Changes to existing modules must preserve or improve existing coverage. A modification that reduces coverage in an existing module requires QA sign-off with a written rationale.

**Mandatory: full per-file coverage table in every coverage fix submission.** Reporting Module A's improvement while omitting Module B (still failing) is a known failure mode. The omission is always the signal that the fix is incomplete.

---

## 9. How We Document

### Docs Owns Documentation

The Docs role finalises all documentation. Team members write **proposals** (inline comments, README section drafts) as part of their implementation work. Docs reviews, corrects, and publishes.

### The Three Mandatory Documents

| Document | Contents | Rule |
|----------|----------|------|
| **README** | What it is, how to install, how to use | Only these three. No roadmap, sprints, future features, or team references. |
| **Release Notes / Changelog** | What changed in this release | Accurate and complete. Covers every user-visible change. Migration steps for breaking changes. |
| **Architecture Log** | ADRs — why decisions were made, what alternatives were considered | Permanent. ADRs are never deleted. They explain why the codebase looks the way it looks. |

### ADR Format (Architecture Decision Record)

Every significant design decision gets an ADR. An ADR answers:

1. **Context** — what situation required a decision
2. **Decision** — what was decided
3. **Rationale** — why this option over the alternatives
4. **Consequences** — what becomes easier, what becomes harder, what debt is incurred

ADRs are written at decision time, not retroactively. A decision made without an ADR is a decision that will be made again in six months by a team member who does not know it was already made.

### Documentation Is a Gate Criterion

Documentation is not follow-on cleanup. If the README still shows a new capability as "coming soon" at gate time, the gate fails. Docs must be gate-ready on first submission.

Source-validated documentation passes gate. Documentation written from planning notes fails gate — not because it is wrong, but because planning notes go stale in ways source does not. Use actual names, signatures, and error codes from the implemented source.

**Documentation drift detection:** At every gate, Docs spot-checks at minimum three random public exports by loading the built artifact and verifying that inline documentation matches the actual signature. If drift is found, the gate fails and the implementer corrects the drift — not Docs.

### Inline Documentation

Every exported interface, function, type, and error code requires inline documentation covering:
- What it is and what it does
- Every input: name, type, constraints
- Every output: type, meaning
- Every error case: when it occurs, what the caller should do

---

## 10. How We Retrospect

### Format

Every sprint retrospective follows this structure:

1. **What went well** — concrete, specific examples. Not "good teamwork." Name the thing that worked and why it worked.
2. **What didn't go well** — honest, direct, no euphemisms. Name the failure mode, the root cause, and who was involved.
3. **What we learned** — actionable insight derived from what happened. Not observations — lessons that change future behaviour.
4. **Action items** — one owner per item, one target sprint per item, one clear definition of done per item.

### Cadence

- **Full retrospective** — after every sprint completion, facilitated by the Lead
- **Abbreviated retrospective** — after any build failure, test failure, or reviewer rejection (see [§11 Ceremonies](#11-ceremonies))

### Action Item Discipline

Action items are written to the decision log. They are reviewed at the next sprint kickoff. They are verified in the gate checklist.

**An action item that is deferred three sprints in a row has an ownership problem, not a priority problem.** At that point, assign a single owner and make it a gate criterion for the next sprint. It cannot slip again.

### The Compounding Value of Retros

Retrospective action items have measurable compounding value when enforced. A checklist item added at Sprint N's retro prevents the exact failure mode it was written for when applied in Sprint N+1. The ROI is not visible in features delivered — it is visible in gate attempts avoided.

The retrospective is not a ceremony that produces documents nobody reads. The documents are the mechanism. If they are not read, the retrospective has zero value.

---

## 11. Ceremonies

Ceremonies are structured alignment events that happen before or after work. They are not optional and are not deferrable.

### Design Review

**When:** Before any work that involves two or more team members touching a shared interface or shared system.

**Agenda:**
1. Review the requirement and its acceptance criteria
2. Agree on the interface contract between components
3. Identify risks, edge cases, and integration points
4. Assign ownership of each piece

**Output:** A written interface contract ready for the Lead's review. Work does not start until the contract is approved.

### Abbreviated Retrospective

**When:** Triggered automatically after any build failure, test failure, or reviewer rejection.

**Agenda:**
1. What happened — facts only, no attribution
2. Root cause — the systemic reason, not the surface symptom
3. What changes — the single most important adjustment
4. Action item — one owner, one target, one clear done condition

This is a 15-minute exercise, not a full sprint retrospective. Do not defer it. The value is in the immediacy — the failure mode is fresh.

### Sprint Kickoff

**When:** Before every new sprint begins.

**Participants:** Lead, Product Owner, all role-holders.

**Agenda:**
1. **Product Owner confirms sprint scope** — what is in, what is explicitly out, what is deferred and why
2. **Product Owner locks priorities** — if there is more work than time, the PO decides what ships and what slips; this decision is written down before work begins
3. Review the debt ledger from the previous sprint — business impact assessed by PO, technical assessment by Lead
4. Write the gate checklist (Lead)
5. Assign contracts for drafting (not yet drafted — see §7 for the drafting sequence)
6. Assign module ownership (Lead)
7. Nominate Lead deputy for this sprint

**Output:** Written scope signed by the Product Owner, written gate checklist, contracts assigned, ownership assigned, deputy named. Work does not start without these.

---

## 12. How Work Is Routed

### Routing Principles

These apply regardless of the specific routing table your project defines:

1. **Domain ownership is exclusive.** One role owns each module or system area. When two roles could handle a task, the one whose primary domain is closer takes it.
2. **Downstream work starts in parallel.** Implementation and testing are parallel, not sequential. As soon as the contract is locked and implementation begins, QA begins writing skeletons. As soon as a module stabilises, Docs begins drafting.
3. **The Lead owns review, not implementation.** Code review and gate decisions always route to the Lead. They never route back to the submitting author.
4. **Quick questions route to the coordinator.** If the answer is already in context, the coordinator answers directly — no agent spawn, no ticket, no meeting.
5. **Ambiguous routing resolves toward the domain owner.** If it is unclear who should handle something, route it to the person whose domain is closest to the work. They can redirect if needed.

### Routing Table (Template)

Fill this in for your project. The role labels on the left are universal.

| Work Type | Route To |
|-----------|----------|
| Architecture decisions, sprint gates, API design | Lead / Architect |
| Core domain implementation | Core Implementer(s) |
| Integration, platform, infrastructure | Platform Implementer(s) |
| Tests, fixtures, coverage | QA / Tester |
| README, architecture log, release notes | Docs |
| CI/CD, build, deployment | DevOps |
| Scope, priorities, backlog | Product Owner |
| Code review, gate sign-off | Lead / Architect |

### Issue Routing

When using an issue tracker with labels:
- `squad` (no sub-label) → Lead triages, assigns `squad:<role>` label
- `squad:<role>` → that role picks it up

The Lead is the triage point. All unlabelled squad work passes through the Lead before being assigned.

---

## 13. Anti-Patterns (Retro-Derived)

These are failure modes that have recurred across sprints. Every new team member reads this section.

---

### Anti-Pattern: Tests Written Against Acceptance Criteria, Not Contracts

**What happens:** QA writes tests using the backlog AC as the API spec. The implementer interprets the AC differently (or more precisely, producing a different signature). Tests fail. Full rewrite required.

**Root cause:** ACs describe behaviour. Contracts describe interfaces. They are different documents and should not be substituted for each other.

**Fix:** QA writes test skeletons only after the interface contract is reviewed and approved by the Lead. See [§7 Contract-First Discipline](#7-contract-first-discipline).

---

### Anti-Pattern: Gate Criteria Discovered at Review Time

**What happens:** At gate review, the Lead identifies a criterion that was never communicated during the sprint ("the public API must include X", "the clean install must succeed from scratch"). Teams scramble to fix things that were actually done correctly — just not to the unstated expectation.

**Root cause:** The gate checklist was written at review time, not at kickoff.

**Fix:** The Lead writes the complete gate checklist at sprint kickoff. Everything on it is known and verifiable from day one. Criteria discovered at review time are process failures. See [§5 How We Gate a Sprint](#5-how-we-gate-a-sprint).

---

### Anti-Pattern: Selective Coverage Reporting

**What happens:** A coverage fix is submitted. It shows Module A improving. It omits Module B, which is still below threshold. The gate fails again. This cycle repeats.

**Root cause:** The submitter reported what improved, not what remains.

**Fix:** Every coverage submission includes the full per-file table. Not a summary. Not the improved modules only. The entire table, with every module's exact numbers. The omission is always the signal that the fix is incomplete.

---

### Anti-Pattern: Runtime Exports Not Verified

**What happens:** Static analysis passes. Lint passes. Tests pass. At gate, the built artifact is loaded and a required exported function is missing. It was declared in source as a type-level or compile-time construct, not as a runtime value — and was erased at build time.

**Root cause:** Static analysis tools verify source-level declarations, not the built artifact. In compiled languages where type information is erased, or in build systems that separate type exports from value exports, a declaration can pass static analysis and still be absent at runtime.

**Fix:** The gate checklist includes a runtime export verification step. Load or import the built artifact. Enumerate its exported names. Verify every expected symbol is present as a runtime-accessible value. This cannot be done with static analysis alone — it must be done against the built output. See gate criterion 5.

---

### Anti-Pattern: Release Pipeline Never Validated

**What happens:** The release automation is set up but never run in dry-run mode. It is deferred sprint after sprint ("it's not blocking this release"). When a real release is finally attempted, the pipeline fails with missing plugins, incorrect credentials, or misconfigured steps.

**Root cause:** Deferral is mistaken for low risk. Each deferral increases the real risk — more versions accumulate, more pipeline assumptions go unchecked.

**Fix:** Run the release dry-run before the first real release. Make it a gate criterion. Three consecutive deferrals means the ownership is unclear — assign a single owner and make it mandatory next sprint.

---

### Anti-Pattern: Informal Scope Pivot Without Gate Amendment

**What happens:** Mid-sprint, a feature is deferred or a new one added. The gate checklist is silently reduced or expanded. At gate time, there is disagreement about which criteria apply.

**Root cause:** Scope changes without written record produce competing memories of what was agreed.

**Fix:** Any mid-sprint scope change requires a formal amendment from the Lead: which criteria are deferred, which are added, which are modified. No silent evaluation against a subset. See [§5 Gate Checklist Amendment Protocol](#gate-checklist-amendment-protocol).

---

### Anti-Pattern: Original Author Revising Their Own Rejected Work

**What happens:** An artifact is rejected. The original author is asked to fix it. The second submission repeats the same conceptual failure.

**Root cause:** The author's mental model produced the initial failure. Returning to the same author without changing the mental model produces the same result.

**Fix:** Rejection lockout. A different team member owns the revision. The lockout is structural, not punitive. See [§6 How We Review Code — Rejection Lockout](#rejection-lockout).

---

### Anti-Pattern: Permanently Pending Tests

**What happens:** Test cases are marked as pending ("todo", "skip", "xit") at gate time. Coverage passes because the framework excludes pending tests. The module ships untested for its most important code paths.

**Root cause:** Pending tests were treated as a resolution rather than a deferral.

**Fix:** Every pending test is a named debt item with an owner and a target sprint. At kickoff, the previous sprint's pending tests are reviewed. If they are still pending, they are assigned and prioritised.

---

### Anti-Pattern: External Dependency Gaps Discovered Mid-Implementation

**What happens:** An implementer starts writing code that depends on an external package. Mid-implementation, they discover the package lacks necessary interfaces, stubs, type definitions, or is incompatible with the existing dependency graph. They stop to resolve this, breaking flow and sometimes invalidating already-written code.

**Root cause:** Dependency analysis was not done at contract time.

**Fix:** When drafting the interface contract, list all external dependencies required. Verify that each is stable, actively maintained, and has the necessary integration points available. Verify compatibility with the existing dependency graph. Resolve gaps before implementation begins, not during. See Dependency Stability at Contract Time in §7.

---

## 14. Debt Ledger

Every piece of work explicitly deferred gets a row here. The ledger is reviewed at every sprint kickoff.

| Item | Introduced | Target Sprint | Owner | Condition for Closure |
|------|-----------|--------------|-------|-----------------------|
| *(example: CLI integration tests pending)* | Sprint 1 | Sprint 2 | QA | All pending CLI tests filled with assertions and passing |

### Ledger Rules

- **Every deferred item has an owner.** "Team" is not an owner.
- **Every deferred item has a target sprint.** "Soon" is not a target sprint.
- **Three deferrals = mandatory.** An item that has been pushed to the next sprint three times in a row is assigned to a specific owner and added to the gate checklist as a required criterion. It cannot be deferred again.
- **Items are closed when the gate verifies them**, not when the implementer says they are done.

---

*This document describes how we work — the principles, process, and discipline — independent of what we are building and who is building it.*  
*Maintained by the Lead. All amendments committed with `docs(squad):` prefix. Read before every sprint kickoff.*
