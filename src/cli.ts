/**
 * @file cli.ts
 * @description Oxori CLI entry point.
 *
 * Provides `oxori init <vaultPath>` and `oxori index <vaultPath>` commands.
 * The shebang line is injected by tsup's banner config — do NOT add it here.
 */

import { Command } from "commander";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { indexVault } from "./indexer.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const program = new Command();

program
  .name("oxori")
  .description("Make your markdown vault queryable")
  .version(pkg.version);

program
  .command("init <vaultPath>")
  .description("Initialize an Oxori vault")
  .action(async (vaultPath: string) => {
    const absPath = resolve(vaultPath);
    const indexDir = `${absPath}/.oxori/index`;

    try {
      await mkdir(indexDir, { recursive: true });
      console.log(`✓ Initialized Oxori vault at ${absPath}`);
    } catch (e: unknown) {
      const code =
        typeof e === "object" && e !== null && "code" in e
          ? (e as { code: unknown }).code
          : undefined;

      if (code === "EEXIST") {
        console.log(`✓ Initialized Oxori vault at ${absPath}`);
        return;
      }

      const message =
        typeof e === "object" && e !== null && "message" in e
          ? String((e as { message: unknown }).message)
          : String(e);

      console.log(`✗ ${message}`);
      process.exit(1);
    }
  });

program
  .command("index <vaultPath>")
  .description("Index all markdown files in the vault")
  .action(async (vaultPath: string) => {
    const absPath = resolve(vaultPath);
    const start = Date.now();

    const result = await indexVault({ vaultPath: absPath });

    if (!result.ok) {
      console.log(`✗ ${result.error.message}`);
      process.exit(1);
    }

    const elapsed = Date.now() - start;
    console.log(`✓ Indexed ${result.value.totalFiles} files in ${elapsed}ms`);
  });

await program.parseAsync(process.argv);
