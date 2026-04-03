# Dumont's Documentation Design Decisions — Phase 1

**Date:** 2026-04-03  
**Agent:** Dumont (DevRel / Docs)  
**Phase:** 1 (Parser + Markdown Index)  
**Status:** Complete

## Decision 1: Architecture Document Structure

**What:** Created a comprehensive `docs/architecture.md` covering all 9 layers, 7 core principles, 7 ADRs, and complete data flow documentation.

**Why:**
- New engineers need a single reference document before making architectural changes
- 9 layers are complex; documenting each one (dependencies, key decisions, returns) prevents confusion
- ADRs capture the "why" behind each design choice — essential for future decisions that might consider changing them
- Type system explanation helps developers understand how data flows through the system

**How:**
- Structured as: Overview → Principles → 9 Layers (each with dependencies, decisions, returns) → Data Flow (by phase) → Type System → Error Handling → Build Phases → File Structure → ADRs → What NOT to Do → Performance

**Impact:**
- Single source of truth for architecture — reduces duplicate explanations in PRs and issues
- ADRs make it clear why SQLite was rejected, why wikilinks are extensionless, why governance is agent-only
- Data flow section shows Phase 2+ engineers how their modules integrate

---

## Decision 2: README.md — Phase 1 Features Only

**What:** Updated README to focus exclusively on Phase 1 (Parser + Markdown Index), with clear "coming soon" labels for Phases 2-5.

**Why:**
- Avoid overpromising. Phase 1 is parser and index; Phases 2-5 are separate releases with separate timelines.
- Users installing v0.1.0 should know what they're actually getting (parsing, indexing) vs. what's coming (querying, search).
- Clear roadmap manages expectations and prevents feature creep.

**How:**
- Feature list: ✅ for Phase 1 (parse, index, human-readable index), 🔜 for future phases
- Quick Start: shows only `oxori init` and `oxori index` (Phase 1 CLI commands)
- SDK Usage: shows only parser and buildIndex from Phase 1
- Index Files: explains what files.md, tags.md, links.md contain (the actual index format)

**Impact:**
- Users understand what Phase 1 delivers and when to expect more
- Phase 2+ can add features to README without cluttering Phase 1 messaging

---

## Decision 3: CONTRIBUTING.md — Comprehensive, Not Minimal

**What:** Wrote a full 300+ line contributor guide covering setup, conventions, testing, PR process, phase gates, and CI/CD.

**Why:**
- Oxori is built by a specialist team (Tron, Yori, Ram, Flynn, etc.). Clear conventions prevent conflicts.
- Phase gates are critical: Phase 1 must be complete (tests, 80% coverage, docs) before Phase 2 starts.
- New contributors should understand why Oxori uses certain conventions (strict TypeScript, Result<T,E>, JSDoc, etc.)

**How:**
- Sections: Getting Started → Running Commands → Code Conventions (TS, functions, comments, paths, async, etc.) → Commit Convention with examples → Testing (structure, coverage targets, examples) → PR Checklist → Phases and Releases → Documentation → CI/CD

**Impact:**
- Onboarding is faster — developers know exactly what's expected
- Code is consistent — no debates about `any` type, function vs. class, or commit format
- Phase gates are clear: no phase merges without tests, coverage, docs, and Flynn approval

---

## Decision 4: RELEASES.md — Detailed, Not Auto-Generated

**What:** Manually wrote detailed release notes for v0.1.0 covering Parser, Indexer, CLI, Type System, and Phase 2 preview.

**Why:**
- Release notes are marketing + documentation. They tell users what's new, what's changed, what's broken.
- For Phase 1, Dumont writes manual notes (this PR). Later, `semantic-release` auto-generates changelogs from commits, but release notes are still hand-written for clarity.
- Users need to know limitations (e.g., "no query engine yet — Phase 2 adds this") so they understand what they're building on.

**How:**
- Structure: What's New (Parser, Index, CLI, Types) → Installation → Quick Start → SDK Usage → Architecture Reference → Breaking Changes → Known Limitations → Migration Guide → Phase 2 Preview → Testing/CI → Contributors

**Impact:**
- Users understand exactly what Phase 1 is and how to use it
- Release notes are a first-class deliverable, not an afterthought
- Clear progression to Phase 2 manages expectations

---

## Decision 5: Structure — API Docs Deferred to Phase 3

**What:** Did NOT create `docs/phase1-api.md` (detailed API reference). Instead, documented parseFile() and buildIndex() in RELEASES.md and README.md SDK section.

