# Squad Team

> oxori — Where humans and AI agents think together, in markdown.

## Coordinator

| Name | Role | Notes |
|------|------|-------|
| Squad | Coordinator | Routes work, enforces handoffs and reviewer gates. |

## Members

| Name | Role | Charter | Status |
|------|------|---------|--------|
| Flynn | Lead & Architect | .squad/agents/flynn/charter.md | 🟢 Active |
| Tron | Core Dev | .squad/agents/tron/charter.md | 🟢 Active |
| Ram | Platform Dev | .squad/agents/ram/charter.md | 🟢 Active |
| Yori | Tester / QA | .squad/agents/yori/charter.md | 🟢 Active |
| Dumont | DevRel / Docs | .squad/agents/dumont/charter.md | 🟢 Active |
| Clu | DevOps | .squad/agents/clu/charter.md | 🟢 Active |
| Castor | Product Owner | .squad/agents/castor/charter.md | 🟢 Active |
| Quorra | AI Agent Builder | .squad/agents/quorra/charter.md | 🟢 Active |
| Scribe | Scribe | .squad/agents/scribe/charter.md | 📋 Silent |
| Ralph | Work Monitor | .squad/agents/ralph/charter.md | 🔄 Monitor |

## Project Context

- **Project:** oxori
- **Owner:** Onur Asiliskender
- **Tagline:** Where humans and AI agents think together, in markdown
- **Stack:** TypeScript 5.x, Node.js 20+, pnpm, vitest, tsup
- **Created:** 2026-04-03
- **Universe:** Tron

## Build Phases

| Phase | Focus | Status |
|-------|-------|--------|
| 1 | Parser + Markdown Index | ✅ Complete (v0.1.0) |
| 2 | Query Engine + Graph Walk | ✅ Complete (v0.2.0) |
| 3 | Write API + Governance | ✅ Complete (v0.3.0) |
| 4 | Governance Rules + CLI + Coverage | 🔜 Next |
| 5 | MCP Server + Obsidian Compat | 🔜 Planned |

## Workflow

**Feature Branch Model (D2 Directive):** All work follows feature-branch → PR → review → merge pattern. Main branch is protected. Every phase uses a dedicated feature branch (e.g., `feature/phase-4-governance`), with Flynn's approval required before merging to main.
