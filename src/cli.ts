/**
 * @file cli.ts
 * @description Oxori CLI entry point.
 *
 * Provides `oxori init <vaultPath>` and `oxori index <vaultPath>` commands.
 * The shebang line is injected by tsup's banner config — do NOT add it here.
 */

import { Command } from "commander";
import { mkdir } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { createRequire } from "node:module";
import { indexVault } from "./indexer.js";
import { tokenize, parse, evaluate } from "./query.js";
import { walk } from "./graph.js";
import type {
  OxoriError,
  Edge,
  WalkOptions,
  WalkDirection,
  WalkVia,
} from "./types.js";

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

program
  .command("query <queryString>")
  .description("Query vault files using the Oxori query language")
  .option("--vault <path>", "vault root path", process.cwd())
  .option("--json", "output as JSON")
  .action(async (queryString: string, options: { vault: string; json?: boolean }) => {
    const vaultPath = resolve(options.vault);

    const indexResult = await indexVault({ vaultPath });
    if (!indexResult.ok) {
      process.stderr.write(`✗ ${indexResult.error.message}\n`);
      process.exit(1);
    }

    const state = indexResult.value;
    let queryResult;

    try {
      const tokens = tokenize(queryString);
      const ast = parse(tokens);
      queryResult = evaluate(ast, state);
    } catch (e: unknown) {
      const isOxoriErr =
        typeof e === "object" &&
        e !== null &&
        "code" in e &&
        "message" in e;
      if (isOxoriErr) {
        const oxoriErr = e as OxoriError;
        process.stderr.write(`✗ ${oxoriErr.message}\n`);
        if (oxoriErr.action !== undefined) {
          process.stderr.write(`→ ${oxoriErr.action}\n`);
        }
      } else {
        process.stderr.write(`✗ ${String(e)}\n`);
      }
      process.exit(1);
    }

    const files = [...queryResult.matches]
      .map((absPath) => relative(vaultPath, absPath))
      .sort();

    if (files.length === 0) {
      console.log("No files matched.");
      process.exit(0);
    }

    if (options.json === true) {
      console.log(
        JSON.stringify({ files, totalCount: queryResult.totalMatched }, null, 2),
      );
    } else {
      for (const f of files) {
        console.log(f);
      }
    }
  });

program
  .command("walk <startPath>")
  .description("Walk the vault link graph from a starting file")
  .option("--vault <path>", "vault root path", process.cwd())
  .option(
    "--direction <direction>",
    "walk direction: forward (outgoing), backward (incoming), or both",
    "outgoing",
  )
  .option(
    "--via <via>",
    "edge kinds to follow: links, tags, both, or relation:<key>",
    "both",
  )
  .option("--depth <n>", "maximum hop depth")
  .option("--json", "output as JSON")
  .action(
    async (
      startPath: string,
      options: {
        vault: string;
        direction?: string;
        via?: string;
        depth?: string;
        json?: boolean;
      },
    ) => {
      const vaultPath = resolve(options.vault);

      const indexResult = await indexVault({ vaultPath });
      if (!indexResult.ok) {
        process.stderr.write(`✗ ${indexResult.error.message}\n`);
        process.exit(1);
      }

      const state = indexResult.value;
      const absStart = resolve(vaultPath, startPath);

      if (!state.files.has(absStart)) {
        process.stderr.write(`✗ File not found in index: ${startPath}\n`);
        process.exit(1);
      }

      // Map CLI direction aliases to WalkDirection values
      const rawDir = options.direction ?? "outgoing";
      const direction: WalkDirection =
        rawDir === "forward"
          ? "outgoing"
          : rawDir === "backward"
            ? "incoming"
            : (rawDir as WalkDirection);

      const walkOpts: WalkOptions = {
        direction,
        via: (options.via ?? "both") as WalkVia,
      };

      if (options.depth !== undefined) {
        const d = parseInt(options.depth, 10);
        if (!isNaN(d)) walkOpts.depth = d;
      }

      const result = walk(absStart, state, walkOpts);

      const visited = [...result.visitOrder]
        .map((absPath) => relative(vaultPath, absPath))
        .sort();

      if (options.json === true) {
        const edges = [...result.edges].map((e) => ({
          from: relative(vaultPath, e.source),
          to: relative(vaultPath, e.target),
          kind: e.kind,
        }));
        console.log(
          JSON.stringify({ visited, edges, totalCount: visited.length }, null, 2),
        );
      } else {
        for (const v of visited) {
          console.log(v);
        }
      }
    },
  );

program
  .command("graph")
  .description("Dump the full link graph of the vault")
  .option("--vault <path>", "vault root path", process.cwd())
  .option("--json", "output as JSON")
  .action(async (options: { vault: string; json?: boolean }) => {
    const vaultPath = resolve(options.vault);

    const indexResult = await indexVault({ vaultPath });
    if (!indexResult.ok) {
      process.stderr.write(`✗ ${indexResult.error.message}\n`);
      process.exit(1);
    }

    const state = indexResult.value;

    // Collect all wikilink edges by iterating every file's outbound links
    const edges: Edge[] = [];
    const nodeSet = new Set<string>();

    for (const [absPath, entry] of state.files) {
      nodeSet.add(absPath);
      for (const stem of entry.wikilinks) {
        // Resolve stem to absolute path via filename matching
        for (const candidate of state.files.values()) {
          if (candidate.filename.toLowerCase() === stem.toLowerCase()) {
            edges.push({ source: absPath, target: candidate.filepath, kind: "wikilink" });
            break;
          }
        }
      }
    }

    if (options.json === true) {
      const nodes = [...nodeSet].map((p) => relative(vaultPath, p)).sort();
      const jsonEdges = edges.map((e) => ({
        source: relative(vaultPath, e.source),
        target: relative(vaultPath, e.target),
        kind: e.kind,
        ...(e.relationType !== undefined ? { relationType: e.relationType } : {}),
      }));
      console.log(JSON.stringify({ nodes, edges: jsonEdges }, null, 2));
    } else {
      for (const e of edges) {
        const src = relative(vaultPath, e.source);
        const tgt = relative(vaultPath, e.target);
        console.log(`${src} → ${tgt} (${e.kind})`);
      }
    }
  });

await program.parseAsync(process.argv);
