# Decision: Phase 3 Documentation Updates

**Date:** 2026-04-04  
**Author:** Dumont (Documentation Engineer)  
**Status:** Completed

## Context

Phase 3 implementation is underway with two major additions:
1. **Watcher** (`src/watcher.ts`) — Real-time file monitoring via EventEmitter
2. **Governance** (`src/governance.ts`) — Glob-pattern rule evaluation

Documentation needed updates to reflect these capabilities in README, architecture guide, and release notes.

## Decision

Update three key documentation files to document Phase 3 additions:

### 1. README.md
- Updated features list: v0.2.0 → v0.3.0
- Updated capability list to include "File watching" and "Governance"
- Split "SDK Usage" into four subsections:
  - Parse and Index (existing)
  - Query and Walk (existing, reorganized)
  - **File Watcher** (new) — shows `watch()` API with `on('change')` listener pattern
  - **Governance** (new) — shows `checkGovernance()` API with rule definition and violation handling
- Updated Architecture section description to reflect Phase 3 completeness

### 2. docs/architecture.md
- Added new section **"Phase 3 Additions"** after System Layers and before Data Flow
- Summarizes Watcher layer: EventEmitter-based, wraps fs.watch, emits WatchEvent (add/change/unlink)
- Summarizes Governance layer: glob-pattern rules, deny/allow effects, agents-only enforcement
- Emphasizes that both are pure functions ready for MCP integration
- Includes API signatures for quick reference

### 3. RELEASES.md
- Added **v0.3.0 [Unreleased]** entry at the top
- Sections: Added, Changed, Documentation
- Lists new APIs: `watch()`, `checkGovernance()`
- Lists new types: VaultWatcher, WatchEvent, GovernanceRule, GovernanceViolation, GovernanceResult
- Describes changes to README and architecture.md
- Preserved existing v0.1.0 content below

## Key Details

### API Accuracy
All examples validated against source files:
- `WatchEvent` uses `filepath` (not `path`), `type: "add" | "change" | "unlink"` (not "create"/"modify"/"delete")
- `GovernanceRule` uses `pattern` (glob string), `effect: "allow" | "deny"`, `appliesTo: "agents" | "all"`
- `GovernanceResult.passed` = true when no violations with severity "error"

### Example Completeness
- File Watcher: shows listener attachment, error handling, clean shutdown
- Governance: shows rule definition with id/description/pattern/effect/appliesTo, result checking, violation iteration

### Architecture Clarity
- Phase 3 section emphasizes: Watcher is optional (for long-running processes), Governance is agent-only (humans bypass), both are pure functions
- Fits naturally between Layer 9 description and existing Data Flow section

## Testing
- README examples match actual API signatures from src/watcher.ts and src/governance.ts
- No breaking changes to existing documentation
- All three files are valid markdown with proper formatting

## Outcome
Phase 3 documentation is now complete and ready for:
- SDK users to understand the new Watcher and Governance APIs
- Architecture reviewers to see integration points with existing layers
- Release notes to reflect Phase 3 delivery

## Follow-up
- Monitor user feedback on API clarity and example usefulness
- Update if governance rule syntax evolves
- Add CLI command docs for `watch` and `governance` commands (Phase 5/MCP alignment)
