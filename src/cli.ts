import { program } from "commander";

program
  .name("oxori")
  .description(
    "Agents read and write markdown knowledge bases — and find the right piece without scanning everything.",
  )
  .version("0.1.0");

program.parse();
