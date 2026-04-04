/**
 * @file governance.test.ts
 * @description Unit + integration tests for the checkGovernance() function — Phase 3.
 *
 * Tests are written to validate the governance engine implementation in src/governance.ts.
 * Governance rules use glob `pattern` + `effect: "allow" | "deny"` with first-match-wins
 * semantics. All functions are pure — IndexState objects are built directly, no I/O.
 *
 * Path note: state.files keys are treated as relative paths in tests so that simple
 * glob patterns like "secrets/**" match without needing absolute-path variants.
 *
 * Run: pnpm test:coverage
 */

import { describe, it, expect } from "vitest";
import { checkGovernance } from "../src/governance";
import type {
  GovernanceRule,
  IndexState,
  FileEntry,
} from "../src/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal FileEntry for use in test IndexState maps. */
function makeEntry(filepath: string): FileEntry {
  return {
    filepath,
    filename: filepath.split("/").pop()!.replace(".md", ""),
    frontmatter: {},
    tags: new Set<string>(),
    wikilinks: new Set<string>(),
    typedRelations: new Map(),
    lastModified: 0,
  };
}

/** Build an IndexState from a flat list of relative file paths. */
function makeState(paths: string[]): IndexState {
  const files = new Map<string, FileEntry>(
    paths.map((p) => [p, makeEntry(p)]),
  );
  return {
    files,
    tags: new Map(),
    links: new Map(),
    totalFiles: files.size,
    lastIndexed: Date.now(),
  };
}

/** A deny rule that blocks all files matching a glob. */
function denyRule(
  id: string,
  pattern: string,
  description = `deny ${pattern}`,
): GovernanceRule {
  return { id, description, pattern, effect: "deny", appliesTo: "agents" };
}

/** An allow rule that explicitly permits all files matching a glob. */
function allowRule(
  id: string,
  pattern: string,
  description = `allow ${pattern}`,
): GovernanceRule {
  return { id, description, pattern, effect: "allow", appliesTo: "agents" };
}

// ---------------------------------------------------------------------------
// checkGovernance()
// ---------------------------------------------------------------------------

