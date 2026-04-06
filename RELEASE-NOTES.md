# Release Notes — v0.3.0

## What's New

Oxori v0.3.0 extends the query engine with real-time vault monitoring and policy enforcement:

### File Watcher

- **`watch(vaultPath, config?)`** — Real-time file watcher emitting `WatchEvent` (add/change/unlink) for markdown files in your vault. Built on EventEmitter for easy integration with indexers and MCP servers.
- **WatchEvent** — Emitted on file changes with fields: `type` (add/change/unlink), `filepath` (absolute), `timestamp` (ms)

### Governance Rules

- **`checkGovernance(rules, state)`** — Glob-pattern-based governance rule evaluation. Define rules with `id`, `pattern`, `effect` (allow/deny), and `appliesTo` (agents). Returns `GovernanceResult` with violations list.
- **Enforcement** — Policy rules apply to agent writes only; humans bypass governance by design.

### Types

- **New exports** — `VaultWatcher`, `WatchEvent`, `GovernanceRule`, `GovernanceViolation`, `GovernanceResult` are now part of the public API alongside existing query and graph traversal types.

### Documentation

- **README.md** — Updated with "File Watcher" and "Governance" sections with complete code examples.
- **docs/architecture.md** — Added "Sprint 3 Additions" section with watcher and governance implementation details.

### Pure Function Design

Both the watcher and governance layers are implemented as pure functions with no I/O or side effects in core logic, maintaining the SDK's simplicity and testability.

