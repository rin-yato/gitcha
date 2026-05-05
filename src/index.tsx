#!/usr/bin/env bun

import { createCliRenderer } from "@opentui/core";
import { render } from "@opentui/solid";

import { CLI } from "@/lib/cli";
import { copyToClipboard } from "@/lib/clipboard";

import { TUI } from "@/tui";

const cli = await CLI.run();

// Exit if the CLI handled the command
if (cli === "HANDLED") process.exit(0);

const renderer = await createCliRenderer({
  targetFps: 60,
  consoleOptions: {
    onCopySelection: (text) => {
      copyToClipboard(text, renderer.copyToClipboardOSC52);
    },
    keyBindings: [{ action: "copy-selection", name: "y" }],
  },
});

renderer.keyInput.on("keypress", (key) => {
  if (key.name === "`") {
    renderer.console.toggle();
  }
});

render(TUI, renderer);