describe("checkGovernance()", () => {
  // ── passed:true / passed:false ──────────────────────────────────────────

  it("returns passed:true when no rules are violated", () => {
    const state = makeState(["notes/public.md", "journal/today.md"]);
    // No deny rules that match these paths
    const rules: GovernanceRule[] = [
      allowRule("allow-all", "**"),
    ];
    const result = checkGovernance(rules, state);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("returns passed:false when a rule is violated", () => {
    const state = makeState(["secrets/agent-key.md"]);
    const rules: GovernanceRule[] = [
      denyRule("no-secrets", "secrets/**"),
    ];
    const result = checkGovernance(rules, state);
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
  });

  // ── required-tag / no-orphan / max-links are not in the implementation ──

  it.todo(
    "required-tag rule flags files missing a required tag — " +
      "checkGovernance uses glob path patterns only; tag-based rules are not implemented",
  );

  it.todo(
    "no-orphan rule flags files with no links — " +
      "checkGovernance uses glob path patterns only; link-count rules are not implemented",
  );

  it.todo(
    "max-links rule flags files exceeding link count — " +
      "checkGovernance uses glob path patterns only; max-links rules are not implemented",
  );

  // ── violation shape ──────────────────────────────────────────────────────

  it("violations array contains filePath and ruleId", () => {
    const state = makeState(["archive/old-post.md"]);
    const rules: GovernanceRule[] = [
      denyRule("no-archive-writes", "archive/**", "Agents must not modify archive"),
    ];
    const result = checkGovernance(rules, state);
    expect(result.violations).toHaveLength(1);
    const v = result.violations[0];
    expect(v?.ruleId).toBe("no-archive-writes");
    expect(v?.filePath).toBe("archive/old-post.md");
    expect(v?.message).toBe("Agents must not modify archive");
    expect(v?.severity).toBe("error");
  });

  // ── severity:error causes passed:false ──────────────────────────────────

  it("severity:error violations cause passed:false", () => {
    const state = makeState(["secrets/credentials.md"]);
    const rules: GovernanceRule[] = [
      denyRule("protect-secrets", "secrets/**"),
    ];
    const result = checkGovernance(rules, state);
    // deny always produces severity: "error"
    expect(result.violations[0]?.severity).toBe("error");
    expect(result.passed).toBe(false);
  });

  it.todo(
    "severity:warning violations do NOT cause passed:false — " +
      "checkGovernance only ever emits severity:'error'; no warning path exists in the implementation",
  );

  // ── empty rules ──────────────────────────────────────────────────────────

  it("empty rules array always returns passed:true", () => {
    const state = makeState([
      "secrets/key.md",
      "archive/old.md",
      "notes/public.md",
    ]);
    const result = checkGovernance([], state);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  // ── checkedAt ────────────────────────────────────────────────────────────

  it("checkedAt field is a valid timestamp", () => {
    const before = Date.now();
    const result = checkGovernance([], makeState([]));
    const after = Date.now();
    expect(result.checkedAt).toBeGreaterThanOrEqual(before);
    expect(result.checkedAt).toBeLessThanOrEqual(after);
  });

  // ── first-match-wins semantics ───────────────────────────────────────────

  it("allow before deny — allow wins, no violation produced", () => {
    // Rule order: allow secrets/public.md → deny secrets/**
    // The file matches allow first → no violation
    const state = makeState(["secrets/public.md"]);
    const rules: GovernanceRule[] = [
      allowRule("allow-public", "secrets/public.md"),
      denyRule("no-secrets", "secrets/**"),
    ];
    const result = checkGovernance(rules, state);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("deny before allow — deny wins, violation is produced", () => {
    // Rule order: deny secrets/** → allow secrets/public.md
    // The file matches deny first → violation
    const state = makeState(["secrets/public.md"]);
    const rules: GovernanceRule[] = [
      denyRule("no-secrets", "secrets/**"),
      allowRule("allow-public", "secrets/public.md"),
    ];
    const result = checkGovernance(rules, state);
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.ruleId).toBe("no-secrets");
  });

  // ── non-matching files ───────────────────────────────────────────────────

  it("files not matching any rule produce no violation", () => {
    const state = makeState(["notes/research.md", "journal/daily.md"]);
    const rules: GovernanceRule[] = [
      denyRule("no-secrets", "secrets/**"),
      denyRule("no-archive", "archive/**"),
    ];
    const result = checkGovernance(rules, state);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  // ── multiple files ───────────────────────────────────────────────────────

  it("multiple files — only matching files produce violations", () => {
    const state = makeState([
      "notes/public.md",
      "secrets/key.md",
      "journal/entry.md",
      "secrets/token.md",
    ]);
    const rules: GovernanceRule[] = [
      denyRule("no-secrets", "secrets/**"),
    ];
    const result = checkGovernance(rules, state);
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(2);
    // All violations come from the deny rule
    expect(result.violations.every((v) => v.ruleId === "no-secrets")).toBe(true);
    // Only secrets/* paths are in violations
    expect(
      result.violations.every((v) => v.filePath.startsWith("secrets/")),
    ).toBe(true);
  });

  // ── violations are sorted by filePath ────────────────────────────────────

  it("violations are sorted by filePath for deterministic output", () => {
    // Files added in reverse alphabetical order
    const state = makeState([
      "secrets/z-last.md",
      "secrets/a-first.md",
      "secrets/m-middle.md",
    ]);
    const rules: GovernanceRule[] = [
      denyRule("no-secrets", "secrets/**"),
    ];
    const result = checkGovernance(rules, state);
    expect(result.violations).toHaveLength(3);
    const paths = result.violations.map((v) => v.filePath);
    expect(paths).toEqual([...paths].sort());
  });

  // ── empty vault state ─────────────────────────────────────────────────────

  it("empty IndexState (no files) always returns passed:true", () => {
    const rules: GovernanceRule[] = [
      denyRule("no-secrets", "secrets/**"),
    ];
    const result = checkGovernance(rules, makeState([]));
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  // ── multiple deny rules — each file only triggers its first match ─────────

  it("each file only triggers one violation even if multiple deny rules match", () => {
    const state = makeState(["secrets/key.md"]);
    const rules: GovernanceRule[] = [
      denyRule("first-deny", "secrets/**"),
      denyRule("second-deny", "**/*.md"), // also matches
    ];
    const result = checkGovernance(rules, state);
    // First-match-wins: only "first-deny" is triggered
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.ruleId).toBe("first-deny");
  });
});
