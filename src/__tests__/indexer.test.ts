import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildLinkGraph,
  buildTagMap,
  computeHash,
  reconcileFiles,
} from "../engine/indexer.js";
import type { FileRecord } from "../types.js";

describe("computeHash", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
      tmpDir = "";
    }
  });

  async function writeTmp(name: string, content: string): Promise<string> {
    if (!tmpDir) {
      tmpDir = join(tmpdir(), `oxori-indexer-test-${randomUUID()}`);
      await mkdir(tmpDir, { recursive: true });
    }
    const filePath = join(tmpDir, name);
    await writeFile(filePath, content, "utf-8");
    return filePath;
  }

  it("is deterministic — same content produces same hash", async () => {
    const filePath = await writeTmp("a.md", "Hello world");
    const hash1 = await computeHash(filePath);
    const hash2 = await computeHash(filePath);
    expect(hash1).toBe(hash2);
  });

  it("changes when content changes — different content produces different hash", async () => {
    const filePath = await writeTmp("b.md", "original content");
    const hash1 = await computeHash(filePath);
    await writeFile(filePath, "modified content", "utf-8");
    const hash2 = await computeHash(filePath);
    expect(hash1).not.toBe(hash2);
  });
});

describe("reconcileFiles", () => {
  let vaultPath: string;

  afterEach(async () => {
    if (vaultPath) await rm(vaultPath, { recursive: true, force: true });
  });

  async function makeVault(): Promise<string> {
    vaultPath = join(tmpdir(), `oxori-reconcile-test-${randomUUID()}`);
    await mkdir(vaultPath, { recursive: true });
    return vaultPath;
  }

  it("new file added — record appears in result", async () => {
    const vault = await makeVault();
    await writeFile(join(vault, "new.md"), "# New\n\nSome content.", "utf-8");

    const records = await reconcileFiles(vault, [], ["new.md"]);

    expect(records).toHaveLength(1);
    expect(records[0].path).toBe("new.md");
    expect(records[0].hash).toBeTruthy();
    expect(records[0].text).toContain("Some content.");
  });

  it("changed file re-parsed — record is updated with new text", async () => {
    const vault = await makeVault();
    await writeFile(join(vault, "changed.md"), "# Old\n\nOld content.", "utf-8");

    // Create an existing record with a stale hash
    const staleRecord: FileRecord = {
      path: "changed.md",
      hash: "stale-hash-that-wont-match",
      text: "Old content.",
      headings: ["Old"],
      tags: [],
      links: [],
    };

    const records = await reconcileFiles(vault, [staleRecord], ["changed.md"]);

    expect(records).toHaveLength(1);
    expect(records[0].path).toBe("changed.md");
    // hash should now be the real one, not the stale one
    expect(records[0].hash).not.toBe("stale-hash-that-wont-match");
    expect(records[0].headings).toContain("Old");
  });

  it("unchanged file is skipped — existing record is reused as-is", async () => {
    const vault = await makeVault();
    const content = "# Stable\n\nStable content.";
    await writeFile(join(vault, "stable.md"), content, "utf-8");

    // Compute real hash so it matches
    const realHash = await computeHash(join(vault, "stable.md"));

    const existingRecord: FileRecord = {
      path: "stable.md",
      hash: realHash,
      text: "Stable content.",
      headings: ["Stable"],
      tags: [],
      links: [],
    };

    const records = await reconcileFiles(vault, [existingRecord], ["stable.md"]);

    expect(records).toHaveLength(1);
    // same object reference — not re-parsed
    expect(records[0]).toBe(existingRecord);
  });

  it("deleted file dropped — no record for file not in filePaths", async () => {
    const vault = await makeVault();
    await writeFile(join(vault, "kept.md"), "Kept content.", "utf-8");

    const deletedRecord: FileRecord = {
      path: "deleted.md",
      hash: "some-hash",
      text: "Deleted content.",
      headings: [],
      tags: [],
      links: [],
    };

    // Only pass "kept.md" in filePaths — deleted.md should be dropped
    const records = await reconcileFiles(vault, [deletedRecord], ["kept.md"]);

    const paths = records.map((r) => r.path);
    expect(paths).not.toContain("deleted.md");
    expect(paths).toContain("kept.md");
  });
});

describe("buildLinkGraph", () => {
  it("backlink inversion — A links to B → B's backlinks contains A", () => {
    const records: FileRecord[] = [
      {
        path: "a.md",
        hash: "h1",
        text: "See b",
        headings: [],
        tags: [],
        links: [{ target: "b", broken: false }],
      },
      {
        path: "b.md",
        hash: "h2",
        text: "I am B",
        headings: [],
        tags: [],
        links: [],
      },
    ];

    const graph = buildLinkGraph(records);

    expect(graph.backlinks["b.md"]).toContain("a.md");
    expect(graph.forward["a.md"]).toContain("b.md");
  });

  it("broken link stored with broken:true — link to nonexistent file is flagged", () => {
    const records: FileRecord[] = [
      {
        path: "a.md",
        hash: "h1",
        text: "See missing",
        headings: [],
        tags: [],
        links: [{ target: "nonexistent", broken: false }],
      },
    ];

    buildLinkGraph(records);

    expect(records[0].links[0].broken).toBe(true);
  });
});

describe("buildTagMap", () => {
  it("groups files by tag — two files sharing a tag both appear under it", () => {
    const records: FileRecord[] = [
      {
        path: "a.md",
        hash: "h1",
        text: "",
        headings: [],
        tags: ["rust", "systems"],
        links: [],
      },
      {
        path: "b.md",
        hash: "h2",
        text: "",
        headings: [],
        tags: ["rust"],
        links: [],
      },
    ];

    const tagMap = buildTagMap(records);

    expect(tagMap["rust"]).toContain("a.md");
    expect(tagMap["rust"]).toContain("b.md");
    expect(tagMap["systems"]).toEqual(["a.md"]);
  });

  it("empty — no tags yields empty object", () => {
    const records: FileRecord[] = [
      {
        path: "a.md",
        hash: "h1",
        text: "no tags here",
        headings: [],
        tags: [],
        links: [],
      },
    ];

    const tagMap = buildTagMap(records);

    expect(tagMap).toEqual({});
  });
});
