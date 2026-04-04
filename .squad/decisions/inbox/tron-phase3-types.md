# Tron: Phase 3 Type Contracts

**Date:** 2026-04-03  
**Phase:** 3 (Watcher + Governance)  
**Wave:** 1 — Types Locked  
**Status:** ✅ Implemented & Build Verified  

---

## Overview

This document specifies all TypeScript type contracts for Phase 3 modules:
- **Watcher** (`src/watcher.ts`): File system change monitoring
- **Governance** (`src/governance.ts`): Rule-based write policy enforcement

All types have been added to `src/types.ts` and exported from `src/index.ts`. Wave 1 implementors must follow these signatures exactly.

---

## New Types Added to `src/types.ts`

### 1. `GovernanceViolation`

Represents a single rule violation found during governance evaluation.

```typescript
export type GovernanceViolation = {
  /** The unique ID of the rule that was violated. */
  ruleId: string;
  /** Human-readable message describing why the rule was violated. */
  message: string;
  /** The filepath (relative or absolute) affected by this violation. */
  filePath: string;
  /** Severity level: "error" prevents the write, "warning" allows but logs. */
  severity: "error" | "warning";
};
```

**Constraints:**
- `ruleId` must match a `GovernanceRule.id` from the input ruleset.
- `filePath` is the target file path (normalized via `path.resolve()` if an absolute path, or relative if provided relative).
- `severity: "error"` blocks writes; `severity: "warning"` is informational.

---

### 2. `GovernanceResult`

Aggregated result of evaluating all governance rules against vault state.

```typescript
export type GovernanceResult = {
  /** True if all rules passed; false if any violation exists. */
  passed: boolean;
  /** Immutable list of violations found during evaluation. */
  violations: readonly GovernanceViolation[];
  /** Unix timestamp (ms) when the evaluation was performed. */
  checkedAt: number;
};
```

**Constraints:**
- `passed === true` ⟺ `violations.length === 0`
- `violations` is readonly to prevent accidental mutation.
- `checkedAt` is a Unix timestamp in milliseconds (`Date.now()`).

---

### 3. `VaultWatcher` (Interface)

EventEmitter-style interface for watching vault filesystem changes.

```typescript
export interface VaultWatcher {
  /**
   * Subscribe to filesystem change events.
   * @param event - The event type: "change" for file modifications, "error" for watcher errors.
   * @param listener - Callback invoked when the event fires.
   * @returns The watcher itself (for method chaining).
   */
  on(event: "change", listener: (e: WatchEvent) => void): this;

  /**
   * Subscribe to watcher errors.
   * @param event - Always "error" for this overload.
   * @param listener - Callback invoked when a filesystem watch error occurs.
   * @returns The watcher itself (for method chaining).
   */
  on(event: "error", listener: (err: Error) => void): this;

  /**
   * Stop watching and clean up the underlying fs.watch handle.
   * After calling stop(), no further events will be emitted.
   */
  stop(): void;
}
```

**Constraints:**
- Must support EventEmitter-style `.on()` chaining (returns `this`).
- Two event types: `"change"` emits `WatchEvent`, `"error"` emits `Error`.
- `stop()` must be synchronous and immediately halt further event emissions.
- Multiple listeners per event are supported (standard EventEmitter behavior).

---

## Existing Types Referenced

### `WatchEvent` (from Phase 1)

Used by the watcher to emit filesystem changes:

```typescript
export type WatchEvent = {
  /** The kind of filesystem change: "add", "change", or "unlink". */
  type: "add" | "change" | "unlink";
  /** Absolute path of the affected file, normalized via path.resolve(). */
  filepath: string;
  /** Unix timestamp (ms) when the event was emitted. */
  timestamp: number;
};
```

---

### `GovernanceRule` (from Phase 1)

Defines a single access control rule evaluated by the governance engine:

```typescript
export type GovernanceRule = {
  /** Unique identifier for this rule. Used in error messages and audit logs. */
  id: string;
  /** Human-readable explanation of what this rule enforces. */
  description: string;
  /** Glob or regex string matched against the target filepath or content. */
  pattern: string;
  /** Whether a matching write is permitted or blocked. */
  effect: "allow" | "deny";
  /** Scope: "agents" for MCP/agent writes only; "all" for future use. */
  appliesTo: "agents" | "all";
};
```

---

### `IndexState` (from Phase 1)

Current state of the vault index; input to governance evaluation:

```typescript
export type IndexState = {
  files: Map<string, ParsedFile>;
  tags: Map<string, TagEntry[]>;
  links: Map<string, LinkEntry[]>;
  relations: Map<string, TypedRelation[]>;
  updatedAt: number;
};
```

---

## Function Signatures for Wave 1+ Implementors

### Watcher Module: `watch()`

**Location:** `src/watcher.ts`

