#!/usr/bin/env node
import { resolve } from "node:path";
import { program } from "commander";
import { indexCommand } from "./commands/index.js";
import { initCommand } from "./commands/init.js";
import { searchCommand } from "./commands/search.js";
import type { SearchOptions } from "./types.js";

program
  .name("oxori")
  .description(
    "Agents read and write markdown knowledge bases — and find the right piece without scanning everything.",
  )
  .version("0.1.0");

// oxori init [path]
program
  .command("init [path]")
  .description("Initialize a vault and build the first index")
  .action(async (path?: string) => {
    const vaultPath = resolve(path ?? process.cwd());
    try {
      await initCommand(vaultPath);
      console.log(`✓ Vault initialized at ${vaultPath}`);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// oxori index [path]
program
  .command("index [path]")
  .description("Update the index with changes to the vault")
  .action(async (path?: string) => {
    const vaultPath = resolve(path ?? process.cwd());
    try {
      await indexCommand(vaultPath);
      console.log(`✓ Index updated at ${vaultPath}`);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// oxori search [query] [path]
program
  .command("search [query] [path]")
  .description("Search the vault index")
  .option("--json", "Output results as JSON")
  .option("--tag <tag>", "Filter by tag (e.g. --tag rust or --tag '#rust')")
  .option("--link <note>", "Show structural links for a note path")
  .action(
    async (
      query: string | undefined,
      path: string | undefined,
      opts: { json?: boolean; tag?: string; link?: string },
    ) => {
      const vaultPath = resolve(path ?? process.cwd());

      const searchOpts: SearchOptions = opts.link
        ? { mode: "structural", structuralTarget: opts.link }
        : opts.tag
          ? { mode: "tag", tagTarget: opts.tag }
          : { mode: "text" };

      // Validate: text mode requires a query
      if (searchOpts.mode === "text" && !query) {
        const msg = "Error: query required for text search. Use --tag or --link for other modes.";
        if (opts.json) {
          console.error(JSON.stringify({ error: msg }));
        } else {
          console.error(msg);
        }
        process.exit(1);
      }

      try {
        const results = await searchCommand(vaultPath, query ?? "", searchOpts);

        if (opts.json) {
          // T6.3 — JSON output
          console.log(JSON.stringify(results, null, 2));
        } else {
          // T6.2 — Human-readable output
          if (results.length === 0) {
            console.log("No matches found.");
          } else if (searchOpts.mode === "structural") {
            // Structural: show links and backlinks in separate sections (Obsidian-style)
            const target = opts.link ?? query ?? "";
            const links = results.filter((r) => r.direction === "link");
            const backlinks = results.filter((r) => r.direction === "backlink");

            console.log(`\n🔗 Links from "${target}" (${links.length})`);
            if (links.length === 0) {
              console.log("   (none)");
            } else {
              for (const r of links) console.log(`   📄 ${r.path}`);
            }

            console.log(`\n⬅️  Backlinks to "${target}" (${backlinks.length})`);
            if (backlinks.length === 0) {
              console.log("   (none)");
            } else {
              for (const r of backlinks) console.log(`   📄 ${r.path}`);
            }
          } else {
            for (const result of results) {
              console.log(`\n📄 ${result.path}`);
              if (result.headings.length > 0) {
                console.log(`   Headings: ${result.headings.join(" › ")}`);
              }
              if (result.snippet) {
                console.log(`   ${result.snippet}`);
              }
              console.log("─".repeat(60));
            }
          }
        }
      } catch (err) {
        if (opts.json) {
          console.error(JSON.stringify({ error: (err as Error).message }));
        } else {
          console.error(`Error: ${(err as Error).message}`);
        }
        process.exit(1);
      }
    },
  );

program.parse();
