import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, it } from "vitest";
import { indexCommand } from "../commands/index.js";
import { initCommand } from "../commands/init.js";
import { searchCommand } from "../commands/search.js";
import type { IndexData } from "../types.js";

const vaultPath = join(tmpdir(), `oxori-acceptance-${randomUUID()}`);

afterAll(async () => {
  await rm(vaultPath, { recursive: true, force: true });
});

it("Phase 1 acceptance scenario", async () => {
  // Step 1: Start with an empty folder
  await mkdir(vaultPath, { recursive: true });
  await expect(access(vaultPath)).resolves.toBeUndefined();

  // Step 2: oxori init → .oxori/ and an (empty) index are created
  await initCommand(vaultPath);
  const oxoriDir = join(vaultPath, ".oxori");
  const indexPath = join(oxoriDir, "index.json");
  const configPath = join(oxoriDir, "config.json");
  await expect(access(indexPath)).resolves.toBeUndefined();
  await expect(access(configPath)).resolves.toBeUndefined();
  const indexAfterInit = JSON.parse(await readFile(indexPath, "utf-8")) as IndexData;
  expect(indexAfterInit.files).toHaveLength(0);

  // Step 3: Write 3 markdown notes with [[links]] and #tags
  const noteA =
    "# Alpha Note\nThis is the alpha note with keyword wristband.\n[[note-b]]\n#project\n";
  const noteB = "# Beta Note\nThe beta note links back context.\n[[note-c]]\n#project #research\n";
  const noteC = "# Gamma Note\nFinal note in the chain.\n#research\n";
  await writeFile(join(vaultPath, "note-a.md"), noteA, "utf-8");
  await writeFile(join(vaultPath, "note-b.md"), noteB, "utf-8");
  await writeFile(join(vaultPath, "note-c.md"), noteC, "utf-8");
  await expect(access(join(vaultPath, "note-a.md"))).resolves.toBeUndefined();
  await expect(access(join(vaultPath, "note-b.md"))).resolves.toBeUndefined();
  await expect(access(join(vaultPath, "note-c.md"))).resolves.toBeUndefined();

  // Step 4: oxori index → index reflects all 3 files, links, backlinks, tags
  await indexCommand(vaultPath);
  const indexAfterIndex = JSON.parse(await readFile(indexPath, "utf-8")) as IndexData;
  expect(indexAfterIndex.files).toHaveLength(3);

  // Forward link: note-a → note-b
  const forwardLinks = indexAfterIndex.linkGraph.forward["note-a.md"] ?? [];
  expect(forwardLinks).toContain("note-b.md");

  // Backlink: note-b ← note-a
  const backlinks = indexAfterIndex.linkGraph.backlinks["note-b.md"] ?? [];
  expect(backlinks).toContain("note-a.md");

  // tagMap: #project contains note-a and note-b
  const projectFiles = indexAfterIndex.tagMap.project ?? [];
  expect(projectFiles).toContain("note-a.md");
  expect(projectFiles).toContain("note-b.md");

  // Step 5: text search "wristband" → note-a.md with snippet
  const textResults = await searchCommand(vaultPath, "wristband", { mode: "text" });
  expect(textResults.length).toBeGreaterThanOrEqual(1);
  expect(textResults[0].path).toBe("note-a.md");
  expect(textResults[0].snippet.toLowerCase()).toContain("wristband");

  // Step 6: structural search for "note-b.md" → backlinks includes "note-a.md"
  const structuralResults = await searchCommand(vaultPath, "note-b.md", {
    mode: "structural",
    structuralTarget: "note-b.md",
  });
  const backlinkPaths = structuralResults.map((r) => r.path);
  expect(backlinkPaths).toContain("note-a.md");

  // Step 7: JSON search (same as step 5 but validated as SearchResult[])
  const jsonResults = await searchCommand(vaultPath, "wristband", { mode: "text" });
  expect(jsonResults[0].path).toBe("note-a.md");
  const serialized = JSON.stringify(jsonResults);
  expect(() => JSON.parse(serialized)).not.toThrow();
  const parsed = JSON.parse(serialized) as typeof jsonResults;
  expect(parsed[0].path).toBe("note-a.md");
  expect(parsed[0].snippet.toLowerCase()).toContain("wristband");
});
