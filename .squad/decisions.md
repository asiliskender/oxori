# Squad Decisions

## Active Decisions

### 2026-04-03: Full sprint backlog created for all 5 phases

**By:** Castor (Product Owner)

**What:** Complete sprint backlog written to `.squad/backlog.md` covering ~38 GitHub issues across all 5 phases. Each phase is a separate shippable npm release (v0.1.0 through v0.5.0). Phase gates owned by Flynn, release notes owned by Dumont.

**Why:** Onur Asiliskender requested full sprint planning before development begins. Clear backlog enables team parallelization (Tron on parser, Ram on graph, Yori on tests) and prevents scope creep by defining phase boundaries explicitly.

**Scope Decisions:**
- Each phase is one npm release — no partial merges to main
- Phase gates (assigned to Flynn) gate all other PRs per phase — design review + approval before merge
- Release notes (assigned to Dumont) are the last issue per phase — document features, breaking changes, migration steps
- Phases 1-3 are "core" (parser, query, write, governance), Phases 4-5 are "extensions" (search, MCP)
- Phase 4 (semantic search) is optional — core Oxori works without embeddings
- Phase 5 (MCP + Obsidian) is the capstone — humans + agents on same vault
- 80% coverage minimum per phase, parser/indexer/governance target 95%
- All phases use conventional commits, atomic commits, and detailed commit messages
- Each phase has integration tests that verify all components work together

**Team Routing:**
- Flynn: Phase gates, architecture review, final approval per phase
- Tron: types, parser, indexer, query, CLI (Phases 1-2)
- Ram: graph, writer, governance, search, MCP, watcher (Phases 2-5)
- Yori: All test suites (Phases 1-5)
- Dumont: All release notes and documentation (Phases 1-5)
- Clu: CI/CD setup (Phase 1)
- Quorra: MCP protocol expertise (Phase 5)

**Next Steps:**
1. Team reviews backlog in `.squad/backlog.md`
2. Each phase starts when previous phase is merged and tagged
3. Developers create PRs linking to the Phase N Kickoff issue
4. Flynn approves/gates each PR per phase
5. On merge to main, tag as v0.X.0 and publish to npm
6. Dumont writes release notes
7. Repeat for next phase

**Success Metric:**
Backlog is complete when: all 5 phases released, 80%+ coverage, full docs, MCP server working, Obsidian compatible, and humans + agents are reading/writing the same vault via Oxori.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
