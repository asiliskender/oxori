import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readConfig, readIndex, writeConfig, writeIndex } from "../engine/store.js";
import type { Config, IndexData } from "../types.js";

describe("store", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  function makeTmpVault(): string {
    tmpDir = join(tmpdir(), `oxori-store-test-${randomUUID()}`);
    return tmpDir;
  }

  const sampleIndex: IndexData = {
    version: 1,
    parserVersion: 2,
    updatedAt: "2026-06-30T00:00:00.000Z",
    files: [
      {
        path: "notes/a.md",
        hash: "abc123",
        text: "Hello world",
        headings: ["Intro"],
        tags: ["rust"],
        links: [{ target: "notes/b.md", broken: false }],
      },
    ],
    linkGraph: {
      forward: { "notes/a.md": ["notes/b.md"] },
      backlinks: { "notes/b.md": ["notes/a.md"] },
    },
    tagMap: { rust: ["notes/a.md"] },
  };

  const sampleConfig: Config = {
    version: 1,
    createdAt: "2026-06-30T00:00:00.000Z",
    vaultPath: "/vault/path",
  };

  it("writeIndex + readIndex round-trip — deep equal", async () => {
    const vaultPath = makeTmpVault();
    await writeIndex(vaultPath, sampleIndex);
    const result = await readIndex(vaultPath);
    expect(result).toEqual(sampleIndex);
  });

  it("writeConfig + readConfig round-trip — deep equal", async () => {
    const vaultPath = makeTmpVault();
    await writeConfig(vaultPath, sampleConfig);
    const result = await readConfig(vaultPath);
    expect(result).toEqual(sampleConfig);
  });

  it("readIndex on missing file — returns null", async () => {
    const vaultPath = makeTmpVault();
    // no .oxori/ dir created
    const result = await readIndex(vaultPath);
    expect(result).toBeNull();
  });

  it("readConfig on missing file — returns null", async () => {
    const vaultPath = makeTmpVault();
    const result = await readConfig(vaultPath);
    expect(result).toBeNull();
  });

  it("readIndex on malformed JSON — throws descriptive error", async () => {
    const vaultPath = makeTmpVault();
    const oxoriDir = join(vaultPath, ".oxori");
    await mkdir(oxoriDir, { recursive: true });
    await writeFile(join(oxoriDir, "index.json"), "this is not json", "utf-8");

    await expect(readIndex(vaultPath)).rejects.toThrow(/Failed to read index\.json/);
  });
});