```typescript
/**
 * Create a vault watcher that monitors filesystem changes.
 * 
 * @param vaultPath - Absolute or relative path to the vault directory.
 * @param config - Optional VaultConfig with settings (e.g., ignore patterns).
 * @returns A VaultWatcher instance.
 * 
 * @remarks
 * - Wraps Node.js fs.watch internally.
 * - Emits WatchEvent on every file change (add, change, unlink).
 * - Call .stop() to release the fs.watch handle.
 * - Caller is responsible for cleanup; no auto-cleanup on process exit.
 */
export function watch(
  vaultPath: string,
  config?: VaultConfig
): VaultWatcher;
```

**Event Flow:**
1. Caller invokes `watch(vaultPath)`.
2. Watcher subscribes to Node.js `fs.watch(vaultPath)`.
3. On filesystem changes, emits `WatchEvent` via `on('change', ...)`.
4. On watch errors (e.g., permission denied), emits `Error` via `on('error', ...)`.
5. Caller calls `stop()` to clean up.

**Example Usage:**
```typescript
const watcher = watch("/path/to/vault");
watcher.on("change", (event) => {
  console.log(`${event.type}: ${event.filepath}`);
});
watcher.on("error", (err) => {
  console.error("Watch error:", err);
});
// ... later ...
watcher.stop();
```

---

### Governance Module: `checkGovernance()`

**Location:** `src/governance.ts`

```typescript
/**
 * Evaluate governance rules against vault state.
 * 
 * @param rules - Array of GovernanceRule to evaluate (in declaration order).
 * @param state - Current IndexState from the vault.
 * @returns GovernanceResult with passed flag and violations list.
 * 
 * @remarks
 * - Rules are evaluated in declaration order; first match wins.
 * - All filepaths in violations are normalized (resolved).
 * - Result is synchronous; no async operations.
 * - Violations are sorted by filePath for consistent output.
 */
export function checkGovernance(
  rules: GovernanceRule[],
  state: IndexState
): GovernanceResult;
```

**Evaluation Logic:**
1. Iterate through `rules` in order.
2. For each rule, check if any file in `state.files` matches `rule.pattern`.
3. If a match is found:
   - If `rule.effect === "deny"`, record a violation with `severity: "error"`.
   - If `rule.effect === "allow"`, continue (no violation).
4. Return `GovernanceResult` with `passed` and `violations`.

**Example Usage:**
```typescript
const rules: GovernanceRule[] = [
  {
    id: "no-agent-writes-to-archive",
    description: "Agents must not modify archived files",
    pattern: "archive/**",
    effect: "deny",
    appliesTo: "agents"
  }
];

const result = checkGovernance(rules, vaultState);
if (!result.passed) {
  for (const v of result.violations) {
    console.error(`[${v.severity}] ${v.ruleId}: ${v.message}`);
  }
}
```

---

## Exports

All new types are exported from `src/index.ts`:

```typescript
export type {
  // ... existing types ...
  // Phase 3 — Watcher and Governance
  VaultWatcher,
  GovernanceViolation,
  GovernanceResult,
  // ... other types ...
};
```

Consumers can now import:
```typescript
import {
  VaultWatcher,
  GovernanceViolation,
  GovernanceResult,
  WatchEvent,
  GovernanceRule,
  IndexState
} from "oxori";
```

---

## Build Status

✅ **`pnpm build` verified successful**  
- TypeScript types compile with zero errors.
- All exports are correctly bound.
- Ready for Wave 1 implementation.

---

## Implementation Notes for Wave 1

1. **Watcher (`src/watcher.ts`):**
   - Must implement `VaultWatcher` interface exactly.
   - Use Node.js `fs.watch()` internally (not `fs.watchFile` — different semantics).
   - Normalize filepaths via `path.resolve()`.
   - Handle recursive directory watching.
   - Debounce rapid successive events if needed (document behavior).

2. **Governance (`src/governance.ts`):**
   - Must implement `checkGovernance()` function exactly.
   - Match filepaths against `rule.pattern` using glob matching or regex (TBD in Wave 1 design).
   - Preserve rule order (first match wins).
   - Record **all** violations, not just the first.
   - Sort violations by `filePath` for deterministic output.
   - Include human-readable messages in violations.

3. **Testing:**
   - Governance module requires ≥95% coverage (per gate criterion #16).
   - Writer module requires ≥90% coverage.
   - Fixtures: `governance-vault/` with sample rules (designed by Yori).

---

## Sign-Off

**Document Owner:** Tron (Senior TypeScript Engineer)  
**Reviewed by:** (Awaiting Flynn)  
**Status:** Pending Flynn Approval

---

## Appendix: Related Decisions

- **castor-phase3-gate.md** — 22-criterion gate checklist
- **flynn-phase3-types-review.md** — (To be written after this document)
- **yori-fixture-design.md** — governance-vault/ fixture specification
