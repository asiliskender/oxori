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
  PathRule,
  TagRule,
  LinkRule,
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

  for (const [filePath, fileEntry] of state.files) {
    for (const rule of rules) {
      if (!micromatch.isMatch(filePath, rule.pattern)) continue;

      // Dispatch on the ruleType discriminant for exhaustive narrowing.
      switch (rule.ruleType) {
        case "path": {
          const pathRule: PathRule = rule;
          if (pathRule.effect === "deny") {
            violations.push({
              ruleId: pathRule.id,
              // description is optional on PathRule; fall back to a default message.
              message: pathRule.description ?? `deny rule '${pathRule.id}' matched '${filePath}'`,
              filePath,
              severity: "error",
            });
          }
          // First matching rule wins — stop evaluating further rules for this file.
          break;
        }

        case "tag": {
          const tagRule: TagRule = rule;
          // FileEntry.tags is a ReadonlySet<string> containing all expanded tag levels.
          if (!fileEntry.tags.has(tagRule.requiredTag)) {
            violations.push({
              ruleId: tagRule.id,
              message:
                tagRule.description ??
                `file '${filePath}' matched pattern '${tagRule.pattern}' but is missing required tag '${tagRule.requiredTag}'`,
              filePath,
              severity: "error",
            });
          }
          // First matching rule wins.
          break;
        }

        case "link": {
          const linkRule: LinkRule = rule;
          // FileEntry.wikilinks contains outbound wikilink stems — use its size as outbound link count.
          const outboundCount = fileEntry.wikilinks.size;

          if (linkRule.minLinks !== undefined && outboundCount < linkRule.minLinks) {
            violations.push({
              ruleId: linkRule.id,
              message:
                linkRule.description ??
                `file '${filePath}' has ${outboundCount} outbound links, minimum required is ${linkRule.minLinks}`,
              filePath,
              severity: "error",
            });
          } else if (linkRule.maxLinks !== undefined && outboundCount > linkRule.maxLinks) {
            violations.push({
              ruleId: linkRule.id,
              message:
                linkRule.description ??
                `file '${filePath}' has ${outboundCount} outbound links, maximum allowed is ${linkRule.maxLinks}`,
              filePath,
              severity: "error",
            });
          }
          // First matching rule wins.
          break;
        }

        default: {
          // Exhaustiveness guard: if a new ruleType is added to the union but
          // not handled here, TypeScript will flag this as an error at compile time.
          const _exhaustive: never = rule;
          void _exhaustive;
        }
      }

      // All rule types: first match per file terminates further rule evaluation.
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
