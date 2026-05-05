#!/usr/bin/env bun

import { CLI } from "@/lib/cli";

import { TUI } from "@/tui";

const cli = await CLI.run();

if (cli === "TUI") {
  await TUI.run().catch((error) => {
    console.error("Error running TUI:", error);
    process.exit(1);
  });
}