**Why:**
- Phase 1 API is very small: just two exported functions (parseFile, buildIndex) plus types.
- Detailed API docs are useful in Phase 3 when there's a public SDK (Oxori.open(), vault.query(), vault.walk(), vault.write()).
- For Phase 1, the relevant docs are: architecture.md (how Parser/Indexer work), README.md (quick start), RELEASES.md (feature overview), and inline JSDoc.

**Impact:**
- Avoid over-documentation for Phase 1
- Phase 3 can create comprehensive API docs when the surface is larger (SDK public API)
- Current docs (architecture, README, releases) are sufficient for Phase 1 users

---

## Decision 6: Code Examples — Tested or Marked

**What:** All code examples in README and RELEASES are pseudocode or explicitly marked as illustrative.

**Why:**
- Code examples must not lie. If an example shows `await parseFile()` but the real implementation returns a Promise<Result<>>, that's confusing.
- Markdown examples can't be auto-tested like test files can. If we write them, we must either test them separately or mark them as pseudocode.

**How:**
- README.md: examples show the API shape (parseFile, buildIndex) without full imports or error handling
- RELEASES.md: examples show the index file format (markdown blocks) — these are actual format, not pseudocode
- Both clearly show the intended usage pattern

**Impact:**
- Users don't get confused by inaccurate examples
- Examples are illustrative, not load-bearing (no one copies-pastes them expecting 1:1 accuracy)

---

## Decision 7: Docs Are Part of Phase

**What:** Documentation is a work item in Phase 1, not a separate concern. Scheduled for completion before phase merge.

**Why:**
- "Done" for a phase means: code is complete + tests pass + docs are written + reviewed.
- Docs are not optional. They're how future phases understand what Phase 1 built.
- If docs are delayed until after merge, they often don't happen or become stale.

**How:**
- This work is Phase 1 delivery
- RELEASES.md is the last thing written for Phase 1 before tagging v0.1.0
- Architecture.md is updated before Phase 2 begins (to incorporate any Phase 1 learnings)

**Impact:**
- Documentation debt is prevented
- Each phase has clear docs from the start
- Future maintainers don't inherit undocumented code

---

## Decisions NOT Made (Deferred)

### Phase 1-specific API Docs
Deferred to Phase 3 when the public SDK is larger. Phase 1 has just two functions; they're documented in README and RELEASES.

### Changelog Generation
Deferred to `semantic-release` automation in Phase 1 release workflow. Release notes are manual; changelog is auto-generated from commits.

### Integration Test Docs
Deferred to Phase 2. Phase 1 docs focus on layers 1-2. When Query (phase 2) and Graph (phase 2) are added, integration test docs will be useful.

---

## Trade-offs Made

### Comprehensiveness vs. Brevity
✅ **Chose comprehensive.** The team is building a complex 5-phase system. Clear, detailed architecture and contributor docs prevent mistakes and misunderstandings. Brevity can come later if needed.

### Manual Release Notes vs. Auto-Generated
✅ **Chose manual.** Release notes are marketing and user guidance. Auto-generated changelogs (from commits) are useful but not user-friendly. For Phase 1, Dumont writes detailed release notes. Later phases will use `semantic-release` for changelog generation, but release notes are still hand-written.

### Multiple Doc Files vs. Single README
✅ **Chose multiple files.** README is for getting started. Deep dives go in docs/. This scales — Phase 5 will have docs/, RELEASES.md, README.md, and CONTRIBUTING.md, each focused and clear.

---

## Lessons Learned

1. **Architecture docs must precede code.** Developers read docs before touching code. If docs are missing or unclear, developers make different architectural decisions than intended.

2. **Release notes are user guidance, not changelogs.** A changelog says "Added parseFile() function." Release notes say "Phase 1 is now available! Here's what you can do (parse files, build index), here's what's coming (query, graph, search), and here's what you should know (this is schemaless, governance is Phase 3)."

3. **Phase gates matter.** Documentation is a gate. No phase merge without docs. This ensures knowledge is captured when it's fresh.

4. **Decisions need ADRs.** "Why do wikilinks not have extensions?" is answered in ADR-002. Future engineers can read it and understand the reasoning, not just the rule.

5. **Conventions reduce friction.** Clear coding conventions (no `any`, prefer functions, JSDoc public APIs, Conventional Commits) mean fewer code review cycles debating style.
