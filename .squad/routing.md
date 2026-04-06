# Work Routing

How to decide who handles what for Oxori.

## Routing Table

| Work Type | Route To | Examples |
|-----------|----------|----------|
| Architecture decisions, sprint gates, API design | Flynn | Interface design, layer boundaries, public SDK shape |
| parser.ts, indexer.ts, query.ts, types.ts | Tron | Frontmatter parsing, in-memory cache, query AST |
| graph.ts, search.ts, watcher.ts, writer.ts, mcp.ts | Ram | Link traversal, vector search, filesystem watching |
| All test files, test fixtures, coverage | Yori | Unit tests, integration tests, fixture vaults |
| docs/, README, CONTRIBUTING, release notes | Dumont | Architecture docs, inline JSDoc, changelogs |
| GitHub Actions, CI/CD, npm publish, build config | Clu | ci.yml, release.yml, tsup config, semantic-release |
| Sprint priorities, scope, requirements, backlog | Castor | What to build next, trade-offs, sprint planning |
| MCP server design, agent integration patterns | Quorra | MCP tools/resources, agent interaction ergonomics |
| Code review, reviewer gates, sprint sign-off | Flynn | Reviews all PRs, approves sprint completion |
| Session logging, decisions merge | Scribe | Automatic — never needs routing |
| Work queue, backlog monitoring | Ralph | Automatic — issue tracking |

## Issue Routing

| Label | Action | Who |
|-------|--------|-----|
| `squad` | Triage: analyze issue, assign squad:{member} label | Flynn |
| `squad:flynn` | Architecture, review, decisions | Flynn |
| `squad:tron` | Parser, indexer, query engine, types | Tron |
| `squad:ram` | Graph, search, watcher, writer, MCP impl | Ram |
| `squad:yori` | Tests, fixtures, coverage | Yori |
| `squad:dumont` | Docs, README, release notes | Dumont |
| `squad:clu` | CI/CD, DevOps, releases | Clu |
| `squad:castor` | Product, scope, priorities | Castor |
| `squad:quorra` | Agent integration, MCP design | Quorra |

## Rules

1. **Eager by default** — spawn all agents who could usefully start work, including anticipatory downstream work.
2. **Scribe always runs** after substantial work, always as mode background. Never blocks.
3. **Quick facts → coordinator answers directly.** Don't spawn an agent for questions already in context.
4. **When two agents could handle it**, pick the one whose domain is primary.
5. **Team fan-out** — spawn all relevant agents in parallel as background.
6. **Anticipate downstream work.** Building a module? Yori writes tests from spec simultaneously. Dumont drafts docs.
7. **Sprint gates require Flynn's approval.** No sprint merge without Flynn reviewing test coverage and docs completeness.
8. **Quorra and Ram collaborate on MCP.** Quorra designs agent interaction patterns; Ram implements the server.
