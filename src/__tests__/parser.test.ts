import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseFile } from "../engine/parser.js";

describe("parseFile", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  async function writeTmp(content: string): Promise<string> {
    tmpDir = join(tmpdir(), `oxori-test-${randomUUID()}`);
    await mkdir(tmpDir, { recursive: true });
    const filePath = join(tmpDir, "test.md");
    await writeFile(filePath, content, "utf-8");
    return filePath;
  }

  it("plain markdown — extracts headings and body text separately", async () => {
    const filePath = await writeTmp(
      "# My Heading\n\nSome body text here.\n\n## Sub Heading\n\nMore content.",
    );
    const result = await parseFile(filePath);

    expect(result.headings).toContain("My Heading");
    expect(result.headings).toContain("Sub Heading");
    expect(result.text).toContain("Some body text here.");
    expect(result.text).toContain("More content.");
    // headings must not bleed into text
    expect(result.text).not.toContain("My Heading");
    expect(result.text).not.toContain("Sub Heading");
  });

  it("[[target]] wikilink — extracted with broken: false", async () => {
    const filePath = await writeTmp("See [[note-a]] for details.");
    const result = await parseFile(filePath);

    expect(result.links).toContainEqual({ target: "note-a", broken: false });
  });

  it("[[target|alias]] link — target extracted, alias not in target field", async () => {
    const filePath = await writeTmp("See [[note-a|My Note]] for details.");
    const result = await parseFile(filePath);

    expect(result.links).toContainEqual({ target: "note-a", broken: false });
    const targets = result.links.map((l) => l.target);
    expect(targets).not.toContain("My Note");
    expect(targets).not.toContain("note-a|My Note");
  });

  it("#tag and #nested/tag — both extracted", async () => {
    const filePath = await writeTmp("This has #rust and also #nested/tag in the body.");
    const result = await parseFile(filePath);

    expect(result.tags).toContain("rust");
    expect(result.tags).toContain("nested/tag");
  });

  it("#tag inside fenced code block — NOT extracted", async () => {
    const filePath = await writeTmp("Normal text.\n\n```\n#notATag\n```\n\nEnd.");
    const result = await parseFile(filePath);

    expect(result.tags).not.toContain("notATag");
  });

  it("# heading marker — NOT a tag, but appears in headings[]", async () => {
    const filePath = await writeTmp("# My Heading\n\nBody text.");
    const result = await parseFile(filePath);

    expect(result.headings).toContain("My Heading");
    expect(result.tags).not.toContain("My");
    expect(result.tags).not.toContain("My Heading");
  });
});
