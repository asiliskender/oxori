import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { indexCommand } from "../commands/index.js";
import { initCommand } from "../commands/init.js";
import { searchCommand } from "../commands/search.js";
import type { IndexData } from "../types.js";

describe("integration", () => {
  let vaultPath: string;

  afterEach(async () => {
    if (vaultPath) await rm(vaultPath, { recursive: true, force: true });
  });

  function makeVault(): string {
    vaultPath = join(tmpdir(), `oxori-integration-${randomUUID()}`);
    return vaultPath;
  }

  async function readIndexJson(vault: string): Promise<IndexData> {
    const raw = await readFile(join(vault, ".oxori", "index.json"), "utf-8");
    return JSON.parse(raw) as IndexData;
  }

  it("initCommand on empty dir — .oxori/ created, index.json exists, config.json exists", async () => {
    const vault = makeVault();
    await mkdir(vault, { recursive: true });
    await initCommand(vault);

    const index = await readIndexJson(vault);
    expect(index).toBeDefined();
    expect(index.version).toBe(1);

    const config = JSON.parse(await readFile(join(vault, ".oxori", "config.json"), "utf-8"));
    expect(config).toBeDefined();
    expect(config.version).toBe(1);
  });

  it("initCommand on already-initialized vault — throws error containing 'already initialized'", async () => {
    const vault = makeVault();
    await mkdir(vault, { recursive: true });
    await initCommand(vault);

    await expect(initCommand(vault)).rejects.toThrow(/already initialized/i);
  });

  it("initCommand on vault with zero .md files — succeeds, index.files is empty array", async () => {
    const vault = makeVault();
    await mkdir(vault, { recursive: true });
    await initCommand(vault);

    const index = await readIndexJson(vault);
    expect(index.files).toEqual([]);
  });

  it("indexCommand after adding new .md file — new file's record appears in index", async () => {
    const vault = makeVault();
    await mkdir(vault, { recursive: true });
    await initCommand(vault);

    await writeFile(join(vault, "new-note.md"), "# New Note\n\nFresh content here.", "utf-8");
    await indexCommand(vault);

    const index = await readIndexJson(vault);
    const paths = index.files.map((f) => f.path);
    expect(paths).toContain("new-note.md");
  });

  it("indexCommand after editing a file — record updated, new content in text field", async () => {
    const vault = makeVault();
    await mkdir(vault, { recursive: true });
    await writeFile(join(vault, "note.md"), "# Note\n\nOriginal content.", "utf-8");
    await initCommand(vault);

    // Edit the file
    await writeFile(join(vault, "note.md"), "# Note\n\nUpdated content after edit.", "utf-8");
    await indexCommand(vault);

    const index = await readIndexJson(vault);
    const record = index.files.find((f) => f.path === "note.md");
    expect(record).toBeDefined();
    expect(record?.text).toContain("Updated content after edit");
  });

  it("indexCommand after deleting a file — record no longer in index", async () => {
    const vault = makeVault();
    await mkdir(vault, { recursive: true });
    await writeFile(join(vault, "to-delete.md"), "# To Delete\n\nThis will be removed.", "utf-8");
    await initCommand(vault);

    await unlink(join(vault, "to-delete.md"));
    await indexCommand(vault);

    const index = await readIndexJson(vault);
    const paths = index.files.map((f) => f.path);
    expect(paths).not.toContain("to-delete.md");
  });

  it("searchCommand returns correct path+headings+snippet", async () => {
    const vault = makeVault();
    await mkdir(vault, { recursive: true });
    await writeFile(
      join(vault, "rust-intro.md"),
      "# Introduction to Rust\n\nRust is a systems programming language focused on safety.\n\n## Features\n\nMemory safety without garbage collection.",
      "utf-8",
    );
    await initCommand(vault);

    const results = await searchCommand(vault, "safety", { mode: "text" });

    expect(results.length).toBeGreaterThan(0);
    const result = results.find((r) => r.path === "rust-intro.md");
    expect(result).toBeDefined();
    expect(result?.path).toBe("rust-intro.md");
    expect(result?.snippet.toLowerCase()).toContain("safety");
  });
});
