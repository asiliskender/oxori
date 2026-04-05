/**
 * @file governance.ts
 * @description Governance rule evaluation engine for Oxori vaults.
 *
 * Evaluates an ordered list of `GovernanceRule` entries against an `IndexState`.
 * Rules are tested in declaration order; the first matching rule per file wins.
 * `deny` matches produce `GovernanceViolation` entries with `severity: "error"`.
 * `allow` matches are silently accepted — no violation is recorded.
 *
 * All functions are pure — no I/O, no mutation of `IndexState`.
 *
 * @module governance
 */

import micromatch from "micromatch";
import type {
  GovernanceRule,
  GovernanceResult,
  GovernanceViolation,
  IndexState,
} from "./types.js";

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * @brief Evaluates governance rules against the current vault state.
 *
 * Evaluate governance rules against the current vault state.
 *
 * Rules are evaluated in declaration order per file; the first matching rule
 * wins. A `deny` match records a `GovernanceViolation` with `severity: "error"`.
 * An `allow` match terminates rule evaluation for that file silently.
 *
 * Violations are sorted by `filePath` for deterministic output.
 *
 * @param rules - Ordered array of `GovernanceRule` to evaluate.
 * @param state - Current vault `IndexState` produced by the indexer.
 * @returns A `GovernanceResult` with `passed`, `violations`, and `checkedAt`.
 *
 * @example
 * const result = checkGovernance(rules, state);
 * if (!result.passed) {
 *   for (const v of result.violations) {
 *     console.error(`[${v.severity}] ${v.ruleId}: ${v.message}`);
 *   }
 * }
 *
 * @since 0.3.0
 */
export function checkGovernance(
  rules: GovernanceRule[],
  state: IndexState,
): GovernanceResult {
  const violations: GovernanceViolation[] = [];

  for (const [filePath] of state.files) {
    for (const rule of rules) {
      if (!micromatch.isMatch(filePath, rule.pattern)) continue;

      if (rule.effect === "deny") {
        violations.push({
          ruleId: rule.id,
          message: rule.description,
          filePath,
          severity: "error",
        });
      }

      // First matching rule wins — stop evaluating further rules for this file.
      break;
    }
  }

  violations.sort((a, b) => a.filePath.localeCompare(b.filePath));

  const passed = violations.every((v) => v.severity !== "error");

  return {
    passed,
    violations,
    checkedAt: Date.now(),
  };
}
